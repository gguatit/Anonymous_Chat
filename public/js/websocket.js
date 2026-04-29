// WebSocket connection manager
export class WebSocketManager {
    constructor(sessionId, messageHandler) {
        this.ws = null;
        this.sessionId = sessionId;
        this.messageHandler = messageHandler;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.baseReconnectDelay = 1000;
        this.heartbeatInterval = null;
        this.heartbeatTimeout = null;
        this.isReconnecting = false;
        this.hasConnectedBefore = false;
        this.manualClose = false;
        this.channelId = '0'; // '0' = main room
        // Heartbeat timing (visible vs hidden)
        this.visibleHeartbeatInterval = 25000;
        this.visibleHeartbeatTimeout = 10000;
        this.hiddenHeartbeatInterval = 60000;
        this.hiddenHeartbeatTimeout = 30000;
    }

    async connect() {
        try {
            // Check if IP or session is banned before attempting WebSocket connection
            const banCheckResponse = await fetch(`/api/check-ban?sessionId=${encodeURIComponent(this.sessionId)}`);
            const banStatus = await banCheckResponse.json();

            if (banStatus.banned) {
                this.messageHandler.onError(`접속이 차단되었습니다. ${banStatus.remainingSeconds}초 후에 다시 시도해주세요.`);
                this.messageHandler.onConnectionChange('banned');

                // 차단 시간 동안 재접속 시도하지 않음
                return;
            }

            // Force WSS in production for security (encrypted WebSocket)
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            let wsUrl = `${protocol}//${window.location.host}/ws?sessionId=${encodeURIComponent(this.sessionId)}`;
            if (this.channelId && this.channelId !== '0') {
                wsUrl += `&channel=${encodeURIComponent(this.channelId)}`;
            }

            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => this.handleOpen();
            this.ws.onmessage = (event) => this.handleMessage(event);
            this.ws.onclose = (event) => this.handleClose(event);
            this.ws.onerror = (error) => this.handleError(error);

        } catch (error) {
            console.error('Connection error:', error);
            this.scheduleReconnect();
        }
    }

    handleOpen() {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;

        // Send join message with reconnection flag
        this.send({
            type: 'join',
            sessionId: this.sessionId,
            timestamp: Date.now(),
            isReconnect: this.hasConnectedBefore
        });

        // Mark as connected
        this.hasConnectedBefore = true;
        this.isReconnecting = false;

        this.messageHandler.onConnectionChange('connected');

        // Start heartbeat to keep connection alive
        // Start with appropriate timing depending on visibility
        if (typeof document !== 'undefined' && document.hidden) {
            this.startHeartbeat(this.hiddenHeartbeatInterval, this.hiddenHeartbeatTimeout);
        } else {
            this.startHeartbeat(this.visibleHeartbeatInterval, this.visibleHeartbeatTimeout);
        }
    }

    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);

            // Handle pong response
            if (data.type === 'pong') {
                this.handlePong();
                return;
            }

            this.messageHandler.onMessage(data);
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    }

    handleClose(event) {
        console.log('WebSocket closed:', event.code, event.reason);

        // Stop heartbeat
        this.stopHeartbeat();

        this.messageHandler.onConnectionChange('disconnected');

        // Don't reconnect if:
        // - manually closed (disconnect() called)
        // - code 1008 = admin kick (Policy Violation)
        // - clean close
        const isAdminKick = event.code === 1008;
        // Reconnect more aggressively: only stop if manually closed or kicked by admin
        if (!this.manualClose && !isAdminKick) {
            this.isReconnecting = true;
            this.scheduleReconnect();
        }

        this.manualClose = false;
    }

    handleError(error) {
        console.error('WebSocket error:', error);
        this.messageHandler.onConnectionChange('error');
    }

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.messageHandler.onError('재연결 실패. 페이지를 새로고침해주세요.');
            return;
        }

        // Exponential backoff: delay = baseDelay * 2^attempts
        const delay = Math.min(
            this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
            30000 // Max 30 seconds
        );

        this.reconnectAttempts++;
        this.messageHandler.onConnectionChange('reconnecting', this.reconnectAttempts, this.maxReconnectAttempts);

        setTimeout(() => {
            console.log(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
            this.connect();
        }, delay);
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    checkConnection() {
        if (!this.isConnected() && !this.isReconnecting) {
            console.log('Connection lost, attempting proactive reconnect');
            this.connect();
        } else if (this.isConnected()) {
            // If connected, send a ping to verify
            this.send({ type: 'ping', timestamp: Date.now() });
        }
    }

    startHeartbeat(intervalDelay = this.visibleHeartbeatInterval, timeoutDelay = this.visibleHeartbeatTimeout) {
        // Stop existing heartbeat
        this.stopHeartbeat();

        // Keep current delays
        this.currentHeartbeatIntervalDelay = intervalDelay;
        this.currentHeartbeatTimeoutDelay = timeoutDelay;

        // Send ping on the configured interval
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected()) {
                this.send({ type: 'ping', timestamp: Date.now() });

                // Set timeout to detect connection loss
                this.heartbeatTimeout = setTimeout(() => {
                    console.warn('Heartbeat timeout - connection may be lost');
                    // Close and reconnect if no pong received
                    if (this.ws) {
                        this.ws.close();
                    }
                }, timeoutDelay);
            } else if (!this.isReconnecting) {
                this.connect();
            }
        }, intervalDelay);

        // Listen for visibility changes to adapt heartbeat timing
        if (typeof document !== 'undefined' && !this._visibilityHandlerAttached) {
            document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
            this._visibilityHandlerAttached = true;
        }
    }

    handleVisibilityChange() {
        if (typeof document === 'undefined') return;
        if (document.hidden) {
            // Tab hidden: relax heartbeat to reduce false timeouts
            this.startHeartbeat(this.hiddenHeartbeatInterval, this.hiddenHeartbeatTimeout);
        } else {
            // Tab visible: restore aggressive heartbeat and probe connection
            this.startHeartbeat(this.visibleHeartbeatInterval, this.visibleHeartbeatTimeout);
            if (this.isConnected()) {
                this.send({ type: 'ping', timestamp: Date.now() });
            } else if (!this.isReconnecting) {
                this.connect();
            }
        }
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
    }

    handlePong() {
        // Clear timeout when pong received
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
    }

    disconnect() {
        this.manualClose = true;
        this.stopHeartbeat();
        if (this.ws) {
            this.ws.close();
        }
    }
}
