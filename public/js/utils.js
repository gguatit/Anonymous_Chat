export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text || '');
    return div.innerHTML;
}

export function isValidUrl(url) {
    try {
        const urlWithProtocol = url.match(/^https?:\/\//) ? url : 'https://' + url;
        const parsed = new URL(urlWithProtocol);
        if (!url.match(/^https?:\/\//)) {
            const domain = parsed.hostname;
            if (!domain || !domain.includes('.') || domain.split('.').pop().length < 2) {
                return false;
            }
        }
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (_e) {
        return false;
    }
}

export function sanitizeUrl(url) {
    if (!isValidUrl(url)) return '#';
    const safeUrl = url.match(/^https?:\/\//) ? url : 'https://' + url;
    return safeUrl.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function formatFileSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = (bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2);
    return `${size} ${sizes[i]}`;
}

export function sendErrorReport(message, context = '', extra = {}) {
    try {
        const body = {
            message: String(message),
            context: String(context),
            environment: {
                userAgent: navigator.userAgent,
                url: window.location.href,
                ...extra
            }
        };
        fetch('/api/logs/error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).catch(() => {});
    } catch (_e) {
        // silent
    }
}
