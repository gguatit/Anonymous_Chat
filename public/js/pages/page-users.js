import ApiClient from '../api-client.js';
import * as ui from '../admin-ui.js';

export async function init(core) {
    document.getElementById('close-user-modal')?.addEventListener('click', () => {
        const m = document.getElementById('user-details-modal');
        if (m) m.classList.remove('open');
    });

    window._adminKickUser = async (sid) => {
        if (!confirm('이 사용자를 킥하시겠습니까?')) return;
        try { await ApiClient.post('/api/admin/kick-user', { sessionId: sid }); core.showNotification('킥 완료', 'success'); await refresh(core); }
        catch { core.showNotification('킥 실패', 'error'); }
    };
    window._adminUnbanIP = async (ip) => {
        if (!confirm(`${ip} 차단을 해제하시겠습니까?`)) return;
        try { await ApiClient.post('/api/admin/unban-ip', { ip }); core.showNotification('차단 해제 완료', 'success'); await refresh(core); }
        catch { core.showNotification('차단 해제 실패', 'error'); }
    };
    window._showUserDetails = async (sid) => {
        try {
            const data = await ApiClient.get(`/api/admin/user-details?sessionId=${sid}`);
            const modal = document.getElementById('user-details-modal');
            const content = document.getElementById('user-details-content');
            if (!modal || !content) return;
            content.innerHTML = `<div class="space-y-3"><div class="flex justify-between"><span class="text-gray-400">Session ID:</span><span class="font-mono text-sm">${sid.substring(0, 30)}...</span></div><div class="flex justify-between"><span class="text-gray-400">IP:</span><span>${data?.ip || '-'}</span></div><div class="flex justify-between"><span class="text-gray-400">Country:</span><span>${data?.country || '-'}</span></div><div class="flex justify-between"><span class="text-gray-400">User Agent:</span><span class="text-xs">${(data?.user_agent || '-').substring(0, 80)}</span></div><div class="flex justify-between"><span class="text-gray-400">Nickname:</span><span>${data?.nickname || '-'}</span></div><div class="flex justify-between"><span class="text-gray-400">Messages:</span><span>${data?.message_count || 0}</span></div></div>`;
            modal.classList.add('open');
        } catch { core.showNotification('사용자 정보 로드 실패', 'error'); }
    };

    await refresh(core);
}

export async function refresh(core) {
    try {
        const data = await ApiClient.get('/api/admin/sessions');
        ui.renderActiveSessions(Array.isArray(data) ? data : (data.sessions || []));
    } catch (_e) { /* ignore */ }
    try {
        const data = await ApiClient.get('/api/admin/banned-ips');
        ui.renderBannedIPs(Array.isArray(data) ? data : (data.ips || []));
    } catch (_e) { /* ignore */ }
    core.updateLastUpdated();
}
