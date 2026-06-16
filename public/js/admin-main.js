import ApiClient from './api-client.js';
import * as ui from './admin-ui.js';

export async function init(core) {
    document.getElementById('refresh-btn')?.addEventListener('click', () => refresh(core));
    document.getElementById('delete-admin-logs-btn')?.addEventListener('click', () => deleteLoginLogs(core));
    document.getElementById('download-errors-btn')?.addEventListener('click', () => downloadErrorLogs(core));
    document.getElementById('delete-errors-btn')?.addEventListener('click', () => deleteErrorLogs(core));
    document.getElementById('audit-log-filter')?.addEventListener('change', loadAuditLogs);
    document.getElementById('export-audit-csv-btn')?.addEventListener('click', () => exportAuditCsv(core));
    document.getElementById('clear-audit-logs-btn')?.addEventListener('click', () => clearAuditLogs(core));

    await refresh(core);
}

async function refresh(core) {
    let metrics = null;
    try { metrics = await ApiClient.get('/api/admin/metrics'); } catch (_e) { /* ignore */ }
    if (metrics) {
        ui.updateMetrics(metrics);
        if (metrics.errorLogs) ui.renderErrorLogs(metrics.errorLogs);
    }
    try {
        const data = await ApiClient.get('/api/admin/logs');
        ui.renderAdminLoginLogs(data.logs || []);
    } catch (_e) { /* ignore */ }
    core.updateLastUpdated();
}

async function deleteLoginLogs(core) {
    if (!confirm('모든 관리자 로그인 로그를 삭제하시겠습니까?')) return;
    try { await ApiClient.post('/api/admin/delete-logs'); core.showNotification('삭제 완료', 'success'); }
    catch { core.showNotification('삭제 실패', 'error'); }
}

async function downloadErrorLogs(core) {
    try {
        const data = await ApiClient.get('/api/admin/metrics');
        const text = ui.formatErrorLogsText(data.errorLogs || []);
        const b = new Blob([text], { type: 'text/plain' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `error-logs-${Date.now()}.txt`; a.click();
    } catch { core.showNotification('다운로드 실패', 'error'); }
}

async function deleteErrorLogs(core) {
    if (!confirm('모든 에러 로그를 삭제하시겠습니까?')) return;
    try { await ApiClient.post('/api/admin/delete-error-logs'); core.showNotification('에러 로그 삭제됨', 'success'); }
    catch { core.showNotification('삭제 실패', 'error'); }
}

async function loadAuditLogs() {
    try {
        const filter = document.getElementById('audit-log-filter')?.value || 'all';
        const data = await ApiClient.get(`/api/admin/audit-logs?filter=${filter}`);
        ui.renderAuditLogs(Array.isArray(data) ? data : (data.logs || []));
    } catch (_e) { /* ignore */ }
}

async function exportAuditCsv(core) {
    try {
        const data = await ApiClient.get('/api/admin/audit-logs');
        const logs = Array.isArray(data) ? data : (data.logs || []);
        const csv = ['type,details,admin_ip,timestamp'];
        logs.forEach(l => csv.push(`"${l.type || ''}","${(l.description || l.details || '').replace(/"/g, '""')}","${l.ip || l.admin_ip || ''}","${l.timestamp || ''}"`));
        const b = new Blob([csv.join('\n')], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `audit-logs-${Date.now()}.csv`; a.click();
    } catch { core.showNotification('CSV 내보내기 실패', 'error'); }
}

async function clearAuditLogs(core) {
    if (!confirm('모든 감사 로그를 삭제하시겠습니까?')) return;
    try { await ApiClient.post('/api/admin/delete-audit-logs'); loadAuditLogs(); core.showNotification('감사 로그 삭제됨', 'success'); }
    catch { core.showNotification('삭제 실패', 'error'); }
}

export { refresh };
