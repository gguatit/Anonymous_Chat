// File Upload Manager
export class FileUploadManager {
    constructor() {
        this.fileInput = document.getElementById('file-input');
        this.uploadSection = document.getElementById('file-upload-section');
        this.fileName = document.getElementById('file-name');
        this.fileSize = document.getElementById('file-size');
        this.cancelButton = document.getElementById('cancel-upload');
        this.progressBar = document.getElementById('upload-progress');
        
        this.currentFile = null;
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.cancelButton.addEventListener('click', () => this.cancelUpload());
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // 파일 크기 체크
        if (file.size > this.maxFileSize) {
            alert('파일 크기는 10MB를 초과할 수 없습니다.');
            this.fileInput.value = '';
            return;
        }

        this.currentFile = file;
        this.showUploadSection(file);
    }

    showUploadSection(file) {
        this.fileName.textContent = file.name;
        this.fileSize.textContent = this.formatFileSize(file.size);
        this.uploadSection.classList.remove('hidden');
    }

    cancelUpload() {
        this.currentFile = null;
        this.fileInput.value = '';
        this.uploadSection.classList.add('hidden');
        this.progressBar.style.width = '0%';
    }

    async uploadFile() {
        if (!this.currentFile) return null;

        try {
            const formData = new FormData();
            formData.append('file', this.currentFile);

            this.progressBar.style.width = '10%';

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            this.progressBar.style.width = '90%';

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '파일 업로드 실패');
            }

            const result = await response.json();
            this.progressBar.style.width = '100%';

            // 업로드 완료 후 초기화
            setTimeout(() => this.cancelUpload(), 500);

            return result;

        } catch (error) {
            console.error('Upload error:', error);
            alert(error.message || '파일 업로드 중 오류가 발생했습니다.');
            this.cancelUpload();
            return null;
        }
    }

    hasFile() {
        return this.currentFile !== null;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}
