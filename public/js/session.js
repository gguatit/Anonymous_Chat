import { MAX_NICKNAME_LENGTH } from '../../src/config/constants.js';

// Session management utilities
export class SessionManager {
    constructor() {
        this.sessionId = this.getOrCreateSessionId();
        this.nickname = this.getOrCreateNickname();
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

    getCapabilityKey() {
        return localStorage.getItem('chatSessionKey');
    }

    setCapabilityKey(key) {
        if (key) {
            localStorage.setItem('chatSessionKey', key);
        } else {
            localStorage.removeItem('chatSessionKey');
        }
    }

    // 세션 열쇠를 폐기하고 새 익명 신원을 발급한다 (열쇠 분실/불일치 시 1회 재시도용)
    resetSession() {
        this.setCapabilityKey(null);
        this.sessionId = this.generateSessionId();
        localStorage.setItem('chatSessionId', this.sessionId);
        return this.sessionId;
    }

    getOrCreateNickname() {
        let nickname = localStorage.getItem('chatNickname');
        if (!nickname) {
            nickname = '익명';
            localStorage.setItem('chatNickname', nickname);
        }
        return nickname;
    }

    getNickname() {
        return this.nickname;
    }

    setNickname(name) {
        const safeName = name ? name.trim().substring(0, MAX_NICKNAME_LENGTH) : '익명';
        this.nickname = safeName || '익명';
        localStorage.setItem('chatNickname', this.nickname);
        return this.nickname;
    }

    hasAcceptedNicknameNotice() {
        return localStorage.getItem('chatNicknameNoticeAccepted') === 'true';
    }

    setNicknameNoticeAccepted(accepted = true) {
        if (accepted) {
            localStorage.setItem('chatNicknameNoticeAccepted', 'true');
        } else {
            localStorage.removeItem('chatNicknameNoticeAccepted');
        }
    }
}
