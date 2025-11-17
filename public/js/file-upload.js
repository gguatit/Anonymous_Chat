// File Upload Manager
export class FileUploadManager {
    constructor() {
        this.fileInput = document.getElementById('file-input');
        this.uploadSection = document.getElementById('file-upload-section');
        this.fileName = document.getElementById('file-name');
        this.fileSize = document.getElementById('file-size');
        this.filePreview = document.getElementById('file-preview');
        this.fileIcon = document.getElementById('file-icon');
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
        console.log('Showing upload section for file:', file.name, file.type);
        
        this.fileName.textContent = file.name;
        this.fileSize.textContent = this.formatFileSize(file.size);
        
        // 이미지 파일인 경우 미리보기 표시
        if (file.type.startsWith('image/')) {
            console.log('Image file detected, loading preview...');
            const reader = new FileReader();
            reader.onload = (e) => {
                console.log('Image loaded, showing preview');
                this.filePreview.src = e.target.result;
                this.filePreview.classList.remove('hidden');
                this.fileIcon.classList.add('hidden');
            };
            reader.onerror = (error) => {
                console.error('Failed to load image preview:', error);
            };
            reader.readAsDataURL(file);
        } else {
            console.log('Non-image file, showing icon');
            this.filePreview.classList.add('hidden');
            this.fileIcon.classList.remove('hidden');
        }
        
        this.uploadSection.classList.remove('hidden');
    }

    cancelUpload() {
        this.currentFile = null;
        this.fileInput.value = '';
        this.uploadSection.classList.add('hidden');
        this.progressBar.style.width = '0%';
        this.filePreview.src = '';
        this.filePreview.classList.add('hidden');
        this.fileIcon.classList.remove('hidden');
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
            console.error('Upload error details:', error.message);
            
            // 더 상세한 에러 메시지 표시
            const errorMessage = error.message || '파일 업로드 중 오류가 발생했습니다.';
            alert(`파일 업로드 실패:\n${errorMessage}\n\n브라우저 콘솔(F12)에서 자세한 내용을 확인하세요.`);
            
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
