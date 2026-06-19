/* ==========================================================================
   Kartezya Core JS Interactions
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    
    // ----------------------------------------------------------------------
    // 1. Header Scroll Effect
    // ----------------------------------------------------------------------
    const header = document.querySelector('.header');
    const checkScroll = () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    };
    window.addEventListener('scroll', checkScroll);
    checkScroll(); // Initial check

    // ----------------------------------------------------------------------
    // 2. Mobile Navigation Toggle
    // ----------------------------------------------------------------------
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const mobileNav = document.querySelector('.mobile-nav');
    const mobileNavClose = document.querySelector('.mobile-nav-close');
    const overlay = document.querySelector('.mobile-nav-overlay');
    const mobileLinks = document.querySelectorAll('.mobile-nav-links a');

    const openMenu = () => {
        mobileNav.classList.add('open');
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    };

    const closeMenu = () => {
        mobileNav.classList.remove('open');
        overlay.classList.remove('open');
        document.body.style.overflow = '';
    };

    if (menuToggle) menuToggle.addEventListener('click', openMenu);
    if (mobileNavClose) mobileNavClose.addEventListener('click', closeMenu);
    if (overlay) overlay.addEventListener('click', closeMenu);
    
    mobileLinks.forEach(link => {
        link.addEventListener('click', closeMenu);
    });

    // ----------------------------------------------------------------------
    // 3. Homepage Hero Slider
    // ----------------------------------------------------------------------
    const slides = document.querySelectorAll('.slide');
    const dotsContainer = document.querySelector('.slider-dots');
    const prevBtn = document.querySelector('.slider-arrow.prev');
    const nextBtn = document.querySelector('.slider-arrow.next');
    
    if (slides.length > 0) {
        let currentSlide = 0;
        let slideInterval;
        const intervalTime = 6000;

        // Generate dots dynamically
        slides.forEach((_, idx) => {
            const dot = document.createElement('div');
            dot.classList.add('slider-dot');
            if (idx === 0) dot.classList.add('active');
            dot.addEventListener('click', () => goToSlide(idx));
            if (dotsContainer) dotsContainer.appendChild(dot);
        });

        const dots = document.querySelectorAll('.slider-dot');

        const updateDots = () => {
            dots.forEach((dot, idx) => {
                if (idx === currentSlide) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            });
        };

        const showSlide = (n) => {
            slides.forEach(slide => slide.classList.remove('active'));
            slides[n].classList.add('active');
            currentSlide = n;
            updateDots();
        };

        const nextSlide = () => {
            let next = (currentSlide + 1) % slides.length;
            showSlide(next);
        };

        const prevSlide = () => {
            let prev = (currentSlide - 1 + slides.length) % slides.length;
            showSlide(prev);
        };

        const goToSlide = (n) => {
            showSlide(n);
            resetTimer();
        };

        const startTimer = () => {
            slideInterval = setInterval(nextSlide, intervalTime);
        };

        const resetTimer = () => {
            clearInterval(slideInterval);
            startTimer();
        };

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                nextSlide();
                resetTimer();
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                prevSlide();
                resetTimer();
            });
        }

        // Start autoplay
        startTimer();
    }

    // ----------------------------------------------------------------------
    // 4. Logo Slider Seamless Ticker Tweak
    // ----------------------------------------------------------------------
    const tickerTrack = document.querySelector('.ticker-track');
    if (tickerTrack) {
        // Duplicate the logo items to ensure there is no blank space during infinite scroll
        const items = Array.from(tickerTrack.children);
        items.forEach(item => {
            const clone = item.cloneNode(true);
            tickerTrack.appendChild(clone);
        });
    }

    // ----------------------------------------------------------------------
    // 5. FAQ Accordion Panels
    // ----------------------------------------------------------------------
    const faqHeaders = document.querySelectorAll('.faq-header');
    faqHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            const content = header.nextElementSibling;
            const isActive = item.classList.contains('active');
            
            // Close other items
            document.querySelectorAll('.faq-item').forEach(otherItem => {
                otherItem.classList.remove('active');
                otherItem.querySelector('.faq-content').style.maxHeight = null;
            });

            if (!isActive) {
                item.classList.add('active');
                content.style.maxHeight = content.scrollHeight + 'px';
            }
        });
    });

    // ----------------------------------------------------------------------
    // 6. Statistics Counter Animation
    // ----------------------------------------------------------------------
    const statsNums = document.querySelectorAll('.counter-val');
    
    if (statsNums.length > 0) {
        const animateCounter = (el) => {
            const target = parseInt(el.getAttribute('data-target'), 10);
            const duration = 2000; // Animation duration in ms
            const stepTime = 30; // Time interval in ms
            const totalSteps = duration / stepTime;
            const increment = target / totalSteps;
            let current = 0;
            let step = 0;

            const timer = setInterval(() => {
                current += increment;
                step++;
                if (step >= totalSteps) {
                    el.textContent = target + (el.getAttribute('data-suffix') || '');
                    clearInterval(timer);
                } else {
                    el.textContent = Math.floor(current) + (el.getAttribute('data-suffix') || '');
                }
            }, stepTime);
        };

        const counterObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    observer.unobserve(entry.target); // Animate only once
                }
            });
        }, { threshold: 0.5 });

        statsNums.forEach(num => counterObserver.observe(num));
    }

    // ----------------------------------------------------------------------
    // 7. Skill Progress Bars Animation
    // ----------------------------------------------------------------------
    const skillFills = document.querySelectorAll('.skill-fill');
    if (skillFills.length > 0) {
        const skillObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const fill = entry.target;
                    const percent = fill.getAttribute('data-percent');
                    fill.style.width = percent + '%';
                    observer.unobserve(fill);
                }
            });
        }, { threshold: 0.5 });

        skillFills.forEach(fill => skillObserver.observe(fill));
    }

    // ----------------------------------------------------------------------
    // 8. Contact Form Handling & Simulation
    // ----------------------------------------------------------------------
    const contactForm = document.getElementById('contactForm');
    const formStatus = document.getElementById('formStatus');

    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Clear status
            formStatus.className = 'form-status';
            formStatus.textContent = '';
            
            // Get values
            const firstName = document.getElementById('first-name').value.trim();
            const lastName = document.getElementById('last-name').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const email = document.getElementById('email').value.trim();
            const message = document.getElementById('message').value.trim();
            
            // Simple validation
            if (!firstName || !lastName || !phone || !email || !message) {
                formStatus.className = 'form-status error';
                formStatus.textContent = 'Please fill in all required fields.';
                return;
            }

            // Simulate sending API request
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;

            setTimeout(() => {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                
                formStatus.className = 'form-status success';
                formStatus.textContent = 'Your message has been sent successfully! We will get in touch with you shortly.';
                
                contactForm.reset();
            }, 1500);
        });
    }
});
