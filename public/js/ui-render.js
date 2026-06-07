// UI Message Rendering mixin
import { renderCodeBlock, isLikelyCode, CODE_BLOCK_PREFIX, INLINE_CODE_PREFIX, PLACEHOLDER_SUFFIX } from './code-highlight.js';
import { escapeHtml, isValidUrl as _isValidUrl, sanitizeUrl as _sanitizeUrl, formatFileSize as _formatFileSize } from './utils.js';
import { UI, MESSAGE_EDIT_WINDOW_MS } from '../../src/config/constants.js';

export const rendering = {
    isValidUrl(url) {
        return _isValidUrl(url);
    },

    sanitizeUrl(url) {
        return _sanitizeUrl(url);
    },

    decodeHtml(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent;
    },

    formatFileSize(bytes) {
        return _formatFileSize(bytes);
    },

    htmlToPlainText(html) {
        const text = html.replace(/<br\s*\/?>/gi, '\n');
        const div = document.createElement('div');
        div.innerHTML = text;
        return div.textContent || div.innerText || '';
    },

    _getThemeHueRange() {
        const theme = document.documentElement.getAttribute('data-theme') || 'dark';
        const ranges = {
            dark:       { min: 0,   max: 360, sat: 25, lgt: 28, alpha: 0.8 },
            light:      { min: 0,   max: 360, sat: 30, lgt: 75, alpha: 0.85 },
            midnight:   { min: 210, max: 270, sat: 20, lgt: 25, alpha: 0.8 },
            ocean:      { min: 160, max: 210, sat: 25, lgt: 30, alpha: 0.8 },
            forest:     { min: 80,  max: 160, sat: 25, lgt: 30, alpha: 0.8 },
            amethyst:   { min: 240, max: 320, sat: 25, lgt: 28, alpha: 0.8 },
            sunset:     { min: 0,   max: 50,  sat: 35, lgt: 30, alpha: 0.8 },
            sakura:     { min: 310, max: 360, sat: 25, lgt: 35, alpha: 0.8 },
        };
        return ranges[theme] || ranges.dark;
    },

    _getSenderHue(sessionId) {
        if (!sessionId) return { hue: 220, sat: 25, lgt: 28, alpha: 0.8 };
        let hash = 0;
        for (let i = 0; i < sessionId.length; i++) {
            hash = ((hash << 5) - hash) + sessionId.charCodeAt(i);
            hash |= 0;
        }
        const range = this._getThemeHueRange();
        const span = range.max - range.min;
        const hue = range.min + (Math.abs(hash) % Math.max(span, 1));
        return { hue: hue, sat: range.sat, lgt: range.lgt, alpha: range.alpha };
    },

    addMessageInteractions(messageDiv) {
        messageDiv.style.cursor = 'pointer';
        messageDiv.style.userSelect = 'text';
    },

    highlightMessage(messageId) {
        const targetDiv = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
        if (!targetDiv) {
            alert('해당 메시지를 찾을 수 없습니다. (오래된 메시지일 수 있습니다)');
            return;
        }

        targetDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetDiv.classList.add('ring-2', 'ring-yellow-400', 'transition-all');

        setTimeout(() => {
            targetDiv.classList.remove('ring-2', 'ring-yellow-400', 'transition-all');
        }, 2000);
    },

    displayMessage(data, isOwnMessage, sessionId) {
        if (data.messageId && this.messagesContainer.querySelector(`[data-message-id="${data.messageId}"]`)) {
            return;
        }

        const messageDiv = this._renderSingleMessage(data, sessionId);
        this.messagesContainer.appendChild(messageDiv);
    },

    displayBatchMessages(messages, sessionId) {
        if (!messages || messages.length === 0) return;

        const fragment = document.createDocumentFragment();

        for (const data of messages) {
            if (data.messageId && this.messagesContainer.querySelector(`[data-message-id="${data.messageId}"]`)) {
                continue;
            }

            const messageDiv = this._renderSingleMessage(data, sessionId);
            fragment.appendChild(messageDiv);
        }

        this.messagesContainer.appendChild(fragment);

        const container = this.messagesContainer;
        const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < UI.SCROLL_PROXIMITY_PX;
        if (isAtBottom) {
            this.scrollToBottom();
        } else {
            this.scrollButton.classList.remove('opacity-0', 'pointer-events-none');
            this.scrollButton.classList.add('opacity-100', 'pointer-events-auto');
        }
    },

    _renderSingleMessage(data, sessionId) {
        if (data.type === 'summary') {
            const MODE_STYLES = {
                default: { bg: 'bg-indigo-900/40', border: 'border-indigo-700/50', title: 'text-indigo-300', label: 'AI \uB300\uD654 \uC694\uC57D' },
                topic: { bg: 'bg-emerald-900/40', border: 'border-emerald-700/50', title: 'text-emerald-300', label: '\uB300\uD654 \uC8FC\uC81C' },
                mood: { bg: 'bg-amber-900/40', border: 'border-amber-700/50', title: 'text-amber-300', label: '\uB300\uD654 \uBD84\uC704\uAE30' },
                conflict: { bg: 'bg-red-900/40', border: 'border-red-700/50', title: 'text-red-300', label: '\uC758\uACAC \uCDA9\uB3CC' },
            };
            const s = MODE_STYLES[data.summaryMode] || MODE_STYLES.default;

            const wrapper = document.createElement('div');
            wrapper.className = `${s.bg} ${s.border} border rounded-lg p-3 mx-2 my-3`;
            wrapper.setAttribute('data-message', 'true');
            wrapper.setAttribute('data-message-id', data.messageId);

            const title = document.createElement('div');
            title.className = `text-xs font-semibold mb-2 ${s.title}`;
            title.textContent = s.label;

            const content = document.createElement('div');
            content.className = 'text-sm text-gray-200 leading-relaxed';
            content.textContent = data.content;

            wrapper.appendChild(title);
            wrapper.appendChild(content);
            return wrapper;
        }

        const isOwnMessage = data.sessionId === sessionId;
        const isAdmin = !!(data.sessionId && String(data.sessionId).startsWith('admin_'));

        const TIME_GAP = UI.MESSAGE_GROUP_TIME_MS;
        const sameAsPrev = this._lastSender !== null
            && this._lastSender === data.sessionId
            && this._lastTime !== null
            && (data.timestamp - this._lastTime < TIME_GAP);
        const isGrouped = sameAsPrev && !isAdmin;
        if (isGrouped && this._lastMessageEl) {
            this._lastMessageEl.classList.add('msg-bubble-grouped');
        }
        this._lastSender = data.sessionId;
        this._lastTime = data.timestamp;

        const timestamp = new Date(data.timestamp).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const canEdit = isOwnMessage && data.timestamp && (Date.now() - data.timestamp < MESSAGE_EDIT_WINDOW_MS);
        const senderName = data.nickname || '익명';

        let contentHtml = '';
        if (data.replyTo) {
            const replyContent = data.replyTo.content || '[파일]';
            const truncatedReply = replyContent.length > 50
                ? replyContent.substring(0, UI.REPLY_PREVIEW_LENGTH) + '...'
                : replyContent;
            const replyLabel = data.replyTo.isOwnMessage ? '내 메시지' : '익명';

            contentHtml += `
                <div class="reply-reference cursor-pointer hover:bg-gray-700/50 transition-colors bg-gray-800/50 border-l-2 border-gray-500 pl-2 py-1 mb-2 text-xs"
                     data-reply-to-id="${escapeHtml(data.replyTo.messageId || '')}">
                    <div class="text-gray-400">${replyLabel}에게 답장:</div>
                    <div class="text-gray-300 italic">${escapeHtml(truncatedReply)}</div>
                </div>
            `;
        }

        if (data.content && data.content.trim()) {
            if (data.replyTo && data.replyTo.isSecret && data.replyTo.secretId) {
                const isRecipient = data.replyTo.targetSessionId === sessionId;
                if (isRecipient) {
                    contentHtml += `
                        <div class="secret-message-container bg-gray-800/60 border border-gray-600/50 rounded-lg p-3 mt-2">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="text-gray-300 text-sm">비밀 메시지</span>
                            </div>
                            <button class="reveal-secret-btn w-full bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded transition-colors text-sm font-medium"
                                    data-secret-id="${escapeHtml(data.replyTo.secretId)}">
                                비밀 메시지 읽기 (한 번만 볼 수 있음)
                            </button>
                            <div class="secret-message-content hidden mt-3 p-3 bg-gray-800/50 rounded text-sm break-words"></div>
                        </div>
                    `;
                } else if (isOwnMessage) {
                    contentHtml += '<div class="text-sm text-gray-400 italic">비밀 메시지를 보냈습니다</div>';
                } else {
                    contentHtml += '<div class="text-sm text-gray-500 italic">비밀 메시지 (답장)</div>';
                }
            } else {
                contentHtml += `<div class="text-sm break-words leading-relaxed message-content">${this.formatMessageContent(data.content)}</div>`;
            }
        }

        if (data.files && Array.isArray(data.files) && data.files.length > 0) {
            contentHtml += this.formatFileGallery(data.files);
        } else if (data.file && data.file.url) {
            contentHtml += this.formatFileContent(data.file);
        }

        if (!contentHtml) {
            contentHtml = '<div class="text-sm text-gray-500 italic">내용 없음</div>';
        }

        const wrapper = document.createElement('div');
        wrapper.setAttribute('data-message', 'true');
        wrapper.setAttribute('data-message-id', data.messageId);
        wrapper.setAttribute('data-session-id', data.sessionId);
        wrapper.setAttribute('data-timestamp', data.timestamp);
        wrapper.setAttribute('data-can-edit', canEdit ? 'true' : 'false');
        if (data.replyTo?.messageId) {
            wrapper.setAttribute('data-reply-to', data.replyTo.messageId);
        }

        if (isAdmin) {
            wrapper.className = 'flex flex-col';
            wrapper.classList.add(isOwnMessage ? 'items-end' : 'items-start');
            if (isOwnMessage) wrapper.style.marginLeft = 'auto';
            if (!isGrouped) {
                const adminLabel = document.createElement('div');
                adminLabel.className = 'msg-sender-label px-1 text-yellow-300 font-semibold';
                adminLabel.textContent = '\uAD00\uB9AC\uC790';
                wrapper.appendChild(adminLabel);
            }
        } else if (!isGrouped) {
            wrapper.className = 'flex flex-col';
            wrapper.classList.add(isOwnMessage ? 'items-end' : 'items-start');
            if (isOwnMessage) wrapper.style.marginLeft = 'auto';
            const nameLabel = document.createElement('div');
            const senderColor = isOwnMessage ? null : this._getSenderHue(data.sessionId);
            nameLabel.className = 'msg-sender-label px-1';
            if (senderColor) {
                wrapper.style.setProperty('--sender-hue', senderColor.hue);
            } else {
                nameLabel.style.setProperty('color', 'var(--c-blue-300)');
            }
            nameLabel.textContent = isOwnMessage ? `\uB098 (${senderName})` : senderName;
            wrapper.appendChild(nameLabel);
        } else {
            wrapper.className = 'flex flex-col';
            if (isOwnMessage) {
                wrapper.classList.add('items-end');
                wrapper.style.marginLeft = 'auto';
            }
        }

        const bubble = document.createElement('div');
        if (isAdmin) {
            bubble.className = 'message-enter msg-bubble msg-bubble-admin border-yellow-400 ring-1 ring-yellow-400/20';
            bubble.style.setProperty('--bubble-bg', 'rgba(113,63,18,0.25)');
            bubble.style.backgroundColor = 'rgba(113,63,18,0.25)';
            bubble.setAttribute('role', 'region');
            bubble.setAttribute('aria-live', 'polite');
            bubble.setAttribute('aria-label', '\uAD00\uB9AC\uC790 \uBA54\uC2DC\uC9C0');
        } else if (isOwnMessage) {
            bubble.className = 'message-enter-own msg-bubble msg-bubble-own';
        } else {
            const senderColor = this._getSenderHue(data.sessionId);
            bubble.className = 'message-enter-other msg-bubble msg-bubble-other';
            bubble.style.setProperty('--sender-hue', senderColor.hue);
        }

        if (isGrouped) {
            bubble.classList.add('msg-bubble-grouped');
        }

        const editedLabel = data.editedAt ? ' <span class="text-xs opacity-60">(\uC218\uC815\uB428)</span>' : '';

        bubble.innerHTML = `
            ${contentHtml}
            <div class="msg-time">${timestamp}${editedLabel}</div>
        `;

        wrapper.appendChild(bubble);

        if (data.reactions && Object.keys(data.reactions).length > 0) {
            const reactionBar = document.createElement('div');
            reactionBar.className = 'reaction-bar flex flex-wrap gap-1 mt-1';
            for (const [emoji, count] of Object.entries(data.reactions)) {
                if (count > 0) {
                    const userReacted = data.reactionSessions &&
                        data.reactionSessions[emoji] &&
                        data.reactionSessions[emoji].includes(sessionId);
                    const pill = document.createElement('button');
                    pill.className = 'reaction-pill inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ' +
                        (userReacted
                            ? 'bg-blue-600 text-white ring-1 ring-blue-400'
                            : 'bg-gray-600 text-gray-200 hover:bg-gray-500');
                    pill.setAttribute('data-emoji', emoji);
                    pill.setAttribute('data-message-id', data.messageId);
                    pill.innerHTML = `${emoji} ${count}`;
                    reactionBar.appendChild(pill);
                }
            }
            wrapper.appendChild(reactionBar);
        }

        this.addMessageInteractions(wrapper, data.messageId, canEdit, data.replyTo?.messageId);
        this._lastMessageEl = bubble;

        return wrapper;
    },

    formatMessageContent(content) {
        if (!content) return '';

        if (!/```/.test(content) && isLikelyCode(content)) {
            return renderCodeBlock(content, '', (text) => escapeHtml(text));
        }

        let processed = content;
        const codeBlocks = [];
        const inlineCodes = [];
        const urlPlaceholders = [];
        const mdLinkPlaceholders = [];

        processed = processed.replace(/```(\w*)\r?\n([\s\S]*?)```/g, (match, lang, code) => {
            const placeholder = `${CODE_BLOCK_PREFIX}${codeBlocks.length}${PLACEHOLDER_SUFFIX}`;
            codeBlocks.push({ lang: lang.toLowerCase(), code });
            return placeholder;
        });

        processed = processed.replace(/`([^`\n]+)`/g, (match, code) => {
            const placeholder = `${INLINE_CODE_PREFIX}${inlineCodes.length}${PLACEHOLDER_SUFFIX}`;
            inlineCodes.push(code);
            return placeholder;
        });

        const sanitized = escapeHtml(processed);

        let step1 = sanitized;
        const urlPattern = /(https?:\/\/[^\s<">]+[^\s<".,;)])|(\bwww\.[^\s<">]+[^\s<".,;)])|(\b[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}(?::[0-9]+)?(?:\/[^\s<"]*[^\s<".,;)])?)/gi;

        step1 = step1.replace(urlPattern, (match) => {
            const url = this.decodeHtml(match);

            if (!this.isValidUrl(url)) {
                return match;
            }

            const safeUrl = this.sanitizeUrl(url);
            const placeholder = `{{UP${urlPlaceholders.length}}}`;

            const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;
            let html;
            if (imageExtensions.test(url)) {
                const imgId = 'img_' + Math.random().toString(36).substring(2, 9);
                setTimeout(() => {
                    const img = document.getElementById(imgId);
                    if (img) {
                        img.addEventListener('error', function () {
                            this.style.display = 'none';
                        });
                    }
                }, 0);

                html = `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline block">${match}</a>
                <img id="${imgId}" src="${safeUrl}" alt="Image preview" class="mt-2 max-w-full max-h-64 rounded-lg border border-gray-600 object-contain" loading="lazy">`;
            } else if (/^https?:\/\//i.test(url)) {
                const secBtnId = 'secbtn_' + Math.random().toString(36).substring(2, 9);
                setTimeout(() => {
                    const btnEl = document.getElementById(secBtnId);
                    if (btnEl) {
                        btnEl.addEventListener('click', function (e) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (window.chatClient && window.chatClient.securityHeaders) {
                                const urlData = this.getAttribute('data-sec-url');
                                window.chatClient.securityHeaders.analyze(urlData);
                            }
                        });
                        btnEl.title = '보안 헤더 분석';
                    }
                }, 0);
                html = `<span class="inline-flex items-center gap-1"><a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline break-all">${match}</a><button id="${secBtnId}" data-sec-url="${safeUrl}" class="inline-flex items-center justify-center w-4 h-4 text-gray-500 hover:text-emerald-400 transition-colors flex-shrink-0" aria-label="보안 헤더 분석"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-2.332 9-7.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg></button><span class="text-[10px] text-emerald-400/70 whitespace-nowrap">← 보안 헤더를 확인해 주세요.</span></span>`;
            } else {
                html = `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline break-all">${match}</a>`;
            }

            urlPlaceholders.push(html);
            return placeholder;
        });

        let step2 = step1;
        step2 = step2.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (match, text, url) => {
            const placeholder = `{{ML${mdLinkPlaceholders.length}}}`;
            mdLinkPlaceholders.push(`<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline break-all">${text}</a>`);
            return placeholder;
        });

        let formatted = step2;
        formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
        formatted = formatted.replace(/__(.+?)__/g, '<strong class="font-bold text-white">$1</strong>');
        formatted = formatted.replace(/\*(.+?)\*/g, '<em class="italic text-gray-200">$1</em>');
        formatted = formatted.replace(/_(.+?)_/g, '<em class="italic text-gray-200">$1</em>');
        formatted = formatted.replace(/~~(.+?)~~/g, '<del class="line-through text-gray-500">$1</del>');
        formatted = formatted.replace(/(^|<br>)&gt;\s?([^<]+)/g, '$1<span class="block border-l-2 border-gray-500 pl-2 my-1 text-gray-300 italic">$2</span>');

        for (let i = 0; i < mdLinkPlaceholders.length; i++) {
            formatted = formatted.replace(`{{ML${i}}}`, mdLinkPlaceholders[i]);
        }

        for (let i = 0; i < urlPlaceholders.length; i++) {
            formatted = formatted.replace(`{{UP${i}}}`, urlPlaceholders[i]);
        }

        for (let i = 0; i < codeBlocks.length; i++) {
            const { lang, code } = codeBlocks[i];
            formatted = formatted.replace(`${CODE_BLOCK_PREFIX}${i}${PLACEHOLDER_SUFFIX}`, renderCodeBlock(code, lang, (text) => escapeHtml(text)));
        }

        for (let i = 0; i < inlineCodes.length; i++) {
            const code = inlineCodes[i];
            const safeCode = escapeHtml(code);
            formatted = formatted.replace(`${INLINE_CODE_PREFIX}${i}${PLACEHOLDER_SUFFIX}`, `<code class="inline-code">${safeCode}</code>`);
        }

        return formatted.replace(/\n/g, '<br>');
    },

    formatFileContent(file) {
        if (!file || !file.url) return '';

        if (!this.isValidUrl(file.url)) {
            return '<div class="text-red-400 text-sm">Invalid file URL</div>';
        }

        const fileType = file.filetype || '';
        const fileName = escapeHtml(file.filename || 'file');
        const fileSize = this.formatFileSize(file.filesize || 0);
        const safeUrl = this.sanitizeUrl(file.url);

        if (fileType.startsWith('image/')) {
            const imgId = 'file_img_' + Math.random().toString(36).substring(2, 9);
            setTimeout(() => {
                const img = document.getElementById(imgId);
                if (img) {
                    img.addEventListener('error', function () {
                        this.style.display = 'none';
                    });
                    img.addEventListener('click', () => {
                        this.ensureLightboxExists();
                        this.openLightbox([{url: file.url, filename: file.filename}], 0);
                    });
                }
            }, 0);

            return `
                <div class="mt-2">
                    <img id="${imgId}" src="${safeUrl}" alt="${fileName}" 
                         class="max-w-full max-h-96 rounded-lg border border-gray-600 object-contain cursor-pointer hover:opacity-90 transition-opacity" 
                         loading="lazy">
                    <div class="mt-1 text-xs text-gray-400">
                        <span>${fileName}</span> · <span>${fileSize}</span>
                    </div>
                </div>
            `;
        }

        if (fileType.startsWith('video/')) {
            return `
                <div class="mt-2">
                    <video controls class="max-w-full max-h-96 rounded-lg border border-gray-600">
                        <source src="${safeUrl}" type="${escapeHtml(fileType)}">
                        Your browser does not support the video tag.
                    </video>
                    <div class="mt-1 text-xs text-gray-400">
                        <span>${fileName}</span> · <span>${fileSize}</span>
                    </div>
                </div>
            `;
        }

        if (fileType.startsWith('audio/')) {
            return `
                <div class="mt-2">
                    <audio controls class="w-full max-w-md">
                        <source src="${safeUrl}" type="${escapeHtml(fileType)}">
                        Your browser does not support the audio tag.
                    </audio>
                    <div class="mt-1 text-xs text-gray-400">
                        <span>${fileName}</span> · <span>${fileSize}</span>
                    </div>
                </div>
            `;
        }

        return `
            <div class="mt-2">
                <a href="${safeUrl}" download="${fileName}" 
                   class="inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clip-rule="evenodd" />
                    </svg>
                    <div class="text-left">
                        <div class="text-sm font-medium">${fileName}</div>
                        <div class="text-xs text-gray-400">${fileSize}</div>
                    </div>
                </a>
            </div>
        `;
    },

    formatFileGallery(files) {
        if (!files || files.length === 0) return '';

        const images = files.filter(f => f.filetype && f.filetype.startsWith('image/'));
        const others = files.filter(f => !f.filetype || !f.filetype.startsWith('image/'));

        let html = '';

        if (images.length > 0) {
            const gridCols = images.length === 1 ? 'grid-cols-1' : 
                           images.length === 2 ? 'grid-cols-2' : 'grid-cols-3';
            
            html += `<div class="grid ${gridCols} gap-1.5 mt-2 max-w-md">`;
            
            const galleryData = btoa(encodeURIComponent(JSON.stringify(images.map(img => ({url: img.url, filename: img.filename})))));
            
            images.forEach((file, index) => {
                const safeUrl = this.sanitizeUrl(file.url);
                const fileName = escapeHtml(file.filename || 'image');
                
                const showOverlay = index === 5 && images.length > 6;
                const hiddenClass = index >= 6 ? 'hidden' : '';
                
                html += `
                    <div class="relative aspect-square rounded-lg overflow-hidden border border-gray-600 cursor-pointer gallery-image ${hiddenClass}"
                         data-gallery-index="${index}" data-gallery-data="${galleryData}">
                        <img src="${safeUrl}" alt="${fileName}" 
                             class="w-full h-full object-cover hover:opacity-90 transition-opacity" 
                             loading="lazy">
                        ${showOverlay ? `
                            <div class="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-lg font-bold">
                                +${images.length - 5}
                            </div>
                        ` : ''}
                    </div>
                `;
            });
            
            html += '</div>';
        }

        others.forEach(file => {
            html += this.formatFileContent(file);
        });

        this.ensureLightboxExists();

        return html;
    },
};
