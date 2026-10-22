const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function build(env) {
    vm.runInNewContext(fs.readFileSync(path.join(root, 'scripts/build-frontend.cjs'), 'utf8'), { require, __dirname: path.join(root, 'scripts'), process: { env }, console, URL });
}
test('fresh deployments require a valid public API origin', () => {
    assert.throws(() => build({ VERCEL: '1' }), /PUBLIC_API_BASE_URL/);
    assert.throws(() => build({ PUBLIC_API_BASE_URL: 'https://user:secret@example.com' }), /must be an origin/);
    assert.throws(() => build({ VERCEL: '1', PUBLIC_API_BASE_URL: 'http://api.example.com' }), /HTTPS/);
});
test('Vercel builds only public frontend files and cannot expose backend or secrets', () => {
    const configuration = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json')));
    assert.equal(configuration.framework, null);
    assert.equal(configuration.outputDirectory, 'dist');
    build({ PUBLIC_API_BASE_URL: 'https://new-api.onrender.com', PUBLIC_SITE_URL: 'https://new-app.vercel.app', DATABASE_URL: 'never-publish-this-database-secret' });
    for (const file of ['index.html', 'admin.html', 'login.html', 'js/main.js', 'js/config.js', 'js/api.js', 'css/app.css', 'sw.js', 'manifest.webmanifest', 'assets/icon-192.png', 'assets/icon-512.png']) {
        assert.ok(fs.existsSync(path.join(root, 'dist', file)), file);
    }
    for (const file of ['.env', 'server.js', 'backend.js', 'node_modules', 'package.json', 'messages.json', 'js/data.json', 'tests']) {
        assert.ok(!fs.existsSync(path.join(root, 'dist', file)), `${file} must not be deployed`);
    }
    const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
    assert.match(html, /<!DOCTYPE html>/i);
    for (const [, asset] of html.matchAll(/(?:src|href)="((?:js|css)\/[^"?#]+)"/g)) assert.ok(fs.existsSync(path.join(root, 'dist', asset)), asset);
    const config = fs.readFileSync(path.join(root, 'dist/js/config.js'), 'utf8');
    assert.match(config, /https:\/\/new-api.onrender.com/);
    assert.ok(!config.includes('never-publish-this-database-secret'));
    assert.match(html, /https:\/\/new-app.vercel.app/);
    assert.match(fs.readFileSync(path.join(root, 'dist/sitemap.xml'), 'utf8'), /https:\/\/new-app.vercel.app/);
});
test('API client rejects failed writes, preserves status, and does not claim success', async () => {
    const window = { fetch: async () => ({ ok: false, status: 403, json: async () => ({ error: 'Expired session' }) }) };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'js/api.js'), 'utf8'), { window, AbortController, setTimeout, clearTimeout });
    await assert.rejects(window.PortfolioAPI.fetch('/api/profile', { method: 'PUT' }), error => error.status === 403 && error.message === 'Expired session');
});
test('service worker excludes API, private pages, and other origins', () => {
    const events = {};
    const self = { location: { origin: 'https://test.example' }, addEventListener(name, callback) { events[name] = callback; } };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), { self, URL });
    for (const suffix of ['/api/data', '/api/chat', '/admin.html', '/login.html']) {
        let intercepted = false;
        events.fetch({ request: { url: self.location.origin + suffix, method: 'GET' }, respondWith() { intercepted = true; } });
        assert.equal(intercepted, false, suffix);
    }
    let intercepted = false;
    events.fetch({ request: { url: 'https://portfolio-0umz.onrender.com/api/data', method: 'GET' }, respondWith() { intercepted = true; } });
    assert.equal(intercepted, false);
});
