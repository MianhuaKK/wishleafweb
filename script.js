(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if ('IntersectionObserver' in window && !reducedMotion) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.closest('.chapter').classList.add('visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.18 });
    document.querySelectorAll('.chapter .visual').forEach(visual => observer.observe(visual));
    document.documentElement.classList.add('motion-ready');
  }

  const carousel = document.querySelector('.begin-visual');
  if (!carousel) return;
  const slides = [...carousel.querySelectorAll('.begin-slide')];
  const buttons = [...carousel.querySelectorAll('.begin-slide-indicator button')];
  let current = 0;
  let timer = null;
  let inView = !('IntersectionObserver' in window);

  const showSlide = index => {
    current = index;
    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === index;
      slide.classList.toggle('active', active);
      slide.setAttribute('aria-hidden', String(!active));
      buttons[slideIndex].setAttribute('aria-current', String(active));
    });
  };

  const stop = () => {
    if (timer) window.clearInterval(timer);
    timer = null;
  };

  const start = () => {
    stop();
    if (reducedMotion || !inView || document.hidden) return;
    timer = window.setInterval(() => showSlide((current + 1) % slides.length), 5000);
  };

  buttons.forEach((button, index) => {
    button.addEventListener('click', () => {
      if (index === current) {
        slides[index].classList.remove('active');
        void slides[index].offsetWidth;
      }
      showSlide(index);
      start();
    });
  });

  if ('IntersectionObserver' in window) {
    const visibilityObserver = new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      if (inView) start();
      else stop();
    }, { threshold: 0.18 });
    visibilityObserver.observe(carousel);
  } else {
    start();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });
})();
