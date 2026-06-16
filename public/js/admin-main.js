import ApiClient from './api-client.js';
import * as ui from './admin-ui.js';

export async function init(core) {
    document.getElementById('delete-admin-logs-btn')?.addEventListener('click', () => deleteLoginLogs(core));
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

export { refresh };
