import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                WebSocketPair: 'readonly',
                Prism: 'readonly',
                turnstile: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
            'no-console': 'warn',
            'prefer-const': 'error',
            'no-var': 'error',
            'no-eval': 'error',
            'no-implied-eval': 'error',
            'complexity': ['warn', 15],
        },
    },
    {
        ignores: [
            'node_modules/**',
            '.wrangler/**',
            'dist/**',
            '.opencode/**',
        ],
    },
];
