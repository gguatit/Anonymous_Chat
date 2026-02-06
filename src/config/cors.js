// Get CORS headers based on request origin
export function getCorsHeaders(origin) {
    const allowedOrigins = [
        'https://kalpha.mmv.kr',
        'http://localhost:8787',
        'http://127.0.0.1:8787'
    ];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    
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
