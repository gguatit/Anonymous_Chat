// Dead Drop API Client - 일회성 비밀 메시지 저장소
export class DeadDropClient {
    constructor(apiUrl = 'https://api.kalpha.kr') {
        this.apiUrl = apiUrl;
        this.apiKey = null; // Optional bearer token
    }

    /**
     * Store a secret message in Dead Drop
     * @param {string} message - The secret message to store
     * @returns {Promise<{id: string}>} - The ID to retrieve the message
     */
    async store(message) {
        try {
            const headers = {
                'Content-Type': 'application/json'
            };

            if (this.apiKey) {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            }

            const response = await fetch(`${this.apiUrl}/store`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Dead Drop store error:', error);
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
            const headers = {};

            if (this.apiKey) {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            }

            const response = await fetch(`${this.apiUrl}/read/${id}`, {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('메시지를 찾을 수 없거나 이미 읽혔습니다.');
                }
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Dead Drop read error:', error);
            throw error;
        }
    }

    /**
     * Generate a read URL for a message
     * @param {string} id - The message ID
     * @returns {string} - Full URL to read the message
     */
    getReadUrl(id) {
        return `${this.apiUrl}/read/${id}`;
    }
}
