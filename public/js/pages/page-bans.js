import ApiClient from '../api-client.js';
import * as ui from '../admin-ui.js';

export async function init(core) {
    await refresh(core);
}

export async function refresh(core) {
    try {
        const data = await ApiClient.get('/api/admin/banned-ips');
        ui.renderBannedIPs(data);
        ui.renderBannedSessions(data?.sessions || []);
    } catch (_e) { /* ignore */ }
    core.updateLastUpdated();
}
