// Rate limiting configuration
export const RATE_LIMIT = {
    MAX_MESSAGES_PER_MINUTE: 30,
    MAX_CONNECTIONS_PER_IP: 25,
    MESSAGE_COOLDOWN: 1000, // 1 second between messages
};

// Security configuration
export const SECURITY = {
    MAX_MESSAGE_LENGTH: 5000,
    BANNED_IPS: new Set(), // Can be populated from KV or environment
    IP_WHITELIST: null, // null means all IPs allowed
    ALLOWED_ORIGINS: [
        'https://kalpha.mmv.kr',
        'http://localhost:8787',
        'http://127.0.0.1:8787'
    ],
};

// Metrics storage (in-memory, per-worker instance)
export const metrics = {
    totalConnections: 0,
    activeConnections: 0,
    totalMessages: 0,
    errors: 0,
};
