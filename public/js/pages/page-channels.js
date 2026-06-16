import ApiClient from '../api-client.js';
import * as ui from '../admin-ui.js';

export async function init(core) {
    document.getElementById('refresh-channels-btn')?.addEventListener('click', () => loadChannels());
    document.getElementById('close-channel-detail')?.addEventListener('click', hideDetail);
    document.getElementById('channel-detail-modal')?.addEventListener('click', (e) => { if (e.target.id === 'channel-detail-modal') hideDetail(); });

    window._viewChannelDetail = async (slug) => {
        try {
            const data = await ApiClient.get(`/api/admin/channel-details?slug=${slug}`);
            const channel = Array.isArray(data) ? data[0] : (data.channel || data);
            ui.renderChannelDetail(channel);
        } catch { core.showNotification('채널 정보 로드 실패', 'error'); }
    };
    window._deleteChannel = async (slug, name) => {
        if (!confirm(`${name} 채널을 삭제하시겠습니까?`)) return;
        try { await ApiClient.post('/api/admin/channel-delete', { slug }); core.showNotification('채널 삭제 완료', 'success'); loadChannels(); }
        catch { core.showNotification('채널 삭제 실패', 'error'); }
    };

    await loadChannels();
}

function hideDetail() {
    const m = document.getElementById('channel-detail-modal');
    if (m) m.classList.remove('open');
}

async function loadChannels() {
    try {
        const data = await ApiClient.get('/api/admin/channels');
        ui.renderChannels(Array.isArray(data) ? data : (data.channels || []));
    } catch (_e) { /* ignore */ }
}

export async function refresh(core) {
    await loadChannels();
    core.updateLastUpdated();
}

export function handleEvent(core, _action, _payload) {
    refresh(core);
}
