/**
 * Earth Theme - Video With Text Overlay Component
 * Custom Element: <vt-video-overlay>
 * Handles responsive video playback (desktop & mobile) and play/pause button state.
 * Preserves scrim overlay and text content over video at all times.
 */

if (!customElements.get('vt-video-overlay')) {
  class VtVideoOverlay extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      // Delay initialization slightly to ensure all child nodes are parsed
      requestAnimationFrame(() => {
        this.init();
      });
    }

    getActiveVideo() {
      const videos = Array.from(this.querySelectorAll('video'));
      return videos.find((v) => v.offsetParent !== null) || videos[0];
    }

    getActiveIframe() {
      const iframes = Array.from(this.querySelectorAll('iframe'));
      return iframes.find((f) => f.offsetParent !== null) || iframes[0];
    }

    init() {
      this.isAutoplay = this.dataset.autoplay === 'true';

      // Event delegation for play/pause button click (works regardless of DOM timing)
      if (!this._hasBoundClick) {
        this._hasBoundClick = true;

        this.addEventListener('click', (e) => {
          const btn = e.target.closest('.vt-video-overlay__play-btn');
          if (btn) {
            e.preventDefault();
            e.stopPropagation();
            this.togglePlay();
          }
        });
      }

      // Handle HTML5 video events for all video tags
      const videos = this.querySelectorAll('video');
      videos.forEach((video) => {
        if (!video._hasBoundEvents) {
          video._hasBoundEvents = true;

          video.addEventListener('ended', () => {
            this.classList.remove('is-playing');
            video.currentTime = 0;
          });

          video.addEventListener('pause', () => {
            if (!video.seeking && !this.isAutoplay) {
              this.classList.remove('is-playing');
            }
          });

          video.addEventListener('play', () => {
            if (!this.isAutoplay) {
              this.classList.add('is-playing');
            }
          });
        }
      });
    }

    togglePlay() {
      if (this.classList.contains('is-playing')) {
        this.pauseVideo();
      } else {
        this.playVideo();
      }
    }

    playVideo() {
      this.classList.add('is-playing');

      const video = this.getActiveVideo();
      const iframe = this.getActiveIframe();

      if (video) {
        video.muted = true;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('Video play was restricted:', err);
            video.muted = true;
            video.play();
          });
        }
      } else if (iframe) {
        let src = iframe.getAttribute('src');
        if (src) {
          if (!src.includes('autoplay=1')) {
            src += (src.includes('?') ? '&' : '?') + 'autoplay=1&mute=1';
            iframe.setAttribute('src', src);
          } else if (iframe.contentWindow) {
            if (src.includes('youtube.com')) {
              iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: [] }), '*');
              iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
            } else if (src.includes('vimeo.com')) {
              iframe.contentWindow.postMessage(JSON.stringify({ method: 'setVolume', value: 0 }), '*');
              iframe.contentWindow.postMessage(JSON.stringify({ method: 'play' }), '*');
            }
          }
        }
      }
    }

    pauseVideo() {
      this.classList.remove('is-playing');

      const video = this.getActiveVideo();
      const iframe = this.getActiveIframe();

      if (video) {
        video.pause();
      } else if (iframe && iframe.contentWindow) {
        const src = iframe.getAttribute('src') || '';
        if (src.includes('youtube.com')) {
          iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
        } else if (src.includes('vimeo.com')) {
          iframe.contentWindow.postMessage(JSON.stringify({ method: 'pause' }), '*');
        }
      }
    }
  }

  customElements.define('vt-video-overlay', VtVideoOverlay);

  // Support Shopify Theme Editor reloads
  document.addEventListener('shopify:section:load', (event) => {
    const overlay = event.target.querySelector('vt-video-overlay');
    if (overlay && typeof overlay.init === 'function') {
      overlay.init();
    }
  });
}

