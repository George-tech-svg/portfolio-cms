// Shared by the public portfolio and certificate editor.
window.Credentials = (() => {
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
    function url(value, files = false) {
        if (typeof value !== 'string' || !value.trim()) return '';
        if (files && /^data:(image\/(png|jpeg|webp|gif)|application\/pdf);base64,[a-z\d+/=\s]+$/i.test(value)) return value;
        try {
            const parsed = new URL(value, document.baseURI);
            return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : '';
        } catch { return ''; }
    }
    function kind(value) {
        if (/^data:application\/pdf;/i.test(value) || /\.pdf(?:[?#]|$)/i.test(value)) return 'pdf';
        if (/^data:image\//i.test(value) || /\.(png|jpe?g|webp|gif)(?:[?#]|$)/i.test(value) || /\/image\/upload\//i.test(value)) return 'image';
        return 'file';
    }
    function mediaURL(value) {
        if (typeof value === 'string' && /^data:video\/(mp4|webm|ogg);base64,[a-z\d+/=\s]+$/i.test(value)) return value;
        return url(value);
    }
    function attachmentURL(value) {
        if (typeof value === 'string' && /^data:(text\/(plain|csv)|application\/(pdf|zip|x-zip-compressed|msword|octet-stream|vnd\.openxmlformats-officedocument\.[a-z.]+));base64,[a-z\d+/=\s]+$/i.test(value)) return value;
        return url(value, true);
    }
    function preview(value, name) {
        const source = url(value, true);
        if (!source) return null;
        const frame = document.createElement('div');
        frame.className = 'credential-preview';
        if (kind(source) === 'image') {
            const image = document.createElement('img');
            image.src = source;
            image.alt = `${name || 'Certificate'} — original credential`;
            image.loading = 'lazy';
            image.addEventListener('error', () => {
                frame.textContent = 'Preview unavailable. Open the original certificate below.';
            });
            frame.append(image);
        } else {
            frame.textContent = kind(source) === 'pdf' ? 'PDF credential · Open to read the full document' : 'Credential document · Open to view';
        }
        return frame;
    }
    // PDF data URLs need a Blob URL for reliable browser document viewing.
    function documentURL(source) {
        if (!source.startsWith('data:')) return source;
        const [header, body] = source.split(',');
        const bytes = Uint8Array.from(atob(body.replace(/\s/g, '')), c => c.charCodeAt(0));
        return URL.createObjectURL(new Blob([bytes], { type: header.slice(5).split(';')[0] }));
    }
    return { escape, url, kind, preview, documentURL, mediaURL, attachmentURL };
})();
