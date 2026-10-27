/**
 * Earth Theme - Slider Navigation & Carousel Controller
 * Inspired by Shopify Horizon architecture
 * 
 * Defines:
 * 1. <earth-slider-nav>: Custom Element for circular slider navigation controls (Prev/Next)
 * 2. window.VtCarousel: Centralized Carousel / Swiper lifecycle manager
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. Centralized Carousel Helper (window.VtCarousel)
  // =========================================================================
  if (!window.VtCarousel) {
    window.VtCarousel = {
      instances: new WeakMap(),

      /**
       * Waits safely for window.Swiper to become available
       * @param {Function} callback 
       * @param {number} maxWait 
       */
      waitForSwiper(callback, maxWait = 4000) {
        if (typeof window.Swiper !== 'undefined') {
          callback();
          return;
        }

        const start = Date.now();
        const interval = setInterval(() => {
          if (typeof window.Swiper !== 'undefined') {
            clearInterval(interval);
            callback();
          } else if (Date.now() - start > maxWait) {
            clearInterval(interval);
            console.warn('[VtCarousel] Swiper library failed to load within timeout.');
          }
        }, 50);
      },

      /**
       * Initialize Swiper on a track element
       * @param {HTMLElement} track
       * @param {Object} options
       * @returns {Promise<any>}
       */
      init(track, options = {}) {
        return new Promise((resolve) => {
          if (!track) return resolve(null);

          // If already initialized on this track, update and return
          if (this.instances.has(track)) {
            const existing = this.instances.get(track);
            existing.update();
            this.notifyNav(track);
            return resolve(existing);
          }

          this.waitForSwiper(() => {
            if (typeof window.Swiper === 'undefined') return resolve(null);

            const gapDesktop = options.gapDesktop !== undefined ? options.gapDesktop : 32;
            const gapMobile = options.gapMobile !== undefined ? options.gapMobile : 16;
            const swipeMobile = options.swipeMobile !== false;
            const slidesPerViewDesktop = options.slidesPerViewDesktop || 'auto';

            const defaultSwiperConfig = {
              slidesPerView: swipeMobile ? 'auto' : 1,
              spaceBetween: gapMobile,
              grabCursor: true,
              watchOverflow: true,
              observer: true,
              observeParents: true,
              threshold: 5,
              breakpoints: {
                769: {
                  slidesPerView: slidesPerViewDesktop,
                  spaceBetween: gapDesktop,
                  allowTouchMove: true
                }
              },
              on: {
                init: (swiper) => {
                  this.notifyNav(track);
                  if (typeof options.onInit === 'function') options.onInit(swiper);
                },
                slideChange: (swiper) => {
                  this.notifyNav(track);
                  if (typeof options.onSlideChange === 'function') options.onSlideChange(swiper);
                },
                update: (swiper) => {
                  this.notifyNav(track);
                  if (typeof options.onUpdate === 'function') options.onUpdate(swiper);
                },
                resize: (swiper) => {
                  this.notifyNav(track);
                  if (typeof options.onResize === 'function') options.onResize(swiper);
                }
              }
            };

            const mergedConfig = Object.assign({}, defaultSwiperConfig, options.swiperOptions || {});
            
            // Deep merge breakpoints if provided
            if (options.swiperOptions && options.swiperOptions.breakpoints) {
              mergedConfig.breakpoints = Object.assign(
                {},
                defaultSwiperConfig.breakpoints,
                options.swiperOptions.breakpoints
              );
            }

            try {
              const swiperInstance = new window.Swiper(track, mergedConfig);
              this.instances.set(track, swiperInstance);
              track.swiper = swiperInstance;
              resolve(swiperInstance);
            } catch (err) {
              console.error('[VtCarousel] Initialization error:', err);
              resolve(null);
            }
          });
        });
      },

      /**
       * Destroy Swiper on a track element
       * @param {HTMLElement} track
       */
      destroy(track) {
        if (!track) return;
        const swiper = this.instances.get(track) || track.swiper;
        if (swiper && typeof swiper.destroy === 'function') {
          swiper.destroy(true, true);
        }
        this.instances.delete(track);
        delete track.swiper;
      },

      /**
       * Update Swiper on a track element
       * @param {HTMLElement} track
       */
      update(track) {
        if (!track) return;
        const swiper = this.instances.get(track) || track.swiper;
        if (swiper && typeof swiper.update === 'function') {
          swiper.update();
        }
        this.notifyNav(track);
      },

      /**
       * Notify associated <earth-slider-nav> elements to update button states
       * @param {HTMLElement} track
       */
      notifyNav(track) {
        if (!track) return;
        const container = track.closest('.has-slider-nav') || track.parentElement;
        if (container) {
          const navs = container.querySelectorAll('earth-slider-nav');
          navs.forEach((nav) => {
            if (typeof nav.updateState === 'function') {
              nav.updateState();
            }
          });
        }
      }
    };
  }

  // =========================================================================
  // 2. Custom Element: <earth-slider-nav>
  // =========================================================================
  if (!customElements.get('earth-slider-nav')) {
    class EarthSliderNav extends HTMLElement {
      constructor() {
        super();
        this.prevBtn = null;
        this.nextBtn = null;
        this.track = null;
        this._ticking = false;
        this._swiperBound = false;
        this._boundSwiper = null;

        this._onScroll = this._onScroll.bind(this);
        this._onPrev = this._onPrev.bind(this);
        this._onNext = this._onNext.bind(this);
        this._onResize = this._onResize.bind(this);
      }

      connectedCallback() {
        this.prevBtn = this.querySelector('.earth-slider-nav__btn--prev');
        this.nextBtn = this.querySelector('.earth-slider-nav__btn--next');

        if (this.prevBtn) {
          this.prevBtn.removeEventListener('click', this._onPrev);
          this.prevBtn.addEventListener('click', this._onPrev);
        }
        if (this.nextBtn) {
          this.nextBtn.removeEventListener('click', this._onNext);
          this.nextBtn.addEventListener('click', this._onNext);
        }

        this._bindTrack();
      }

      disconnectedCallback() {
        if (this.track) {
          this.track.removeEventListener('scroll', this._onScroll);
        }
        window.removeEventListener('resize', this._onResize);
      }

      _bindTrack() {
        const targetId = this.getAttribute('data-target-id');
        if (targetId) {
          try {
            this.track = document.getElementById(targetId) || document.querySelector(targetId);
          } catch (e) {
            this.track = document.getElementById(targetId);
          }
        }

        // Fallback: search closest parent container
        if (!this.track) {
          const parent = this.closest('.has-slider-nav') || this.parentElement;
          if (parent) {
            this.track = parent.querySelector('[data-slider-track]') || 
                         parent.querySelector('.plt__track') || 
                         parent.querySelector('.vt-values-tabs__track') || 
                         parent.querySelector('.vt-carousel__track') ||
                         parent.querySelector('.swiper');
          }
        }

        if (this.track) {
          this.track.addEventListener('scroll', this._onScroll, { passive: true });
          window.addEventListener('resize', this._onResize, { passive: true });
          this._bindSwiperIfAvailable();
          
          // Initial check
          this.updateState();
          // Secondary check after web fonts, images, and layout stabilize
          window.setTimeout(() => this.updateState(), 100);
          window.setTimeout(() => this.updateState(), 400);
        }
      }

      _bindSwiperIfAvailable() {
        if (!this.track) return;
        const swiper = this.track.swiper || (window.VtCarousel && window.VtCarousel.instances.get(this.track));
        if (!swiper || this._boundSwiper === swiper) return;

        const updateFn = () => this.updateState();
        swiper.on('slideChange', updateFn);
        swiper.on('reachBeginning', updateFn);
        swiper.on('reachEnd', updateFn);
        swiper.on('fromEdge', updateFn);
        swiper.on('lock', updateFn);
        swiper.on('unlock', updateFn);
        swiper.on('update', updateFn);

        this._boundSwiper = swiper;
        this._swiperBound = true;
      }

      _onScroll() {
        if (!this._ticking) {
          window.requestAnimationFrame(() => {
            this.updateState();
            this._ticking = false;
          });
          this._ticking = true;
        }
      }

      _onResize() {
        this.updateState();
      }

      updateState() {
        if (!this.track) return;
        this._bindSwiperIfAvailable();

        const swiper = this.track.swiper || (window.VtCarousel && window.VtCarousel.instances.get(this.track));
        if (swiper) {
          if (swiper.isLocked || (swiper.slides && swiper.slides.length <= 1)) {
            this._setHidden(this.prevBtn, true);
            this._setHidden(this.nextBtn, true);
            return;
          }
          this._setHidden(this.prevBtn, swiper.isBeginning);
          this._setHidden(this.nextBtn, swiper.isEnd);
          return;
        }

        // Native scroll fallback
        const sl = this.track.scrollLeft;
        const sw = this.track.scrollWidth;
        const cw = this.track.clientWidth;

        // If not enough content to scroll, hide both
        if (sw <= cw + 2) {
          this._setHidden(this.prevBtn, true);
          this._setHidden(this.nextBtn, true);
          return;
        }

        // At beginning: hide Prev
        const atStart = sl <= 6;
        this._setHidden(this.prevBtn, atStart);

        // At end: hide Next
        const atEnd = Math.ceil(sl + cw) >= sw - 6;
        this._setHidden(this.nextBtn, atEnd);
      }

      _setHidden(btn, isHidden) {
        if (!btn) return;
        btn.disabled = isHidden;
        if (isHidden) {
          btn.setAttribute('data-hidden', 'true');
        } else {
          btn.removeAttribute('data-hidden');
        }
      }

      _getStep() {
        if (!this.track) return 300;
        // Try to get width of one child card/slide
        const firstCard = this.track.querySelector('.shopify-block, .product-card, .vt-product-card, .vt-value-card, .swiper-slide, [role="listitem"]') || 
                          this.track.firstElementChild;
        if (firstCard) {
          const computed = window.getComputedStyle(this.track);
          const gap = parseFloat(computed.columnGap || computed.gap || 0);
          const cardWidth = firstCard.getBoundingClientRect().width;
          if (cardWidth > 50) {
            return cardWidth + gap;
          }
        }
        return this.track.clientWidth * 0.8;
      }

      _onPrev() {
        if (!this.track) return;
        const swiper = this.track.swiper || (window.VtCarousel && window.VtCarousel.instances.get(this.track));
        if (swiper && typeof swiper.slidePrev === 'function') {
          swiper.slidePrev();
          return;
        }
        const step = this._getStep();
        this.track.scrollBy({ left: -step, behavior: 'smooth' });
      }

      _onNext() {
        if (!this.track) return;
        const swiper = this.track.swiper || (window.VtCarousel && window.VtCarousel.instances.get(this.track));
        if (swiper && typeof swiper.slideNext === 'function') {
          swiper.slideNext();
          return;
        }
        const step = this._getStep();
        this.track.scrollBy({ left: step, behavior: 'smooth' });
      }
    }

    customElements.define('earth-slider-nav', EarthSliderNav);
  }

  // =========================================================================
  // =========================================================================
  // 3. Custom Element: <earth-carousel> & <farmer-stories>
  // =========================================================================
  if (!customElements.get('earth-carousel')) {
    class EarthCarousel extends HTMLElement {
      connectedCallback() {
        this.track = this.querySelector('[data-slider-track]');
        if (!this.track) return;

        const colDesktop = parseFloat(this.dataset.colDesktop) || 3;
        const gapDesktop = parseFloat(this.dataset.gapDesktop) || 32;
        const gapMobile = parseFloat(this.dataset.gapMobile) || 16;
        const isSwipeMobile = this.dataset.swipeMobile !== 'false';

        if (window.VtCarousel) {
          window.VtCarousel.init(this.track, {
            slidesPerViewDesktop: colDesktop,
            gapDesktop: gapDesktop,
            gapMobile: gapMobile,
            swipeMobile: isSwipeMobile,
            swiperOptions: {
              slidesPerView: isSwipeMobile ? 1.2 : 1,
              spaceBetween: gapMobile,
              breakpoints: {
                768: {
                  slidesPerView: 2,
                  spaceBetween: Math.min(gapDesktop, 24)
                },
                1024: {
                  slidesPerView: colDesktop,
                  spaceBetween: gapDesktop
                }
              }
            }
          });
        }
      }

      disconnectedCallback() {
        if (this.track && window.VtCarousel) {
          window.VtCarousel.destroy(this.track);
        }
      }
    }

    customElements.define('earth-carousel', EarthCarousel);
  }

  // =========================================================================
  // 4. Custom Element: <card-list> (Native fluid scroll + earth-slider-nav)
  // =========================================================================
  if (!customElements.get('card-list')) {
    class CardList extends HTMLElement {
      constructor() {
        super();
        this.track = null;
        this.swiper = null;
        this._mqlMobile = window.matchMedia('(max-width: 767.98px)');
        this._onMediaChange = this._onMediaChange.bind(this);
      }

      connectedCallback() {
        if (this.dataset.preview === 'true') return;

        this.track = this.querySelector('[data-slider-track]');
        if (!this.track) return;

        this.initCarousel();

        if (this._mqlMobile.addEventListener) {
          this._mqlMobile.addEventListener('change', this._onMediaChange);
        } else if (this._mqlMobile.addListener) {
          this._mqlMobile.addListener(this._onMediaChange);
        }
      }

      disconnectedCallback() {
        if (this.track && window.VtCarousel) {
          window.VtCarousel.destroy(this.track);
        }
        if (this._mqlMobile.removeEventListener) {
          this._mqlMobile.removeEventListener('change', this._onMediaChange);
        } else if (this._mqlMobile.removeListener) {
          this._mqlMobile.removeListener(this._onMediaChange);
        }
      }

      _onMediaChange() {
        this.initCarousel();
      }

      initCarousel() {
        if (!this.track) return;

        const isSwipeMobile = this.dataset.swipeMobile !== 'false';
        if (!isSwipeMobile && this._mqlMobile.matches) {
          if (window.VtCarousel) {
            window.VtCarousel.destroy(this.track);
          }
          return;
        }

        const wrapper = this.track.querySelector('.swiper-wrapper');
        if (wrapper) {
          Array.from(wrapper.children).forEach((child) => {
            child.classList.add('swiper-slide');
          });
        }

        const colDesktop = parseFloat(this.dataset.colDesktop) || 3;
        const gapDesktop = parseFloat(this.dataset.gapDesktop) || 32;
        const gapMobile = parseFloat(this.dataset.gapMobile) || 16;
        const desktopSlidesPerView = colDesktop >= 3 ? (colDesktop - 0.65) : (colDesktop === 2 ? 1.35 : 1);

        if (window.VtCarousel) {
          window.VtCarousel.init(this.track, {
            swipeMobile: isSwipeMobile,
            gapDesktop: gapDesktop,
            gapMobile: gapMobile,
            slidesPerViewDesktop: desktopSlidesPerView,
            swiperOptions: {
              slidesPerView: isSwipeMobile ? 1.2 : 1,
              spaceBetween: gapMobile,
              grabCursor: true,
              watchOverflow: true,
              breakpoints: {
                768: {
                  slidesPerView: 1.8,
                  spaceBetween: Math.min(gapDesktop, 24)
                },
                1024: {
                  slidesPerView: desktopSlidesPerView,
                  spaceBetween: gapDesktop
                }
              }
            }
          }).then((swiper) => {
            if (swiper) {
              this.swiper = swiper;
              window.VtCarousel.notifyNav(this.track);
            }
          });
        }
      }
    }
    customElements.define('card-list', CardList);
  }
})();
