// Cloudflare Pages Functions - Main worker logic
import worker from '../src/worker.js';

export const onRequest = worker.fetch;
