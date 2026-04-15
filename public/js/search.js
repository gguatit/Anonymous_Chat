export class SearchManager {
    constructor(onResultClick) {
        this.onResultClick = onResultClick;
        this.isOpen = false;
        this.currentQuery = '';
        this.searchTimeout = null;
        this.results = [];
        this.overlay = null;
        this.searchInput = null;
        this.resultsContainer = null;
        this.resultCountEl = null;
        this.activeTags = new Set();

        this.createOverlay();
        this.attachHeaderButton();
    }

    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'search-overlay';
        this.overlay.className = 'fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm hidden';
        this.overlay.innerHTML = `
            <div class="fixed inset-0 md:inset-y-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl bg-gray-800 shadow-2xl flex flex-col md:rounded-xl overflow-hidden border border-gray-700">
                <div class="flex items-center gap-3 p-4 border-b border-gray-700">
                    <svg class="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                    </svg>
                    <input id="search-input" type="text" placeholder="검색어 입력... (#images #files #code 태그로만 필터링)" 
                        class="flex-1 bg-gray-900 text-gray-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 border border-gray-600"
                        autocomplete="off" maxlength="200">
                    <button id="search-close-btn" class="text-gray-400 hover:text-gray-200 transition-colors p-1.5 rounded-lg hover:bg-gray-700" aria-label="검색 닫기">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div class="flex items-center gap-2 px-4 py-2 border-b border-gray-700/50 bg-gray-800/50">
                    <span class="text-xs text-gray-500 flex-shrink-0">태그:</span>
                    <button data-tag="images" class="search-tag-btn flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition-colors bg-gray-700/50 border-gray-600 text-gray-400 hover:border-blue-500 hover:text-blue-400">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        #images
                    </button>
                    <button data-tag="files" class="search-tag-btn flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition-colors bg-gray-700/50 border-gray-600 text-gray-400 hover:border-blue-500 hover:text-blue-400">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-4.586 4.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.586a4 4 0 105.657 5.657l4.585-4.586"/>
                        </svg>
                        #files
                    </button>
                    <button data-tag="code" class="search-tag-btn flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition-colors bg-gray-700/50 border-gray-600 text-gray-400 hover:border-blue-500 hover:text-blue-400">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
                        </svg>
                        #code
                    </button>
                </div>
                <div id="search-results-container" class="flex-1 overflow-y-auto p-4 space-y-2" style="scrollbar-width: thin; scrollbar-color: #4B5563 transparent;">
                    <div class="flex flex-col items-center justify-center h-full text-gray-500">
                        <svg class="w-12 h-12 mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                        <p class="text-sm">검색어를 입력하세요</p>
                        <p class="text-xs text-gray-600 mt-1">최근 12시간 이내의 모든 메시지에서 검색합니다</p>
                        <p class="text-xs text-gray-600 mt-2">#images #files #code 태그로 유형별 필터링</p>
                        <p class="text-xs text-gray-600 mt-0.5">태그 검색 시 키워드는 무시되고 태그만 적용됩니다</p>
                    </div>
                </div>
                <div id="search-result-count" class="hidden px-4 py-2 text-xs text-gray-400 border-t border-gray-700 bg-gray-800/50">
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);

        this.searchInput = this.overlay.querySelector('#search-input');
        this.resultsContainer = this.overlay.querySelector('#search-results-container');
        this.resultCountEl = this.overlay.querySelector('#search-result-count');

        this.overlay.querySelector('#search-close-btn').addEventListener('click', () => this.close());

        this.overlay.querySelectorAll('.search-tag-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tag = btn.dataset.tag;
                this.toggleTag(tag);
            });
        });

        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                e.preventDefault();
                this.close();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                const active = document.activeElement;
                const isEditable = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
                if (!isEditable && !this.isOpen) {
                    e.preventDefault();
                    this.open();
                }
            }
        });

        this.searchInput.addEventListener('input', () => {
            this.syncTagsFromInput();
            if (this.searchTimeout) clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => this.performSearch(), 300);
        });

        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.performSearch();
            }
        });
    }

    toggleTag(tag) {
        if (this.activeTags.has(tag)) {
            this.activeTags.delete(tag);
        } else {
            this.activeTags.add(tag);
        }
        this.updateTagButtons();
        this.syncInputFromTags();
        if (this.searchTimeout) clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => this.performSearch(), 300);
    }

    updateTagButtons() {
        this.overlay.querySelectorAll('.search-tag-btn').forEach(btn => {
            const tag = btn.dataset.tag;
            if (this.activeTags.has(tag)) {
                btn.classList.remove('bg-gray-700/50', 'border-gray-600', 'text-gray-400');
                btn.classList.add('bg-blue-600/30', 'border-blue-500', 'text-blue-300');
            } else {
                btn.classList.add('bg-gray-700/50', 'border-gray-600', 'text-gray-400');
                btn.classList.remove('bg-blue-600/30', 'border-blue-500', 'text-blue-300');
            }
        });
    }

syncInputFromTags() {
        const parts = [];
        for (const tag of this.activeTags) {
            parts.push(`#${tag}`);
        }
        this.searchInput.value = parts.join(' ');
    }

    syncTagsFromInput() {
        const text = this.searchInput.value;
        const tagRegex = /#(images|files|code)\b/gi;
        const foundTags = new Set();
        let match;
        while ((match = tagRegex.exec(text)) !== null) {
            foundTags.add(match[1].toLowerCase());
        }
        this.activeTags = foundTags;
        this.updateTagButtons();

        if (foundTags.size > 0) {
            const hasNonTagText = text.replace(/#\w+/g, '').trim().length > 0;
            if (hasNonTagText) {
                const onlyTags = text.replace(/#\w+/g, '').trim();
                const tagParts = [];
                for (const tag of foundTags) {
                    tagParts.push(`#${tag}`);
                }
                this.searchInput.value = tagParts.join(' ');
            }
        }
    }
        const rawText = input.value.replace(/#\w+/g, '').trim();
        if (rawText) parts.push(rawText);
        const cursorPos = input.selectionStart;
        input.value = parts.join(' ');
        const newPos = Math.min(cursorPos, input.value.length);
        input.setSelectionRange(newPos, newPos);
    }

    syncTagsFromInput() {
        const text = this.searchInput.value;
        const tagRegex = /#(images|files|code)\b/gi;
        const foundTags = new Set();
        let match;
        while ((match = tagRegex.exec(text)) !== null) {
            foundTags.add(match[1].toLowerCase());
        }
        this.activeTags = foundTags;
        this.updateTagButtons();
    }

    attachHeaderButton() {
        const headerRight = document.querySelector('header .flex.items-center.gap-3');
        if (!headerRight) return;

        const searchBtn = document.createElement('button');
        searchBtn.id = 'search-toggle-btn';
        searchBtn.className = 'text-gray-400 hover:text-gray-200 transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-gray-700';
        searchBtn.title = '메시지 검색 (Ctrl+F)';
        searchBtn.setAttribute('aria-label', '메시지 검색');
        searchBtn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
        `;
        searchBtn.addEventListener('click', () => this.open());

        const userCount = headerRight.querySelector('#user-count');
        if (userCount) {
            headerRight.insertBefore(searchBtn, userCount);
        } else {
            headerRight.appendChild(searchBtn);
        }
    }

    open() {
        this.isOpen = true;
        this.overlay.classList.remove('hidden');
        this.searchInput.focus();
        document.body.style.overflow = 'hidden';
    }

    close() {
        this.isOpen = false;
        this.overlay.classList.add('hidden');
        document.body.style.overflow = '';
        this.searchInput.value = '';
        this.results = [];
        this.currentQuery = '';
        this.activeTags.clear();
        this.updateTagButtons();
        this.resetResults();
    }

    resetResults() {
        this.resultCountEl.classList.add('hidden');
        this.resultsContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-gray-500">
                <svg class="w-12 h-12 mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <p class="text-sm">검색어를 입력하세요</p>
                <p class="text-xs text-gray-600 mt-1">최근 12시간 이내의 모든 메시지에서 검색합니다</p>
                <p class="text-xs text-gray-600 mt-2">#images #files #code 태그로 유형별 필터링</p>
                <p class="text-xs text-gray-600 mt-0.5">태그 검색 시 키워드는 무시되고 태그만 적용됩니다</p>
            </div>
        `;
    }

    async performSearch() {
        const query = this.searchInput.value.trim();
        if (!query) {
            this.resetResults();
            return;
        }

        this.currentQuery = query;
        this.resultsContainer.innerHTML = `
            <div class="flex items-center justify-center h-full">
                <div class="flex items-center gap-2 text-gray-400">
                    <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span class="text-sm">검색 중...</span>
                </div>
            </div>
        `;

        try {
            const params = new URLSearchParams({ q: query, limit: '100' });
            const response = await fetch(`/api/search?${params}`);
            if (!response.ok) {
                throw new Error(`검색 실패: ${response.status}`);
            }
            const data = await response.json();
            this.results = data.results || [];
            this.renderResults();
        } catch (error) {
            console.error('[Search] Error:', error);
            this.resultsContainer.innerHTML = `
                <div class="flex items-center justify-center h-full">
                    <div class="text-center">
                        <svg class="w-10 h-10 mx-auto mb-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <p class="text-sm text-red-400">검색 중 오류가 발생했습니다</p>
                        <p class="text-xs text-gray-500 mt-1">${error.message}</p>
                    </div>
                </div>
            `;
        }
    }

    getQueryWithoutTags() {
        return this.currentQuery.replace(/#(images|files|code)\b/gi, '').trim();
    }

    highlightText(text) {
        const textTerms = this.getQueryWithoutTags();
        if (!text && !textTerms) return this.escapeHtml(text || '');
        const escaped = this.escapeHtml(text || '');
        if (!textTerms) return escaped;
        const terms = textTerms.toLowerCase().split(/\s+/).filter(t => t.length > 0);
        let result = escaped;
        for (const term of terms) {
            const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            result = result.replace(regex, '<mark class="bg-yellow-500/30 text-yellow-200 rounded px-0.5">$1</mark>');
        }
        return result;
    }

    renderTagBadges(tags) {
        if (!tags || tags.length === 0) return '';
        const tagConfig = {
            images: { label: 'images', bg: 'bg-emerald-600/30', text: 'text-emerald-300', border: 'border-emerald-500/40' },
            files: { label: 'files', bg: 'bg-amber-600/30', text: 'text-amber-300', border: 'border-amber-500/40' },
            code: { label: 'code', bg: 'bg-violet-600/30', text: 'text-violet-300', border: 'border-violet-500/40' }
        };
        return tags.map(tag => {
            const cfg = tagConfig[tag] || { label: tag, bg: 'bg-gray-600/30', text: 'text-gray-300', border: 'border-gray-500/40' };
            return `<span class="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${cfg.bg} ${cfg.text} border ${cfg.border}">#${cfg.label}</span>`;
        }).join(' ');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    renderResults() {
        if (this.results.length === 0) {
            this.resultsContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-gray-500">
                    <svg class="w-12 h-12 mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <p class="text-sm">"${this.escapeHtml(this.currentQuery)}"에 대한 검색 결과가 없습니다</p>
                    <p class="text-xs text-gray-600 mt-1">다른 검색어를 시도해보세요</p>
                </div>
            `;
            this.resultCountEl.classList.add('hidden');
            return;
        }

        const fragment = document.createDocumentFragment();

        for (const msg of this.results) {
            const item = document.createElement('div');
            item.className = 'p-3 rounded-lg bg-gray-700/50 hover:bg-gray-700 cursor-pointer transition-colors border border-gray-600/50';
            item.setAttribute('data-message-id', msg.messageId);

            const timestamp = new Date(msg.timestamp).toLocaleString('ko-KR', {
                month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            const senderName = this.escapeHtml(msg.nickname || 'Anonymous');
            const contentPreview = msg.content.length > 200
                ? msg.content.substring(0, 200) + '...'
                : msg.content;
            const highlightedContent = this.highlightText(contentPreview);

            let fileBadge = '';
            if (msg.hasFile) {
                const isImage = msg.fileType && msg.fileType.startsWith('image/');
                if (isImage) {
                    fileBadge = `<span class="text-xs text-emerald-400 ml-1.5">
                        <svg class="w-3.5 h-3.5 inline-block mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>${this.escapeHtml(msg.fileName || 'image')}</span>`;
                } else {
                    fileBadge = `<span class="text-xs text-amber-400 ml-1.5">
                        <svg class="w-3.5 h-3.5 inline-block mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-4.586 4.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.586a4 4 0 105.657 5.657l4.585-4.586"/>
                        </svg>${this.escapeHtml(msg.fileName || 'file')}</span>`;
                }
            }

            const tagBadges = this.renderTagBadges(msg.tags);

            item.innerHTML = `
                <div class="flex items-start justify-between gap-2 mb-1">
                    <div class="flex items-center flex-wrap gap-1">
                        <span class="text-xs font-medium text-blue-300">${senderName}</span>
                        ${fileBadge}
                    </div>
                    <span class="text-xs text-gray-500 flex-shrink-0">${timestamp}</span>
                </div>
                ${tagBadges ? `<div class="mb-1.5 flex flex-wrap gap-1">${tagBadges}</div>` : ''}
                <div class="text-sm text-gray-300 break-words leading-relaxed">${highlightedContent}</div>
            `;

            item.addEventListener('click', () => {
                if (this.onResultClick) {
                    this.onResultClick(msg.messageId);
                }
                this.close();
            });

            fragment.appendChild(item);
        }

        this.resultsContainer.innerHTML = '';
        this.resultsContainer.appendChild(fragment);

        this.resultCountEl.textContent = `검색 결과: ${this.results.length}건`;
        this.resultCountEl.classList.remove('hidden');
    }
}