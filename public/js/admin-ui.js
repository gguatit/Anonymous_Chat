import { escapeHtml } from './utils.js';

const h = escapeHtml;
const _now = () => Date.now();

function tr(id) { return id && id.length > 20 ? id.substring(0, 20) + '...' : id || 'Unknown'; }

function dur(ms) {
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), hr = Math.floor(m / 60);
    if (hr > 0) return `${hr}시간 전`;
    if (m > 0) return `${m}분 전`;
    return `${s}초 전`;
}

export function updateMetrics(metrics) {
    const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = (v ?? 0).toLocaleString(); };
    el('stat-active-connections', metrics.activeConnections);
    el('stat-total-messages', metrics.totalMessages);
    el('stat-total-connections', metrics.totalConnections);
    el('stat-errors', metrics.errors);
    const st = document.getElementById('server-time');
    if (st) st.textContent = new Date().toLocaleString('ko-KR');
    if (metrics.uptime) {
        const ut = document.getElementById('uptime');
        if (ut) ut.textContent = `${Math.floor(metrics.uptime / 3600000)}시간 ${Math.floor((metrics.uptime % 3600000) / 60000)}분`;
    }
}

export function renderErrorLogs(logs) {
    const container = document.getElementById('error-logs-list');
    if (!container) return;
    if (!logs || logs.length === 0) {
        container.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500">최근 발생한 오류가 없습니다.</td></tr>';
        return;
    }
    const filter = document.getElementById('error-log-filter')?.value || 'all';
    const search = (document.getElementById('error-log-search')?.value || '').toLowerCase();
    let filtered = logs;
    if (filter !== 'all') filtered = filtered.filter(l => l.type === filter);
    if (search) filtered = filtered.filter(l => (l.message || '').toLowerCase().includes(search) || (l.location || '').toLowerCase().includes(search));
    if (!filtered.length) {
        container.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500">검색 결과가 없습니다.</td></tr>';
        return;
    }
    container.innerHTML = filtered.map(l => {
        const d = new Date(l.timestamp);
        const badgeMap = { WS_MESSAGE_PARSE: 'bg-yellow-900/50 text-yellow-500', CLIENT_ERROR: 'bg-orange-900/50 text-orange-500', WS_CONNECTION: 'bg-purple-900/50 text-purple-500', SYSTEM_ERROR: 'bg-red-900/50 text-red-500' };
        const badge = badgeMap[l.type] || 'bg-gray-700 text-gray-300';
        return `<tr class="hover:bg-gray-700/30">
            <td class="px-2 py-2 md:px-4 md:py-3 whitespace-nowrap text-xs text-gray-400">${d.toLocaleDateString()}<br>${d.toLocaleTimeString()}</td>
            <td class="px-2 py-2 md:px-4 md:py-3 whitespace-nowrap"><span class="px-2 py-1 rounded text-[10px] font-bold ${badge}">${h(l.type)}</span></td>
            <td class="px-2 py-2 md:px-4 md:py-3 text-xs" style="max-width:0"><div class="font-mono text-red-400 truncate w-full" title="${h(l.message)}">${h(l.message)}</div><div class="text-gray-500 text-[10px] mt-1">${h(l.location)}</div></td>
            <td class="px-2 py-2 md:px-4 md:py-3 text-right"><button class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300" onclick="this.nextElementSibling.classList.toggle('hidden')">자세히</button><div class="hidden text-left text-[11px] text-gray-400 mt-1 font-mono whitespace-pre-wrap">${h(l.stackTrace || 'N/A')}</div></td>
        </tr>`;
    }).join('');
}

export function renderAdminLoginLogs(logs) {
    const container = document.getElementById('admin-login-logs');
    if (!container) return;
    if (!logs || logs.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">기록이 없습니다.</p>';
        return;
    }
    container.innerHTML = logs.map(l => `
        <div class="p-2 bg-gray-700 rounded text-sm">
            <span class="text-gray-300">${h(l.type === 'login_success' ? '로그인' : l.type === 'logout' ? '로그아웃' : l.type || '기록')}</span>
            ${l.admin ? `<span class="text-blue-400 ml-2">${h(l.admin)}</span>` : ''}
            <span class="text-gray-500 ml-2">${new Date(l.timestamp).toLocaleString('ko-KR')}</span>
            <span class="text-gray-600 ml-2">${h(l.ip || '-')}</span>
        </div>
    `).join('');
}

export function renderAuditLogs(logs) {
    const container = document.getElementById('audit-logs-list');
    if (!container) return;
    if (!logs || logs.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">감사 로그가 없습니다.</p>';
        return;
    }
    container.innerHTML = logs.map(l => `
        <div class="p-3 bg-gray-700 rounded flex justify-between items-start">
            <div>
                <span class="px-2 py-0.5 rounded text-xs font-bold bg-blue-900/50 text-blue-400">${h(l.type)}</span>
                <span class="text-xs text-gray-400 ml-2">${h(l.description || l.details || '')}</span>
            </div>
            <div class="text-xs text-gray-500 text-right">
                <div>${new Date(l.timestamp).toLocaleString('ko-KR')}</div>
                <div>${h(l.ip || l.admin_ip || '-')}</div>
            </div>
        </div>
    `).join('');
}

export function renderBannedIPs(ips) {
    const tbody = document.getElementById('banned-ips-body');
    if (!tbody) return;
    if (!ips || ips.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-gray-500">차단된 IP가 없습니다.</td></tr>';
        return;
    }
    tbody.innerHTML = ips.map(ip => {
        const remaining = ip.remainingMs ? (ip.remainingMs === -1 ? '영구' : dur(ip.remainingMs)) : '-';
        return `<tr>
            <td class="px-3 md:px-4 py-2 font-mono text-sm">${h(ip.ip)}</td>
            <td class="px-3 md:px-4 py-2 text-sm">${remaining}</td>
            <td class="px-3 md:px-4 py-2 text-sm hidden md:table-cell">${h(ip.reason || '-')}</td>
            <td class="px-3 md:px-4 py-2 text-sm hidden md:table-cell">${ip.timestamp ? new Date(ip.timestamp).toLocaleString('ko-KR') : '-'}</td>
            <td class="px-3 md:px-4 py-2 text-center"><button class="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded" onclick="window._adminUnbanIP&&window._adminUnbanIP('${h(ip.ip)}')">해제</button></td>
        </tr>`;
    }).join('');
}

export function renderActiveSessions(sessions) {
    const container = document.getElementById('active-sessions');
    if (!container) return;
    if (!sessions || sessions.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">활성 세션이 없습니다.</p>';
        return;
    }
    container.innerHTML = sessions.map(s => {
        const online = s.isOnline, sc = online ? 'bg-green-500' : 'bg-gray-500';
        const last = s.lastMessageTime > 0 ? dur(_now() - s.lastMessageTime) + ' 전 활동' : s.lastActivityTime ? dur(_now() - s.lastActivityTime) + ' 전 활동' : '활동 없음';
        return `<div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer session-row" data-sid="${h(s.sessionId)}">
            <div class="flex items-center gap-3 flex-1">
                <div class="w-2 h-2 ${sc} rounded-full ${online ? 'animate-pulse' : ''}"></div>
                <div class="flex-1">
                    <p class="text-sm font-mono text-gray-300 break-all">${tr(s.sessionId)}${s.nickname ? `<span class="text-xs ml-2 text-yellow-300">(${h(s.nickname)})</span>` : ''}</p>
                    <p class="text-xs text-gray-500">${h(s.ip || 'Unknown')}${s.country ? ' · ' + h(s.country) : ''}</p>
                    <p class="text-xs text-gray-400">${last}</p>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <div class="text-right"><p class="text-xs text-gray-400">${s.messageCount || 0} 메시지</p><p class="text-xs text-gray-500">접속: ${dur(_now() - s.joinTime)}</p></div>
                <button class="kick-user-btn bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded" data-sid="${h(s.sessionId)}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 inline" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg> 퇴장
                </button>
            </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.session-row').forEach(r => {
        r.addEventListener('click', async () => {
            const sid = r.dataset.sid;
            if (window._showUserDetails) window._showUserDetails(sid);
        });
    });
    container.querySelectorAll('.kick-user-btn').forEach(b => {
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window._adminKickUser) window._adminKickUser(b.dataset.sid);
        });
    });
}

export function renderRecentMessages(messages) {
    const container = document.getElementById('recent-messages');
    if (!container) return;
    if (!messages || messages.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">최근 메시지가 없습니다.</p>';
        return;
    }
    container.innerHTML = messages.reverse().map(msg => {
        const isAdmin = msg.sessionId && String(msg.sessionId).startsWith('admin_');
        const adminBadge = isAdmin ? '<span class="text-xs font-semibold text-yellow-300 bg-yellow-900/20 px-2 py-0.5 rounded">관리자</span>' : '';
        return `<div class="p-3 ${isAdmin ? 'bg-yellow-900/5 border border-yellow-800' : 'bg-gray-700'} rounded-lg">
            <div class="flex items-start justify-between mb-1">
                <div class="flex items-center gap-2"><span class="text-xs font-mono text-gray-400">${tr(msg.sessionId)}</span>${adminBadge}</div>
                <span class="text-xs text-gray-500">${new Date(msg.timestamp).toLocaleTimeString('ko-KR')}</span>
            </div>
            <p class="text-sm text-gray-200 break-words whitespace-pre-wrap">${h(msg.content || '')}</p>
            ${msg.editedAt ? '<span class="text-xs text-yellow-500">(수정됨)</span>' : ''}
        </div>`;
    }).join('');
}

export function renderAnnouncements(announcements) {
    const container = document.getElementById('announcement-list');
    if (!container) return;
    if (!announcements || announcements.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">등록된 공지사항이 없습니다.</p>';
        return;
    }
    container.innerHTML = announcements.map(a => {
        const ts = new Date(a.timestamp).toLocaleString('ko-KR');
        const emergency = a.isEmergency ? '<span class="text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-1.5 py-0.5 rounded-full ml-1">긴급</span>' : '';
        const content = h(a.content).replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<>"']+)/g, '<a href="$1" target="_blank" rel="noopener" class="text-blue-400 hover:text-blue-300 underline break-all">$1</a>');
        return `<div class="bg-gray-700 rounded p-3 flex justify-between items-start gap-4 ${a.isEmergency ? 'border border-red-700/50' : ''}">
            <div class="flex-1"><div class="text-xs text-gray-400 mb-1">${ts}${emergency}</div><div class="text-sm text-gray-200">${content}</div></div>
        </div>`;
    }).join('');
}

export function renderChannels(channels) {
    const tbody = document.getElementById('channels-list');
    if (!tbody) return;
    if (!channels || channels.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">활성 채널이 없습니다.</td></tr>';
        return;
    }
    tbody.innerHTML = channels.map(ch => {
        const date = new Date(ch.createdAt).toLocaleString('ko-KR');
        return `<tr class="hover:bg-gray-700/50 transition-colors">
            <td class="px-2 py-2 md:px-4 md:py-3 font-medium text-emerald-300">${h(ch.name)}</td>
            <td class="px-2 py-2 md:px-4 md:py-3 text-xs text-gray-400">${h(ch.createdBy || '-')}</td>
            <td class="px-2 py-2 md:px-4 md:py-3 text-xs text-gray-400">${date}</td>
            <td class="px-2 py-2 md:px-4 md:py-3 text-sm">${ch.connections ?? '-'}</td>
            <td class="px-2 py-2 md:px-4 md:py-3 text-sm">${ch.messageCount ?? '-'}</td>
            <td class="px-2 py-2 md:px-4 md:py-3 text-right whitespace-nowrap" style="vertical-align:middle">
                <button class="view-channel-btn text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded mr-1" data-slug="${h(ch.slug)}" data-name="${h(ch.name)}">상세</button>
                <button class="delete-channel-btn text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded" data-slug="${h(ch.slug)}" data-name="${h(ch.name)}">삭제</button>
            </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('.view-channel-btn').forEach(b => {
        b.addEventListener('click', () => window._viewChannelDetail && window._viewChannelDetail(b.dataset.slug));
    });
    tbody.querySelectorAll('.delete-channel-btn').forEach(b => {
        b.addEventListener('click', () => window._deleteChannel && window._deleteChannel(b.dataset.slug, b.dataset.name));
    });
}

export function renderChannelDetail(channel) {
    const title = document.getElementById('channel-detail-title');
    const content = document.getElementById('channel-detail-content');
    const modal = document.getElementById('channel-detail-modal');
    if (!title || !content || !modal) return;
    title.textContent = channel.name || '채널 상세 정보';
    content.innerHTML = `
        <div class="grid grid-cols-2 gap-3 text-sm">
            <div><span class="text-gray-400">슬러그:</span> <span class="font-mono">${h(channel.slug)}</span></div>
            <div><span class="text-gray-400">생성자:</span> ${h(channel.createdBy || '-')}</div>
            <div><span class="text-gray-400">생성일:</span> ${new Date(channel.createdAt).toLocaleString('ko-KR')}</div>
            <div><span class="text-gray-400">접속자:</span> ${channel.connections ?? '-'}</div>
            <div><span class="text-gray-400">메시지:</span> ${channel.messageCount ?? '-'}</div>
            <div><span class="text-gray-400">상태:</span> ${channel.status || 'active'}</div>
        </div>
    `;
    modal.classList.add('open');
}

export function formatErrorLogsText(logs) {
    if (!logs || logs.length === 0) return 'No error logs';
    return logs.map(l => {
        const d = new Date(l.timestamp);
        return `[${d.toISOString()}] ${l.type}\n  Message: ${l.message || 'N/A'}\n  Location: ${l.location || 'N/A'}\n  Context: ${l.context || 'N/A'}\n`;
    }).join('\n');
}

export function showNotification(type, message) {
    const id = 'admin-notifications-container';
    let c = document.getElementById(id);
    if (!c) { c = document.createElement('div'); c.id = id; c.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:9999;display:flex;flex-direction:column;gap:0.5rem'; document.body.appendChild(c); }
    const colors = { success: '#16a34a', error: '#dc2626', warn: '#d97706', info: '#374151' };
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.style.cssText = `padding:8px 12px;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.4);max-width:320px;background:${colors[type] || '#374151'};color:#fff`;
    el.textContent = message;
    c.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 350); }, 3000);
}
