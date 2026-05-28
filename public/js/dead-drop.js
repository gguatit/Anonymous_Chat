// Dead Drop API Client - store/read once 자체 구현
export class DeadDropClient {
    constructor() {
        this._storeUrl = '/api/secret-store';
        this._readUrl = '/api/secret-read';
    }

    /**
     * Store a secret message
     * @param {string} message - The secret message to store
     * @returns {Promise<{id: string}>} - The ID to retrieve the message
     */
    async store(message) {
        try {
            const response = await fetch(this._storeUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Secret store error:', error);
            throw error;
        }
    }

    /**
     * Read and consume a secret message (single-use)
     * @param {string} id - The message ID
     * @returns {Promise<{message: string}>} - The secret message
     */
    async read(id) {
        try {
            const response = await fetch(`${this._readUrl}?id=${encodeURIComponent(id)}`);

            if (!response.ok) {
                if (response.status === 404 || response.status === 410) {
                    throw new Error('메시지를 찾을 수 없거나 이미 읽혔습니다.');
                }
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Secret read error:', error);
            throw error;
        }
    }
}
