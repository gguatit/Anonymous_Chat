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
        this.adminMessageInput = document.getElementById('admin-message-input');
        this.adminSendBtn?.addEventListener('click', () => this.sendAdminMessage());
        
        // IP management elements
        this.ipActiveSessions = document.getElementById('ip-active-sessions');
        this.bannedIpsList = document.getElementById('banned-ips-list');
        this.banIpInput = document.getElementById('ban-ip-input');
        this.banIpBtn = document.getElementById('ban-ip-btn');
        this.banIpBtn?.addEventListener('click', () => this.handleBanIp());
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

    async sendAdminMessage() {
        if (!this.sessionToken) {
            alert('관리자 인증이 필요합니다.');
            return;
        }

        const content = (this.adminMessageInput?.value || '').trim();
        if (!content) {
            alert('메시지를 입력하세요.');
            return;
        }

        try {
            const response = await fetch('/api/admin/broadcast', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                body: JSON.stringify({ content })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => null);
                console.error('Broadcast failed', err);
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

            // Load banned IPs and active sessions for IP management panel
            this.loadIpManagementData();
            // Load banned IPs and active sessions for IP management panel
            this.loadIpManagementData();

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

        container.innerHTML = sessions.map(session => `
            <div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <div class="flex items-center gap-3">
                    <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <div>
                        <p class="text-sm font-mono text-gray-300">${this.truncateId(session.sessionId)}</p>
                        <p class="text-xs text-gray-500">${session.ip || 'Unknown IP'}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-xs text-gray-400">${session.messageCount || 0} 메시지</p>
                    <p class="text-xs text-gray-500">${this.formatDuration(Date.now() - session.joinTime)}</p>
                </div>
            </div>
        `).join('');
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

            return `
                <div class="p-3 ${isAdminMsg ? 'bg-yellow-900/5 border border-yellow-800' : 'bg-gray-700'} rounded-lg">
                    <div class="flex items-start justify-between mb-1">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-mono text-gray-400">${this.truncateId(msg.sessionId)}</span>
                            ${adminBadge}
                        </div>
                        <span class="text-xs text-gray-500">${new Date(msg.timestamp).toLocaleTimeString('ko-KR')}</span>
                    </div>
                    <p class="text-sm text-gray-200 break-words">${this.escapeHtml(msg.content || '')}</p>
                    ${msg.editedAt ? '<span class="text-xs text-yellow-500">(수정됨)</span>' : ''}
                    ${fileHtml}
                </div>
            `;
        }).join('');
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
    
    async loadAuditLogs() {
        try {
            const response = await fetch('/api/admin/logs', {
                headers: {
                    'Authorization': `Bearer ${this.sessionToken}`
                }
            });
            
            if (!response.ok) throw new Error('Failed to fetch logs');
            
            const data = await response.json();
            this.displayLogs(data.logs || []);
        } catch (error) {
            console.error('Error loading logs:', error);
        }
    }
    
    displayLogs(logs) {
        // 감사 로그 표시 (필요시 UI에 추가)
        console.log('Audit Logs:', logs);
    }

    // ------------------ IP Management ------------------
    async loadIpManagementData() {
        try {
            // Active sessions (reuse existing endpoint)
            const sessionsResp = await fetch('/api/admin/sessions', { headers: { 'Authorization': `Bearer ${this.sessionToken}` } });
            const bannedResp = await fetch('/api/admin/banned-ips', { headers: { 'Authorization': `Bearer ${this.sessionToken}` } });

            if (sessionsResp.ok) {
                const sessions = await sessionsResp.json();
                this.renderActiveSessionsForIp(sessions || []);
            } else {
                if (this.ipActiveSessions) this.ipActiveSessions.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">활성 세션을 불러올 수 없습니다.</p>';
            }

            if (bannedResp.ok) {
                const data = await bannedResp.json();
                this.renderBannedIps(data.banned || []);
            } else {
                if (this.bannedIpsList) this.bannedIpsList.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">차단된 IP를 불러올 수 없습니다.</p>';
            }
        } catch (error) {
            console.error('IP management load error:', error);
            if (this.ipActiveSessions) this.ipActiveSessions.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">오류 발생</p>';
            if (this.bannedIpsList) this.bannedIpsList.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">오류 발생</p>';
        }
    }

    renderActiveSessionsForIp(sessions) {
        if (!this.ipActiveSessions) return;
        if (!sessions || sessions.length === 0) {
            this.ipActiveSessions.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">활성 세션이 없습니다.</p>';
            return;
        }

        this.ipActiveSessions.innerHTML = sessions.map(s => `
            <div class="flex items-center justify-between bg-gray-800 p-2 rounded">
                <div class="text-xs text-gray-300">
                    <div class="font-mono">${this.escapeHtml(s.sessionId)}</div>
                    <div class="text-gray-400">${this.escapeHtml(s.ip || '')}</div>
                </div>
                <div>
                    <button data-ip="${this.escapeHtml(s.ip || '')}" class="block-ip-btn bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded">차단</button>
                </div>
            </div>
        `).join('');

        // Attach listeners
        this.ipActiveSessions.querySelectorAll('.block-ip-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ip = e.currentTarget.getAttribute('data-ip');
                if (ip) this.blockIp(ip);
            });
        });
    }

    renderBannedIps(banned) {
        if (!this.bannedIpsList) return;
        if (!banned || banned.length === 0) {
            this.bannedIpsList.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">차단된 IP가 없습니다.</p>';
            return;
        }

        this.bannedIpsList.innerHTML = banned.map(ip => `
            <div class="flex items-center justify-between bg-gray-800 p-2 rounded">
                <div class="text-xs text-gray-300">${this.escapeHtml(ip)}</div>
                <div>
                    <button data-ip="${this.escapeHtml(ip)}" class="unblock-ip-btn bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded">해제</button>
                </div>
            </div>
        `).join('');

        this.bannedIpsList.querySelectorAll('.unblock-ip-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ip = e.currentTarget.getAttribute('data-ip');
                if (ip) this.unblockIp(ip);
            });
        });
    }

    async handleBanIp() {
        const ip = (this.banIpInput?.value || '').trim();
        if (!ip) return alert('차단할 IP를 입력하세요.');
        await this.blockIp(ip);
    }

    async blockIp(ip) {
        if (!this.sessionToken) return alert('관리자 인증이 필요합니다.');
        try {
            const resp = await fetch('/api/admin/block-ip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.sessionToken}` },
                body: JSON.stringify({ ip })
            });
            if (!resp.ok) throw new Error('Failed to block');
            // refresh lists
            this.loadIpManagementData();
        } catch (error) {
            console.error('blockIp error:', error);
            alert('IP 차단 중 오류가 발생했습니다.');
        }
    }

    async unblockIp(ip) {
        if (!this.sessionToken) return alert('관리자 인증이 필요합니다.');
        try {
            const resp = await fetch('/api/admin/unblock-ip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.sessionToken}` },
                body: JSON.stringify({ ip })
            });
            if (!resp.ok) throw new Error('Failed to unblock');
            this.loadIpManagementData();
        } catch (error) {
            console.error('unblockIp error:', error);
            alert('IP 차단 해제 중 오류가 발생했습니다.');
        }
    }
}

// Initialize admin dashboard
new AdminDashboard();
