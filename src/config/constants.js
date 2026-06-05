// Rate limiting configuration
export const RATE_LIMIT = {
    MAX_MESSAGES_PER_MINUTE: 30,
    MAX_CONNECTIONS_PER_IP: 25,
    MESSAGE_COOLDOWN: 1000, // 1 second between messages
};

// Security configuration
export const SECURITY = {
    MAX_MESSAGE_LENGTH: 7500,
    ALLOWED_ORIGINS: [
        'https://kalpha.mmv.kr',
        'http://localhost:8787',
        'http://127.0.0.1:8787'
    ],
};

// Channel configuration
export const CHANNEL = {
    EMPTY_TTL: 10 * 60 * 1000, // 10 minutes
    MAX_NAME_LENGTH: 20,
};

// Message lifecycle constants
export const MESSAGE_RETENTION_MS = 12 * 60 * 60 * 1000; // 12 hours
export const MAX_STORED_MESSAGES = 500;
export const MAX_AUDIT_LOGS = 500;
export const MESSAGE_EDIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
export const RECENT_MESSAGES_BATCH = 50;

// Session and cleanup constants
export const CLEANUP_INTERVAL_MS = 300000; // 5 minutes
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const PUSH_THROTTLE_MS = 1500;

// Nickname constants
export const DEFAULT_NICKNAME = '익명';
export const MAX_NICKNAME_LENGTH = 12;

// DO room name constants
export const ROOM_NAME = 'main-room';
export const CHANNEL_PREFIX = 'channel:';

// Auth constants
export const AUTH = {
    RATE_LIMIT_EXPIRE: 5 * 60 * 1000, // 5 minutes
    MAX_FAILED_ATTEMPTS: 5,
    KV_TTL_SECONDS: 10 * 60,
    TOKEN_EXPIRY_MS: 2 * 60 * 60 * 1000, // 2 hours
};

// Push notification constants
export const PUSH_SUBSCRIPTION_TTL = 30 * 24 * 60 * 60; // 30 days
export const PUSH_CONFIG = {
    KV_LIST_LIMIT: 1000,
    BODY_TRUNCATION: 100,
};

// API rate limiting for unprotected endpoints
export const API_RATE_LIMIT = {
    CONFIG: { windowMs: 60000, max: 10 },
    HEALTH: { windowMs: 60000, max: 30 },
    TURNSTILE: { windowMs: 10000, max: 5 },
    UPLOAD: { windowMs: 60000, max: 10 },
    PUSH: { windowMs: 60000, max: 10 },
    CHECK_BAN: { windowMs: 10000, max: 10 },
};

// Reaction constants
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];
export const MAX_REACTIONS_PER_EMOJI = 100;
export const REACTION_RATE_LIMIT_MS = 3000;

// AI summary constants
export const AI_SUMMARY = {
    RECENT_MESSAGES_COUNT: 50,
    TIMEOUT_MS: 8000,
    RATE_LIMIT: { windowMs: 15000, max: 1 },
    MODEL_PRIMARY: '@cf/meta/llama-3-8b-instruct',
    MODEL_FALLBACK: '@cf/qwen/qwen1.5-7b-chat',
    MAX_TOKENS: 600,
    TEMPERATURE: 0.4,
};

// File upload constants
export const UPLOAD = {
    MAX_BYTES: 50 * 1024 * 1024, // 50MB
    MAX_BODY_BYTES: 1024 * 1024,  // 1MB
    MAX_FILENAME_LENGTH: 255,
    MAX_FILETYPE_LENGTH: 100,
    RATE_LIMIT: { windowMs: 60000, max: 10 },
};

// Dead drop constants
export const DEAD_DROP = {
    TTL_MS: 30 * 60 * 1000, // 30 minutes
    MAX_MESSAGE_LENGTH: 10000,
};

// General time constants
export const ONE_MINUTE_MS = 60000;
export const ONE_HOUR_MS = 60 * 60 * 1000;
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Admin display constants
export const ADMIN = {
    LOG_FETCH_LIMIT: 100,
    AUDIT_LOG_TRUNCATION: 50,
    ANNOUNCEMENT_HISTORY_MAX: 100,
    SESSION_ID_LENGTH: 8,
};

// Search constants
export const SEARCH = {
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 100,
};

// Code detection tuning constants (for content classification)
export const CODE_DETECTION = {
    MIN_LINES_FOR_CODE: 2,
    MAX_LINES_ALWAYS_CODE: 50,
    CODE_ENDING_RATIO: 0.4,
    CODE_CHAR_RATIO: 0.08,
};

// Miscellaneous delay/length constants
export const FORCE_DELETE_DELAY_MS = 1500;
export const MESSAGE_PREVIEW_COUNT = 20;
export const MAX_SESSION_ID_LENGTH = 100;

// Metrics storage (in-memory, per-worker instance)
export const metrics = {
    totalConnections: 0,
    activeConnections: 0,
    totalMessages: 0,
    errors: 0,
};
