const ApiClient = {
    _token: null,

    setToken(token) {
        this._token = token;
    },

    getToken() {
        return this._token;
    },

    headers(extra = {}) {
        const h = { ...extra };
        if (this._token) {
            h['Authorization'] = `Bearer ${this._token}`;
        }
        return h;
    },

    async request(url, options = {}) {
        const res = await fetch(url, {
            ...options,
            headers: this.headers(options.headers || {})
        });
        return res;
    },

    async get(url) {
        const res = await this.request(url);
        if (!res.ok) {
            throw new Error(`GET ${url} failed: ${res.status}`);
        }
        return res.json();
    },

    async getRaw(url) {
        const res = await this.request(url, { method: 'GET' });
        return res;
    },

    // Parse JSON, but reject on HTTP errors so callers can show failures truthfully
    async _json(res, label) {
        if (!res.ok) {
            let detail = '';
            try {
                const d = await res.json();
                detail = d?.error || d?.message || '';
            } catch { /* no body */ }
            throw new Error(`${label} failed: ${res.status}${detail ? ' - ' + detail : ''}`);
        }
        return res.json().catch(() => null);
    },

    async post(url, body) {
        const res = await this.request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined
        });
        return this._json(res, `POST ${url}`);
    },

    async postRaw(url, body) {
        const res = await this.request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined
        });
        return res;
    },

    async put(url, body) {
        const res = await this.request(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined
        });
        return this._json(res, `PUT ${url}`);
    },

    async del(url, body) {
        const res = await this.request(url, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined
        });
        return this._json(res, `DELETE ${url}`);
    }
};

export default ApiClient;
