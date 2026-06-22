import { SECURITY } from './constants.js';

// Get CORS headers based on request origin
export function getCorsHeaders(origin) {
    if (!origin || !SECURITY.ALLOWED_ORIGINS.includes(origin)) {
        return {};
    }

    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
    };
}

// Handle CORS preflight requests
export function handleCorsPreflightResponse(corsHeaders) {
    return new Response(null, { headers: corsHeaders });
}
