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
        
        this.selectedFile = null;
        this.uploadedFileUrl = null;
        
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
            this.clearFile();
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
    }

    clearFile() {
        this.selectedFile = null;
        this.uploadedFileUrl = null;
        this.fileInput.value = '';
        this.filePreview.classList.add('hidden');
        this.previewImage.src = '';
        this.previewImage.classList.add('hidden');
        this.fileName.textContent = '';
        this.fileSize.textContent = '';
    }

    async uploadFile() {
        if (!this.selectedFile) {
            return null;
        }

        try {
            console.log('Starting file upload:', this.selectedFile.name, this.selectedFile.type, this.selectedFile.size);
            
            const formData = new FormData();
            formData.append('file', this.selectedFile);

            console.log('Uploading to:', `${this.apiBaseUrl}/upload`);
            
            const response = await fetch(`${this.apiBaseUrl}/upload`, {
                method: 'POST',
                body: formData
            });

            console.log('Upload response status:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Upload error response:', errorText);
                throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Upload result:', result);
            
            // API 응답에서 파일 URL 추출
            // 예상 응답 형식: { "id": "abc123", "name": "filename.jpg", "url": "https://file.kalpha.kr/abc123/filename.jpg" }
            if (result.url) {
                this.uploadedFileUrl = result.url;
            } else if (result.id && result.name) {
                // URL이 없으면 id와 name으로 구성
                this.uploadedFileUrl = `${this.apiBaseUrl}/${result.id}/${result.name}`;
            } else {
                throw new Error('Invalid upload response');
            }

            return {
                url: this.uploadedFileUrl,
                filename: this.selectedFile.name,
                filesize: this.selectedFile.size,
                filetype: this.selectedFile.type
            };
        } catch (error) {
            console.error('File upload error:', error);
            throw error;
        }
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
