export class SecurityHeadersManager {
    constructor() {
        this.overlay = null;
        this.createOverlay();
    }

    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'security-headers-overlay';
        this.overlay.className = 'fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm hidden';
        this.overlay.innerHTML = `
            <div class="fixed inset-0 md:inset-y-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl bg-gray-800 shadow-2xl flex flex-col md:rounded-xl overflow-hidden border border-gray-700">
                <div class="flex items-center justify-between p-4 border-b border-gray-700">
                    <div class="flex items-center gap-2">
                        <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-2.332 9-7.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                        </svg>
                        <h3 class="text-sm font-semibold text-gray-100">보안 헤더 분석</h3>
                    </div>
                    <button id="sec-close-btn" class="text-gray-400 hover:text-gray-200 transition-colors p-1.5 rounded-lg hover:bg-gray-700" aria-label="닫기">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div id="sec-content" class="flex-1 overflow-y-auto p-4" style="scrollbar-width: thin; scrollbar-color: #4B5563 transparent;">
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);

        this.overlay.querySelector('#sec-close-btn').addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.overlay.classList.contains('hidden')) {
                e.preventDefault();
                this.close();
            }
        });
    }

    async analyze(url) {
        this.open();
        const content = this.overlay.querySelector('#sec-content');
        content.innerHTML = `
            <div class="flex items-center justify-center h-full">
                <div class="flex items-center gap-2 text-gray-400">
                    <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span class="text-sm">분석 중...</span>
                </div>
            </div>
        `;

        try {
            const apiUrl = `https://api.kalpha.kr/security/headers?url=${encodeURIComponent(url)}`;
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            this.renderResult(data, url);
        } catch (error) {
            console.error('[SecurityHeaders] Error:', error);
            content.innerHTML = `
                <div class="flex items-center justify-center h-full">
                    <div class="text-center">
                        <svg class="w-10 h-10 mx-auto mb-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <p class="text-sm text-red-400">보안 헤더 분석 실패</p>
                        <p class="text-xs text-gray-500 mt-1">${this.esc(error.message)}</p>
                    </div>
                </div>
            `;
        }
    }

    renderResult(data, url) {
        const content = this.overlay.querySelector('#sec-content');

        const numericScore = typeof data.score === 'number' ? data.score : (typeof data.grade === 'number' ? data.grade : 0);
        const letterGrade = typeof data.grade === 'string' ? data.grade : (typeof data.score === 'string' ? data.score : '');
        const scoreColor = this.getScoreColor(numericScore);

        let headersHtml = '';
        const headerNames = {
            'Content-Security-Policy': 'CSP',
            'Strict-Transport-Security': 'HSTS',
            'X-Frame-Options': 'X-Frame',
            'X-Content-Type-Options': 'X-Content-Type',
            'Referrer-Policy': 'Referrer',
            'Permissions-Policy': 'Permissions',
            'Cross-Origin-Embedder-Policy': 'COEP',
            'Cross-Origin-Opener-Policy': 'COOP',
            'Cross-Origin-Resource-Policy': 'CORP',
            'Server': 'Server',
            'X-Powered-By': 'X-Powered-By'
        };

        for (const [key, value] of Object.entries(data.headers || {})) {
            const label = headerNames[key] || key;
            const badge = value
                ? '<span class="text-emerald-400">설정됨</span>'
                : '<span class="text-red-400">미설정</span>';
            headersHtml += `
                <div class="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0">
                    <span class="text-xs text-gray-300 font-medium">${this.esc(label)}</span>
                    ${badge}
                </div>
            `;
        }

        let analysisHtml = '';
        if (data.analysis && data.analysis.length > 0) {
            for (const item of data.analysis) {
                const statusConfig = {
                    excellent: { bg: 'bg-emerald-600/30', text: 'text-emerald-300', label: '우수' },
                    good: { bg: 'bg-blue-600/30', text: 'text-blue-300', label: '양호' },
                    warning: { bg: 'bg-amber-600/30', text: 'text-amber-300', label: '주의' },
                    danger: { bg: 'bg-red-600/30', text: 'text-red-300', label: '위험' },
                    info: { bg: 'bg-gray-600/30', text: 'text-gray-300', label: '정보' }
                };
                const cfg = statusConfig[item.status] || statusConfig.info;
                analysisHtml += `
                    <div class="py-2 border-b border-gray-700/50 last:border-0">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.bg} ${cfg.text}">${cfg.label}</span>
                            <span class="text-xs text-gray-200 font-medium">${this.esc(item.header)}</span>
                        </div>
                        <p class="text-xs text-gray-400 leading-relaxed">${this.esc(item.message)}</p>
                    </div>
                `;
            }
        }

        content.innerHTML = `
            <div class="space-y-4">
                <div class="bg-gray-700/50 rounded-lg p-4 border border-gray-600/50">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex-1 min-w-0 mr-3">
                            <p class="text-xs text-gray-400 mb-1">분석 대상</p>
                            <p class="text-sm text-gray-200 break-all truncate" title="${this.esc(url)}">${this.esc(this.truncateUrl(url))}</p>
                        </div>
                        <div class="text-center flex-shrink-0">
                            <div class="w-14 h-14 rounded-full flex items-center justify-center border-2 ${scoreColor.border} mb-1">
                                <span class="text-xl font-bold ${scoreColor.text}">${this.esc(letterGrade || String(numericScore))}</span>
                            </div>
                            <span class="text-[10px] text-gray-400">${numericScore}/100</span>
                        </div>
                    </div>
                    <div class="w-full bg-gray-600 rounded-full h-2">
                        <div class="h-2 rounded-full transition-all duration-500 ${scoreColor.bg}" style="width: ${numericScore}%"></div>
                    </div>
                </div>

                <div>
                    <h4 class="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                        </svg>
                        헤더 상태
                    </h4>
                    <div class="bg-gray-700/30 rounded-lg p-3 border border-gray-700/50">
                        ${headersHtml}
                    </div>
                </div>

                ${analysisHtml ? `
                <div>
                    <h4 class="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        상세 분석
                    </h4>
                    <div class="bg-gray-700/30 rounded-lg p-3 border border-gray-700/50">
                        ${analysisHtml}
                    </div>
                </div>
                ` : ''}

                <div class="bg-amber-900/20 rounded-lg p-3 border border-amber-700/30">
                    <p class="text-[11px] text-amber-300/70 leading-relaxed">본 분석은 개발 중인 API를 사용하며, 일부 사이트는 보안 헤더 검증이 불가할 수 있습니다. 결과의 신뢰성이 떨어질 수 있으니 참고용으로만 활용해주세요.</p>
                </div>
            </div>
        `;
    }

    getScoreColor(score) {
        if (score >= 90) return { bg: 'bg-emerald-500', text: 'text-emerald-300', border: 'border-emerald-500' };
        if (score >= 70) return { bg: 'bg-blue-500', text: 'text-blue-300', border: 'border-blue-500' };
        if (score >= 50) return { bg: 'bg-amber-500', text: 'text-amber-300', border: 'border-amber-500' };
        return { bg: 'bg-red-500', text: 'text-red-300', border: 'border-red-500' };
    }

    truncateUrl(url) {
        if (url.length > 60) return url.substring(0, 57) + '...';
        return url;
    }

    esc(text) {
        const div = document.createElement('div');
        div.textContent = String(text || '');
        return div.innerHTML;
    }

    open() {
        this.overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    close() {
        this.overlay.classList.add('hidden');
        document.body.style.overflow = '';
    }
}