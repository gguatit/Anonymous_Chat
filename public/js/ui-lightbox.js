// UI Lightbox/Gallery mixin
export const lightbox = {
    ensureLightboxExists() {
        if (document.getElementById('gallery-lightbox')) return;

        const lightboxEl = document.createElement('div');
        lightboxEl.id = 'gallery-lightbox';
        lightboxEl.className = 'fixed inset-0 z-[200] bg-black/90 hidden flex items-center justify-center';
        lightboxEl.innerHTML = `
            <button id="lightbox-close" class="absolute top-4 right-4 text-white/80 hover:text-white p-2 z-50 cursor-pointer">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
            <button id="lightbox-prev" class="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 z-10 hidden">
                <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                </svg>
            </button>
            <button id="lightbox-next" class="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 z-10 hidden">
                <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
            </button>
            <div class="max-w-5xl max-h-[90vh] p-4 pointer-events-none">
                <img id="lightbox-img" src="" alt="" class="max-w-full max-h-[85vh] object-contain rounded-lg pointer-events-auto">
                <p id="lightbox-caption" class="text-center text-white/80 mt-3 text-sm pointer-events-auto"></p>
            </div>
        `;
        document.body.appendChild(lightboxEl);

        lightboxEl.addEventListener('click', (e) => {
            if (e.target === lightboxEl || e.target.closest('#lightbox-close')) {
                this.closeLightbox();
            }
        });

        document.getElementById('lightbox-prev').addEventListener('click', (e) => {
            e.stopPropagation();
            this.navigateLightbox(-1);
        });
        document.getElementById('lightbox-next').addEventListener('click', (e) => {
            e.stopPropagation();
            this.navigateLightbox(1);
        });

        if (this._lightboxKeyHandler) {
            document.removeEventListener('keydown', this._lightboxKeyHandler);
        }
        this._lightboxKeyHandler = (e) => {
            if (lightboxEl.classList.contains('hidden')) return;
            if (e.key === 'Escape') this.closeLightbox();
            if (e.key === 'ArrowLeft') this.navigateLightbox(-1);
            if (e.key === 'ArrowRight') this.navigateLightbox(1);
        };
        document.addEventListener('keydown', this._lightboxKeyHandler);
    },

    openLightbox(images, startIndex) {
        this.lightboxImages = images;
        this.lightboxIndex = startIndex;
        this.updateLightbox();
        
        const lightboxEl = document.getElementById('gallery-lightbox');
        lightboxEl.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    },

    closeLightbox() {
        const lightboxEl = document.getElementById('gallery-lightbox');
        lightboxEl.classList.add('hidden');
        document.body.style.overflow = '';
        this.lightboxImages = null;
    },

    navigateLightbox(direction) {
        if (!this.lightboxImages) return;
        this.lightboxIndex = (this.lightboxIndex + direction + this.lightboxImages.length) % this.lightboxImages.length;
        this.updateLightbox();
    },

    updateLightbox() {
        const img = document.getElementById('lightbox-img');
        const caption = document.getElementById('lightbox-caption');
        const prev = document.getElementById('lightbox-prev');
        const next = document.getElementById('lightbox-next');
        
        const current = this.lightboxImages[this.lightboxIndex];
        img.src = this.sanitizeUrl(current.url);
        caption.textContent = `${this.lightboxIndex + 1} / ${this.lightboxImages.length}`;
        
        if (this.lightboxImages.length > 1) {
            prev.classList.remove('hidden');
            next.classList.remove('hidden');
        }
    },
};
