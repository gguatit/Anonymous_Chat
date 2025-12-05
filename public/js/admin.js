// Admin Dashboard JavaScript

class AdminDashboard {
    constructor() {
        this.loginScreen = document.getElementById('login-screen');
        this.adminDashboard = document.getElementById('admin-dashboard');
        this.loginForm = document.getElementById('login-form');
        this.loginError = document.getElementById('login-error');
        this.logoutBtn = document.getElementById('logout-btn');
        this.refreshBtn = document.getElementById('refresh-btn');
        
        this.sessionToken = localStorage.getItem('admin_token');
        this.refreshInterval = null;
        
        this.initializeEventListeners();
        this.checkAuthentication();
    }

    initializeEventListeners() {
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.logoutBtn?.addEventListener('click', () => this.handleLogout());
        this.refreshBtn?.addEventListener('click', () => this.refreshData());
        this.exportCsvBtn = document.getElementById('export-csv-btn');
        this.exportCsvBtn?.addEventListener('click', () => this.exportCsv());

        this.adminSendBtn = document.getElementById('admin-send-btn');
        this.adminAnnounceBtn = document.getElementById('admin-announce-btn');
        this.adminMessageInput = document.getElementById('admin-message-input');
        this.adminSendBtn?.addEventListener('click', () => this.sendAdminMessage(false));
        this.adminAnnounceBtn?.addEventListener('click', () => this.sendAdminMessage(true));

        // Enter = send, Shift+Enter = newline for textarea
        if (this.adminMessageInput) {
            this.adminMessageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendAdminMessage(false);
                }
            });
        }

        this.exportFilteredCsvBtn = document.getElementById('export-filtered-csv-btn');
        this.exportFilteredCsvBtn?.addEventListener('click', () => this.exportFilteredCsv());
    }

    async checkAuthentication() {
        if (this.sessionToken) {
            const isValid = await this.verifyToken(this.sessionToken);
            if (isValid) {
                this.showDashboard();
            } else {
                this.showLogin();
            }
        } else {
            this.showLogin();
        }
    }

    async exportCsv() {
        if (!this.sessionToken) {
            alert('관리자 인증이 필요합니다.');
            return;
        }

        try {
            const [sessionsResp, messagesResp] = await Promise.all([
                fetch('/api/admin/sessions', { headers: { 'Authorization': `Bearer ${this.sessionToken}` } }),
                fetch('/api/admin/messages', { headers: { 'Authorization': `Bearer ${this.sessionToken}` } })
            ]);

            if (!sessionsResp.ok || !messagesResp.ok) {
                alert('데이터를 불러오는 중 오류가 발생했습니다. 권한을 확인하세요.');
                return;
            }

            const sessions = await sessionsResp.json();
            const messages = await messagesResp.json();

            // Map users by sessionId for quick lookup
            const usersMap = new Map();
            for (const s of sessions) {
                usersMap.set(s.sessionId, s);
            }

            // Build CSV rows: include user info per message; also include users with no messages
            const rows = [];
            const headers = [
                'user_session_id', 'user_ip', 'user_join_time', 'user_message_count', 'user_last_message_time',
                'message_id', 'message_timestamp', 'message_content', 'message_edited_at', 'file_url', 'file_name', 'file_size', 'file_type'
            ];

            for (const msg of messages) {
                const user = usersMap.get(msg.sessionId) || {};
                rows.push([
                    user.sessionId || msg.sessionId || '',
                    user.ip || '',
                    user.joinTime ? new Date(user.joinTime).toISOString() : '',
                    user.messageCount != null ? user.messageCount : '',
                    user.lastMessageTime ? new Date(user.lastMessageTime).toISOString() : '',
                    msg.messageId || '',
                    msg.timestamp ? new Date(msg.timestamp).toISOString() : '',
                    msg.content || '',
                    msg.editedAt ? new Date(msg.editedAt).toISOString() : '',
                    msg.file?.url || '',
                    msg.file?.filename || '',
                    msg.file?.filesize != null ? String(msg.file.filesize) : '',
                    msg.file?.filetype || ''
                ]);
            }

            // Add users who have no messages as rows with empty message fields
            for (const [sessionId, user] of usersMap.entries()) {
                const hasMessage = messages.some(m => m.sessionId === sessionId);
                if (!hasMessage) {
                    rows.push([
                        user.sessionId || sessionId,
                        user.ip || '',
                        user.joinTime ? new Date(user.joinTime).toISOString() : '',
                        user.messageCount != null ? user.messageCount : '',
                        user.lastMessageTime ? new Date(user.lastMessageTime).toISOString() : '',
                        '', '', '', '', '', '', '', ''
                    ]);
                }
            }

            // CSV escape helper
            const escape = (value) => {
                if (value == null) return '';
                const str = String(value);
                // Replace double quotes with two double quotes, wrap in quotes
                return '"' + str.replace(/"/g, '""') + '"';
            };

            const csvContent = [headers.map(h => escape(h)).join(',')]
                .concat(rows.map(r => r.map(cell => escape(cell)).join(',')))
                .join('\n');

            // Add BOM for Excel compatibility
            const bom = '\uFEFF';
            const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `anonymous_chat_export_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Export CSV error:', error);
            alert('CSV 내보내기 중 오류가 발생했습니다. 콘솔을 확인하세요.');
        }
    }

    async sendAdminMessage(isAnnouncement = false) {
        if (!this.sessionToken) {
            alert('관리자 인증이 필요합니다.');
            return;
        }

        const raw = (this.adminMessageInput?.value || '');
        const content = raw.trim();
        if (!content) {
            alert('메시지를 입력하세요.');
            return;
        }

        if (raw.length > 5000) {
            alert('메시지는 최대 5000자까지 가능합니다.');
            return;
        }

        try {
            const endpoint = isAnnouncement ? '/api/admin/announce' : '/api/admin/broadcast';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                body: JSON.stringify({ content: raw })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => null);
                console.error('Message send failed', err);
                alert('메시지 전송에 실패했습니다. 콘솔을 확인하세요.');
                return;
            }

            // Clear input and refresh recent messages
            if (this.adminMessageInput) this.adminMessageInput.value = '';
            this.refreshData();

        } catch (error) {
            console.error('sendAdminMessage error:', error);
            alert('메시지 전송 중 오류가 발생했습니다.');
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const id = document.getElementById('admin-id').value;
        const password = document.getElementById('admin-password').value;
        this.loginError.classList.add('hidden');

        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.sessionToken = data.token;
                localStorage.setItem('admin_token', data.token);
                this.showDashboard();
            } else {
                this.loginError.classList.remove('hidden');
                document.getElementById('admin-id').value = '';
                document.getElementById('admin-password').value = '';
            }
        } catch (error) {
            console.error('Login error:', error);
            this.loginError.classList.remove('hidden');
        }
    }

    async verifyToken(token) {
        try {
            const response = await fetch('/api/admin/verify', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    handleLogout() {
        const token = localStorage.getItem('admin_token');
        
        // 서버에 로그아웃 요청 (토큰 무효화)
        if (token) {
            fetch('/api/admin/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }).catch(err => console.error('Logout error:', err));
        }
        
        // 로컬 토큰 삭제
        localStorage.removeItem('admin_token');
        this.sessionToken = null;
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        this.showLogin();
    }

    showLogin() {
        this.loginScreen.classList.remove('hidden');
        this.adminDashboard.classList.add('hidden');
    }

    showDashboard() {
        this.loginScreen.classList.add('hidden');
        this.adminDashboard.classList.remove('hidden');
        this.refreshData();
        
        // Auto-refresh every 5 seconds
        this.refreshInterval = setInterval(() => this.refreshData(), 5000);
    }

    async refreshData() {
        try {
            // Fetch metrics
            const metricsResponse = await fetch('/api/admin/metrics', {
                headers: { 'Authorization': `Bearer ${this.sessionToken}` }
            });

            if (!metricsResponse.ok) {
                if (metricsResponse.status === 401) {
                    this.handleLogout();
                    return;
                }
                throw new Error('Failed to fetch metrics');
            }

            const metrics = await metricsResponse.json();
            this.updateMetrics(metrics);

            // Fetch active sessions
            const sessionsResponse = await fetch('/api/admin/sessions', {
                headers: { 'Authorization': `Bearer ${this.sessionToken}` }
            });

            if (sessionsResponse.ok) {
                const sessions = await sessionsResponse.json();
                this.updateActiveSessions(sessions);
            }

            // Fetch recent messages
            const messagesResponse = await fetch('/api/admin/messages', {
                headers: { 'Authorization': `Bearer ${this.sessionToken}` }
            });

            if (messagesResponse.ok) {
                const messages = await messagesResponse.json();
                this.updateRecentMessages(messages);
            }

            this.updateLastUpdated();

        } catch (error) {
            console.error('Refresh error:', error);
        }
    }

    updateMetrics(metrics) {
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
    }

    updateActiveSessions(sessions) {
        const container = document.getElementById('active-sessions');
        
        if (!sessions || sessions.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">활성 세션이 없습니다.</p>';
            return;
        }

        container.innerHTML = sessions.map(session => {
            const isOnline = session.lastMessageTime > 0 || (Date.now() - session.joinTime) < 60000;
            const statusColor = isOnline ? 'bg-green-500' : 'bg-gray-500';
            const lastActiveText = session.lastMessageTime > 0 
                ? this.formatDuration(Date.now() - session.lastMessageTime) + ' 전 활동'
                : '활동 없음';
            
            return `
                <div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                    <div class="flex items-center gap-3 flex-1">
                        <div class="w-2 h-2 ${statusColor} rounded-full ${isOnline ? 'animate-pulse' : ''}"></div>
                        <div class="flex-1">
                            <p class="text-sm font-mono text-gray-300">${this.truncateId(session.sessionId)}</p>
                            <p class="text-xs text-gray-500">${session.ip || 'Unknown IP'}</p>
                            <p class="text-xs text-gray-400">${lastActiveText}</p>
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
                                title="사용자 강제퇴장">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 inline" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                            </svg>
                            퇴장
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // 강제퇴장 버튼 이벤트
        document.querySelectorAll('.kick-user-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const sessionId = e.currentTarget.dataset.sessionId;
                const userIp = e.currentTarget.dataset.userIp;
                
                // 차단 시간 선택 모달 생성
                const modal = this.createBanModal(sessionId, userIp);
                document.body.appendChild(modal);
            });
        });
    }

    createBanModal(sessionId, userIp) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-gray-800 rounded-lg shadow-2xl p-6 max-w-md w-full mx-4 border border-gray-700">
                <h3 class="text-xl font-bold text-gray-100 mb-4">사용자 강제퇴장</h3>
                <div class="mb-4 text-sm text-gray-400">
                    <p>세션 ID: <span class="text-gray-200">${this.truncateId(sessionId)}</span></p>
                    <p>IP 주소: <span class="text-gray-200">${userIp}</span></p>
                </div>
                <p class="text-sm text-gray-300 mb-4">차단 시간을 선택하세요:</p>
                <div class="grid grid-cols-2 gap-3 mb-6">
                    <button class="ban-option-btn bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-3 px-4 rounded-lg transition-colors" data-duration="0">
                        즉시 퇴장
                        <span class="block text-xs opacity-80">재접속 가능</span>
                    </button>
                    <button class="ban-option-btn bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 px-4 rounded-lg transition-colors" data-duration="30">
                        30초 차단
                        <span class="block text-xs opacity-80">임시 차단</span>
                    </button>
                    <button class="ban-option-btn bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition-colors" data-duration="300">
                        5분 차단
                        <span class="block text-xs opacity-80">단기 차단</span>
                    </button>
                    <button class="ban-option-btn bg-red-700 hover:bg-red-800 text-white font-medium py-3 px-4 rounded-lg transition-colors" data-duration="600">
                        10분 차단
                        <span class="block text-xs opacity-80">장기 차단</span>
                    </button>
                </div>
                <button class="cancel-btn w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 rounded-lg transition-colors">
                    취소
                </button>
            </div>
        `;

        // 차단 옵션 버튼 이벤트
        modal.querySelectorAll('.ban-option-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const banDuration = parseInt(btn.dataset.duration);
                modal.remove();
                await this.kickUser(sessionId, banDuration);
            });
        });

        // 취소 버튼 이벤트
        modal.querySelector('.cancel-btn').addEventListener('click', () => {
            modal.remove();
        });

        // 모달 배경 클릭시 닫기
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        return modal;
    }

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

                // If image, show thumbnail
                if (filetype.startsWith('image/')) {
                    return `
                        <div class="mt-2">
                            <a href="${url}" target="_blank" rel="noopener noreferrer">
                                <img src="${url}" alt="${filename}" class="w-full max-h-48 object-contain rounded border border-gray-600" />
                            </a>
                            <div class="mt-1 text-xs text-gray-400">${filename} ${filesize ? '· ' + filesize : ''}</div>
                        </div>
                    `;
                }

                // Non-image file: show link with metadata
                return `
                    <div class="mt-2 text-xs text-gray-300">
                        <a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">${filename}</a>
                        ${filesize ? `<span class="text-gray-400"> · ${filesize}</span>` : ''}
                        ${filetype ? `<span class="text-gray-400"> · ${this.escapeHtml(filetype)}</span>` : ''}
                    </div>
                `;
            })() : '';

            const isAdminMsg = msg.sessionId && String(msg.sessionId).startsWith('admin_');
            const adminBadge = isAdminMsg ? `
                <span class="inline-block text-xs font-semibold text-yellow-300 bg-yellow-900/20 px-2 py-0.5 rounded">관리자</span>
            ` : '';

            // 관리자 메시지는 시간 제한 없이 수정/삭제 가능
            const canEdit = isAdminMsg;
            const editButtons = canEdit ? `
                <div class="mt-2 flex gap-2">
                    <button class="admin-edit-msg-btn text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded" data-message-id="${msg.messageId}" data-content="${this.escapeHtml(msg.content || '')}">
                        수정
                    </button>
                    <button class="admin-delete-msg-btn text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded" data-message-id="${msg.messageId}">
                        삭제
                    </button>
                </div>
            ` : '';

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
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        if (!bytes) return '';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        const size = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2);
        return `${size} ${units[i]}`;
    }

    updateLastUpdated() {
        document.getElementById('last-updated').textContent = 
            `마지막 업데이트: ${new Date().toLocaleTimeString('ko-KR')}`;
    }

    truncateId(id) {
        if (!id) return 'Unknown';
        return id.length > 20 ? id.substring(0, 20) + '...' : id;
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) return `${hours}시간 전`;
        if (minutes > 0) return `${minutes}분 전`;
        return `${seconds}초 전`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

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
                
                if (confirm('이 메시지를 삭제하시겠습니까?')) {
                    await this.deleteAdminMessage(messageId);
                }
            });
        });
    }

    async editAdminMessage(messageId, newContent) {
        if (!this.sessionToken) {
            alert('관리자 인증이 필요합니다.');
            return;
        }

        if (!newContent) {
            alert('메시지 내용이 비어있습니다.');
            return;
        }

        try {
            const response = await fetch('/api/admin/edit-message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                body: JSON.stringify({ messageId, newContent })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => null);
                console.error('Edit failed', err);
                alert('메시지 수정에 실패했습니다.');
                return;
            }

            this.refreshData();
        } catch (error) {
            console.error('editAdminMessage error:', error);
            alert('메시지 수정 중 오류가 발생했습니다.');
        }
    }

    async deleteAdminMessage(messageId) {
        if (!this.sessionToken) {
            alert('관리자 인증이 필요합니다.');
            return;
        }

        try {
            const response = await fetch('/api/admin/delete-message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                body: JSON.stringify({ messageId })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => null);
                console.error('Delete failed', err);
                alert('메시지 삭제에 실패했습니다.');
                return;
            }

            this.refreshData();
        } catch (error) {
            console.error('deleteAdminMessage error:', error);
            alert('메시지 삭제 중 오류가 발생했습니다.');
        }
    }

    async kickUser(sessionId, banDuration = 0) {
        if (!this.sessionToken) {
            alert('관리자 인증이 필요합니다.');
            return;
        }

        try {
            const response = await fetch('/api/admin/kick-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                body: JSON.stringify({ sessionId, banDuration })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => null);
                console.error('Kick user failed', err);
                alert('사용자 강제퇴장에 실패했습니다.');
                return;
            }

            const result = await response.json();
            
            if (result.banned) {
                const minutes = Math.floor(banDuration / 60);
                const seconds = banDuration % 60;
                const timeStr = minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
                alert(`사용자가 강제퇴장되었습니다.\nIP ${result.ip}가 ${timeStr}간 차단되었습니다.`);
            } else {
                alert('사용자가 강제퇴장되었습니다.');
            }
            
            this.refreshData();
        } catch (error) {
            console.error('kickUser error:', error);
            alert('사용자 강제퇴장 중 오류가 발생했습니다.');
        }
    }

    async exportFilteredCsv() {
        if (!this.sessionToken) {
            alert('관리자 인증이 필요합니다.');
            return;
        }

        // 필터 옵션 프롬프트
        const filterOptions = prompt(
            '내보내기 옵션을 선택하세요:\n' +
            '1: 전체 데이터\n' +
            '2: 활성 세션만\n' +
            '3: 오늘 메시지만\n' +
            '4: 최근 1시간\n' +
            '5: 최근 24시간',
            '1'
        );

        if (!filterOptions) return;

        try {
            const [sessionsResp, messagesResp] = await Promise.all([
                fetch('/api/admin/sessions', { headers: { 'Authorization': `Bearer ${this.sessionToken}` } }),
                fetch('/api/admin/messages', { headers: { 'Authorization': `Bearer ${this.sessionToken}` } })
            ]);

            if (!sessionsResp.ok || !messagesResp.ok) {
                alert('데이터를 불러오는 중 오류가 발생했습니다.');
                return;
            }

            let sessions = await sessionsResp.json();
            let messages = await messagesResp.json();

            // 필터 적용
            const now = Date.now();
            const oneHour = 60 * 60 * 1000;
            const oneDay = 24 * oneHour;
            const todayStart = new Date().setHours(0, 0, 0, 0);

            switch(filterOptions) {
                case '2': // 활성 세션만
                    const activeSessions = new Set(sessions.map(s => s.sessionId));
                    messages = messages.filter(m => activeSessions.has(m.sessionId));
                    break;
                case '3': // 오늘 메시지
                    messages = messages.filter(m => m.timestamp >= todayStart);
                    break;
                case '4': // 최근 1시간
                    messages = messages.filter(m => now - m.timestamp < oneHour);
                    sessions = sessions.filter(s => now - s.joinTime < oneHour);
                    break;
                case '5': // 최근 24시간
                    messages = messages.filter(m => now - m.timestamp < oneDay);
                    sessions = sessions.filter(s => now - s.joinTime < oneDay);
                    break;
                default: // 전체
                    break;
            }

            // CSV 생성
            const usersMap = new Map();
            for (const s of sessions) {
                usersMap.set(s.sessionId, s);
            }

            const rows = [];
            const headers = [
                'user_session_id', 'user_ip', 'user_join_time', 'user_message_count', 'user_last_message_time',
                'message_id', 'message_timestamp', 'message_content', 'message_edited_at', 'file_url', 'file_name', 'file_size', 'file_type'
            ];

            for (const msg of messages) {
                const user = usersMap.get(msg.sessionId) || {};
                rows.push([
                    user.sessionId || msg.sessionId || '',
                    user.ip || '',
                    user.joinTime ? new Date(user.joinTime).toISOString() : '',
                    user.messageCount != null ? user.messageCount : '',
                    user.lastMessageTime ? new Date(user.lastMessageTime).toISOString() : '',
                    msg.messageId || '',
                    msg.timestamp ? new Date(msg.timestamp).toISOString() : '',
                    msg.content || '',
                    msg.editedAt ? new Date(msg.editedAt).toISOString() : '',
                    msg.file?.url || '',
                    msg.file?.filename || '',
                    msg.file?.filesize != null ? String(msg.file.filesize) : '',
                    msg.file?.filetype || ''
                ]);
            }

            // 메시지 없는 세션 추가
            for (const [sessionId, user] of usersMap.entries()) {
                const hasMessage = messages.some(m => m.sessionId === sessionId);
                if (!hasMessage) {
                    rows.push([
                        user.sessionId || sessionId,
                        user.ip || '',
                        user.joinTime ? new Date(user.joinTime).toISOString() : '',
                        user.messageCount != null ? user.messageCount : '',
                        user.lastMessageTime ? new Date(user.lastMessageTime).toISOString() : '',
                        '', '', '', '', '', '', '', ''
                    ]);
                }
            }

            const escape = (value) => {
                if (value == null) return '';
                const str = String(value);
                return '"' + str.replace(/"/g, '""') + '"';
            };

            const csvContent = [headers.map(h => escape(h)).join(',')]
                .concat(rows.map(r => r.map(cell => escape(cell)).join(',')))
                .join('\n');

            const bom = '\uFEFF';
            const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            const filterName = ['all', 'active', 'today', '1hour', '24hours'][parseInt(filterOptions) - 1] || 'filtered';
            const a = document.createElement('a');
            a.href = url;
            a.download = `anonymous_chat_${filterName}_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Export filtered CSV error:', error);
            alert('CSV 내보내기 중 오류가 발생했습니다.');
        }
    }

    async loadAuditLogs() {
        // 감사 로그 표시 (필요시 UI에 추가)
        console.log('Audit Logs:', logs);
    }
}

// Initialize admin dashboard
new AdminDashboard();
