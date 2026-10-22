// One backend address for public pages, admin pages, and authentication.
window.PortfolioAPI = {
    baseURL: 'https://portfolio-0umz.onrender.com',
    async fetch(url, options = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);
        try {
            const response = await window.fetch(url, { ...options, signal: options.signal || controller.signal });
            if (!response.ok) {
                const details = await response.json().catch(() => ({}));
                const error = new Error(details.error || `Request failed (HTTP ${response.status}). Please try again.`);
                error.status = response.status;
                throw error;
            }
            return response;
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('The server is taking too long to respond. Please try again.');
            throw error;
        } finally { clearTimeout(timeout); }
    }
};
