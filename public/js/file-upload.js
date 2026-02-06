// File Upload Manager
export class FileUploadManager {
    constructor(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl || 'https://static.a85labs.net';
        this.fileInput = document.getElementById('file-input');
        this.fileButton = document.getElementById('file-button');
        this.filePreview = document.getElementById('file-preview');
        this.previewImage = document.getElementById('preview-image');
        this.fileName = document.getElementById('file-name');
        this.fileSize = document.getElementById('file-size');
        this.removeFileBtn = document.getElementById('remove-file');
        this.uploadProgress = document.getElementById('upload-progress');
        this.uploadPercent = document.getElementById('upload-percent');
        this.uploadProgressBar = document.getElementById('upload-progress-bar');
        this.sendButton = document.getElementById('send-button');
        
        this.selectedFile = null;
        this.uploadedFileUrl = null;
        this.uploadXhr = null;
        this.isUploading = false;
        
        this.maxFileSize = 100 * 1024 * 1024; // 100MB
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // File button click
        this.fileButton.addEventListener('click', () => {
            this.fileInput.click();
        });

        // File selection
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleFileSelection(file);
            }
        });

        // Remove file
        this.removeFileBtn.addEventListener('click', () => {
            if (!this.isUploading) {
                this.clearFile();
            }
        });
    }

    handleFileSelection(file) {
        // Validate file size
        if (file.size > this.maxFileSize) {
            alert(`파일 크기는 ${this.maxFileSize / 1024 / 1024}MB를 초과할 수 없습니다.`);
            this.clearFile();
            return;
        }

        this.selectedFile = file;
        this.showPreview(file);
    }

    showPreview(file) {
        this.fileName.textContent = file.name;
        this.fileSize.textContent = this.formatFileSize(file.size);

        // Show image preview if file is an image
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.previewImage.src = e.target.result;
                this.previewImage.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        } else {
            this.previewImage.classList.add('hidden');
        }

        this.filePreview.classList.remove('hidden');
        
        // Adjust messages container padding to prevent preview from covering messages
        this.adjustMessagesContainerPadding();
        
        // Adjust bug report button position to prevent overlap with preview
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
            
            const inputArea = document.querySelector('.fixed.bottom-0');
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

    clearFile() {
        // Cancel ongoing upload if any
        if (this.uploadXhr) {
            this.uploadXhr.abort();
            this.uploadXhr = null;
        }
        
        this.selectedFile = null;
        this.uploadedFileUrl = null;
        this.isUploading = false;
        this.fileInput.value = '';
        this.filePreview.classList.add('hidden');
        this.previewImage.src = '';
        this.previewImage.classList.add('hidden');
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

    async uploadFile() {
        if (!this.selectedFile) {
            return null;
        }

        if (this.isUploading) {
            throw new Error('Upload already in progress');
        }

        return new Promise((resolve, reject) => {
            try {
                console.log('Starting file upload:', this.selectedFile.name, this.selectedFile.type, this.selectedFile.size);
                
                this.showUploadProgress();
                
                const formData = new FormData();
                formData.append('file', this.selectedFile);

                console.log('Uploading to:', `${this.apiBaseUrl}/upload`);
                
                this.uploadXhr = new XMLHttpRequest();
                
                // Upload progress tracking
                this.uploadXhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        // 전송은 95%까지만 표시 (100%는 서버 응답 수신 시)
                        const percentComplete = Math.min((e.loaded / e.total) * 95, 95);
                        this.updateUploadProgress(percentComplete);
                        console.log(`Upload progress: ${percentComplete.toFixed(1)}%`);
                    }
                });
                
                // Upload transmission complete (data sent to server)
                this.uploadXhr.upload.addEventListener('load', () => {
                    // 데이터 전송 완료, 서버 처리 대기 중
                    console.log('Upload transmission complete, waiting for server response...');
                    this.uploadPercent.textContent = '서버 처리 중...';
                    this.uploadProgressBar.style.width = '100%';
                });
                
                // Server response received
                this.uploadXhr.addEventListener('load', () => {
                    console.log('Server response received:', this.uploadXhr.status, this.uploadXhr.statusText);
                    
                    // 서버 응답 수신 완료
                    this.updateUploadProgress(100);
                    
                    // 짧은 지연 후 숨김 (사용자가 100% 볼 수 있도록)
                    setTimeout(() => {
                        this.hideUploadProgress();
                    }, 300);
                    
                    if (this.uploadXhr.status >= 200 && this.uploadXhr.status < 300) {
                        try {
                            const result = JSON.parse(this.uploadXhr.responseText);
                            console.log('Upload result:', result);
            
                            // API 응답에서 파일 URL 추출
                            // full_url 우선 사용, 없으면 url, 그것도 없으면 id와 name으로 구성
                            if (result.full_url) {
                                this.uploadedFileUrl = result.full_url;
                            } else if (result.url && result.url.startsWith('http')) {
                                this.uploadedFileUrl = result.url;
                            } else if (result.url) {
                                // 상대 경로인 경우 전체 URL로 변환
                                this.uploadedFileUrl = `${this.apiBaseUrl}${result.url}`;
                            } else if (result.id && result.name) {
                                // URL이 없으면 id와 name으로 구성
                                this.uploadedFileUrl = `${this.apiBaseUrl}/${result.id}/${result.name}`;
                            } else {
                                reject(new Error('Invalid upload response'));
                                return;
                            }

                            resolve({
                                url: this.uploadedFileUrl,
                                filename: this.selectedFile.name,
                                filesize: this.selectedFile.size,
                                filetype: this.selectedFile.type
                            });
                        } catch (parseError) {
                            console.error('Upload response parse error:', parseError);
                            reject(new Error('Invalid upload response'));
                        }
                    } else {
                        const errorText = this.uploadXhr.responseText;
                        console.error('Upload error response:', errorText);
                        reject(new Error(`Upload failed: ${this.uploadXhr.status} ${this.uploadXhr.statusText}`));
                    }
                });
                
                // Upload error
                this.uploadXhr.addEventListener('error', () => {
                    console.error('Upload network error');
                    this.hideUploadProgress();
                    reject(new Error('Network error during upload'));
                });
                
                // Upload aborted
                this.uploadXhr.addEventListener('abort', () => {
                    console.log('Upload aborted');
                    this.hideUploadProgress();
                    reject(new Error('Upload cancelled'));
                });
                
                // Send request
                this.uploadXhr.open('POST', `${this.apiBaseUrl}/upload`);
                this.uploadXhr.send(formData);
                
            } catch (error) {
                console.error('File upload error:', error);
                this.hideUploadProgress();
                reject(error);
            }
        });
    }

    hasFile() {
        return this.selectedFile !== null;
    }

    getFileInfo() {
        if (!this.selectedFile) {
            return null;
        }

        return {
            name: this.selectedFile.name,
            size: this.selectedFile.size,
            type: this.selectedFile.type
        };
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
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

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelection(files[0]);
            }
        });
    }
}
