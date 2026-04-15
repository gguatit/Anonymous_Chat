export class GalleryManager {
    constructor() {
        this.images = [];
        this.isOpen = false;
        this.currentIndex = 0;
        this.overlay = null;
        this.gridContainer = null;
        this.lightboxOverlay = null;
        this.lightboxImage = null;
        this.lightboxCounter = null;
        this.collectButton = null;

        this.createOverlay();
        this.createLightbox();
        this.attachHeaderButton();
    }

    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'gallery-overlay';
        this.overlay.className = 'fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm hidden';
        this.overlay.innerHTML = `
            <div class="fixed inset-0 md:inset-y-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-3xl bg-gray-800 shadow-2xl flex flex-col md:rounded-xl overflow-hidden border border-gray-700">
                <div class="flex items-center justify-between p-4 border-b border-gray-700">
                    <div class="flex items-center gap-2">
                        <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        <h3 class="text-sm font-semibold text-gray-100">이미지 갤러리</h3>
                        <span id="gallery-count" class="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded-full"></span>
                    </div>
                    <div class="flex items-center gap-2">
                        <button id="gallery-refresh-btn" class="text-gray-400 hover:text-gray-200 transition-colors p-1.5 rounded-lg hover:bg-gray-700" title="새로고침" aria-label="새로고침">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                            </svg>
                        </button>
                        <button id="gallery-close-btn" class="text-gray-400 hover:text-gray-200 transition-colors p-1.5 rounded-lg hover:bg-gray-700" title="닫기" aria-label="갤러리 닫기">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div id="gallery-grid" class="flex-1 overflow-y-auto p-4" style="scrollbar-width: thin; scrollbar-color: #4B5563 transparent;">
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);

        this.gridContainer = this.overlay.querySelector('#gallery-grid');
        this.overlay.querySelector('#gallery-close-btn').addEventListener('click', () => this.close());
        const refreshBtn = this.overlay.querySelector('#gallery-refresh-btn');
        refreshBtn.addEventListener('click', () => {
            refreshBtn.classList.add('gallery-refresh-spin');
            this.collectAndRender();
            setTimeout(() => refreshBtn.classList.remove('gallery-refresh-spin'), 600);
        });
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });
    }

    createLightbox() {
        this.lightboxOverlay = document.createElement('div');
        this.lightboxOverlay.id = 'gallery-lightbox';
        this.lightboxOverlay.className = 'fixed inset-0 z-[70] bg-black/90 hidden flex items-center justify-center';
        this.lightboxOverlay.innerHTML = `
            <button id="lightbox-prev" class="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 bg-gray-800/80 hover:bg-gray-700 text-white p-2 rounded-full transition-colors z-10" aria-label="이전 이미지">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                </svg>
            </button>
            <img id="lightbox-image" class="max-w-[90vw] max-h-[85vh] object-contain rounded-lg" alt="Gallery image">
            <button id="lightbox-next" class="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 bg-gray-800/80 hover:bg-gray-700 text-white p-2 rounded-full transition-colors z-10" aria-label="다음 이미지">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
            </button>
            <div id="lightbox-counter" class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-800/80 text-gray-300 px-3 py-1 rounded-full text-sm"></div>
            <button id="lightbox-close" class="absolute top-4 right-4 bg-gray-800/80 hover:bg-gray-700 text-white p-2 rounded-full transition-colors" aria-label="닫기">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        `;
        document.body.appendChild(this.lightboxOverlay);

        this.lightboxImage = this.lightboxOverlay.querySelector('#lightbox-image');
        this.lightboxCounter = this.lightboxOverlay.querySelector('#lightbox-counter');

        this.lightboxOverlay.querySelector('#lightbox-close').addEventListener('click', () => this.closeLightbox());
        this.lightboxOverlay.querySelector('#lightbox-prev').addEventListener('click', () => this.navigateLightbox(-1));
        this.lightboxOverlay.querySelector('#lightbox-next').addEventListener('click', () => this.navigateLightbox(1));
        this.lightboxOverlay.addEventListener('click', (e) => {
            if (e.target === this.lightboxOverlay) this.closeLightbox();
        });

        document.addEventListener('keydown', (e) => {
            if (!this.lightboxOverlay.classList.contains('hidden')) {
                if (e.key === 'ArrowLeft') this.navigateLightbox(-1);
                else if (e.key === 'ArrowRight') this.navigateLightbox(1);
                else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.closeLightbox();
                }
            }
        });
    }

    attachHeaderButton() {
        const headerRight = document.querySelector('header .flex.items-center.gap-3');
        if (!headerRight) return;

        const galleryBtn = document.createElement('button');
        galleryBtn.id = 'gallery-toggle-btn';
        galleryBtn.className = 'text-gray-400 hover:text-gray-200 transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-gray-700';
        galleryBtn.title = '이미지 갤러리';
        galleryBtn.setAttribute('aria-label', '이미지 갤러리');
        galleryBtn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
        `;
        galleryBtn.addEventListener('click', () => this.open());

        const userCount = headerRight.querySelector('#user-count');
        if (userCount) {
            headerRight.insertBefore(galleryBtn, userCount);
        } else {
            headerRight.appendChild(galleryBtn);
        }
    }

    collectAndRender() {
        this.images = [];
        const messagesContainer = document.getElementById('messages-container');
        if (!messagesContainer) return;

        const messageElements = messagesContainer.querySelectorAll('[data-message-id]');
        for (const el of messageElements) {
            const imgElements = el.querySelectorAll('img[id^="img_"], img[id^="file_img_"]');
            for (const img of imgElements) {
                if (img.src && !img.src.startsWith('data:')) {
                    const messageId = el.getAttribute('data-message-id');
                    const sessionId = el.getAttribute('data-session-id');
                    const timestamp = parseInt(el.getAttribute('data-timestamp') || '0');
                    const nameEl = el.querySelector('.text-xs.font-medium');
                    const senderName = nameEl ? nameEl.textContent.trim() : 'Anonymous';

                    this.images.push({
                        url: img.src,
                        messageId,
                        sessionId,
                        timestamp,
                        senderName
                    });
                }
            }
        }

        this.renderGrid();
    }

    renderGrid() {
        const countEl = this.overlay.querySelector('#gallery-count');

        if (this.images.length === 0) {
            this.gridContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-gray-500">
                    <svg class="w-12 h-12 mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    <p class="text-sm">아직 공유된 이미지가 없습니다</p>
                </div>
            `;
            countEl.textContent = '0';
            return;
        }

        countEl.textContent = `${this.images.length}`;

        const fragment = document.createDocumentFragment();

        for (let i = 0; i < this.images.length; i++) {
            const img = this.images[i];
            const thumb = document.createElement('div');
            thumb.className = 'relative group cursor-pointer rounded-lg overflow-hidden bg-gray-700 aspect-square';
            thumb.innerHTML = `
                <img src="${img.url}" alt="Image" class="w-full h-full object-cover" loading="lazy" onerror="this.parentElement.style.display='none'">
                <div class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end">
                    <div class="w-full p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p class="text-xs text-white font-medium truncate">${this.escapeHtml(img.senderName)}</p>
                        <p class="text-xs text-gray-300">${new Date(img.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                </div>
            `;
            thumb.addEventListener('click', () => this.openLightbox(i));
            fragment.appendChild(thumb);
        }

        this.gridContainer.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3';
        grid.appendChild(fragment);
        this.gridContainer.appendChild(grid);
    }

    open() {
        this.isOpen = true;
        this.overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        this.collectAndRender();
        const refreshBtn = this.overlay.querySelector('#gallery-refresh-btn');
        if (refreshBtn) {
            refreshBtn.classList.add('gallery-refresh-spin');
            setTimeout(() => refreshBtn.classList.remove('gallery-refresh-spin'), 600);
        }
    }

    close() {
        this.isOpen = false;
        this.overlay.classList.add('hidden');
        if (!this.lightboxOverlay.classList.contains('hidden')) {
            this.closeLightbox();
        }
        if (!document.getElementById('search-overlay')?.classList.contains('hidden')) {
            // don't restore overflow if search overlay is also open
        } else {
            document.body.style.overflow = '';
        }
    }

    openLightbox(index) {
        this.currentIndex = index;
        this.lightboxOverlay.classList.remove('hidden');
        this.updateLightbox();
    }

    closeLightbox() {
        this.lightboxOverlay.classList.add('hidden');
    }

    navigateLightbox(direction) {
        this.currentIndex += direction;
        if (this.currentIndex < 0) this.currentIndex = this.images.length - 1;
        if (this.currentIndex >= this.images.length) this.currentIndex = 0;
        this.updateLightbox();
    }

    updateLightbox() {
        if (this.images.length === 0) return;
        const img = this.images[this.currentIndex];
        this.lightboxImage.src = img.url;
        this.lightboxImage.alt = `Image ${this.currentIndex + 1}`;
        this.lightboxCounter.textContent = `${this.currentIndex + 1} / ${this.images.length}`;
    }

    addImage(url, messageId, sessionId, timestamp, senderName) {
        if (!url || this.images.some(i => i.url === url)) return;
        this.images.push({ url, messageId, sessionId, timestamp, senderName });
    }

    removeImage(url) {
        this.images = this.images.filter(i => i.url !== url);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}