/**
 * Earth Theme - Collection Tabs Component
 * Defines: <collection-tabs>, <collection-tab> Custom Elements
 * Handles: Multi-collection tab switching, accessible panel toggling, per-panel carousel initialization,
 *          Theme Editor (CMS) block select/deselect integration, MutationObserver for live updates.
 */

(function () {
  'use strict';

  // 1. Define <collection-tab> element to catch Theme Editor block select events directly
  if (!customElements.get('collection-tab')) {
    class CollectionTab extends HTMLElement {
      constructor() {
        super();
        this._onBlockSelect = this._onBlockSelect.bind(this);
      }

      connectedCallback() {
        this.addEventListener('shopify:block:select', this._onBlockSelect);
      }

      disconnectedCallback() {
        this.removeEventListener('shopify:block:select', this._onBlockSelect);
      }

      _onBlockSelect() {
        const parent = this.closest('collection-tabs');
        if (parent && typeof parent.activateTabByBlockId === 'function') {
          parent.activateTabByBlockId(this.dataset.blockId);
        }
      }
    }

    customElements.define('collection-tab', CollectionTab);
  }

  // 2. Define <collection-tabs> element
  if (!customElements.get('collection-tabs')) {
    class CollectionTabs extends HTMLElement {
      constructor() {
        super();
        this.tablist = null;
        this.tabs = [];
        this.panels = [];
        this.swipers = new Map();
        this._mqlMobile = window.matchMedia('(max-width: 767.98px)');

        this._onTabClick = this._onTabClick.bind(this);
        this._onTabFocus = this._onTabFocus.bind(this);
        this._onKeydown = this._onKeydown.bind(this);
        this._onMediaChange = this._onMediaChange.bind(this);
        this._onBlockSelect = this._onBlockSelect.bind(this);
        this._onSectionLoad = this._onSectionLoad.bind(this);
        this._onMutation = this._onMutation.bind(this);
      }

      connectedCallback() {
        this.tablist = this.querySelector('.plt__tablist');
        if (!this.tablist) return;

        this.collectTabsAndPanels();
        this.initCarousels();

        if (this._mqlMobile.addEventListener) {
          this._mqlMobile.addEventListener('change', this._onMediaChange);
        } else if (this._mqlMobile.addListener) {
          this._mqlMobile.addListener(this._onMediaChange);
        }

        // Listen for Theme Editor block selection and section loading
        document.addEventListener('shopify:block:select', this._onBlockSelect);
        document.addEventListener('shopify:section:load', this._onSectionLoad);

        // MutationObserver to observe CMS live updates
        this._observer = new MutationObserver(this._onMutation);
        this._observer.observe(this, { childList: true, subtree: true });
      }

      disconnectedCallback() {
        this.destroyAllSwipers();
        if (this._mqlMobile.removeEventListener) {
          this._mqlMobile.removeEventListener('change', this._onMediaChange);
        } else if (this._mqlMobile.removeListener) {
          this._mqlMobile.removeListener(this._onMediaChange);
        }

        document.removeEventListener('shopify:block:select', this._onBlockSelect);
        document.removeEventListener('shopify:section:load', this._onSectionLoad);

        if (this._observer) {
          this._observer.disconnect();
          this._observer = null;
        }
      }

      _onMutation(mutations) {
        // Only react to changes outside the tablist (e.g. child collection-tab re-rendered)
        const relevant = mutations.some((m) => {
          if (this.tablist && (m.target === this.tablist || this.tablist.contains(m.target))) {
            return false;
          }
          return true;
        });

        if (relevant) {
          const activeIdx = this.tabs.findIndex((t) => t.classList.contains('plt__tab--active'));
          const activeBlockId = activeIdx !== -1 ? this.tabs[activeIdx].dataset.blockId : null;
          this.collectTabsAndPanels();
          if (activeBlockId) {
            this.activateTabByBlockId(activeBlockId);
          }
        }
      }

      _onSectionLoad(event) {
        if (event.target && event.target.contains(this)) {
          this.collectTabsAndPanels();
          this.initCarousels();
        }
      }

      _onBlockSelect(event) {
        const blockId = event.detail ? event.detail.blockId : (event.target && event.target.dataset ? event.target.dataset.blockId : null);
        if (!blockId) return;

        // Check if selected block is a tab button
        let targetIndex = this.tabs.findIndex((tab) => tab.dataset.blockId === blockId);
        if (targetIndex !== -1) {
          this.activateTab(targetIndex);
          return;
        }

        // Check if selected block is a child block (like product-card) inside a collection-tab
        const targetEl = event.target || this.querySelector(`[data-block-id="${blockId}"]`);
        if (targetEl) {
          const parentTab = targetEl.closest('collection-tab');
          if (parentTab && parentTab.dataset.blockId) {
            this.activateTabByBlockId(parentTab.dataset.blockId);
          }
        }
      }

      activateTabByBlockId(blockId) {
        if (!blockId) return;

        let targetIndex = this.tabs.findIndex((tab) => tab.dataset.blockId === blockId);
        if (targetIndex === -1) {
          const tabBlocks = Array.from(this.querySelectorAll('collection-tab'));
          targetIndex = tabBlocks.findIndex((b) => b.dataset.blockId === blockId);
        }

        if (targetIndex !== -1) {
          this.activateTab(targetIndex);
        }
      }

      collectTabsAndPanels() {
        this.tabs = [];
        this.panels = [];

        const tabBlocks = Array.from(this.querySelectorAll('collection-tab'));

        tabBlocks.forEach((block) => {
          const blockId = block.dataset.blockId;
          const panel = block.querySelector('.plt__panel');
          if (!panel) return;

          let btn = this.tablist.querySelector(`[data-block-id="${blockId}"]`);
          const blockBtn = block.querySelector('.plt__tab');

          if (blockBtn && blockBtn !== btn) {
            if (btn) {
              this.tablist.replaceChild(blockBtn, btn);
            } else {
              this.tablist.appendChild(blockBtn);
            }
            btn = blockBtn;
          }

          if (btn) {
            btn.dataset.blockId = blockId;

            // Ensure container block never holds an editor attribute to avoid duplicate overlay
            block.removeAttribute('data-shopify-editor-block');

            btn.removeEventListener('click', this._onTabClick);
            btn.removeEventListener('focus', this._onTabFocus);
            btn.removeEventListener('focusin', this._onTabFocus);
            btn.removeEventListener('keydown', this._onKeydown);

            btn.addEventListener('click', this._onTabClick);
            btn.addEventListener('focus', this._onTabFocus);
            btn.addEventListener('focusin', this._onTabFocus);
            btn.addEventListener('keydown', this._onKeydown);

            if (btn.dataset.autoTitle === 'true' || btn.getAttribute('data-auto-title') === 'true') {
              const span = btn.querySelector('.vt-heading');
              if (span) {
                span.textContent = `Tab ${tabBlocks.indexOf(block) + 1}`;
                btn.removeAttribute('data-auto-title');
              }
            }

            this.tabs.push(btn);
            this.panels.push(panel);
          }
        });

        // Clean up any stale tab buttons
        const validIds = new Set(tabBlocks.map((b) => b.dataset.blockId));
        this.tablist.querySelectorAll('.plt__tab').forEach((tabBtn) => {
          if (!validIds.has(tabBtn.dataset.blockId)) {
            tabBtn.remove();
          }
        });

        if (this.tabs.length === 1) {
          this.tablist.classList.add('plt__tablist--single');
        } else {
          this.tablist.classList.remove('plt__tablist--single');
        }

        let activeIdx = this.tabs.findIndex((t) => t.classList.contains('plt__tab--active'));
        if (activeIdx === -1) activeIdx = 0;
        this.activateTab(activeIdx);
      }

      _onMediaChange() {
        if (this.dataset.swipeMobile === 'false') {
          if (this._mqlMobile.matches) {
            this.destroyAllSwipers();
          } else {
            this.initCarousels();
          }
        }
      }

      destroyAllSwipers() {
        this.swipers.forEach((swiper, track) => {
          if (window.VtCarousel) {
            window.VtCarousel.destroy(track);
          } else if (swiper && typeof swiper.destroy === 'function') {
            swiper.destroy(true, true);
          }
        });
        this.swipers.clear();
      }

      initCarousels() {
        const tracks = this.querySelectorAll('.plt__track');
        tracks.forEach((track) => this.initSwiperForTrack(track));
      }

      initSwiperForTrack(track) {
        if (!track || this.swipers.has(track)) return;

        const isSwipeMobile = this.dataset.swipeMobile !== 'false';
        if (!isSwipeMobile && this._mqlMobile.matches) return;

        const colDesktop = parseFloat(this.dataset.colDesktop) || 3;
        const gapDesktop = parseFloat(this.dataset.gapDesktop) || 32;
        const gapMobile = parseFloat(this.dataset.gapMobile) || 16;
        const desktopSlidesPerView = colDesktop >= 3 ? (colDesktop - 0.65) : (colDesktop === 2 ? 1.35 : 1);

        if (window.VtCarousel) {
          window.VtCarousel.init(track, {
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
              this.swipers.set(track, swiper);
            }
          });
        }
      }

      _onTabClick(event) {
        const clickedTab = event.currentTarget;
        const targetIndex = this.tabs.indexOf(clickedTab);
        if (targetIndex !== -1) {
          this.activateTab(targetIndex);
        }
      }

      _onTabFocus(event) {
        const focusedTab = event.currentTarget;
        const targetIndex = this.tabs.indexOf(focusedTab);
        if (targetIndex !== -1) {
          this.activateTab(targetIndex);
        }
      }

      _onKeydown(event) {
        const currentTab = event.currentTarget;
        const currentIndex = this.tabs.indexOf(currentTab);
        let nextIndex = currentIndex;

        switch (event.key) {
          case 'ArrowRight':
            nextIndex = (currentIndex + 1) % this.tabs.length;
            break;
          case 'ArrowLeft':
            nextIndex = (currentIndex - 1 + this.tabs.length) % this.tabs.length;
            break;
          case 'Home':
            nextIndex = 0;
            break;
          case 'End':
            nextIndex = this.tabs.length - 1;
            break;
          default:
            return;
        }

        event.preventDefault();
        this.tabs[nextIndex].focus();
        this.activateTab(nextIndex);
      }

      activateTab(index) {
        if (!this.tabs[index]) return;

        this.tabs.forEach((tab, i) => {
          const isActive = i === index;
          tab.classList.toggle('plt__tab--active', isActive);
          tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
          tab.setAttribute('tabindex', isActive ? '0' : '-1');

          if (isActive) {
            tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        });

        this.panels.forEach((panel, i) => {
          const isCurrent = i === index;
          panel.classList.toggle('plt__panel--hidden', !isCurrent);
          if (isCurrent) {
            panel.removeAttribute('hidden');
            const track = panel.querySelector('.plt__track');
            if (track) {
              if (!this.swipers.has(track)) {
                this.initSwiperForTrack(track);
              }
              const swiper = this.swipers.get(track) || track.swiper;
              if (swiper) {
                window.requestAnimationFrame(() => {
                  swiper.update();
                  if (window.VtCarousel) {
                    window.VtCarousel.notifyNav(track);
                  }
                });
              }
            }
          } else {
            panel.setAttribute('hidden', '');
          }
        });
      }
    }

    customElements.define('collection-tabs', CollectionTabs);
  }
})();
