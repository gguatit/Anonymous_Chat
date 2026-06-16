import { classifyContent, classifyURLPath, classifyPayloadSize } from '../utils/security-classifier.js';
import { logSecurityEvent } from '../utils/security-logger.js';

export async function validateRequestInput(env, url, bodyText, ip, method, userAgent) {
    if (!env?.DB_ADMIN) return;

    if (classifyURLPath(url.pathname)) {
        await logSecurityEvent(env, 'PATH_TRAVERSAL', {
            ip,
            path: url.pathname,
            method,
            userAgent,
            details: `Suspicious URL path: ${url.pathname}`,
        });
        return;
    }

    for (const [key, value] of url.searchParams) {
        const result = classifyContent(value);
        if (result) {
            await logSecurityEvent(env, result.type, {
                ip,
                path: url.pathname,
                method,
                userAgent,
                details: `Query param "${key}" matched ${result.type}`,
                metadata: { param: key, value: value.substring(0, 200) },
            });
            return;
        }
    }

    if (bodyText) {
        const bodyResult = classifyContent(bodyText);
        if (bodyResult) {
            await logSecurityEvent(env, bodyResult.type, {
                ip,
                path: url.pathname,
                method,
                userAgent,
                details: `Request body matched ${bodyResult.type}`,
                metadata: { bodyPreview: bodyText.substring(0, 300) },
            });
            return;
        }

        const sizeResult = classifyPayloadSize(bodyText.length);
        if (sizeResult) {
            await logSecurityEvent(env, sizeResult.type, {
                ip,
                path: url.pathname,
                method,
                userAgent,
                details: `Oversized payload: ${bodyText.length} bytes`,
                metadata: { size: bodyText.length },
            });
        }
    }
}

export async function validateWSMessage(env, messageText, ip, sessionId) {
    if (!env?.DB_ADMIN || !messageText) return;

    const result = classifyContent(messageText);
    if (result) {
        await logSecurityEvent(env, result.type, {
            ip,
            sessionId,
            details: `WebSocket message matched ${result.type}`,
            metadata: { preview: messageText.substring(0, 300) },
        });
    }
}
