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
        const res = await this.request(url);
        return res;
    },

    async post(url, body) {
        const res = await this.request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined
        });
        return res.json().catch(() => null);
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
        return res.json().catch(() => null);
    },

    async del(url, body) {
        const res = await this.request(url, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined
        });
        return res.json().catch(() => null);
    }
};

export default ApiClient;
