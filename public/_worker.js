// Cloudflare Pages Functions Worker
// This file is automatically deployed with your Pages project

export { default } from '../src/worker.js';

// Re-export Durable Object classes
export { ChatRoom } from '../src/worker.js';
