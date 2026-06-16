import ApiClient from '../api-client.js';
import renderMethods from '../admin-render.js';

export async function init(core) {
    document.getElementById('refresh-channels-btn')?.addEventListener('click', () => loadChannels());
    document.getElementById('close-channel-detail')?.addEventListener('click', hideDetail);
    document.getElementById('channel-detail-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'channel-detail-modal') hideDetail();
    });

    window._viewChannelDetail = async (channelId) => {
        try {
            const res = await ApiClient.get(`/api/admin/channels/${channelId}`);
            const channel = await res.json();
            renderMethods.renderChannelDetail(channel);
            const modal = document.getElementById('channel-detail-modal');
            if (modal) {
                modal.classList.remove('hidden');
                document.getElementById('close-channel-detail')?.focus();
            }
        } catch (_e) { core.showNotification('채널 정보 로드 실패', 'error'); }
    };
    window._deleteChannel = async (channelId, name) => {
        if (!confirm(`${name} 채널을 삭제하시겠습니까?`)) return;
        try {
            await ApiClient.post(`/api/admin/channels/${channelId}/delete`);
            core.showNotification('채널 삭제 완료', 'success');
            loadChannels();
        } catch (_e) { core.showNotification('채널 삭제 실패', 'error'); }
    };

    await loadChannels();
}

function hideDetail() {
    const modal = document.getElementById('channel-detail-modal');
    if (modal) modal.classList.add('hidden');
}

async function loadChannels() {
    try {
        const res = await ApiClient.get('/api/admin/channels');
        const data = await res.json();
        renderMethods.renderChannels(data.channels || []);
    } catch (_e) { /* ignore */ }
}

export async function refresh(core) {
    await loadChannels();
    core.updateLastUpdated();
}
