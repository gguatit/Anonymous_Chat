import ApiClient from './api-client.js';

const securityState = {
    events: [],
    total: 0,
    page: 1,
    limit: 50,
    category: '',
    severity: '',
    search: '',
    ip: '',
    stats: null,
    riskIPs: [],
    badge: { critical: 0, high: 0, medium: 0 },
};

let _core = null;

function formatTimestamp(ts) {
    if (!ts) return '-';
    return new Date(ts).toLocaleString('ko-KR');
}

function severityClass(severity) {
    const map = { low: 'sev-low', medium: 'sev-medium', high: 'sev-high', critical: 'sev-critical' };
    return map[severity] || 'sev-low';
}

function categoryLabel(cat) {
    const map = { auth: '인증', endpoint: '엔드포인트', input: '입력값', websocket: '웹소켓', system: '시스템' };
    return map[cat] || cat;
}

function renderEvents() {
    const tbody = document.getElementById('security-events-body');
    if (!tbody) return;
    if (securityState.events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding:2rem;text-align:center;color:#94a3b8">이벤트가 없습니다.</td></tr>';
        return;
    }
    tbody.innerHTML = securityState.events.map(e => `
        <tr class="event-row" data-id="${e.id}">
            <td>${e.id}</td>
            <td><span class="badge-cat">${categoryLabel(e.category)}</span></td>
            <td><span class="${severityClass(e.severity)}">${e.severity}</span></td>
            <td class="mono">${e.ip || '-'}</td>
            <td class="mono truncate">${e.path || '-'}</td>
            <td>${(e.details || '').substring(0, 80)}</td>
            <td class="mono">${formatTimestamp(e.timestamp)}</td>
        </tr>
        <tr id="detail-${e.id}" class="event-detail hidden">
            <td colspan="7">
                <div class="detail-grid">
                    <div><strong>Event Type:</strong> ${e.event_type}</div>
                    <div><strong>Method:</strong> ${e.method || '-'}</div>
                    <div><strong>User Agent:</strong> ${(e.user_agent || '').substring(0, 100)}</div>
                    <div><strong>Country:</strong> ${e.country || '-'}</div>
                    <div><strong>Session:</strong> ${e.session_id || '-'}</div>
                    <div><strong>Score:</strong> ${e.severity_score || 0}</div>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderPagination() {
    const el = document.getElementById('security-pagination');
    if (!el) return;
    const totalPages = Math.ceil(securityState.total / securityState.limit);
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    let html = '';
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="page-btn ${i === securityState.page ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    el.innerHTML = html;
}

function renderStats() {
    const el = document.getElementById('security-stats');
    if (!el || !securityState.stats) return;
    const s = securityState.stats;
    el.innerHTML = `
        <div class="sec-stat">
            <div class="sec-stat-val">${s.last24h}</div>
            <div class="sec-stat-label">24h 이벤트</div>
        </div>
        <div class="sec-stat sec-stat-critical">
            <div class="sec-stat-val">${securityState.badge.critical}</div>
            <div class="sec-stat-label">Critical</div>
        </div>
        <div class="sec-stat sec-stat-high">
            <div class="sec-stat-val">${securityState.badge.high}</div>
            <div class="sec-stat-label">High</div>
        </div>
        <div class="sec-stat sec-stat-medium">
            <div class="sec-stat-val">${securityState.badge.medium}</div>
            <div class="sec-stat-label">Medium</div>
        </div>
    `;
}

function renderRiskIPs() {
    const tbody = document.getElementById('risk-ips-body');
    if (!tbody) return;
    if (securityState.riskIPs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding:1rem;text-align:center;color:#94a3b8">위험 IP가 없습니다.</td></tr>';
        return;
    }
    tbody.innerHTML = securityState.riskIPs.map(ip => `
        <tr>
            <td class="mono">${ip.ip}</td>
            <td>${Math.round(ip.score)}</td>
            <td>${ip.eventCount}</td>
            <td><button class="btn-sm btn-red" data-block-ip="${ip.ip}">차단</button></td>
        </tr>
    `).join('');
}

async function loadEvents() {
    try {
        const params = new URLSearchParams({ page: securityState.page, limit: securityState.limit.toString() });
        if (securityState.category) params.set('category', securityState.category);
        if (securityState.severity) params.set('severity', securityState.severity);
        if (securityState.search) params.set('search', securityState.search);
        if (securityState.ip) params.set('ip', securityState.ip);
        const data = await ApiClient.get(`/api/admin/security/events?${params}`);
        securityState.events = data.events || [];
        securityState.total = data.total || 0;
        securityState.page = data.page || 1;
        renderEvents();
        renderPagination();
    } catch (_e) { /* ignore */ }
}

async function loadStats() {
    try {
        const data = await ApiClient.get('/api/admin/security/stats');
        securityState.stats = data;
        renderStats();
    } catch (_e) { /* ignore */ }
}

async function loadRiskIPs() {
    try {
        const data = await ApiClient.get('/api/admin/security/risk-ips');
        securityState.riskIPs = data.riskIPs || [];
        renderRiskIPs();
    } catch (_e) { /* ignore */ }
}

async function loadBadge() {
    try {
        const data = await ApiClient.get('/api/admin/security/badge');
        securityState.badge = data;
        updateBadgeDisplay();
    } catch (_e) { /* ignore */ }
}

function updateBadgeDisplay() {
    document.querySelectorAll('[data-badge="security"]').forEach(el => {
        const total = securityState.badge.critical + securityState.badge.high + securityState.badge.medium;
        if (total > 0) {
            el.style.display = 'inline-flex';
            el.textContent = total;
            el.style.background = securityState.badge.critical > 0 ? '#dc2626'
                : securityState.badge.high > 0 ? '#ea580c' : '#d97706';
        } else {
            el.style.display = 'none';
        }
    });
}

async function exportCSV() {
    try {
        const params = new URLSearchParams();
        if (securityState.category) params.set('category', securityState.category);
        const res = await ApiClient.getRaw(`/api/admin/security/events/export?${params}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `security-events-${Date.now()}.csv`;
        a.click(); URL.revokeObjectURL(url);
        _core?.showNotification('CSV 내보내기 완료', 'success');
    } catch (_e) { _core?.showNotification('CSV 내보내기 실패', 'error'); }
}

async function clearOldEvents() {
    if (!confirm('90일 이상 된 보안 이벤트를 모두 삭제하시겠습니까?')) return;
    try {
        const data = await ApiClient.post('/api/admin/security/events/clear');
        _core?.showNotification(`${data?.deleted || 0}개 이벤트 삭제됨`, 'success');
        loadEvents(); loadStats();
    } catch (_e) { _core?.showNotification('이벤트 삭제 실패', 'error'); }
}

async function blockIP(ip) {
    if (!confirm(`${ip} IP를 24시간 차단하시겠습니까?`)) return;
    try {
        await ApiClient.post('/api/admin/security/block-ip', { ip });
        _core?.showNotification(`${ip} 차단 완료`, 'success');
        loadRiskIPs();
    } catch (_e) { _core?.showNotification('IP 차단 실패', 'error'); }
}

function debounce(fn, delay) {
    let timer;
    return function (...args) { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), delay); };
}

export async function init(core) {
    _core = core;

    document.getElementById('security-refresh-btn')?.addEventListener('click', () => refresh(core));
    document.getElementById('security-export-btn')?.addEventListener('click', exportCSV);
    document.getElementById('security-clear-btn')?.addEventListener('click', clearOldEvents);

    const categoryFilter = document.getElementById('security-category-filter');
    const severityFilter = document.getElementById('security-severity-filter');
    const searchInput = document.getElementById('security-search');
    const ipInput = document.getElementById('security-ip-filter');

    categoryFilter?.addEventListener('change', () => { securityState.category = categoryFilter.value; securityState.page = 1; loadEvents(); });
    severityFilter?.addEventListener('change', () => { securityState.severity = severityFilter.value; securityState.page = 1; loadEvents(); });
    searchInput?.addEventListener('input', debounce(() => { securityState.search = searchInput.value; securityState.page = 1; loadEvents(); }, 400));
    ipInput?.addEventListener('input', debounce(() => { securityState.ip = ipInput.value.trim(); securityState.page = 1; loadEvents(); }, 400));

    document.getElementById('security-events-body')?.addEventListener('click', (e) => {
        const row = e.target.closest('.event-row');
        if (!row) return;
        const detail = document.getElementById(`detail-${row.dataset.id}`);
        if (detail) detail.classList.toggle('hidden');
    });
    document.getElementById('risk-ips-body')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-block-ip]');
        if (btn) blockIP(btn.dataset.blockIp);
    });
    document.getElementById('security-pagination')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.page-btn');
        if (!btn) return;
        securityState.page = parseInt(btn.dataset.page);
        loadEvents();
        document.getElementById('security-events-table')?.scrollIntoView({ behavior: 'smooth' });
    });

    await refresh(core);
}

export async function refresh(core) {
    core.updateLastUpdated();
    await Promise.allSettled([loadEvents(), loadStats(), loadRiskIPs(), loadBadge()]);
}
