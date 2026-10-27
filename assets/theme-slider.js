/*
  Shared Swiper carousel for sections and blocks.
  Loaded once in layout/theme.liquid, after swiper-bundle.min.js
*/


(function () {
  if (window.vtSlider) return;

  const desktop = window.matchMedia('(min-width: 990px)');

  const updateArrowState = (swiper, prevBtn, nextBtn) => {
    if (!prevBtn || !nextBtn) return;
    // When watchOverflow is true and not enough slides, Swiper locks
    const locked = swiper.isLocked;
    const atStart = locked || swiper.isBeginning;
    const atEnd = locked || swiper.isEnd;

    prevBtn.setAttribute('aria-disabled', atStart ? 'true' : 'false');
    nextBtn.setAttribute('aria-disabled', atEnd ? 'true' : 'false');
    prevBtn.disabled = atStart;
    nextBtn.disabled = atEnd;
  };

  const init = (container) => {
    if (!container) return null;
    if (container.dataset.swiperReady === 'true') return container._swiperInstance || null;
    if (typeof Swiper === 'undefined') return null;

    const data = container.dataset;
    const slidesDesktop = parseFloat(data.slidesDesktop) || 4;
    const slidesTablet = (parseFloat(data.slidesTablet) || 3) + (parseFloat(data.peekTablet) || 0);
    const slidesMobile = (parseFloat(data.slidesMobile) || 2) + (parseFloat(data.peekMobile) || 0);
    const desktopDrag = data.desktopDrag !== 'false';
    const loop = data.loop === 'true';
    const autoplay = data.autoplay === 'true';
    const autoplayDelay = parseInt(data.autoplayDelay, 10) || 4000;

    // Gap is a CSS length (often a fluid clamp()); Swiper needs px, so read
    // the resolved value and refresh it on every resize
    const getGap = () => parseFloat(getComputedStyle(container).columnGap) || 0;

    // Offset (desktop): every stop sits a % of the carousel width from the left edge
    const offsetPercent = data.slideStyle === 'offset' ? parseFloat(data.slideOffset) || 0 : 0;
    const getOffset = () => (desktop.matches ? (container.clientWidth * offsetPercent) / 100 : 0);

    // Below desktop: when CSS bleeds the carousel past the side margins (negative
    // margins), start and end on those margins so the first and last slides line up
    const getBleed = (side) =>
      Math.max(0, -parseFloat(getComputedStyle(container).getPropertyValue(`margin-inline-${side}`)) || 0);
    const getOffsetBefore = () => (desktop.matches ? getOffset() : getBleed('start'));
    const getOffsetAfter = () => (desktop.matches ? getOffset() : getBleed('end'));

    // Arrows follow the same offset (CSS reads --vt-swiper-offset)
    const setArrowOffset = () => container.style.setProperty('--vt-swiper-offset', `${getOffset()}px`);

    const prevBtn = container.querySelector('[data-swiper-prev]');
    const nextBtn = container.querySelector('[data-swiper-next]');

    const swiper = new Swiper(container, {
      slidesPerView: slidesMobile,
      spaceBetween: getGap(),
      watchOverflow: true,
      slidesOffsetBefore: getOffsetBefore(),
      slidesOffsetAfter: getOffsetAfter(),
      loop: loop && container.querySelectorAll('.swiper-slide').length > slidesDesktop,
      autoplay: autoplay ? { delay: autoplayDelay, disableOnInteraction: false, pauseOnMouseEnter: true } : false,
      navigation: {
        prevEl: prevBtn,
        nextEl: nextBtn,
        disabledClass: 'is-disabled',
      },
      allowTouchMove: true,
      breakpoints: {
        750: { slidesPerView: slidesTablet, allowTouchMove: true },
        990: { slidesPerView: slidesDesktop, allowTouchMove: desktopDrag },
      },
      // Translated labels from Liquid (Swiper's a11y would otherwise set English ones)
      a11y: {
        prevSlideMessage: prevBtn?.getAttribute('aria-label') || '',
        nextSlideMessage: nextBtn?.getAttribute('aria-label') || '',
      },
      on: {
        beforeResize(s) {
          s.params.spaceBetween = getGap();
          s.params.slidesOffsetBefore = getOffsetBefore();
          s.params.slidesOffsetAfter = getOffsetAfter();
        },
        init(s) {
          setArrowOffset();
          updateArrowState(s, prevBtn, nextBtn);
        },
        slideChange(s) {
          updateArrowState(s, prevBtn, nextBtn);
        },
        resize(s) {
          setArrowOffset();
          updateArrowState(s, prevBtn, nextBtn);
        },
      },
    });

    container.dataset.swiperReady = 'true';
    container._swiperInstance = swiper;
    return swiper;
  };

  const destroy = (container) => {
    if (!container?._swiperInstance) return;
    container._swiperInstance.destroy(true, true);
    container._swiperInstance = null;
    container.dataset.swiperReady = 'false';
  };

  const initAuto = (root = document) => {
    root.querySelectorAll('[data-swiper][data-swiper-auto]').forEach(init);
  };

  window.vtSlider = { init, destroy };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAuto());
  } else {
    initAuto();
  }

  document.addEventListener('shopify:section:load', (event) => initAuto(event.target));
})();
