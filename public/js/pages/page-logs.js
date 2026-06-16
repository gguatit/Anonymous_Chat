import ApiClient from '../api-client.js';
import renderMethods from '../admin-render.js';

let _core;

function debounce(fn, delay) {
    let timer;
    return function (...args) { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), delay); };
}

export async function init(core) {
    _core = core;
    document.getElementById('download-errors-btn')?.addEventListener('click', () => downloadErrors(core));
    document.getElementById('delete-errors-btn')?.addEventListener('click', () => deleteErrors(core));
    document.getElementById('error-log-filter')?.addEventListener('change', () => loadErrorLogs(core));
    document.getElementById('error-log-search')?.addEventListener('input', debounce(() => loadErrorLogs(core), 400));
    document.getElementById('audit-log-filter')?.addEventListener('change', () => loadAuditLogs());
    document.getElementById('export-audit-csv-btn')?.addEventListener('click', () => exportAuditCsv(core));
    document.getElementById('clear-audit-logs-btn')?.addEventListener('click', () => clearAuditLogs(core));
    document.getElementById('delete-admin-logs-btn')?.addEventListener('click', () => deleteLoginLogs(core));

    await Promise.allSettled([loadErrorLogs(core), loadAuditLogs(), loadLoginLogs()]);
    core.updateLastUpdated();
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
        renderMethods.renderErrorLogs(logs);
    } catch (_e) { /* ignore */ }
}

async function loadAuditLogs() {
    try {
        const filter = document.getElementById('audit-log-filter')?.value || 'all';
        const res = await ApiClient.get(`/api/admin/audit-logs?filter=${filter}`);
        const data = await res.json();
        renderMethods.renderAuditLogs(data.logs || []);
    } catch (_e) { /* ignore */ }
}

async function loadLoginLogs() {
    try {
        const res = await ApiClient.get('/api/admin/logs');
        const data = await res.json();
        renderMethods.renderAdminLoginLogs(data.logs || []);
    } catch (_e) { /* ignore */ }
}

async function downloadErrors(core) {
    try {
        const res = await ApiClient.get('/api/admin/metrics');
        const data = await res.json();
        const text = renderMethods.formatErrorLogsText(data.errorLogs || []);
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `error-logs-${Date.now()}.txt`;
        a.click(); URL.revokeObjectURL(url);
    } catch (_e) { core.showNotification('다운로드 실패', 'error'); }
}

async function deleteErrors(core) {
    if (!confirm('모든 에러 로그를 삭제하시겠습니까?')) return;
    try {
        await ApiClient.post('/api/admin/delete-error-logs');
        await loadErrorLogs(core);
        core.showNotification('에러 로그 삭제됨', 'success');
    } catch (_e) { core.showNotification('삭제 실패', 'error'); }
}

async function deleteLoginLogs(core) {
    if (!confirm('관리자 로그인 로그를 삭제하시겠습니까?')) return;
    try {
        await ApiClient.post('/api/admin/delete-logs');
        await loadLoginLogs();
        core.showNotification('삭제 완료', 'success');
    } catch (_e) { core.showNotification('삭제 실패', 'error'); }
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
        await loadAuditLogs();
        core.showNotification('감사 로그 삭제됨', 'success');
    } catch (_e) { core.showNotification('삭제 실패', 'error'); }
}

export async function refresh(core) {
    await Promise.allSettled([loadErrorLogs(core), loadAuditLogs(), loadLoginLogs()]);
    core.updateLastUpdated();
}
