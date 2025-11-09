// Session management utilities
export class SessionManager {
    constructor() {
        this.sessionId = this.getOrCreateSessionId();
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

    getSessionId() {
        return this.sessionId;
    }
}
