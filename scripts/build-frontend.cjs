// Publish an explicit allowlist. Backend code, secrets and runtime data never enter dist.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
if (output !== path.resolve(root, 'dist')) throw new Error('Invalid output directory');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const file of ['index.html', 'admin.html', 'login.html', 'register.html', 'privacy.html', 'terms.html', 'favicon.svg', 'manifest.webmanifest', 'sw.js', 'sitemap.xml', 'robots.txt']) {
    fs.copyFileSync(path.join(root, file), path.join(output, file));
}
for (const folder of ['css', 'assets']) fs.cpSync(path.join(root, folder), path.join(output, folder), { recursive: true });
fs.mkdirSync(path.join(output, 'js'));
for (const file of ['api.js', 'credentials.js', 'app.js', 'main.js', 'admin.js']) {
    fs.copyFileSync(path.join(root, 'js', file), path.join(output, 'js', file));
}
console.log('Built frontend in dist/ (backend and secrets excluded).');
