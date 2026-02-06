// 감사 로그 기록 함수
export async function logAdminActivity(env, activity) {
    if (!env?.ADMIN_LOGS) return;
    
    const logKey = `log:${activity.timestamp}:${crypto.randomUUID()}`;
    const logData = JSON.stringify(activity);
    
    // KV에 30일간 보관
    await env.ADMIN_LOGS.put(logKey, logData, {
        expirationTtl: 30 * 24 * 60 * 60
    });
}
