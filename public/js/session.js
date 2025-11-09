// Session management utilities
export class SessionManager {
    constructor() {
        this.sessionId = this.getOrCreateSessionId();
        this.nickname = this.getNickname();
    }

    getOrCreateSessionId() {
        // Try to get existing sessionId from localStorage
        let sessionId = localStorage.getItem('chatSessionId');
        
        if (!sessionId) {
            // Generate new sessionId if not exists
            sessionId = this.generateSessionId();
            localStorage.setItem('chatSessionId', sessionId);
        }
        
        return sessionId;
    }

    generateSessionId() {
        // Generate a cryptographically secure random session ID for anonymous user
        // Using crypto.randomUUID() for better security than Math.random()
        return 'user_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16) + '_' + Date.now();
    }

    getNickname() {
        return localStorage.getItem('chatNickname') || null;
    }

    setNickname(nickname) {
        if (nickname && nickname.trim()) {
            const sanitized = nickname.trim().substring(0, 20); // Max 20 chars
            localStorage.setItem('chatNickname', sanitized);
            this.nickname = sanitized;
        } else {
            localStorage.removeItem('chatNickname');
            this.nickname = null;
        }
        return this.nickname;
    }

    clearNickname() {
        localStorage.removeItem('chatNickname');
        this.nickname = null;
    }

    getSessionId() {
        return this.sessionId;
    }

    getDisplayName() {
        return this.nickname || '익명';
    }
}
