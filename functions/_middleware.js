// Cloudflare Pages Functions - Main worker logic
// Properly bridges Pages Function context to Worker fetch handler
import worker from '../src/worker.js';

export async function onRequest(context) {
    const { request, env, ctx } = context;
    return worker.fetch(request, env, ctx);
}
