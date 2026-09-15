// Extracted from announcements.html inline script (CSP: script-src without 'unsafe-inline').
(function () {
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    async function loadAnnouncements() {
        const loadingEl = document.getElementById('loading-state');
        const errorEl = document.getElementById('error-state');
        const emptyEl = document.getElementById('empty-state');
        const listEl = document.getElementById('announcements-list');
        const countBadge = document.getElementById('count-badge');

        // Show loading
        loadingEl.classList.remove('hidden');
        errorEl.classList.add('hidden');
        emptyEl.classList.add('hidden');
        listEl.classList.add('hidden');
        listEl.innerHTML = '';

        try {
            const res = await fetch('/api/announcements');
            if (!res.ok) throw new Error('Network error');
            const data = await res.json();

            loadingEl.classList.add('hidden');

            if (!Array.isArray(data) || data.length === 0) {
                emptyEl.classList.remove('hidden');
                return;
            }

            // Mark the currently fetched latest announcement as seen.
            const latestAnnouncementTs = data.reduce((latest, item) => {
                const numericTs = Number(item?.timestamp);
                const parsedTs = Number.isFinite(numericTs) ? numericTs : Date.parse(item?.timestamp);
                return Number.isFinite(parsedTs) && parsedTs > latest ? parsedTs : latest;
            }, 0);
            if (latestAnnouncementTs > 0) {
                localStorage.setItem('chatLastSeenAnnouncementTs', String(latestAnnouncementTs));
            }

            // Update badge
            countBadge.textContent = `총 ${data.length}개`;
            countBadge.classList.remove('hidden');

            // Render cards
            data.forEach((item, i) => {
                const card = document.createElement('div');
                const isEmergency = item.isEmergency;
                card.className = 'announcement-card fade-in-up bg-gray-800 border rounded-xl p-4 shadow-lg transition-colors ' +
                    (isEmergency ? 'border-red-700/60 hover:border-red-600/80' : 'border-yellow-700/40 hover:border-yellow-600/60');
                card.style.setProperty('--i', i);

                const date = new Date(item.timestamp);
                const dateStr = date.toLocaleString('ko-KR', {
                    year: 'numeric', month: 'long', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });

                const emergencyBadge = isEmergency
                    ? `<span class="ml-auto text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full font-medium">긴급</span>`
                    : '';
                const latestBadge = i === 0 && !isEmergency
                    ? `<span class="ml-auto text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-2 py-0.5 rounded-full font-medium">최신</span>`
                    : '';

                const typeLabel = isEmergency
                    ? '<span class="text-xs font-semibold text-red-300">긴급 공지</span>'
                    : '<span class="text-xs font-semibold text-yellow-300">관리자 공지</span>';

                const iconClass = isEmergency ? 'text-red-400' : 'text-yellow-400';

                const contentHtml = (() => {
                    const esc = escapeHtml(item.content);
                    const withLinks = esc.replace(/(https?:\/\/[^\s<>"']+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline break-all">$1</a>');
                    return withLinks.replace(/\n/g, '<br>');
                })();
                card.innerHTML = `
                    <div class="flex items-center gap-2 mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ${iconClass} flex-shrink-0" fill="none"
                            viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                        </svg>
                        ${typeLabel}
                        ${emergencyBadge}
                        ${latestBadge}
                    </div>
                    <p class="text-sm text-gray-200 whitespace-pre-wrap break-words leading-relaxed mb-3">${contentHtml}</p>
                <div class="flex items-center gap-1.5 text-xs text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    ${dateStr}
                </div>
            `;
                listEl.appendChild(card);
            });

            listEl.classList.remove('hidden');

        } catch (e) {
            console.error('Failed to load announcements:', e);
            loadingEl.classList.add('hidden');
            errorEl.classList.remove('hidden');
        }
    }

    document.getElementById('retry-button')?.addEventListener('click', loadAnnouncements);

    // Load on page start
    loadAnnouncements();

    // Emergency polling, countdown, and auto-redirect
    (function initEmergencyPolling() {
        const params = new URLSearchParams(location.search);
        if (params.get('from') !== 'emergency') return;

        const banner = document.getElementById('emergency-banner');
        const resolved = document.getElementById('emergency-resolved');
        banner.classList.remove('hidden');

        // 10-second minimum stay enforcement
        const backLink = document.querySelector('header a[href="/"]');
        const redirectTime = parseInt(localStorage.getItem('chatEmergencyRedirectTime') || '0');
        const minStay = 10000;
        const elapsed = Date.now() - redirectTime;
        const remaining = Math.max(0, Math.ceil((minStay - elapsed) / 1000));

        if (remaining > 0) {
            backLink.removeAttribute('href');
            backLink.classList.add('pointer-events-none', 'opacity-40');
            const countdownEl = document.createElement('span');
            countdownEl.id = 'emergency-countdown';
            countdownEl.className = 'text-xs text-red-300 ml-2';
            countdownEl.textContent = remaining + '초 후 이동 가능';
            backLink.parentElement.appendChild(countdownEl);

            const countdownInterval = setInterval(() => {
                const nowRemaining = Math.max(0, Math.ceil((minStay - (Date.now() - redirectTime)) / 1000));
                if (nowRemaining <= 0) {
                    clearInterval(countdownInterval);
                    backLink.href = '/';
                    backLink.classList.remove('pointer-events-none', 'opacity-40');
                    backLink.classList.add('hover:bg-gray-700');
                    countdownEl.textContent = '채팅으로 이동';
                    countdownEl.className = 'text-xs text-green-300 ml-2';
                } else {
                    countdownEl.textContent = nowRemaining + '초 후 이동 가능';
                }
            }, 1000);
        }

        let pollCount = 0;
        const maxPolls = 120; // 10 minutes at 5s intervals
        const pollInterval = setInterval(async () => {
            pollCount++;
            try {
                const res = await fetch('/api/emergency-announcement');
                const data = await res.json();
                if (!data.isEmergency || pollCount >= maxPolls) {
                    clearInterval(pollInterval);
                    banner.classList.add('hidden');
                    resolved.classList.remove('hidden');
                    localStorage.removeItem('chatEmergencySeenTs');
                    localStorage.removeItem('chatEmergencyRedirectTime');
                    setTimeout(() => { location.href = '/'; }, 3000);
                }
            } catch {
                // retry on error
            }
        }, 5000);
    })();
})();
