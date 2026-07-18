package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"time"
)

// ──────────────────────────────────────────────
// Sabitler
// ──────────────────────────────────────────────

const (
	maxBodyBytes   = 4 << 10 // 4 KB – istek gövdesi üst sınırı
	telegramAPIURL = "https://api.telegram.org/bot"
	serverPort     = ":8080"
)

// ──────────────────────────────────────────────
// Bellek havuzu – her istek için sıfır alloc
// ──────────────────────────────────────────────

var bufPool = sync.Pool{
	New: func() any { return new(bytes.Buffer) },
}

// ──────────────────────────────────────────────
// Telegram istemcisi – tek, yeniden kullanılan bağlantı
// ──────────────────────────────────────────────

var telegramClient = &http.Client{
	Timeout: 8 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:    1,
		IdleConnTimeout: 60 * time.Second,
		// DNS önbelleği Telegram için yeterli
		DisableCompression: false,
	},
}

// ──────────────────────────────────────────────
// İstek / yanıt tipleri
// ──────────────────────────────────────────────

type contactReq struct {
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Phone     string `json:"phone"`
	Email     string `json:"email"`
	Message   string `json:"message"`
}

// ──────────────────────────────────────────────
// main
// ──────────────────────────────────────────────

func main() {
	// Çekirdek sayısını 1'e sabitle – küçük sunucularda GC baskısını düşürür.
	// Birden fazla çekirdeğiniz ve yüksek trafiğiniz varsa bu satırı silin.
	runtime.GOMAXPROCS(1)

	port := os.Getenv("PORT")
	if port == "" {
		port = serverPort
	} else {
		port = ":" + port
	}

	mux := http.NewServeMux()

	// --- Statik dosya sunucusu ---
	fs := http.FileServer(http.Dir("./static"))
	mux.Handle("/", fs)

	// --- API: iletişim formu ---
	mux.HandleFunc("/api/contact", handleContact)

	srv := &http.Server{
		Addr:    port,
		Handler: mux,

		// Saldırı / yavaş istemciye karşı zaman aşımları
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,

		// Her bağlantı için ~4 KB yığın yerine varsayılanı kullan
		// (net/http zaten verimli)
	}

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("Sunucu başladı → http://localhost%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Sunucu hatası: %v", err)
		}
	}()

	<-quit
	log.Println("Kapatılıyor...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Zorla kapatma: %v", err)
	}
	log.Println("Sunucu temiz kapandı.")
}

// ──────────────────────────────────────────────
// /api/contact handler
// ──────────────────────────────────────────────

func handleContact(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Gövdeyi sınırla – büyük yükleri reddet
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)

	var req contactReq
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		jsonError(w, "Geçersiz istek gövdesi", http.StatusBadRequest)
		return
	}

	if req.FirstName == "" || req.LastName == "" ||
		req.Phone == "" || req.Email == "" || req.Message == "" {
		jsonError(w, "Tüm alanlar zorunludur", http.StatusBadRequest)
		return
	}

	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	chatID := os.Getenv("TELEGRAM_CHAT_ID")
	if token == "" || chatID == "" {
		log.Println("UYARI: Telegram ortam değişkenleri tanımlı değil")
		jsonError(w, "Telegram entegrasyonu yapılandırılmamış", http.StatusInternalServerError)
		return
	}

	msg := buildMessage(req)
	if err := sendTelegram(token, chatID, msg); err != nil {
		log.Printf("Telegram gönderim hatası: %v", err)
		jsonError(w, "Mesaj gönderilemedi", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	io.WriteString(w, `{"status":"success","message":"Mesaj başarıyla gönderildi"}`)
}

// ──────────────────────────────────────────────
// Yardımcı: Telegram mesajı oluştur (sıfır fmt alloc)
// ──────────────────────────────────────────────

func buildMessage(req contactReq) string {
	var sb strings.Builder
	sb.Grow(256) // tipik mesaj boyutu için ön-ayır
	sb.WriteString("📩 *Yeni İletişim Formu*\n\n")
	sb.WriteString("*Ad Soyad:* ")
	sb.WriteString(req.FirstName)
	sb.WriteByte(' ')
	sb.WriteString(req.LastName)
	sb.WriteString("\n*Telefon:* ")
	sb.WriteString(req.Phone)
	sb.WriteString("\n*E-posta:* ")
	sb.WriteString(req.Email)
	sb.WriteString("\n\n*Mesaj:*\n")
	sb.WriteString(req.Message)
	return sb.String()
}

// ──────────────────────────────────────────────
// Yardımcı: Telegram API çağrısı (havuzdan buffer)
// ──────────────────────────────────────────────

func sendTelegram(token, chatID, text string) error {
	buf := bufPool.Get().(*bytes.Buffer)
	buf.Reset()
	defer bufPool.Put(buf)

	payload := struct {
		ChatID    string `json:"chat_id"`
		Text      string `json:"text"`
		ParseMode string `json:"parse_mode"`
	}{chatID, text, "Markdown"}

	if err := json.NewEncoder(buf).Encode(payload); err != nil {
		return err
	}

	resp, err := telegramClient.Post(
		telegramAPIURL+token+"/sendMessage",
		"application/json",
		bytes.NewReader(buf.Bytes()),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body) // bağlantıyı serbest bırak

	if resp.StatusCode != http.StatusOK {
		return &telegramErr{resp.StatusCode}
	}
	return nil
}

// ──────────────────────────────────────────────
// Yardımcı: JSON hata yanıtı
// ──────────────────────────────────────────────

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	io.WriteString(w, `{"error":"`+msg+`"}`)
}

// ──────────────────────────────────────────────
// Özel hata tipi (fmt bağımlılığını kaldırır)
// ──────────────────────────────────────────────

type telegramErr struct{ code int }

func (e *telegramErr) Error() string {
	var sb strings.Builder
	sb.WriteString("telegram API HTTP ")
	// itoa yerine elle dönüştür – sıfır alloc
	writeInt(&sb, e.code)
	return sb.String()
}

func writeInt(sb *strings.Builder, n int) {
	if n == 0 {
		sb.WriteByte('0')
		return
	}
	var buf [10]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	sb.Write(buf[i:])
}
