// Admin Dashboard - Announcement Methods

const announceMethods = {
    async sendAdminAnnounce() {
        if (!this.sessionToken) {
            alert('관리자 인증이 필요합니다.');
            return;
        }

        const raw = (this.adminAnnounceInput?.value || '');
        const content = raw.trim();
        if (!content) {
            alert('공지 내용을 입력하세요.');
            return;
        }

        if (raw.length > 7500) {
            alert('공지사항은 최대 7500자까지 가능합니다.');
            return;
        }

        const isEmergency = this.emergencyCheckbox?.checked || false;

        if (isEmergency) {
            const confirmed = await new Promise((resolve) => {
                const modal = document.createElement('div');
                modal.className = 'fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50';
                modal.innerHTML = `
            <div class="bg-gray-800 rounded-lg shadow-2xl p-6 max-w-md w-full mx-4 border border-red-500/30">
                <div class="flex items-center gap-2 mb-3">
                    <span class="text-2xl">🚨</span>
                    <h3 class="text-lg font-bold text-red-400">긴급 공지 확인</h3>
                </div>
                <p class="text-sm text-gray-300 mb-1">정말 <span class="text-red-400 font-semibold">긴급 공지</span>로 발송하시겠습니까?</p>
                <p class="text-xs text-gray-500 mb-4">긴급 공지는 모든 사용자를 공지 페이지로 강제 이동시킵니다.</p>
                <div class="text-xs text-gray-600 bg-gray-900 rounded p-2 mb-4 max-h-24 overflow-y-auto">${this.escapeHtml(content.substring(0, 200))}${content.length > 200 ? '...' : ''}</div>
                <div class="flex gap-3 justify-end">
                    <button class="cancel-btn bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm">취소</button>
                    <button class="confirm-btn bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">긴급 발송</button>
                </div>
            </div>`;
                document.body.appendChild(modal);
                modal.querySelector('.cancel-btn').onclick = () => { modal.remove(); resolve(false); };
                modal.querySelector('.confirm-btn').onclick = () => { modal.remove(); resolve(true); };
                modal.addEventListener('click', (e) => { if (e.target === modal) { modal.remove(); resolve(false); } });
            });
            if (!confirmed) return;
        }

        const body = { content: raw, isEmergency };
        if (isEmergency) {
            const duration = parseInt(this.emergencyDuration?.value || '0');
            if (duration > 0) {
                body.emergencyUntil = Date.now() + duration;
            }
        }

        const isScheduled = this.scheduleCheckbox?.checked || false;
        if (isScheduled && this.scheduleDatetime?.value) {
            body.scheduleAt = new Date(this.scheduleDatetime.value).getTime();
            if (body.scheduleAt <= Date.now()) {
                alert('예약 시간은 현재보다 이후여야 합니다.');
                return;
            }
        }

        const expiryDuration = parseInt(this.announceExpirySelect?.value || '0');
        if (expiryDuration > 0) {
            body.expiresAt = Date.now() + expiryDuration;
        }

        try {
            const response = await fetch('/api/admin/announce', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const err = await response.json().catch(() => null);
                console.error('Announce failed', err);
                alert('공지 전송에 실패했습니다.');
                return;
            }

            const result = await response.json();
            if (result.sessionsNotified !== undefined) {
                alert(`공지가 ${result.sessionsNotified}명의 사용자에게 전송되었습니다.`);
            } else {
                alert('공지가 전송되었습니다.');
            }

            if (this.adminAnnounceInput) this.adminAnnounceInput.value = '';
            if (this.emergencyCheckbox) this.emergencyCheckbox.checked = false;
            if (this.emergencyDuration) this.emergencyDuration.classList.add('hidden');
            this.refreshData();

        } catch (error) {
            console.error('sendAdminAnnounce error:', error);
            alert('공지 전송 중 오류가 발생했습니다.');
        }
    },

    async loadAnnouncements() {
        try {
            const response = await fetch('/api/announcements');

            if (!response.ok) {
                throw new Error('Failed to load announcements');
            }

            const announcements = await response.json();
            this.lastAnnouncements = announcements;
            this.updateAnnouncementsList(announcements);
        } catch (error) {
            console.error('Announcements load error:', error);
            const container = document.getElementById('announcement-list');
            if (container) {
                container.innerHTML = '<p class="text-sm text-red-500 text-center py-8">공지사항을 불러오는 중 오류가 발생했습니다.</p>';
            }
        }
    },

    async editAnnouncement(timestamp) {
        const item = this.lastAnnouncements?.find(a => a.timestamp === timestamp);
        if (!item) return;

        const isEmergency = item.isEmergency || false;
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-gray-800 rounded-lg shadow-2xl p-6 max-w-lg w-full mx-4 border border-gray-700">
                <h3 class="text-lg font-bold text-gray-100 mb-4">공지사항 수정</h3>
                <textarea id="edit-announce-input" rows="5" class="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none resize-none mb-3">${item.content}</textarea>
                <label class="flex items-center gap-1.5 text-sm text-gray-300 mb-4 cursor-pointer">
                    <input type="checkbox" id="edit-emergency-checkbox" class="rounded bg-gray-700 border-gray-600 text-red-500 focus:ring-red-500" ${isEmergency ? 'checked' : ''}>
                    긴급공지
                </label>
                <div class="flex justify-end gap-2">
                    <button id="cancel-edit-btn" class="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm transition-colors">취소</button>
                    <button id="save-edit-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors">저장</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#cancel-edit-btn').addEventListener('click', () => modal.remove());
        modal.querySelector('#save-edit-btn').addEventListener('click', async () => {
            const newContent = modal.querySelector('#edit-announce-input').value.trim();
            if (!newContent) {
                this.showNotification('내용을 입력하세요.', 'error');
                return;
            }
            const newEmergency = modal.querySelector('#edit-emergency-checkbox').checked;
            modal.remove();

            try {
                const body = { timestamp, content: newContent, isEmergency: newEmergency };
                if (newEmergency && item.emergencyUntil) {
                    body.emergencyUntil = item.emergencyUntil;
                }
                const response = await fetch('/api/admin/announce', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.sessionToken}`
                    },
                    body: JSON.stringify(body)
                });

                if (!response.ok) throw new Error('Failed to edit announcement');
                this.showNotification('공지사항이 수정되었습니다.', 'success');
                this.refreshData();
            } catch (_error) {
                this.showNotification('공지사항 수정에 실패했습니다.', 'error');
            }
        });
    },

    async deleteAnnouncement(timestamp) {
        if (!confirm('정말 이 공지사항을 삭제하시겠습니까?')) return;

        try {
            const response = await fetch('/api/admin/announce', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                body: JSON.stringify({ timestamp })
            });

            if (!response.ok) throw new Error('Failed to delete announcement');
            this.showNotification('공지사항이 삭제되었습니다.', 'success');
            this.refreshData();
        } catch (_error) {
            this.showNotification('공지사항 삭제에 실패했습니다.', 'error');
        }
    },

    async demoteAnnouncement(timestamp) {
        if (!this.sessionToken) { alert('관리자 인증이 필요합니다.'); return; }
        if (!confirm('긴급 공지를 일반 공지로 전환하시겠습니까?\n\n전환 시 사용자에게 긴급 해제 알림이 전송됩니다.')) return;

        try {
            const response = await fetch('/api/admin/announce', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                body: JSON.stringify({ timestamp, isEmergency: false, emergencyUntil: null })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => null);
                console.error('Demote announce failed', err);
                alert('공지 전환에 실패했습니다.');
                return;
            }
            alert('긴급 공지가 일반 공지로 전환되었습니다.');
            this.refreshData();
        } catch (error) {
            console.error('demoteAnnouncement error:', error);
            alert('공지 전환 중 오류가 발생했습니다.');
        }
    },

    filterAnnouncements(query) {
        if (!this.lastAnnouncements) return;
        if (!query) {
            this.updateAnnouncementsList(this.lastAnnouncements);
            return;
        }
        const filtered = this.lastAnnouncements.filter(acc => {
            const content = acc.content.toLowerCase();
            const timeStr = new Date(acc.timestamp).toLocaleString('ko-KR').toLowerCase();
            return content.includes(query) || timeStr.includes(query);
        });
        this.updateAnnouncementsList(filtered);
    },
};

export default announceMethods;
