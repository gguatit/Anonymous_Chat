import { metrics } from '../config/constants.js';

export function handleMetrics(corsHeaders) {
    return new Response(JSON.stringify({
        timestamp: Date.now(),
        activeConnections: metrics.activeConnections,
        totalMessages: metrics.totalMessages,
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

export function handleHealth(corsHeaders) {
    return new Response(JSON.stringify({ status: 'healthy' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}
