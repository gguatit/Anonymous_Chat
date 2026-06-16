import ApiClient from '../api-client.js';
import renderMethods from '../admin-render.js';

export async function init(core) {
    window._adminUnbanIP = async (ip) => {
        if (!confirm(`${ip} 차단을 해제하시겠습니까?`)) return;
        try {
            await ApiClient.post('/api/admin/unban-ip', { ip });
            core.showNotification('차단 해제 완료', 'success');
            await refresh(core);
        } catch (_e) { core.showNotification('차단 해제 실패', 'error'); }
    };

    await refresh(core);
}

export async function refresh(core) {
    try {
        const res = await ApiClient.get('/api/admin/banned-ips');
        const data = await res.json();
        renderMethods.renderBannedIPs(data.ips || []);
    } catch (_e) { /* ignore */ }
    core.updateLastUpdated();
}
