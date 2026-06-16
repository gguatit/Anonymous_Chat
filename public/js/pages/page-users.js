import ApiClient from '../api-client.js';
import renderMethods from '../admin-render.js';

export async function init(core) {
    document.getElementById('close-user-modal')?.addEventListener('click', () => {
        const m = document.getElementById('user-details-modal');
        if (m) hideModalStyles(m);
    });

    window._adminKickUser = async (sessionId) => {
        if (!confirm('이 사용자를 킥하시겠습니까?')) return;
        try {
            await ApiClient.post('/api/admin/kick-user', { sessionId });
            core.showNotification('사용자 킥 완료', 'success');
            await refresh(core);
        } catch (_e) { core.showNotification('킥 실패', 'error'); }
    };
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

function hideModalStyles(modal) {
    if (modal) modal.classList.add('hidden');
}

export async function refresh(core) {
    try {
        const res = await ApiClient.get('/api/admin/sessions');
        const data = await res.json();
        renderMethods.renderActiveSessions(data.sessions || []);
    } catch (_e) { /* ignore */ }
    try {
        const bansRes = await ApiClient.get('/api/admin/banned-ips');
        const bansData = await bansRes.json();
        renderMethods.renderBannedIPs(bansData.ips || []);
    } catch (_e) { /* ignore */ }
    core.updateLastUpdated();
}
