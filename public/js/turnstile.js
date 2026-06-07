import { TURNSTILE_CLIENT } from '../../src/config/constants.js';

export class TurnstileManager {
    constructor(siteKey, onVerified) {
        this.siteKey = siteKey;
        this.onVerified = onVerified;
        this.verified = false;
        this.widgetId = null;
        this.STORAGE_KEY = 'turnstileVerified';
        this.SESSION_TIMESTAMP_KEY = 'turnstileVerifiedAt';
        this.MAX_SESSION_AGE = TURNSTILE_CLIENT.SESSION_AGE_MS;
    }

    isAlreadyVerified() {
        const verified = sessionStorage.getItem(this.STORAGE_KEY);
        const timestamp = sessionStorage.getItem(this.SESSION_TIMESTAMP_KEY);

        if (verified === 'true' && timestamp) {
            const elapsed = Date.now() - parseInt(timestamp, 10);
            if (elapsed < this.MAX_SESSION_AGE) {
                return true;
            }
            sessionStorage.removeItem(this.STORAGE_KEY);
            sessionStorage.removeItem(this.SESSION_TIMESTAMP_KEY);
        }
        return false;
    }

    markVerified() {
        this.verified = true;
        sessionStorage.setItem(this.STORAGE_KEY, 'true');
        sessionStorage.setItem(this.SESSION_TIMESTAMP_KEY, String(Date.now()));
    }

    init() {
        if (this.isAlreadyVerified()) {
            this.verified = true;
            this.hideModal();
            if (this.onVerified) this.onVerified();
            return;
        }

        this.showModal();
        this.renderWidget();
    }

    showModal() {
        const modal = document.getElementById('turnstile-modal');
        if (modal) {
            modal.classList.remove('opacity-0', 'pointer-events-none');
            modal.classList.add('opacity-100');
            const inner = modal.querySelector('.scale-95');
            if (inner) {
                inner.classList.remove('scale-95');
                inner.classList.add('scale-100');
            }
        }
    }

    hideModal() {
        const modal = document.getElementById('turnstile-modal');
        if (modal) {
            modal.classList.add('opacity-0', 'pointer-events-none');
            modal.classList.remove('opacity-100');
            const inner = modal.querySelector('.scale-100');
            if (inner) {
                inner.classList.remove('scale-100');
                inner.classList.add('scale-95');
            }
        }
    }

    showSuccess() {
        const container = document.getElementById('turnstile-widget');
        const successEl = document.getElementById('turnstile-success');
        const errorEl = document.getElementById('turnstile-error');

        if (container) container.classList.add('hidden');
        if (errorEl) errorEl.classList.add('hidden');
        if (successEl) successEl.classList.remove('hidden');

        setTimeout(() => {
            this.hideModal();
            if (this.onVerified) this.onVerified();
        }, TURNSTILE_CLIENT.HIDE_DELAY_MS);
    }

    showError(message) {
        const errorEl = document.getElementById('turnstile-error');
        if (errorEl) {
            errorEl.textContent = message || '인증에 실패했습니다. 다시 시도해주세요.';
            errorEl.classList.remove('hidden');
        }
    }

    hideError() {
        const errorEl = document.getElementById('turnstile-error');
        if (errorEl) errorEl.classList.add('hidden');
    }

    renderWidget() {
        const container = document.getElementById('turnstile-widget');
        if (!container) return;

        if (typeof turnstile !== 'undefined') {
            this.widgetId = turnstile.render(container, {
                sitekey: this.siteKey,
                theme: 'dark',
                size: 'normal',
                callback: (token) => this.handleCallback(token),
                'error-callback': () => this.handleError(),
                'expired-callback': () => this.handleExpired(),
                'timeout-callback': () => this.handleExpired()
            });
        } else {
            this.showError('보안 인증 로딩 중...');
            let attempts = 0;
            const maxAttempts = TURNSTILE_CLIENT.POLL_MAX_ATTEMPTS;
            const waitInterval = setInterval(() => {
                attempts++;
                if (typeof turnstile !== 'undefined') {
                    clearInterval(waitInterval);
                    this.hideError();
                    this.widgetId = turnstile.render(container, {
                        sitekey: this.siteKey,
                        theme: 'dark',
                        size: 'normal',
                        callback: (token) => this.handleCallback(token),
                        'error-callback': () => this.handleError(),
                        'expired-callback': () => this.handleExpired(),
                        'timeout-callback': () => this.handleExpired()
                    });
                } else if (attempts >= maxAttempts) {
                    clearInterval(waitInterval);
                    this.showError('보안 인증 로딩 실패. 페이지를 새로고침해주세요.');
                }
            }, TURNSTILE_CLIENT.POLL_INTERVAL_MS);
        }
    }

    async handleCallback(token) {
        this.hideError();

        try {
            const response = await fetch('/api/turnstile/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });

            const result = await response.json();

            if (result.success) {
                this.markVerified();
                this.showSuccess();
            } else {
                const errorMsg = result.errorCodes && result.errorCodes.includes('timeout-or-duplicate')
                    ? '인증 시간이 만료되었습니다. 다시 시도해주세요.'
                    : '인증에 실패했습니다. 다시 시도해주세요.';
                this.showError(errorMsg);
                this.resetWidget();
            }
        } catch (error) {
            console.error('Turnstile verify request failed:', error);
            this.showError('서버 통신 오류가 발생했습니다. 다시 시도해주세요.');
            this.resetWidget();
        }
    }

    handleError() {
        this.showError('보안 인증에 문제가 발생했습니다. 페이지를 새로고침해주세요.');
    }

    handleExpired() {
        this.showError('인증이 만료되었습니다. 다시 인증해주세요.');
        this.resetWidget();
    }

    resetWidget() {
        if (typeof turnstile !== 'undefined' && this.widgetId) {
            turnstile.reset(this.widgetId);
        }
    }
}