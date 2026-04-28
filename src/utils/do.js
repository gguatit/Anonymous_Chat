const ROOM_NAME = 'main-room';

export function getChatRoom(env) {
    const id = env.CHAT_ROOM.idFromName(ROOM_NAME);
    return env.CHAT_ROOM.get(id);
}

export async function forwardToDO(env, path, options = {}) {
    const room = getChatRoom(env);
    const headers = {
        'X-HMAC-Secret': env.HMAC_SECRET || '',
        ...options.headers
    };
    if (options.json !== undefined) {
        headers['Content-Type'] = 'application/json';
    }
    const request = new Request(`https://dummy${path}`, {
        method: options.method || 'GET',
        headers,
        body: options.json !== undefined ? JSON.stringify(options.json) : options.body
    });
    return await room.fetch(request);
}
