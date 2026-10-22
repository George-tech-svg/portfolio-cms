// Publish an explicit allowlist. Backend code, secrets and runtime data never enter dist.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function publicURL(value, name) {
    if (!value) return '';
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new Error(`${name} must be an origin such as https://your-app.onrender.com`);
    if (process.env.VERCEL && parsed.protocol !== 'https:') throw new Error(`${name} must use HTTPS on Vercel`);
    return parsed.origin;
}
if (process.env.VERCEL && !process.env.PUBLIC_API_BASE_URL) throw new Error('Set PUBLIC_API_BASE_URL to your new Render API URL before deploying the frontend.');
const apiBaseURL = publicURL(process.env.PUBLIC_API_BASE_URL || 'http://localhost:3000', 'PUBLIC_API_BASE_URL');
const siteURL = publicURL(process.env.PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : ''), 'PUBLIC_SITE_URL');
const output = path.join(root, 'dist');
if (output !== path.resolve(root, 'dist')) throw new Error('Invalid output directory');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const file of ['index.html', 'admin.html', 'login.html', 'register.html', 'privacy.html', 'terms.html', 'favicon.svg', 'manifest.webmanifest', 'sw.js', 'robots.txt']) {
    fs.copyFileSync(path.join(root, file), path.join(output, file));
}
for (const folder of ['css', 'assets']) fs.cpSync(path.join(root, folder), path.join(output, folder), { recursive: true });
fs.mkdirSync(path.join(output, 'js'));
for (const file of ['api.js', 'credentials.js', 'app.js', 'main.js', 'admin.js']) {
    fs.copyFileSync(path.join(root, 'js', file), path.join(output, 'js', file));
}
fs.writeFileSync(path.join(output, 'js/config.js'), 'window.PORTFOLIO_CONFIG = ' + JSON.stringify({ apiBaseURL, siteURL }) + ';\n');
for (const name of ['index.html', 'login.html', 'register.html', 'admin.html']) {
    const file = path.join(output, name);
    let html = fs.readFileSync(file, 'utf8');
    html = html.replace(/\s*<link rel="canonical"[^>]*>/g, '');
    if (siteURL && name === 'index.html') html = html.replace('</head>', `<link rel="canonical" href="${siteURL}/"></head>`);
    fs.writeFileSync(file, html);
}
if (siteURL) {
    fs.writeFileSync(path.join(output, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ['/', '/privacy.html', '/terms.html'].map(url => `<url><loc>${siteURL}${url}</loc></url>`).join('') + '</urlset>');
    fs.appendFileSync(path.join(output, 'robots.txt'), `\nSitemap: ${siteURL}/sitemap.xml\n`);
}
console.log('Built frontend in dist/ (backend and secrets excluded).');
