import { SECURITY } from './constants.js';

// Get CORS headers based on request origin
export function getCorsHeaders(origin) {
    const corsOrigin = SECURITY.ALLOWED_ORIGINS.includes(origin) ? origin : SECURITY.ALLOWED_ORIGINS[0];
    
    return {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
    };
}

// Handle CORS preflight requests
export function handleCorsPreflightResponse(corsHeaders) {
    return new Response(null, { headers: corsHeaders });
}
