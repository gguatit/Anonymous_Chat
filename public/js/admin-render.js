// Admin Dashboard - Render Methods
// Extracted from admin.js for separation of concerns.
//
// These methods expect the following to exist on `this` (the AdminDashboard instance):
//   Helpers:       this.escapeHtml(), this.formatDuration(), this.truncateId(),
//                  this.formatFileSize(), this.isValidUrl(), this.sanitizeUrl()
//   Downstream:    this.showUserDetails(), this.createBanModal(),
//                  this.editAdminMessage(), this.deleteMessage(),
//                  this.attachMessageEventListeners() (also in this module),
//                  this.viewChannelDetail(), this.deleteChannel(), this.loadChannelStats()
//   Properties:    this.lastMetrics, this._errorLogs

import { escapeHtml } from './utils.js';
import { trapFocus } from './admin-utils.js';

const renderMethods = {

    updateMetrics(metrics) {
        // Keep a reference to latest metrics so other actions (download/delete logs) can use them
        this.lastMetrics = metrics;
        document.getElementById('stat-active-connections').textContent =
            metrics.activeConnections?.toLocaleString() || '0';
        document.getElementById('stat-total-messages').textContent =
            metrics.totalMessages?.toLocaleString() || '0';
        document.getElementById('stat-total-connections').textContent =
            metrics.totalConnections?.toLocaleString() || '0';
        document.getElementById('stat-errors').textContent =
            metrics.errors?.toLocaleString() || '0';

        // Update system info
        document.getElementById('server-time').textContent =
            new Date().toLocaleString('ko-KR');

        if (metrics.uptime) {
            const hours = Math.floor(metrics.uptime / 3600000);
            const minutes = Math.floor((metrics.uptime % 3600000) / 60000);
            document.getElementById('uptime').textContent =
                `${hours}시간 ${minutes}분`;
        }

        if (metrics.errorLogs) {
            this.renderErrorLogs(metrics.errorLogs);
        }
    },

    renderErrorLogs(logs) {
        const container = document.getElementById('error-logs-list');
        if (!container) return;

        this._errorLogs = logs || [];

        const filterSelect = document.getElementById('error-log-filter');
        const searchInput = document.getElementById('error-log-search');
        const filterType = filterSelect?.value || 'all';
        const searchText = (searchInput?.value || '').toLowerCase();

        let filteredLogs = this._errorLogs;

        if (filterType !== 'all') {
            filteredLogs = filteredLogs.filter(log => log.type === filterType);
        }

        if (searchText) {
            filteredLogs = filteredLogs.filter(log =>
                (log.message && log.message.toLowerCase().includes(searchText)) ||
                (log.location && log.location.toLowerCase().includes(searchText)) ||
                (log.type && log.type.toLowerCase().includes(searchText))
            );
        }

        if (!filteredLogs || filteredLogs.length === 0) {
            container.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500">최근 발생한 오류가 없습니다.</td></tr>';
            return;
        }

        // Preserve opened details based on ID matching or index
        const currentOpened = Array.from(container.querySelectorAll('tr[id^="error-detail-"]:not(.hidden)')).map(el => el.getAttribute('data-log-id'));

        container.innerHTML = filteredLogs.map((log, index) => {
            const date = new Date(log.timestamp);
            let badgeClass = 'bg-gray-700 text-gray-300';
            
            if (log.type === 'WS_MESSAGE_PARSE') badgeClass = 'bg-yellow-900/50 text-yellow-500 border border-yellow-700';
            else if (log.type === 'CLIENT_ERROR') badgeClass = 'bg-orange-900/50 text-orange-500 border border-orange-700';
            else if (log.type === 'WS_CONNECTION') badgeClass = 'bg-purple-900/50 text-purple-500 border border-purple-700';
            else if (log.type === 'SYSTEM_ERROR') badgeClass = 'bg-red-900/50 text-red-500 border border-red-700';

            // Generate a more stable ID based on timestamp and type to keep it open across refreshes
            const uniqueLogId = `log-${log.timestamp}-${log.type}`;
            const detailsId = `error-detail-${index}`;
            const isOpened = currentOpened.includes(uniqueLogId);

            return `
            <tr class="hover:bg-gray-700/30 transition-colors">
                <td class="px-2 py-2 md:px-4 md:py-3 whitespace-nowrap text-xs text-gray-400">
                    ${date.toLocaleDateString()}<br>${date.toLocaleTimeString()}
                </td>
                <td class="px-2 py-2 md:px-4 md:py-3 whitespace-nowrap">
                    <span class="px-2 py-1 rounded text-[10px] font-bold ${badgeClass}">${log.type}</span>
                </td>
                <td class="px-2 py-2 md:px-4 md:py-3 text-xs" style="max-width: 0;">
                    <div class="font-mono text-red-400 truncate w-full" title="${this.escapeHtml(log.message)}">${this.escapeHtml(log.message)}</div>
                    <div class="text-gray-500 text-[10px] mt-1 truncate w-full" title="${this.escapeHtml(log.location)}">${this.escapeHtml(log.location)}</div>
                </td>
                <td class="px-2 py-2 md:px-4 md:py-3 text-right">
                    <button onclick="document.getElementById('${detailsId}').classList.toggle('hidden')" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300 transition-colors">
                        자세히
                    </button>
                </td>
            </tr>
            <tr id="${detailsId}" data-log-id="${uniqueLogId}" class="${isOpened ? '' : 'hidden'} bg-gray-900/50 border-t border-gray-800">
                <td colspan="4" class="px-4 py-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                        <div class="min-w-0 flex flex-col">
                            <h4 class="text-xs font-bold text-gray-400 mb-2 border-b border-gray-700 pb-1 shrink-0">환경 정보</h4>
                            <div class="overflow-y-auto max-h-48 pr-1 min-h-[4rem]">
                                <ul class="text-[11px] text-gray-300 space-y-1 font-mono break-all">
                                    <li><strong class="text-gray-400">IP / 지역:</strong> ${this.escapeHtml(log.environment?.ip || 'N/A')} (${this.escapeHtml(log.environment?.country || 'Unknown')})</li>
                                    <li><strong class="text-gray-400">User-Agent:</strong> <span>${this.escapeHtml(log.environment?.userAgent || 'N/A')}</span></li>
                                    <li><strong class="text-gray-400">Context:</strong> ${this.escapeHtml(log.context || 'N/A')}</li>
                                    ${log.environment?.url ? `<li><strong class="text-gray-400">URL:</strong> <a href="${this.escapeHtml(log.environment.url)}" target="_blank" class="text-cyan-400 hover:underline">${this.escapeHtml(log.environment.url)}</a></li>` : ''}
                                </ul>
                            </div>
                        </div>
                        <div class="min-w-0 flex flex-col">
                            <h4 class="text-xs font-bold text-gray-400 mb-2 border-b border-gray-700 pb-1 shrink-0">Stack Trace</h4>
                            <div class="bg-black p-2 rounded flex-1 min-h-[8rem] max-h-48 overflow-y-auto overflow-x-hidden text-[10px] font-mono text-gray-400 whitespace-pre-wrap break-all">${this.escapeHtml(log.stackTrace)}</div>
                        </div>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    },

    updateActiveSessions(sessions) {
        const container = document.getElementById('active-sessions');

        if (!sessions || sessions.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">활성 세션이 없습니다.</p>';
            return;
        }

        container.innerHTML = sessions.map(session => {
            const isOnline = session.isOnline;
            const statusColor = isOnline ? 'bg-green-500' : 'bg-gray-500';
            const lastActiveText = session.lastMessageTime > 0
                ? this.formatDuration(Date.now() - session.lastMessageTime) + ' 전 활동'
                : session.lastActivityTime
                    ? this.formatDuration(Date.now() - session.lastActivityTime) + ' 전 활동'
                    : '활동 없음';
            const userAgent = session.userAgent ? session.userAgent.substring(0, 40) + (session.userAgent.length > 40 ? '...' : '') : '';

            return `
                <div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer session-row" data-session-id="${session.sessionId}">
                    <div class="flex items-center gap-3 flex-1">
                        <div class="w-2 h-2 ${statusColor} rounded-full ${isOnline ? 'animate-pulse' : ''}"></div>
                        <div class="flex-1">
                            <p class="text-sm font-mono text-gray-300 break-all">
                                ${this.truncateId(session.sessionId)}
                                ${session.nickname ? `<span class="text-xs ml-2 text-yellow-300">(${this.escapeHtml(session.nickname)})</span>` : ''}
                            </p>
                            <p class="text-xs text-gray-500 break-all">${session.ip || 'Unknown IP'}${session.country ? ` · ${this.escapeHtml(session.country)}` : ''}</p>
                            <p class="text-xs text-gray-400">${lastActiveText}</p>
                            ${userAgent ? `<p class="text-xs text-gray-500 truncate">${this.escapeHtml(userAgent)}</p>` : ''}
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="text-right">
                            <p class="text-xs text-gray-400">${session.messageCount || 0} 메시지</p>
                            <p class="text-xs text-gray-500">접속: ${this.formatDuration(Date.now() - session.joinTime)}</p>
                        </div>
                        <button class="kick-user-btn bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded" 
                                data-session-id="${session.sessionId}"
                                data-user-ip="${session.ip || 'Unknown'}"
                                title="사용자 강제퇴장"
                                onclick="event.stopPropagation()">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 inline" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                            </svg>
                            퇴장
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // 세션 행 클릭 이벤트 - 사용자 상세 정보 표시
        document.querySelectorAll('.session-row').forEach(row => {
            row.addEventListener('click', async (e) => {
                const sessionId = e.currentTarget.dataset.sessionId;
                await this.showUserDetails(sessionId);
            });
        });

        // 강제퇴장 버튼 이벤트
        document.querySelectorAll('.kick-user-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const sessionId = e.currentTarget.dataset.sessionId;
                const userIp = e.currentTarget.dataset.userIp;

                // 차단 시간 선택 모달 생성
                const modal = this.createBanModal(sessionId, userIp);
                document.body.appendChild(modal);
                trapFocus(modal);
            });
        });
    },

    updateRecentMessages(messages) {
        const container = document.getElementById('recent-messages');

        if (!messages || messages.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">최근 메시지가 없습니다.</p>';
            return;
        }

        container.innerHTML = messages.slice(-50).reverse().map(msg => {
            const fileHtml = msg.file ? (() => {
                const filename = this.escapeHtml(msg.file.filename || '파일');
                const filesize = msg.file.filesize != null ? this.formatFileSize(msg.file.filesize) : '';
                const filetype = msg.file.filetype || '';
                const url = msg.file.url || '#';

                // Validate URL for security
                if (!this.isValidUrl(url)) {
                    return '<div class="text-red-400 text-xs mt-2">Invalid file URL</div>';
                }
                const safeUrl = this.sanitizeUrl(url);

                // If image, show thumbnail
                if (filetype.startsWith('image/')) {
                    return `
                        <div class="mt-2">
                            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">
                                <img src="${safeUrl}" alt="${filename}" class="w-full max-h-48 object-contain rounded border border-gray-600" />
                            </a>
                            <div class="mt-1 text-xs text-gray-400">${filename} ${filesize ? '· ' + filesize : ''}</div>
                        </div>
                    `;
                }

                // Non-image file: show link with metadata
                return `
                    <div class="mt-2 text-xs text-gray-300">
                        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">${filename}</a>
                        ${filesize ? `<span class="text-gray-400"> · ${filesize}</span>` : ''}
                        ${filetype ? `<span class="text-gray-400"> · ${this.escapeHtml(filetype)}</span>` : ''}
                    </div>
                `;
            })() : '';

            const isAdminMsg = msg.sessionId && String(msg.sessionId).startsWith('admin_');
            const adminBadge = isAdminMsg ? `
                <span class="inline-block text-xs font-semibold text-yellow-300 bg-yellow-900/20 px-2 py-0.5 rounded">관리자</span>
            ` : '';

            // 관리자는 모든 메시지를 삭제 가능, 자신의 메시지만 수정 가능
            const canEdit = isAdminMsg;
            const canDelete = true; // 관리자는 모든 메시지 삭제 가능

            const editButtons = `
                <div class="mt-2 flex gap-2">
                    ${canEdit ? `
                        <button class="admin-edit-msg-btn text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded" data-message-id="${msg.messageId}" data-content="${this.escapeHtml(msg.content || '')}">
                            수정
                        </button>
                    ` : ''}
                    ${canDelete ? `
                        <button class="admin-delete-msg-btn text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded" data-message-id="${msg.messageId}">
                            삭제
                        </button>
                    ` : ''}
                </div>
            `;

            return `
                <div class="p-3 ${isAdminMsg ? 'bg-yellow-900/5 border border-yellow-800' : 'bg-gray-700'} rounded-lg" data-message-id="${msg.messageId}">
                    <div class="flex items-start justify-between mb-1">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-mono text-gray-400">${this.truncateId(msg.sessionId)}</span>
                            ${adminBadge}
                        </div>
                        <span class="text-xs text-gray-500">${new Date(msg.timestamp).toLocaleTimeString('ko-KR')}</span>
                    </div>
                    <p class="message-content text-sm text-gray-200 break-words whitespace-pre-wrap">${this.escapeHtml(msg.content || '')}</p>
                    ${msg.editedAt ? '<span class="text-xs text-yellow-500">(수정됨)</span>' : ''}
                    ${fileHtml}
                    ${editButtons}
                </div>
            `;
        }).join('');

        // 수정/삭제 버튼 이벤트 리스너 추가
        this.attachMessageEventListeners();
    },

    attachMessageEventListeners() {
        // 수정 버튼 이벤트
        document.querySelectorAll('.admin-edit-msg-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const messageId = e.target.dataset.messageId;
                const currentContent = e.target.dataset.content;
                const newContent = prompt('메시지를 수정하세요:', currentContent);

                if (newContent !== null && newContent.trim() !== currentContent.trim()) {
                    await this.editAdminMessage(messageId, newContent.trim());
                }
            });
        });

        // 삭제 버튼 이벤트
        document.querySelectorAll('.admin-delete-msg-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const messageId = e.target.dataset.messageId;

                if (confirm('이 메시지를 삭제하시겠습니까?\n\n삭제된 메시지는 복구할 수 없습니다.\n첨부된 파일도 함께 삭제됩니다.')) {
                    await this.deleteMessage(messageId);
                }
            });
        });
    },

    updateAnnouncementsList(announcements) {
        const container = document.getElementById('announcement-list');
        if (!container) return;

        if (!announcements || announcements.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">등록된 공지사항이 없습니다.</p>';
            return;
        }

        container.innerHTML = announcements.map(acc => {
            const timeStr = new Date(acc.timestamp).toLocaleString('ko-KR');
            const escaped = this.escapeHtml(acc.content);
            const withLinks = escaped.replace(/(https?:\/\/[^\s<>"']+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline break-all">$1</a>');
            const content = withLinks.replace(/\n/g, '<br>');
            const emergencyBadge = acc.isEmergency
                ? '<span class="text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-1.5 py-0.5 rounded-full font-medium ml-1">긴급</span>'
                : '';

            return `
                <div class="bg-gray-700 rounded p-3 flex justify-between items-start gap-4 ${acc.isEmergency ? 'border border-red-700/50' : ''}">
                    <div class="flex-1">
                        <div class="text-xs text-gray-400 mb-1">${timeStr}${emergencyBadge}</div>
                        <div class="text-sm text-gray-200">${content}</div>
                    </div>
                    <div class="flex flex-col gap-2">
                        <button onclick="window.adminDashboard.editAnnouncement(${acc.timestamp})" class="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded transition-colors whitespace-nowrap">수정</button>
                        ${acc.isEmergency ? '<button onclick="window.adminDashboard.demoteAnnouncement(' + acc.timestamp + ')" class="bg-yellow-600 hover:bg-yellow-700 text-white text-xs px-3 py-1.5 rounded transition-colors whitespace-nowrap">일반 전환</button>' : ''}
                        <button onclick="window.adminDashboard.deleteAnnouncement(${acc.timestamp})" class="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded transition-colors whitespace-nowrap">삭제</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderChannels(channels) {
        const tbody = document.getElementById('channels-list');
        if (!tbody) return;
        if (!channels.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">활성 채널이 없습니다.</td></tr>';
            return;
        }
        tbody.innerHTML = channels.map(ch => {
            const date = new Date(ch.createdAt).toLocaleString('ko-KR');
            return `
                <tr class="hover:bg-gray-700/50 transition-colors">
                    <td class="px-2 py-2 md:px-4 md:py-3 font-medium text-emerald-300">${escapeHtml(ch.name)}</td>
                    <td class="px-2 py-2 md:px-4 md:py-3 text-xs text-gray-400">${escapeHtml(ch.createdBy || '-')}</td>
                    <td class="px-2 py-2 md:px-4 md:py-3 text-xs text-gray-400">${date}</td>
                    <td class="px-2 py-2 md:px-4 md:py-3"><span class="channel-users" data-slug="${escapeHtml(ch.slug)}">-</span></td>
                    <td class="px-2 py-2 md:px-4 md:py-3"><span class="channel-messages" data-slug="${escapeHtml(ch.slug)}">-</span></td>
                    <td class="px-2 py-2 md:px-4 md:py-3 text-right">
                        <button class="view-channel-btn text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded mr-1" data-slug="${escapeHtml(ch.slug)}" data-name="${escapeHtml(ch.name)}">상세</button>
                        <button class="delete-channel-btn text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded" data-slug="${escapeHtml(ch.slug)}" data-name="${escapeHtml(ch.name)}">삭제</button>
                    </td>
                </tr>
            `;
        }).join('');

        // Bind buttons
        tbody.querySelectorAll('.view-channel-btn').forEach(btn => {
            btn.addEventListener('click', () => this.viewChannelDetail(btn.dataset.slug, btn.dataset.name));
        });
        tbody.querySelectorAll('.delete-channel-btn').forEach(btn => {
            btn.addEventListener('click', () => this.deleteChannel(btn.dataset.slug, btn.dataset.name));
        });

        // Load live stats for each channel
        channels.forEach(ch => this.loadChannelStats(ch.slug));
    },

};

export default renderMethods;
