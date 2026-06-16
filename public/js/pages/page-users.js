import ApiClient from '../api-client.js';
import * as ui from '../admin-ui.js';

let _kickTargetSessionId = null;

function showKickUserModal(sid, ip) {
    _kickTargetSessionId = sid;
    const elSid = document.getElementById('kick-modal-sessionid');
    const elIp = document.getElementById('kick-modal-ip');
    if (elSid) elSid.textContent = sid;
    if (elIp) elIp.textContent = ip || 'N/A';
    document.getElementById('kick-user-modal')?.classList.add('open');
}

function hideKickUserModal() {
    document.getElementById('kick-user-modal')?.classList.remove('open');
    _kickTargetSessionId = null;
}

export async function init(core) {
    const closeUserModal = () => document.getElementById('user-details-modal')?.classList.remove('open');
    document.getElementById('close-user-modal')?.addEventListener('click', closeUserModal);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeUserModal(); });
    document.getElementById('close-kick-modal')?.addEventListener('click', hideKickUserModal);
    document.getElementById('cancel-kick-btn')?.addEventListener('click', hideKickUserModal);
    document.getElementById('kick-user-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'kick-user-modal') hideKickUserModal();
    });
    document.getElementById('confirm-kick-btn')?.addEventListener('click', async () => {
        if (!_kickTargetSessionId) return;
        const duration = parseInt(document.querySelector('input[name="kick-duration"]:checked')?.value || '0');
        try {
            await ApiClient.post('/api/admin/kick-user', { sessionId: _kickTargetSessionId, banDuration: duration });
            core.showNotification(duration === 0 ? '퇴장 처리됨' : `${Math.round(duration / 60)}분 차단됨`, 'success');
            hideKickUserModal();
            await refresh(core);
        } catch { core.showNotification('강퇴 실패', 'error'); }
    });

    window._adminKickUser = (sid, ip) => showKickUserModal(sid, ip);
    window._showUserDetails = async (sid) => {
        try {
            const data = await ApiClient.get(`/api/admin/user-details?sessionId=${sid}`);
            const modal = document.getElementById('user-details-modal');
            const content = document.getElementById('user-details-content');
            if (!modal || !content) return;
            const m = data?.metadata || {};
            const env = m?.environment || {};
            const msgCount = data?.messageCount ?? 0;
            content.innerHTML = `<div class="space-y-3"><div class="flex justify-between"><span class="text-gray-400">Session ID:</span><span class="font-mono text-sm">${sid.substring(0, 30)}...</span></div><div class="flex justify-between"><span class="text-gray-400">IP:</span><span>${m.ip || env.ip || '-'}</span></div><div class="flex justify-between"><span class="text-gray-400">Country:</span><span>${env.country || '-'}</span></div><div class="flex justify-between"><span class="text-gray-400">User Agent:</span><span class="text-xs">${(env.userAgent || '-').substring(0, 80)}</span></div><div class="flex justify-between"><span class="text-gray-400">Nickname:</span><span>${m.nickname || '-'}</span></div><div class="flex justify-between"><span class="text-gray-400">Messages:</span><span>${msgCount}</span></div></div>`;
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

export function handleEvent(core, _action, _payload) {
    refresh(core);
}
