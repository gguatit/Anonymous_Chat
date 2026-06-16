export const CATEGORY = {
    AUTH: 'auth',
    ENDPOINT: 'endpoint',
    INPUT: 'input',
    WEBSOCKET: 'websocket',
    SYSTEM: 'system',
};

export const SEVERITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
};

export const SECURITY_EVENTS = {
    LOGIN_FAIL: {
        type: 'LOGIN_FAIL',
        category: CATEGORY.AUTH,
        severity: SEVERITY.MEDIUM,
        score: 25,
    },
    TOKEN_INVALID: {
        type: 'TOKEN_INVALID',
        category: CATEGORY.AUTH,
        severity: SEVERITY.HIGH,
        score: 50,
    },
    TOKEN_EXPIRED: {
        type: 'TOKEN_EXPIRED',
        category: CATEGORY.AUTH,
        severity: SEVERITY.LOW,
        score: 10,
    },
    NONCE_REPLAY: {
        type: 'NONCE_REPLAY',
        category: CATEGORY.AUTH,
        severity: SEVERITY.HIGH,
        score: 60,
    },
    RATE_LIMIT_HIT: {
        type: 'RATE_LIMIT_HIT',
        category: CATEGORY.AUTH,
        severity: SEVERITY.MEDIUM,
        score: 20,
    },
    RATE_LIMIT_HARD: {
        type: 'RATE_LIMIT_HARD',
        category: CATEGORY.AUTH,
        severity: SEVERITY.HIGH,
        score: 40,
    },
    ADMIN_NO_TOKEN: {
        type: 'ADMIN_NO_TOKEN',
        category: CATEGORY.ENDPOINT,
        severity: SEVERITY.HIGH,
        score: 45,
    },
    ADMIN_FORBIDDEN: {
        type: 'ADMIN_FORBIDDEN',
        category: CATEGORY.ENDPOINT,
        severity: SEVERITY.HIGH,
        score: 55,
    },
    ENDPOINT_SCAN: {
        type: 'ENDPOINT_SCAN',
        category: CATEGORY.ENDPOINT,
        severity: SEVERITY.MEDIUM,
        score: 25,
    },
    METHOD_NOT_ALLOWED: {
        type: 'METHOD_NOT_ALLOWED',
        category: CATEGORY.ENDPOINT,
        severity: SEVERITY.MEDIUM,
        score: 20,
    },
    XSS_PAYLOAD: {
        type: 'XSS_PAYLOAD',
        category: CATEGORY.INPUT,
        severity: SEVERITY.HIGH,
        score: 65,
    },
    SQL_INJECTION: {
        type: 'SQL_INJECTION',
        category: CATEGORY.INPUT,
        severity: SEVERITY.HIGH,
        score: 70,
    },
    PATH_TRAVERSAL: {
        type: 'PATH_TRAVERSAL',
        category: CATEGORY.INPUT,
        severity: SEVERITY.HIGH,
        score: 60,
    },
    OVERSIZED_PAYLOAD: {
        type: 'OVERSIZED_PAYLOAD',
        category: CATEGORY.INPUT,
        severity: SEVERITY.MEDIUM,
        score: 30,
    },
    WS_FLOOD: {
        type: 'WS_FLOOD',
        category: CATEGORY.WEBSOCKET,
        severity: SEVERITY.HIGH,
        score: 50,
    },
    WS_HANDSHAKE_FAIL: {
        type: 'WS_HANDSHAKE_FAIL',
        category: CATEGORY.WEBSOCKET,
        severity: SEVERITY.MEDIUM,
        score: 25,
    },
    WS_INVALID_MSG: {
        type: 'WS_INVALID_MSG',
        category: CATEGORY.WEBSOCKET,
        severity: SEVERITY.MEDIUM,
        score: 30,
    },
    IP_BYPASS_ATTEMPT: {
        type: 'IP_BYPASS_ATTEMPT',
        category: CATEGORY.SYSTEM,
        severity: SEVERITY.HIGH,
        score: 55,
    },
    CF_WORKER_ERROR: {
        type: 'CF_WORKER_ERROR',
        category: CATEGORY.SYSTEM,
        severity: SEVERITY.HIGH,
        score: 50,
    },
    D1_QUERY_FAIL: {
        type: 'D1_QUERY_FAIL',
        category: CATEGORY.SYSTEM,
        severity: SEVERITY.HIGH,
        score: 50,
    },
    KV_FAILURE: {
        type: 'KV_FAILURE',
        category: CATEGORY.SYSTEM,
        severity: SEVERITY.MEDIUM,
        score: 35,
    },
    SHARED_IP_HIGH: {
        type: 'SHARED_IP_HIGH',
        category: CATEGORY.AUTH,
        severity: SEVERITY.LOW,
        score: 8,
    },
};

export const SECURITY_EVENTS_MAP = Object.fromEntries(
    Object.values(SECURITY_EVENTS).map((e) => [e.type, e])
);

export const RETENTION_DAYS = 90;
export const DEDUP_WINDOW_MS = 60 * 1000;
export const RISK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const CATEGORY_DIVERSITY_BONUS = 0.2;
export const CATEGORY_DIVERSITY_THRESHOLD = 4;

export const TIME_WEIGHTS = {
    ONE_HOUR: { maxAgeMs: 60 * 60 * 1000, multiplier: 2.0 },
    ONE_DAY: { maxAgeMs: 24 * 60 * 60 * 1000, multiplier: 1.5 },
    ONE_WEEK: { maxAgeMs: 7 * 24 * 60 * 60 * 1000, multiplier: 1.0 },
};

export const CLEANUP_PROBABILITY = 0.1;
