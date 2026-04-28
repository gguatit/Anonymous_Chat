const CACHE_MAX = 50;
const FETCH_TIMEOUT = 5000;

export class OGPreviewManager {
    constructor() {
        this.cache = new Map();
        this.pendingFetches = new Map();
    }

    async getPreview(url) {
        const cached = this.cache.get(url);
        if (cached) return cached;

        if (this.pendingFetches.has(url)) {
            return this.pendingFetches.get(url);
        }

        const promise = this._fetchPreview(url);
        this.pendingFetches.set(url, promise);
        const result = await promise;
        this.pendingFetches.delete(url);

        if (result) {
            if (this.cache.size >= CACHE_MAX) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }
            this.cache.set(url, result);
        }
        return result;
    }

    async _fetchPreview(url) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

            const response = await fetch('/api/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            clearTimeout(timeout);

            if (!response.ok) return null;
            const data = await response.json();
            if (!data.og) return null;
            const og = data.og;
            if (!og.title && !og.description && !og.image) return null;
            return og;
        } catch {
            return null;
        }
    }

    renderCard(og, url) {
        const title = this._esc(og.title || new URL(url).hostname);
        const description = og.description ? this._esc(og.description.substring(0, 200)) : '';
        const image = og.image || '';
        const siteName = og.siteName ? this._esc(og.siteName) : this._esc(new URL(url).hostname);

        return `
            <div class="og-card mt-2 rounded-lg border border-gray-600/50 overflow-hidden bg-gray-800/60 hover:bg-gray-700/60 transition-colors cursor-pointer" onclick="window.open('${this._esc(url)}', '_blank', 'noopener')">
                ${image ? `
                <div class="og-image w-full h-40 bg-gray-700 overflow-hidden flex items-center justify-center">
                    <img src="${this._esc(image)}" alt="" class="w-full h-full object-cover" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'text-gray-500 text-xs\\'>이미지를 불러올 수 없습니다</div>'">
                </div>` : ''}
                <div class="p-3">
                    <p class="text-sm font-semibold text-gray-100 leading-snug" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${title}</p>
                    ${description ? `<p class="text-xs text-gray-400 mt-1 leading-relaxed" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${description}</p>` : ''}
                    <p class="text-xs text-gray-500 mt-1.5 truncate">${siteName}</p>
                </div>
            </div>
        `;
    }

    _ogId(url) {
        let safe = '';
        for (let i = 0; i < url.length; i++) {
            const c = url.charCodeAt(i);
            safe += (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 58 || c === 47 || c === 46 || c === 45 || c === 95 ? url[i] : '_';
        }
        return 'og_' + safe.substring(0, 80);
    }

    enrichUrlLink(aElement) {
        const url = aElement.href;
        if (!url || !url.startsWith('http')) return;

        if (aElement.closest('.og-card') || aElement.closest('.og-image')) return;
        if (aElement.closest('[data-og-enriched]')) return;

        const parent = aElement.parentElement;
        if (parent && parent.closest?.('.og-card')) return;
        if (aElement.querySelector('img')) return;

        const container = aElement.closest('[data-message]') || aElement.closest('.message-content');
        if (!container) return;

        const ogId = this._ogId(url);
        if (container.querySelector(`[data-og-id="${ogId}"]`)) return;

        const placeholder = document.createElement('div');
        placeholder.dataset.ogEnriched = 'true';
        placeholder.dataset.ogId = ogId;
        placeholder.className = 'og-placeholder';
        placeholder.innerHTML = '<div class="flex items-center gap-2 mt-2 text-gray-500 text-xs"><div class="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>링크 미리보기 로딩 중...</div>';

        const linkEl = aElement.closest('.inline-flex') || aElement.parentElement;
        if (linkEl) {
            linkEl.insertAdjacentElement('afterend', placeholder);
        } else {
            aElement.insertAdjacentElement('afterend', placeholder);
        }

        this.getPreview(url).then(og => {
            if (og) {
                placeholder.innerHTML = this.renderCard(og, url);
            } else {
                placeholder.remove();
            }
        }).catch(() => {
            placeholder.remove();
        });
    }

    enrichMessage(element) {
        if (!element) return;
        const links = element.querySelectorAll('a[href^="http"]');
        links.forEach(link => this.enrichUrlLink(link));
    }

        this.getPreview(url).then(og => {
            if (og) {
                placeholder.innerHTML = this.renderCard(og, url);
            } else {
                placeholder.remove();
            }
        }).catch(() => {
            placeholder.remove();
        });
    }

    enrichMessage(element) {
        const links = element.querySelectorAll('a[href^="http"]');
        links.forEach(link => this.enrichUrlLink(link));
    }

    _esc(text) {
        const div = document.createElement('div');
        div.textContent = String(text || '');
        return div.innerHTML;
    }
}
