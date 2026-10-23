// Run with: node tests/portfolio.browser.cjs
// Uses an installed Chromium browser and fixture data; never writes to the live API.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const adminMode = process.argv.includes('--admin');
const browser = process.env.PORTFOLIO_TEST_BROWSER || [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find(file => fs.existsSync(file));
if (!browser) throw new Error('Set PORTFOLIO_TEST_BROWSER to an installed Chromium executable.');
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aU1sAAAAASUVORK5CYII=';
const fixture = {
    personal: { name: 'Portfolio Test', heroSubtitle: 'Data scientist', aboutImage: image },
    about: { paragraphs: [Array(80).fill('A thoughtful approach to data, design, and useful software.').join(' ')] },
    experience: [{ role: 'Data scientist', company: 'Research team', period: '2024?2026', description: Array(60).fill('Built data products and shared findings.').join(' ') }],
    education: [{ institution: 'University', degree: 'Computer science', description: Array(60).fill('Research, statistics, and software engineering.').join(' ') }],
    skills: [{ category: 'Data science', items: ['Python', 'SQL', 'Statistics'] }, { category: 'Machine learning', items: ['Scikit-learn', 'PyTorch'] }],
    projectGroups: [{ id: 1, name: 'Data science', projects: [{ id: 2, title: 'Sample project', images: [image], readme: 'Project explanation', files: [{ name: 'existing.pdf', data: 'data:application/pdf;base64,JVBERi0xLjQKJSVFT0Y=' }] }] }],
    certifications: [
        { id: 1, name: 'Image certificate', issuer: 'Test issuer', description: Array(30).fill('Practical data analysis and research.').join(' ') + '<script>inert text</script>', file: image, link: 'https://example.com/verify' },
        { id: 2, name: 'PDF certificate', file: 'data:application/pdf;base64,JVBERi0xLjQKJSVFT0Y=' },
        { id: 3, name: '<img src=x onerror=alert(1)>', link: 'javascript:alert(1)' }
    ]
};
const setup = `<script>
localStorage.clear();
localStorage.setItem('token', 'local-test-token');
window.fixture = ${JSON.stringify(fixture).replace(/</g, '\\u003c')};
window.failFetch = false;
window.saveRequests = [];
window.uploadRequests = [];
window.alerts = [];
window.alert = message => window.alerts.push(message);
window.browserErrors = [];
window.addEventListener('error', event => { if (event.filename?.includes(location.origin)) window.browserErrors.push(event.message); });
window.addEventListener('unhandledrejection', event => window.browserErrors.push(String(event.reason)));
window.chatMessages = [];
window.fetch = async (url, options = {}) => {
    if (window.failFetch) throw new Error('Simulated offline');
    if (url.endsWith('/api/upload')) {
        const file = options.body.get('image');
        window.uploadRequests.push(file.name);
        return { ok: true, status: 200, json: async () => ({ success: true, url: 'https://res.cloudinary.com/test/image/upload/' + file.name }) };
    }
    if (url.endsWith('/api/visitor-login') || url.endsWith('/api/visitor-register')) {
        return { ok: true, status: 200, json: async () => ({ success: true, token: 'test-visitor', username: 'Visitor' }) };
    }
    if (url.endsWith('/api/chat')) return { ok: true, status: 200, json: async () => ({ success: true, conversationId: 7, messages: window.chatMessages, username: 'Visitor' }) };
    if (url.endsWith('/api/chat/send')) {
        window.chatMessages.push({ sender_type: 'visitor', message: JSON.parse(options.body).message });
        return { ok: true, status: 200, json: async () => ({ success: true }) };
    }
    if (options.method === 'POST' || options.method === 'PUT') {
        window.saveRequests.push(JSON.parse(options.body));
        return { ok: !window.rejectSave, status: window.rejectSave ? 500 : 200, json: async () => ({ success: !window.rejectSave, error: 'Test save failure' }) };
    }
    if (url.endsWith('/api/admin/overview')) return { ok: true, status: 200, json: async () => ({ success: true, overview: { inquiries: 2, conversations: 1, credential_files: 2, projects: 1, about_paragraphs: 0, profile_ready: true } }) };
    if (url.endsWith('/api/messages')) return { ok: true, status: 200, json: async () => [] };
    return { ok: true, status: 200, json: async () => window.fixture };
};
</script>`;
const adminChecks = `<script>
document.addEventListener('DOMContentLoaded', () => setTimeout(async () => {
    const failures = [];
    function check(condition, message) { if (!condition) failures.push(message); }
    try {
        check(document.getElementById('owner-overview').textContent.includes('2 project inquiries'), 'Owner dashboard shows inquiry totals');
        check(document.querySelectorAll('.owner-checklist button').length === 4, 'Owner dashboard lists content readiness');
        await editCertification(1);
        check(document.querySelector('#certFilePreview img'), 'Saved certificate image previews in the editor');
        check(document.getElementById('certFile').files.length === 0, 'Editor clears previous file selection');
        const form = document.getElementById('certificationForm');
        window.rejectSave = true;
        form.dispatchEvent(new Event('submit', { cancelable: true }));
        await new Promise(resolve => setTimeout(resolve, 100));
        check(window.alerts.at(-1)?.includes('Failed to save'), 'HTTP failure is reported as a failed save');
        check(!document.getElementById('certSubmitBtn').disabled, 'Save button recovers after failure');
        check(window.saveRequests.at(-1)?.file === window.fixture.certifications[0].file, 'Metadata edit preserves existing certificate');
        showAddCertification();
        document.getElementById('certName').value = 'New credential';
        document.getElementById('certIssuer').value = 'Issuer';
        const transfer = new DataTransfer();
        transfer.items.add(new File(['image bytes'], 'certificate.png', { type: 'image/png' }));
        document.getElementById('certFile').files = transfer.files;
        window.rejectSave = false;
        form.dispatchEvent(new Event('submit', { cancelable: true }));
        await new Promise(resolve => setTimeout(resolve, 150));
        check(window.saveRequests.at(-1)?.file.startsWith('https://res.cloudinary.com/'), 'Saved credential contains its Cloudinary URL');
        check(window.alerts.at(-1) === 'Certification saved!', 'Successful save is confirmed');
        showAddCertification();
        check(document.getElementById('certFile').files.length === 0, 'New credential cannot reuse the previous upload');
        await editProject(1, 2);
        const attachments = new DataTransfer();
        attachments.items.add(new File(['Project notes'], 'notes.txt', { type: 'text/plain' }));
        document.getElementById('projectFiles').files = attachments.files;
        document.getElementById('projectForm').dispatchEvent(new Event('submit', { cancelable: true }));
        await new Promise(resolve => setTimeout(resolve, 150));
        check(window.saveRequests.at(-1)?.files.length === 2, 'Adding an attachment preserves the existing files');
        check(window.saveRequests.at(-1)?.files[1].data.startsWith('https://res.cloudinary.com/'), 'New attachment stores a Cloudinary URL');
        showAddProject(1);
        check(document.getElementById('projectFiles').files.length === 0, 'New projects clear previous attachments');
        const resume = new DataTransfer(); resume.items.add(new File(['test PDF'], 'resume.pdf', { type: 'application/pdf' }));
        document.getElementById('resumeFile').files = resume.files;
        document.getElementById('resumeForm').dispatchEvent(new Event('submit', { cancelable: true }));
        await new Promise(resolve => setTimeout(resolve, 150));
        check(window.saveRequests.at(-1)?.resume === 'https://res.cloudinary.com/test/image/upload/resume.pdf', 'Resume stores its Cloudinary URL');
        check(window.uploadRequests.includes('certificate.png') && window.uploadRequests.includes('notes.txt') && window.uploadRequests.includes('resume.pdf'), 'Certificates, attachments, and resumes all upload to Cloudinary');
    } catch (error) { failures.push(error.stack); }
    failures.push(...window.browserErrors);
    const result = document.createElement('pre');
    result.id = 'qa-result';
    result.textContent = failures.length ? JSON.stringify(failures) : 'PASS';
    document.body.append(result);
}, 100));
</script>`;
const checks = `<script>
document.addEventListener('DOMContentLoaded', () => setTimeout(async () => {
    const failures = [];
    function check(condition, message) { if (!condition) failures.push(message); }
    try {
        check(document.getElementById('load-status').hidden, 'Loading status clears after success');
        check(document.querySelectorAll('.certification-card').length === 3, 'All credentials render');
        check(document.querySelector('.credential-preview img')?.src.startsWith('data:image/png'), 'Actual uploaded photo renders');
        check(document.querySelectorAll('.certification-card')[2].querySelectorAll('img, a').length === 0, 'Untrusted credential text and URL remain inert');
        await new Promise(resolve => setTimeout(resolve, 100));
        for (const [selector, lines] of [['#about-text', '5'], ['#timeline .expandable-copy', '4'], ['#education-list .expandable-copy', '4'], ['.cert-description', '1']]) {
            const description = document.querySelector(selector);
            const more = description.nextElementSibling;
            check(getComputedStyle(description).webkitLineClamp === lines, selector + ' uses requested line limit');
            check(more && !more.hidden && more.getAttribute('aria-expanded') === 'false', selector + ' offers more for overflowing text');
            more.focus(); more.click();
            check(more.textContent === 'hide' && more.getAttribute('aria-expanded') === 'true' && getComputedStyle(description).webkitLineClamp === 'none', selector + ' expands fully');
            more.click();
            check(more.textContent === 'more' && more.getAttribute('aria-expanded') === 'false', selector + ' collapses again');
        }
        check(!document.querySelector('.cert-description script') && document.querySelector('.cert-description').textContent === window.fixture.certifications[0].description, 'Description text remains safe');
        check(document.querySelector('.certification-card').firstElementChild.className === 'cert-heading', 'Certificate heading precedes photo');
        check(document.querySelector('#timeline .entry-portrait'), 'Experience uses owner portrait');
        check(document.querySelectorAll('.skill-card')[1].getBoundingClientRect().top >= document.querySelectorAll('.skill-card')[0].getBoundingClientRect().bottom, 'Skill categories appear one after another');
        document.querySelector('.credential-thumbnail').click();
        check(document.querySelector('.credential-dialog')?.open && document.querySelector('.credential-dialog img'), 'Image viewer opens');
        document.querySelector('.credential-dialog button').click();
        await new Promise(resolve => setTimeout(resolve, 100));
        check(!document.querySelector('.credential-dialog'), 'Viewer closes and removes itself');
        document.querySelectorAll('.certification-card')[1].querySelector('button').click();
        check(document.querySelector('.credential-dialog iframe')?.src.startsWith('blob:'), 'PDF data becomes a viewable Blob URL');
        document.querySelector('.credential-dialog button').click();
        await new Promise(resolve => setTimeout(resolve, 100));
        document.querySelector('.group-card').click();
        check(location.hash === '#projects/group/1', 'Group has a shareable URL');
        document.querySelector('.project-card').click();
        check(location.hash === '#projects/group/1/project/2', 'Project has a shareable URL');
        check(document.querySelector('.project-gallery img') && document.querySelector('.project-readme')?.textContent === 'Project explanation', 'Project media and write-up render');
        history.back();
        await new Promise(resolve => setTimeout(resolve, 150));
        check(location.hash === '#projects/group/1' && document.querySelector('.project-card'), 'Browser Back restores group');
        const menu = document.getElementById('hamburger');
        menu.click();
        check(menu.getAttribute('aria-expanded') === 'true' && getComputedStyle(document.getElementById('navLinks')).display !== 'none', 'Mobile navigation opens');
        document.querySelector('.nav-links a[href="#certifications"]').click();
        check(menu.getAttribute('aria-expanded') === 'false', 'Section navigation closes mobile menu');
        window.failFetch = true;
        await loadPublicData();
        check(!document.getElementById('load-status').hidden && document.querySelector('#load-status button'), 'Failed data load offers retry');
        window.failFetch = false;
        await loadPublicData();
        check(document.getElementById('load-status').hidden, 'Retry recovers from API failure');
        check(document.documentElement.scrollWidth <= innerWidth, 'Mobile page has no horizontal overflow');
        check(getComputedStyle(document.querySelector('body > nav:not(.app-dock)')).position === 'fixed', 'Base styles apply without an external font import');
        check(getComputedStyle(document.getElementById('authModal')).display === 'none', 'Login modal starts hidden');
        const search = document.getElementById('project-search');
        search.value = 'Sample'; search.dispatchEvent(new Event('input'));
        check(document.getElementById('projects-grid').hidden && document.querySelectorAll('.explorer-result').length === 1, 'Search finds a project');
        document.querySelector('.explorer-result').click();
        const save = document.querySelector('.project-app-actions button'); save.click();
        check(save.getAttribute('aria-pressed') === 'true', 'Visitor can save a project');
        showGroups(); document.getElementById('saved-projects').click();
        check(document.querySelectorAll('.explorer-result').length === 1, 'Saved projects can be found again');
        showGroups();
        openAuthModal('register');
        document.getElementById('authUsername').value = 'Visitor';
        document.getElementById('authPassword').value = 'pass123';
        document.getElementById('authConfirmPassword').value = 'mismatch';
        document.getElementById('authForm').dispatchEvent(new Event('submit', { cancelable: true }));
        check(document.getElementById('authError').textContent === 'Passwords do not match.', 'Registration validates password confirmation');
        document.getElementById('authConfirmPassword').value = 'pass123';
        document.getElementById('authForm').dispatchEvent(new Event('submit', { cancelable: true }));
        await new Promise(resolve => setTimeout(resolve, 100));
        check(localStorage.getItem('visitorToken') === 'test-visitor' && !document.getElementById('chat-input').disabled, 'Visitor registration opens chat');
        document.getElementById('chat-input').value = 'Hello about a project';
        await sendChatMessage();
        check(document.querySelector('.chat-message')?.textContent === 'Hello about a project', 'Chat sends and renders a message');
        document.getElementById('chat-auth-status').querySelector('button').click();
        check(!localStorage.getItem('visitorToken') && document.getElementById('chat-input').disabled, 'Visitor can sign out');
        document.getElementById('out-name').value = 'Visitor';
        document.getElementById('out-email').value = 'visitor@example.com';
        document.getElementById('out-message').value = 'I would like to discuss a project';
        document.getElementById('out-reply-contact').value = '+254700000000';
        document.getElementById('out-form').dispatchEvent(new Event('submit', { cancelable: true }));
        await new Promise(resolve => setTimeout(resolve, 100));
        check(window.saveRequests.at(-1)?.message.includes('+254700000000'), 'Contact saves reply details');
        check(document.getElementById('inquiry-feedback').textContent.includes('message is saved'), 'Contact confirms the actual saved behavior');
        check(!document.querySelector('#out-form [type=submit]').disabled, 'Contact form recovers after sending');
        check(document.querySelector('link[rel=manifest]') && document.getElementById('install-app'), 'App installation is declared');
        document.getElementById('open-quick-nav').click();
        check(document.getElementById('quick-nav').open, 'Quick navigation opens');
        document.getElementById('close-quick-nav').click();
        const category = document.getElementById('project-category'); category.value = '1'; category.dispatchEvent(new Event('change'));
        check(document.querySelectorAll('.explorer-result').length === 1, 'Category filter finds the right work');
        document.getElementById('clear-project-filters').click();
        check(!document.getElementById('projects-grid').hidden, 'Clear filters restores category browsing');
        check(document.querySelectorAll('.featured-project').length === 0 && !document.getElementById('spotlight'), 'Featured projects are removed');
        document.querySelector('[data-inquiry-service=web]').click();
        check(document.getElementById('inquiry-service').value === 'web', 'Service inquiry chooses the right project type');
        showProjectDetail(1, 2);
        document.querySelector('.project-app-actions a').click();
        check(!document.getElementById('inquiry-context').hidden && document.getElementById('inquiry-context').textContent.includes('Sample project'), 'Project discussion carries context to inquiry');
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo({ top: 0, behavior: 'instant' });
        await new Promise(resolve => setTimeout(resolve, 100));
        check(document.querySelector('.hero-content').getBoundingClientRect().right <= innerWidth + 1, 'Hero stays within the mobile viewport');
        check(document.querySelector('.nav-actions').getBoundingClientRect().right <= innerWidth + 1, 'Header actions stay within the mobile viewport');
        document.getElementById('theme-toggle').click();
        check(document.body.classList.contains('dark'), 'Dark theme can be enabled');
        document.getElementById('theme-toggle').click();
        check(!document.body.classList.contains('dark'), 'Light theme can be restored');
        if (${JSON.stringify(process.env.PORTFOLIO_TEST_DARK === '1')}) document.getElementById('theme-toggle').click();
        if (${JSON.stringify(process.env.PORTFOLIO_TEST_SECTION || '')}) {
            document.getElementById(${JSON.stringify(process.env.PORTFOLIO_TEST_SECTION || 'hero')}).scrollIntoView({ behavior: 'instant' });
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    } catch (error) { failures.push(error.stack); }
    failures.push(...window.browserErrors);
    const result = document.createElement('pre');
    result.id = 'qa-result';
    result.textContent = failures.length ? JSON.stringify(failures) : 'PASS';
    document.body.append(result);
}, 100));
</script>`;

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404).end(); return;
    }
    let body = fs.readFileSync(file);
    if (file.endsWith(adminMode ? 'admin.html' : 'index.html')) body = body.toString()
        .replace(/<link\b[^>]*href="https:\/\/[^\"]*"[^>]*>/g, '')
        .replace('<head>', '<head>' + setup).replace('</body>', (adminMode ? adminChecks : checks) + '</body>');
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(body);
});
server.listen(0, '127.0.0.1', () => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-browser-'));
    execFile(browser, [
        '--headless=new', '--force-device-scale-factor=1', '--disable-gpu', '--run-all-compositor-stages-before-draw', '--no-first-run', '--no-default-browser-check',
        '--disable-background-networking', '--window-size=' + (process.env.PORTFOLIO_TEST_WIDTH || '390') + ',844', '--hide-scrollbars',
        '--virtual-time-budget=11000', '--dump-dom', '--user-data-dir=' + profile,
        ...(process.env.PORTFOLIO_TEST_SCREENSHOT ? ['--screenshot=' + path.resolve(process.env.PORTFOLIO_TEST_SCREENSHOT)] : []),
        `http://127.0.0.1:${server.address().port}/${adminMode ? 'admin.html' : ''}`
    ], { windowsHide: true, timeout: 30000, maxBuffer: 2 * 1024 * 1024 }, (error, stdout) => {
        server.close();
        try {
            assert.ifError(error);
            const result = stdout.match(/<pre id="qa-result">([\s\S]*?)<\/pre>/);
            assert.ok(result, 'Browser checks completed');
            assert.equal(result[1], 'PASS');
            console.log(adminMode ? 'PASS: owner dashboard, readiness checklist, certificate preview, save failures, image upload, and attachment preservation.' : 'PASS: credentials, project navigation, search, saved projects, registration, chat, contact, retry, mobile layout, and no browser errors.');
        } catch (failure) { console.error(failure.message); process.exitCode = 1; }
        // Delete only the unique temporary profile created by this process.
        if (profile.startsWith(path.join(os.tmpdir(), 'portfolio-browser-'))) {
            try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch {}
        }
    });
});
