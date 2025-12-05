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
    }

    async connect() {
        try {
            // Check if IP is banned before attempting WebSocket connection
            const banCheckResponse = await fetch('/api/check-ban');
            const banStatus = await banCheckResponse.json();
            
            if (banStatus.banned) {
                this.messageHandler.onError(`접속이 차단되었습니다. ${banStatus.remainingSeconds}초 후에 다시 시도해주세요.`);
                this.messageHandler.onConnectionChange('banned');
                
                // Schedule reconnection after ban expires
                setTimeout(() => {
                    this.connect();
                }, (banStatus.remainingSeconds + 1) * 1000);
                return;
            }
            
            // Force WSS in production for security (encrypted WebSocket)
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            
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
        this.startHeartbeat();
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
        
        // Don't reconnect if manually closed
        if (!this.manualClose && !event.wasClean) {
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
    
    startHeartbeat() {
        // Stop existing heartbeat
        this.stopHeartbeat();
        
        // Send ping every 30 seconds
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
                }, 10000); // 10 second timeout
            }
        }, 30000); // 30 second interval
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
