import * as esbuild from 'esbuild';

const isProd = process.env.NODE_ENV !== 'development';

const common = {
    bundle: true,
    format: 'esm',
    minify: isProd,
    target: 'es2020',
};

const entries = {
    chat: 'public/js/chat.js',
    'admin-core': 'public/js/admin-core.js',
    'admin-main': 'public/js/admin-main.js',
    'admin-users': 'public/js/pages/page-users.js',
    'admin-messages': 'public/js/pages/page-messages.js',
    'admin-logs': 'public/js/pages/page-logs.js',
    'admin-announcements': 'public/js/pages/page-announcements.js',
    'admin-channels': 'public/js/pages/page-channels.js',
    'admin-bans': 'public/js/pages/page-bans.js',
    'security-center': 'public/js/security-center.js',
};

const outdir = 'public/js';

try {
    await esbuild.build({
        ...common,
        entryPoints: entries,
        outdir,
        entryNames: '[dir]/[name].bundle',
        splitting: true,
        chunkNames: 'chunks/[name]-[hash]',
    });
    console.log(`[esbuild] Built ${Object.keys(entries).length} bundles → ${outdir}`);
} catch (error) {
    console.error('[esbuild] Build failed:', error);
    process.exit(1);
}
