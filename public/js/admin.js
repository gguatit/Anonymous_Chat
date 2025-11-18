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
        
        // Admin message form
        const adminMessageForm = document.getElementById('admin-message-form');
        if (adminMessageForm) {
            adminMessageForm.addEventListener('submit', (e) => this.handleAdminMessage(e));
        }
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
            const isAdminMessage = msg.isAdmin || msg.sessionId === 'ADMIN';
            const bgColor = isAdminMessage ? 'bg-gradient-to-r from-purple-900 to-purple-800 border border-purple-500' : 'bg-gray-700';
            const badge = isAdminMessage ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-600 text-white">관리자</span>' : '';
            
            return `
                <div class="p-3 ${bgColor} rounded-lg">
                    <div class="flex items-start justify-between mb-1">
                        <div class="flex items-center gap-2">
                            ${badge}
                            <span class="text-xs font-mono text-gray-400">${this.truncateId(msg.sessionId)}</span>
                        </div>
                        <span class="text-xs text-gray-500">${new Date(msg.timestamp).toLocaleTimeString('ko-KR')}</span>
                    </div>
                    <p class="text-sm text-gray-200 break-words">${this.escapeHtml(msg.content)}</p>
                    ${msg.editedAt ? '<span class="text-xs text-yellow-500">(수정됨)</span>' : ''}
                </div>
            `;
        }).join('');
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
    
    async handleAdminMessage(e) {
        e.preventDefault();
        
        const input = document.getElementById('admin-message-input');
        const content = input.value.trim();
        
        if (!content) return;
        
        try {
            const response = await fetch('/api/admin/send-message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                body: JSON.stringify({ content })
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    this.handleLogout();
                    return;
                }
                throw new Error('Failed to send message');
            }
            
            const result = await response.json();
            
            if (result.success) {
                input.value = '';
                // Refresh messages to show the new admin message
                this.refreshData();
            } else {
                alert('메시지 전송에 실패했습니다: ' + (result.error || '알 수 없는 오류'));
            }
        } catch (error) {
            console.error('Admin message error:', error);
            alert('메시지 전송 중 오류가 발생했습니다.');
        }
    }
}

// Initialize admin dashboard
new AdminDashboard();
