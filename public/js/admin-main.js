import ApiClient from './api-client.js';
import renderMethods from './admin-render.js';
import logMethods from './admin-logs.js';

const methods = { ...renderMethods, ...logMethods };

export async function init(core) {
    document.getElementById('refresh-btn')?.addEventListener('click', () => refresh(core));

    document.getElementById('delete-admin-logs-btn')?.addEventListener('click', () => deleteLoginLogs(core));
    document.getElementById('download-errors-btn')?.addEventListener('click', () => downloadErrorLogs(core));
    document.getElementById('delete-errors-btn')?.addEventListener('click', () => deleteErrorLogs(core));
    document.getElementById('audit-log-filter')?.addEventListener('change', () => loadAuditLogs());
    document.getElementById('export-audit-csv-btn')?.addEventListener('click', () => exportAuditCsv(core));
    document.getElementById('clear-audit-logs-btn')?.addEventListener('click', () => clearAuditLogs(core));

    const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
    const mobileAutoRefresh = document.getElementById('mobile-auto-refresh');
    const autoRefreshInterval = document.getElementById('auto-refresh-interval');
    const mobileRefreshInterval = document.getElementById('mobile-refresh-interval');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const closeMobileMenu = document.getElementById('close-mobile-menu');
    const mobileExportCsv = document.getElementById('mobile-export-csv');

    mobileMenuBtn?.addEventListener('click', () => {
        mobileMenu?.classList.remove('hidden');
        setTimeout(() => mobileMenu?.querySelector('.mobile-menu')?.classList.add('active'), 10);
    });
    closeMobileMenu?.addEventListener('click', () => {
        mobileMenu?.querySelector('.mobile-menu')?.classList.remove('active');
        setTimeout(() => mobileMenu?.classList.add('hidden'), 300);
    });
    mobileMenu?.addEventListener('click', (e) => {
        if (e.target === mobileMenu) {
            mobileMenu?.querySelector('.mobile-menu')?.classList.remove('active');
            setTimeout(() => mobileMenu?.classList.add('hidden'), 300);
        }
    });
    mobileAutoRefresh?.addEventListener('change', (e) => {
        if (autoRefreshToggle) autoRefreshToggle.checked = e.target.checked;
    });
    mobileRefreshInterval?.addEventListener('change', (e) => {
        if (autoRefreshInterval) autoRefreshInterval.value = e.target.value;
    });
    mobileExportCsv?.addEventListener('click', () => {
        mobileMenu?.querySelector('.mobile-menu')?.classList.remove('active');
        setTimeout(() => mobileMenu?.classList.add('hidden'), 300);
    });

    document.getElementById('export-csv-btn')?.addEventListener('click', () => core.navigateTo('logs'));

    await refresh(core);
}

async function refresh(core) {
    core.updateLastUpdated();
    await Promise.allSettled([loadMetrics(), loadAdminLoginLogs(), loadErrorLogs(core)]);
}

async function loadMetrics() {
    try {
        const res = await ApiClient.get('/api/admin/metrics');
        const data = await res.json();
        methods.updateMetrics(data);
    } catch (_e) { /* ignore */ }
}

async function loadAdminLoginLogs() {
    try {
        const res = await ApiClient.get('/api/admin/logs');
        const data = await res.json();
        methods.renderAdminLoginLogs(data.logs || []);
    } catch (_e) { /* ignore */ }
}

async function deleteLoginLogs(core) {
    if (!confirm('모든 관리자 로그인 로그를 삭제하시겠습니까?')) return;
    try {
        await ApiClient.post('/api/admin/delete-logs');
        loadAdminLoginLogs();
        core.showNotification('로그인 로그가 삭제되었습니다.', 'success');
    } catch (_e) { core.showNotification('로그인 로그 삭제 실패', 'error'); }
}

async function loadErrorLogs(_core) {
    try {
        const res = await ApiClient.get('/api/admin/metrics');
        const data = await res.json();
        const filter = document.getElementById('error-log-filter')?.value || 'all';
        const search = document.getElementById('error-log-search')?.value || '';
        let logs = data.errorLogs || [];
        if (filter !== 'all') logs = logs.filter(l => l.type === filter);
        if (search) {
            const s = search.toLowerCase();
            logs = logs.filter(l => (l.message || '').toLowerCase().includes(s) || (l.context || '').toLowerCase().includes(s));
        }
        methods.renderErrorLogs(logs);
    } catch (_e) { /* ignore */ }
}

async function downloadErrorLogs(core) {
    try {
        const res = await ApiClient.get('/api/admin/metrics');
        const data = await res.json();
        const text = methods.formatErrorLogsText(data.errorLogs || []);
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `error-logs-${Date.now()}.txt`;
        a.click(); URL.revokeObjectURL(url);
    } catch (_e) { core.showNotification('로그 다운로드 실패', 'error'); }
}

async function deleteErrorLogs(core) {
    if (!confirm('모든 에러 로그를 삭제하시겠습니까?')) return;
    try {
        await ApiClient.post('/api/admin/delete-error-logs');
        loadErrorLogs(core);
        core.showNotification('에러 로그가 삭제되었습니다.', 'success');
    } catch (_e) { core.showNotification('에러 로그 삭제 실패', 'error'); }
}

async function loadAuditLogs() {
    try {
        const filter = document.getElementById('audit-log-filter')?.value || 'all';
        const res = await ApiClient.get(`/api/admin/audit-logs?filter=${filter}`);
        const data = await res.json();
        methods.renderAuditLogs(data.logs || []);
    } catch (_e) { /* ignore */ }
}

async function exportAuditCsv(core) {
    try {
        const res = await ApiClient.get('/api/admin/audit-logs');
        const data = await res.json();
        const logs = data.logs || [];
        const csv = ['type,details,admin_ip,timestamp'];
        logs.forEach(l => csv.push(`"${l.type || ''}","${(l.description || '').replace(/"/g, '""')}","${l.ip || ''}","${l.timestamp || ''}"`));
        const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `audit-logs-${Date.now()}.csv`;
        a.click(); URL.revokeObjectURL(url);
    } catch (_e) { core.showNotification('CSV 내보내기 실패', 'error'); }
}

async function clearAuditLogs(core) {
    if (!confirm('모든 감사 로그를 삭제하시겠습니까?')) return;
    try {
        await ApiClient.post('/api/admin/delete-audit-logs');
        loadAuditLogs();
        core.showNotification('감사 로그가 삭제되었습니다.', 'success');
    } catch (_e) { core.showNotification('감사 로그 삭제 실패', 'error'); }
}
