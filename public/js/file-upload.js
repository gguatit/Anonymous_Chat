// File Upload Manager
import { formatFileSize, escapeHtml } from './utils.js';
import { FILE_UPLOAD_CLIENT, UPLOAD } from '../../src/config/constants.js';

export class FileUploadManager {
    constructor(apiBaseUrl, uploadEndpoint) {
        this.apiBaseUrl = apiBaseUrl || null;
        this.uploadEndpoint = uploadEndpoint || '/api/upload';
        this.fileInput = document.getElementById('file-input');
        this.fileButton = document.getElementById('file-button');
        this.filePreview = document.getElementById('file-preview');
        this.previewGallery = document.getElementById('preview-gallery');
        this.fileName = document.getElementById('file-name');
        this.fileSize = document.getElementById('file-size');
        this.removeFileBtn = document.getElementById('remove-file');
        this.uploadProgress = document.getElementById('upload-progress');
        this.uploadPercent = document.getElementById('upload-percent');
        this.uploadProgressBar = document.getElementById('upload-progress-bar');
        this.sendButton = document.getElementById('send-button');
        
        this.selectedFiles = [];
        this.uploadedFiles = [];
        this.uploadXhr = null;
        this.isUploading = false;
        
        this.maxFileSize = FILE_UPLOAD_CLIENT.MAX_BYTES;
        this.maxFiles = FILE_UPLOAD_CLIENT.MAX_FILES;
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // File button click
        this.fileButton.addEventListener('click', () => {
            this.fileInput.click();
        });

        // File selection
        this.fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                this.selectedFiles = []; // Reset previous selection
                this.handleFileSelection(files);
            }
        });

        // Remove all files
        this.removeFileBtn.addEventListener('click', () => {
            if (!this.isUploading) {
                this.clearFiles();
            }
        });

        // Remove individual file (event delegation — handles async image thumbnails)
        this.previewGallery.addEventListener('click', (e) => {
            const btn = e.target.closest('.remove-file-btn');
            if (!btn) return;
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            this.selectedFiles.splice(idx, 1);
            this.showPreview();
        });

        // Clipboard image paste
        document.addEventListener('paste', (e) => this.handlePaste(e));
    }

    handlePaste(e) {
        const items = e.clipboardData?.items;
        if (!items) return;

        const pastedFiles = [];
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    const namedFile = new File([file], `pasted-image-${Date.now()}.${file.type.split('/')[1] || 'png'}`, { type: file.type });
                    pastedFiles.push(namedFile);
                }
            }
        }
        if (pastedFiles.length > 0) {
            this.handleFileSelection(pastedFiles);
        }
    }

    handleFileSelection(files) {
        // Validate max files
        if (this.selectedFiles.length + files.length > this.maxFiles) {
            alert(`최대 ${this.maxFiles}개의 파일만 업로드할 수 있습니다.`);
            files = files.slice(0, this.maxFiles - this.selectedFiles.length);
        }

        // Validate file sizes
        const validFiles = files.filter(file => {
            if (file.size > this.maxFileSize) {
                alert(`'${file.name}'의 크기가 ${this.maxFileSize / 1024 / 1024}MB를 초과하여 제외되었습니다.`);
                return false;
            }
            return true;
        });

        this.selectedFiles.push(...validFiles);
        this.showPreview();
    }

    showPreview() {
        if (this.selectedFiles.length === 0) {
            this.clearFiles();
            return;
        }

        // Calculate total size
        const totalSize = this.selectedFiles.reduce((sum, f) => sum + f.size, 0);
        this.fileName.textContent = `${this.selectedFiles.length}개 파일`;
        this.fileSize.textContent = formatFileSize(totalSize);

        // Build gallery preview
        this.previewGallery.innerHTML = '';
        this.selectedFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'relative aspect-square rounded border border-gray-600 overflow-hidden bg-gray-800';
            
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    item.innerHTML = `
                        <img src="${e.target.result}" alt="${escapeHtml(file.name)}" class="w-full h-full object-cover">
                        <button class="remove-file-btn absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center text-xs"
                            data-index="${index}">×</button>
                    `;
                };
                reader.readAsDataURL(file);
            } else {
                item.innerHTML = `
                    <div class="w-full h-full flex flex-col items-center justify-center text-gray-400">
                        <svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        <span class="text-[10px] px-1 truncate w-full text-center">${escapeHtml(file.name)}</span>
                    </div>
                    <button class="remove-file-btn absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center text-xs"
                        data-index="${index}">×</button>
                `;
            }
            
            this.previewGallery.appendChild(item);
        });

        this.filePreview.classList.remove('hidden');
        this.adjustMessagesContainerPadding();
        this.adjustBugReportButtonPosition();
    }
    
    adjustMessagesContainerPadding() {
        // Wait for the preview to render and get its actual height
        requestAnimationFrame(() => {
            const messagesContainer = document.querySelector('main');
            const previewHeight = this.filePreview.offsetHeight;
            
            // Add extra padding to accommodate the file preview
            // Base padding is 8rem (128px), add preview height
            messagesContainer.style.paddingBottom = `calc(8rem + ${previewHeight}px)`;
        });
    }
    
    adjustBugReportButtonPosition() {
        // Wait for the preview to render and get its actual height
        requestAnimationFrame(() => {
            const bugReportBtn = document.getElementById('bug-report-btn');
            if (!bugReportBtn) return;
            
            const previewHeight = this.filePreview.offsetHeight;
            
            // Calculate total height: input area + preview
            // Input area base is about 144px (9rem), add preview height
            const totalOffset = 144 + previewHeight;
            
            // Update button position
            bugReportBtn.style.bottom = `${totalOffset}px`;
        });
    }
    
    resetBugReportButtonPosition() {
        const bugReportBtn = document.getElementById('bug-report-btn');
        if (!bugReportBtn) return;
        
        // Reset to default position (bottom-36 = 9rem = 144px)
        bugReportBtn.style.bottom = '144px';
    }

    clearFiles() {
        // Cancel ongoing upload if any
        if (this.uploadXhr) {
            this.uploadXhr.abort();
            this.uploadXhr = null;
        }
        
        this.selectedFiles = [];
        this.uploadedFiles = [];
        this.isUploading = false;
        this.fileInput.value = '';
        this.filePreview.classList.add('hidden');
        this.previewGallery.innerHTML = '';
        this.fileName.textContent = '';
        this.fileSize.textContent = '';
        this.hideUploadProgress();
        
        // Reset messages container padding when file preview is hidden
        const messagesContainer = document.querySelector('main');
        messagesContainer.style.paddingBottom = '8rem';
        
        // Reset bug report button position
        this.resetBugReportButtonPosition();
    }
    
    showUploadProgress() {
        this.isUploading = true;
        this.uploadProgress.classList.remove('hidden');
        this.removeFileBtn.disabled = true;
        this.removeFileBtn.classList.add('opacity-50', 'cursor-not-allowed');
        if (this.sendButton) {
            this.sendButton.disabled = true;
            this.sendButton.classList.add('opacity-50');
        }
        this.updateUploadProgress(0);
    }
    
    hideUploadProgress() {
        this.isUploading = false;
        this.uploadProgress.classList.add('hidden');
        this.removeFileBtn.disabled = false;
        this.removeFileBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        if (this.sendButton) {
            this.sendButton.disabled = false;
            this.sendButton.classList.remove('opacity-50');
        }
        this.updateUploadProgress(0);
    }
    
    updateUploadProgress(percent) {
        const roundedPercent = Math.round(percent);
        this.uploadPercent.textContent = `${roundedPercent}%`;
        this.uploadProgressBar.style.width = `${roundedPercent}%`;
    }

    async uploadFiles() {
        if (this.selectedFiles.length === 0) {
            return [];
        }

        if (this.isUploading) {
            throw new Error('Upload already in progress');
        }

        this.uploadedFiles = [];
        this.showUploadProgress();
        const maxConcurrency = FILE_UPLOAD_CLIENT.CONCURRENT_UPLOADS;
        const progressMap = new Map(); // index -> 0~1

        const updateTotalProgress = () => {
            let total = 0;
            progressMap.forEach(v => total += v);
            const avg = total / this.selectedFiles.length;
            const percent = Math.round(avg * 100);
            this.updateUploadProgress(percent);
        };

        try {
            const results = new Array(this.selectedFiles.length);
            let completed = 0;

            const uploadWithProgress = async (file, index) => {
                progressMap.set(index, 0);
                const result = await this.uploadSingleFile(file, (percent) => {
                    progressMap.set(index, percent);
                    updateTotalProgress();
                });
                progressMap.set(index, 1);
                completed++;
                this.uploadPercent.textContent = `${completed}/${this.selectedFiles.length}`;
                results[index] = result;
                updateTotalProgress();
            };

            for (let i = 0; i < this.selectedFiles.length; i += maxConcurrency) {
                const batch = [];
                for (let j = i; j < Math.min(i + maxConcurrency, this.selectedFiles.length); j++) {
                    batch.push(uploadWithProgress(this.selectedFiles[j], j));
                }
                await Promise.all(batch);
            }

            this.uploadedFiles = results;
            this.hideUploadProgress();
            return this.uploadedFiles;
        } catch (error) {
            this.hideUploadProgress();
            throw error;
        }
    }

    async uploadSingleFile(file, onProgress) {
        if (file.size > UPLOAD.WORKER_BODY_LIMIT) {
            return this.uploadChunkedFile(file, onProgress);
        }
        return new Promise((resolve, reject) => {
            try {
                const formData = new FormData();
                formData.append('file', file);

                const xhr = new XMLHttpRequest();
                this.uploadXhr = xhr;
                
                // Upload progress
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable && onProgress) {
                        const percent = (e.loaded / e.total);
                        onProgress(percent);
                    }
                });
                
                // Server response received
                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const result = JSON.parse(xhr.responseText);
            
                            let uploadedFileUrl;
                            if (result.full_url) {
                                uploadedFileUrl = result.full_url;
                            } else if (result.url && result.url.startsWith('http')) {
                                uploadedFileUrl = result.url;
                            } else if (result.url) {
                                if (!this.apiBaseUrl) { reject(new Error('Upload not configured')); return; }
                                uploadedFileUrl = `${this.apiBaseUrl}${result.url}`;
                            } else if (result.id && result.name) {
                                if (!this.apiBaseUrl) { reject(new Error('Upload not configured')); return; }
                                uploadedFileUrl = `${this.apiBaseUrl}/${result.id}/${result.name}`;
                            } else {
                                reject(new Error('Invalid upload response'));
                                return;
                            }

                            resolve({
                                url: uploadedFileUrl,
                                filename: file.name,
                                filesize: file.size,
                                filetype: file.type
                            });
                        } catch (parseError) {
                            console.error('Upload response parse error:', parseError);
                            reject(new Error('Invalid upload response'));
                        }
                    } else {
                        const errorText = xhr.responseText;
                        console.error('Upload error response:', errorText);
                        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
                    }
                });
                
                // Upload error
                xhr.addEventListener('error', () => {
                    console.error('Upload network error');
                    reject(new Error('Network error during upload'));
                });
                
                // Upload aborted
                xhr.addEventListener('abort', () => {
                    reject(new Error('Upload cancelled'));
                });
                
                // Send request
                xhr.open('POST', this.uploadEndpoint);
                xhr.send(formData);
                
            } catch (error) {
                console.error('File upload error:', error);
                reject(error);
            }
        });
    }

    async uploadChunkedFile(file, onProgress) {
        const chunkSize = UPLOAD.CHUNK_SIZE;
        const totalChunks = Math.ceil(file.size / chunkSize);
        const concurrency = UPLOAD.CHUNK_CONCURRENCY;

        // Step 1: Initialize
        const initResp = await fetch('/api/upload/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, totalSize: file.size, contentType: file.type })
        });
        if (!initResp.ok) {
            const errText = await initResp.text();
            console.error('Init response error:', initResp.status, errText);
            throw new Error(`Init failed: ${initResp.status}`);
        }
        const initData = await initResp.json();
        if (!initData.success || !initData.data) throw new Error('Invalid init response');
        const { uploadId, fileId } = initData.data;

        // Step 2: Upload chunks
        const parts = [];
        let uploaded = 0;
        const sendChunk = async (partNumber) => {
            const start = (partNumber - 1) * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            const blob = file.slice(start, end);

            const resp = await fetch(`/api/upload/${encodeURIComponent(uploadId)}/part?partNumber=${partNumber}&fileId=${encodeURIComponent(fileId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/octet-stream' },
                body: blob
            });
            if (!resp.ok) {
                const errText = await resp.text();
                console.error(`Chunk ${partNumber} error:`, resp.status, errText);
                throw new Error(`Chunk ${partNumber} failed: ${resp.status}`);
            }
            const result = await resp.json();
            if (!result.success) throw new Error(`Chunk ${partNumber} error: ${result.error?.message}`);
            const partData = { partNumber: result.data.partNumber, etag: result.data.etag };
            console.log(`Part ${partNumber} done:`, JSON.stringify(partData));
            parts.push(partData);
            uploaded++;
            if (onProgress) onProgress(uploaded / totalChunks);
        };

        for (let i = 0; i < totalChunks; i += concurrency) {
            const batch = [];
            for (let j = i; j < Math.min(i + concurrency, totalChunks); j++) {
                batch.push(sendChunk(j + 1));
            }
            await Promise.all(batch);
        }

        // Step 3: Complete
        parts.sort((a, b) => a.partNumber - b.partNumber);
        console.log('Complete request:', JSON.stringify({ fileId, parts }));
        const completeResp = await fetch(`/api/upload/${encodeURIComponent(uploadId)}/complete?fileId=${encodeURIComponent(fileId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId, parts })
        });
        if (!completeResp.ok) {
            const errText = await completeResp.text();
            console.error('Complete response error:', completeResp.status, errText);
            throw new Error(`Complete failed: ${completeResp.status}`);
        }
        const completeResult = await completeResp.json();

        let uploadedFileUrl;
        if (completeResult.full_url) {
            uploadedFileUrl = completeResult.full_url;
        } else if (completeResult.url && completeResult.url.startsWith('http')) {
            uploadedFileUrl = completeResult.url;
        } else if (completeResult.url) {
            if (!this.apiBaseUrl) throw new Error('Upload not configured');
            uploadedFileUrl = `${this.apiBaseUrl}${completeResult.url}`;
        } else {
            throw new Error('Invalid upload response');
        }

        if (onProgress) onProgress(1);

        return {
            url: uploadedFileUrl,
            filename: file.name,
            filesize: file.size,
            filetype: file.type
        };
    }

    hasFile() {
        return this.selectedFiles.length > 0;
    }

    // Drag and drop support
    enableDragAndDrop(dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('border-blue-500', 'bg-blue-900/10');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-blue-500', 'bg-blue-900/10');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-blue-500', 'bg-blue-900/10');

            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                this.handleFileSelection(files);
            }
        });
    }
}
