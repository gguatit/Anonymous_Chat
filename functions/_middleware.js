// Cloudflare Pages Functions Middleware
// This file routes all requests to the main worker

export async function onRequest(context) {
    // Import the worker module
    const worker = await import('../src/worker.js');
    
    // Forward the request to the worker
    return worker.default.fetch(context.request, context.env, context);
}
