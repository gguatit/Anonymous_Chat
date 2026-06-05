// UI Modals & Channel UI mixin
export const modals = {
    _showModal(modal) {
        if (!modal) return;
        modal.classList.remove('opacity-0', 'pointer-events-none');
        modal.classList.add('opacity-100');
        const inner = modal.querySelector('.scale-95');
        if (inner) {
            inner.classList.remove('scale-95');
            inner.classList.add('scale-100');
        }
    },

    _hideModal(modal) {
        if (!modal) return;
        modal.classList.add('opacity-0', 'pointer-events-none');
        modal.classList.remove('opacity-100');
        const inner = modal.querySelector('.scale-100');
        if (inner) {
            inner.classList.remove('scale-100');
            inner.classList.add('scale-95');
        }
    },

    showNoticeModal() {
        this._showModal(this.noticeModal);
    },

    hideNoticeModal() {
        this._hideModal(this.noticeModal);
    },

    showCreateChannelModal() {
        if (this.createChannelModal) {
            this.hideJoinChannelModal();
            this._showModal(this.createChannelModal);
            this.createChannelInput.value = '';
            this.createChannelError.classList.add('hidden');
            setTimeout(() => this.createChannelInput.focus(), 50);
        }
    },

    hideCreateChannelModal() {
        if (this.createChannelModal) {
            this._hideModal(this.createChannelModal);
        }
    },

    showCreateChannelError(message) {
        if (this.createChannelError) {
            this.createChannelError.textContent = message;
            this.createChannelError.classList.remove('hidden');
        }
    },

    showJoinChannelModal() {
        if (this.joinChannelModal) {
            this.hideCreateChannelModal();
            this._showModal(this.joinChannelModal);
            this.joinChannelInput.value = '';
            this.joinChannelError.classList.add('hidden');
            setTimeout(() => this.joinChannelInput.focus(), 50);
        }
    },

    hideJoinChannelModal() {
        if (this.joinChannelModal) {
            this._hideModal(this.joinChannelModal);
        }
    },

    showJoinChannelError(message) {
        if (this.joinChannelError) {
            this.joinChannelError.textContent = message;
            this.joinChannelError.classList.remove('hidden');
        }
    },

    updateChannelIndicator(number, name) {
        if (this.channelBadge) {
            if (number && number !== '0' && number !== 0) {
                this.channelBadge.classList.remove('hidden');
                this.channelNumberEl.textContent = number;
                this.channelNameEl.textContent = name || '';
                if (this.backToMainBtn) this.backToMainBtn.classList.remove('hidden');
            } else {
                this.channelBadge.classList.add('hidden');
                if (this.backToMainBtn) this.backToMainBtn.classList.add('hidden');
            }
        }
    },
};
