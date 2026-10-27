/**
 * Earth Theme - Values Tabs Component
 * Defines: <values-tabs> Custom Element
 * Handles: Tab generation from child cards, Swiper integration, accessible tab navigation
 */

(function () {
  'use strict';

  if (!customElements.get('values-tabs')) {
    class ValuesTabs extends HTMLElement {
      constructor() {
        super();
        this.track = null;
        this.tablist = null;
        this.cards = [];
        this.tabs = [];
        this.currentIndex = 0;
        this.swiper = null;

        this._signature = '';
        this._observer = null;
        this._resizeTimeout = null;

        [
          'init', 'buildTabs', 'initSwiper', '_onMutation', '_onTabClick', '_onKeydown',
          '_onResize', '_onBlockSelect'
        ].forEach((name) => {
          this[name] = this[name].bind(this);
        });
      }

      connectedCallback() {
        if (this.dataset.preview === 'true') return;

        this.init();

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', this.init, { once: true });
        }

        this._observer = new MutationObserver(this._onMutation);
        this._observer.observe(this, { childList: true, subtree: true });

        document.addEventListener('shopify:block:select', this._onBlockSelect);
        window.addEventListener('resize', this._onResize, { passive: true });
      }

      disconnectedCallback() {
        if (window.VtCarousel && this.track) {
          window.VtCarousel.destroy(this.track);
        } else if (this.swiper && typeof this.swiper.destroy === 'function') {
          this.swiper.destroy(true, true);
        }
        this.swiper = null;
        if (this._observer) {
          this._observer.disconnect();
          this._observer = null;
        }
        document.removeEventListener('DOMContentLoaded', this.init);
        document.removeEventListener('shopify:block:select', this._onBlockSelect);
        window.removeEventListener('resize', this._onResize);
        clearTimeout(this._resizeTimeout);
      }

      _prefersReducedMotion() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      }

      _onMutation(records) {
        const tablist = this.tablist;
        const relevant = records.some((record) => !(tablist && tablist.contains(record.target)));
        if (relevant) {
          this.buildTabs();
          if (this.swiper) {
            this.swiper.update();
          } else {
            this.initSwiper();
          }
        }
      }

      init() {
        this.track = this.querySelector('.vt-values-tabs__track');
        this.tablist = this.querySelector('.vt-values-tabs__tablist');
        if (!this.track || !this.tablist) return;

        this.buildTabs();
        this.initSwiper();
      }

      initSwiper() {
        if (!this.track) return;
        if (this.swiper) {
          this.swiper.update();
          return;
        }

        const wrapper = this.track.querySelector('.vt-values-tabs__wrapper');
        if (wrapper) {
          Array.from(wrapper.children).forEach((child) => {
            child.classList.add('swiper-slide');
          });
        }

        const gapDesktop = parseFloat(this.dataset.gapDesktop) || 32;
        const gapMobile = parseFloat(this.dataset.gapMobile) || 16;
        const isSwipeMobile = this.dataset.swipeMobile !== 'false';

        if (window.VtCarousel) {
          window.VtCarousel.init(this.track, {
            swipeMobile: isSwipeMobile,
            gapDesktop: gapDesktop,
            gapMobile: gapMobile,
            swiperOptions: {
              slidesPerView: 'auto',
              centeredSlides: false,
              breakpoints: {
                769: {
                  slidesPerView: 'auto',
                  spaceBetween: gapDesktop,
                  centeredSlides: false,
                  allowTouchMove: true
                }
              }
            },
            onInit: (swiper) => {
              this.swiper = swiper;
              this.activateTab(swiper.activeIndex);
            },
            onSlideChange: (swiper) => {
              this.activateTab(swiper.activeIndex);
            }
          }).then((swiper) => {
            if (swiper) {
              this.swiper = swiper;
            }
          });
        }
      }

      buildTabs() {
        const cards = Array.from(this.querySelectorAll('.vt-value-card'));
        this.cards = cards;
        if (cards.length === 0) return;

        const signature = cards
          .map((card) => {
            const slideBtn = card.querySelector(':scope > .vt-values__tab');
            return (card.dataset.blockId || '') + '|' + (slideBtn ? slideBtn.innerHTML : '');
          })
          .join('||');

        const tabsAlive = this.tabs.length === cards.length && this.tabs.every((tab) => tab.isConnected);
        if (signature === this._signature && tabsAlive) return;
        this._signature = signature;

        const existing = Array.from(this.tablist.querySelectorAll('.vt-values__tab[data-block-id]'));
        const tabs = [];

        cards.forEach((card, idx) => {
          const blockId = card.dataset.blockId;
          const slideBtn = card.querySelector(':scope > .vt-values__tab');
          if (!blockId || !slideBtn) return;

          let btn = existing.find((el) => el.dataset.blockId === blockId);
          if (!btn) {
            btn = slideBtn.cloneNode(true);
            btn.dataset.blockId = blockId;
          } else if (btn.innerHTML !== slideBtn.innerHTML) {
            btn.innerHTML = slideBtn.innerHTML;
          }

          btn.id = 'vt-val-tablink-' + blockId;
          btn.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
          btn.dataset.slideIndex = String(idx);
          if (card.id) btn.setAttribute('aria-controls', card.id);

          card.setAttribute('role', 'tabpanel');
          card.setAttribute('aria-labelledby', btn.id);

          btn.removeEventListener('click', this._onTabClick);
          btn.removeEventListener('keydown', this._onKeydown);
          btn.addEventListener('click', this._onTabClick);
          btn.addEventListener('keydown', this._onKeydown);

          this.tablist.appendChild(btn);
          tabs.push(btn);
        });

        const validIds = new Set(cards.map((card) => card.dataset.blockId));
        this.tablist.querySelectorAll('.vt-values__tab').forEach((tabBtn) => {
          if (!validIds.has(tabBtn.dataset.blockId)) tabBtn.remove();
        });

        this.tabs = tabs;

        if (this.currentIndex >= cards.length) this.currentIndex = 0;
        this.activateTab(this.currentIndex, false);
      }

      _onTabClick(event) {
        const btn = event.currentTarget;
        const idx = parseInt(btn.dataset.slideIndex, 10);
        if (!isNaN(idx)) {
          this.activateTab(idx, true);
        }
      }

      _onKeydown(event) {
        const active = document.activeElement;
        const currentIdx = this.tabs.indexOf(active);
        if (currentIdx === -1) return;

        let nextIdx = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          nextIdx = (currentIdx + 1) % this.tabs.length;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          nextIdx = (currentIdx - 1 + this.tabs.length) % this.tabs.length;
        } else if (event.key === 'Home') {
          nextIdx = 0;
        } else if (event.key === 'End') {
          nextIdx = this.tabs.length - 1;
        }

        if (nextIdx !== null) {
          event.preventDefault();
          this.tabs[nextIdx].focus();
          this.activateTab(nextIdx, true);
        }
      }

      activateTab(index, shouldScroll = false) {
        if (!this.tabs[index]) return;
        this.currentIndex = index;

        this.tabs.forEach((tab, idx) => {
          const isActive = idx === index;
          tab.classList.toggle('vt-values__tab--active', isActive);
          tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
          tab.setAttribute('tabindex', isActive ? '0' : '-1');
        });

        this.scrollTabIntoView(this.tabs[index]);

        if (shouldScroll) {
          if (this.swiper) {
            this.swiper.slideTo(index, this._prefersReducedMotion() ? 0 : 450);
          } else if (this.cards[index] && this.track) {
            this.track.scrollTo({
              left: this.cards[index].offsetLeft - (parseFloat(this.dataset.padDesktop) || 34),
              behavior: this._prefersReducedMotion() ? 'auto' : 'smooth'
            });
          }
        }
      }

      scrollTabIntoView(tab) {
        if (!tab || !this.tablist) return;
        const container = this.querySelector('.vt-values-tabs__tablist-container');
        if (!container) return;

        const cRect = container.getBoundingClientRect();
        const tRect = tab.getBoundingClientRect();

        if (tRect.left < cRect.left || tRect.right > cRect.right) {
          const scrollTarget = tab.offsetLeft - (container.clientWidth / 2) + (tab.clientWidth / 2);
          container.scrollTo({
            left: Math.max(0, scrollTarget),
            behavior: this._prefersReducedMotion() ? 'auto' : 'smooth'
          });
        }
      }

      _onBlockSelect(event) {
        const blockId = event.detail ? event.detail.blockId : null;
        if (!blockId) return;

        const cardIdx = this.cards.findIndex((card) => card.dataset.blockId === blockId);
        if (cardIdx !== -1) {
          this.activateTab(cardIdx, true);
        }
      }

      _onResize() {
        clearTimeout(this._resizeTimeout);
        this._resizeTimeout = setTimeout(() => {
          if (this.swiper) {
            this.swiper.update();
          }
        }, 150);
      }
    }

    customElements.define('values-tabs', ValuesTabs);
  }
})();
