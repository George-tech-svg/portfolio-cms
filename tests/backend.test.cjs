const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const jwt = require('jsonwebtoken');

// Real Express routing and JWT verification, with an isolated fake database.
function harness(query = async () => ({ rows: [], rowCount: 0 }), options = {}) {
    const queries = [];
    const uploads = [];
    let released = false;
    class Pool {
        async query(sql, params) { queries.push({ sql, params }); return query(sql, params); }
        async connect() { return { query: this.query.bind(this), release() { released = true; } }; }
    }
    const module = { exports: {} };
    const customRequire = name => {
        if (name === 'pg') return { Pool };
        if (name === 'dotenv') return { config() {} };
        if (name === 'cloudinary') return { v2: { config() {}, uploader: { async upload(source, options) { uploads.push({ source, options }); return { public_id: 'temporary-test', secure_url: 'https://res.cloudinary.com/test/' + options.resource_type + '/upload/example' }; }, async destroy() { return { result: 'ok' }; } } } };
        return require(name);
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8'), {
        require: customRequire, module,
        process: { env: { JWT_SECRET: 'isolated-test-secret', CORS_ORIGINS: ' https://preview.example.com ', FRONTEND_URL: 'https://new-portfolio.vercel.app/' } },
        console: { log() {}, error() {}, warn() {} },
        Buffer, AbortSignal,
        fetch: async () => ({ ok: !options.blockPDF, status: options.blockPDF ? 401 : 200, headers: { get() { return 'PDF delivery blocked'; } } })
    });
    return { ...module.exports, queries, uploads, released: () => released };
}
async function serve(app, work) {
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try { await work(`http://127.0.0.1:${server.address().port}`); }
    finally { await new Promise(resolve => server.close(resolve)); }
}
const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ id: 7 }, 'isolated-test-secret')}` };

test('Vercel origin and configured origins can reach the API', async () => {
    const { app } = harness();
    await serve(app, async base => {
        for (const origin of ['https://new-portfolio.vercel.app', 'https://preview.example.com']) {
            const response = await fetch(base + '/api/test', { headers: { Origin: origin } });
            assert.equal(response.status, 200);
            assert.equal(response.headers.get('access-control-allow-origin'), origin);
        }
        const blocked = await fetch(base + '/api/test', { headers: { Origin: 'https://untrusted.example.com' } });
        assert.equal(blocked.status, 403);
    });
});
test('a visitor token cannot access admin routes or run setup', async () => {
    const { app, queries } = harness();
    await serve(app, async base => {
        const token = jwt.sign({ id: 1, type: 'visitor' }, 'isolated-test-secret');
        const headers = { Authorization: `Bearer ${token}` };
        assert.equal((await fetch(base + '/api/messages', { headers })).status, 403);
        assert.equal((await fetch(base + '/api/admin/overview', { headers })).status, 403);
        assert.equal((await fetch(base + '/api/setup-db', { headers })).status, 403);
        assert.equal((await fetch(base + '/api/setup-db')).status, 401);
        assert.equal(queries.length, 0);
    });
});
test('profile updates the selected database row even when its ID is not 1', async () => {
    const { app, queries } = harness(async sql => ({ rows: sql.startsWith('SELECT id FROM profile') ? [{ id: 42 }] : [], rowCount: 1 }));
    await serve(app, async base => {
        const response = await fetch(base + '/api/profile', { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ name: 'Owner' }) });
        assert.equal(response.status, 200);
        const update = queries.find(query => query.sql.startsWith('UPDATE profile'));
        assert.equal(update.params.at(-1), 42);
        assert.match(update.sql, /WHERE id=\$11/);
    });
});
test('failed project edit rolls back instead of deleting existing media', async () => {
    const state = harness(async sql => {
        if (sql.startsWith('INSERT INTO project_images')) throw new Error('simulated DB failure');
        return { rows: [], rowCount: 1 };
    });
    await serve(state.app, async base => {
        const response = await fetch(base + '/api/projects/1', { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ title: 'Test', images: ['photo.png'] }) });
        assert.equal(response.status, 500);
        assert.ok(state.queries.some(query => query.sql === 'BEGIN'));
        assert.ok(state.queries.some(query => query.sql === 'ROLLBACK'));
        assert.ok(!state.queries.some(query => query.sql === 'COMMIT'));
        assert.ok(state.released());
    });
});

test('project edits preserve omitted media and save a changed category', async () => {
    const state = harness(async () => ({ rows: [], rowCount: 1 }));
    await serve(state.app, async base => {
        const response = await fetch(base + '/api/projects/1', { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ title: 'Updated title', groupId: 9 }) });
        assert.equal(response.status, 200);
        assert.equal(state.queries.find(query => query.sql.startsWith('UPDATE projects')).params[6], 9);
        assert.ok(!state.queries.some(query => query.sql.startsWith('DELETE FROM project_')));
        assert.ok(state.queries.some(query => query.sql === 'COMMIT'));
    });
});

test('explicit attachment removal clears saved files and missing projects return 404', async () => {
    const state = harness(async () => ({ rows: [], rowCount: 1 }));
    await serve(state.app, async base => {
        assert.equal((await fetch(base + '/api/projects/1', { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ files: [] }) })).status, 200);
        assert.ok(state.queries.some(query => query.sql.startsWith('DELETE FROM project_files')));
        assert.ok(!state.queries.some(query => query.sql.startsWith('DELETE FROM project_images')));
    });
    const missing = harness();
    await serve(missing.app, async base => {
        assert.equal((await fetch(base + '/api/projects/99', { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ title: 'Missing' }) })).status, 404);
        assert.ok(missing.queries.some(query => query.sql === 'ROLLBACK'));
        assert.ok(!missing.queries.some(query => query.sql.startsWith('DELETE FROM')));
    });
});

test('profile and biography save atomically and roll back on a biography failure', async () => {
    const state = harness(async sql => {
        if (sql.startsWith('INSERT INTO about_paragraphs')) throw new Error('simulated failure');
        return { rows: [{ id: 42 }], rowCount: 1 };
    });
    await serve(state.app, async base => {
        const response = await fetch(base + '/api/profile-content', { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ personal: { name: 'New name' }, paragraphs: ['New biography'] }) });
        assert.equal(response.status, 500);
        assert.ok(state.queries.some(query => query.sql.startsWith('UPDATE profile')));
        assert.ok(state.queries.some(query => query.sql === 'ROLLBACK'));
        assert.ok(!state.queries.some(query => query.sql === 'COMMIT'));
    });
});

test('welcome video edits use the saved row ID', async () => {
    const state = harness(async () => ({ rows: [{ id: 42 }], rowCount: 1 }));
    await serve(state.app, async base => {
        assert.equal((await fetch(base + '/api/welcome-video', { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ url: 'https://example.com/intro.mp4' }) })).status, 200);
        assert.equal(state.queries.find(query => query.sql.startsWith('UPDATE welcome_video')).params[1], 42);
    });
});

test('failed social rename retains the previous link', async () => {
    const state = harness(async sql => { if (sql.startsWith('INSERT INTO social_links')) throw new Error('simulated failure'); return { rows: [], rowCount: 1 }; });
    await serve(state.app, async base => {
        assert.equal((await fetch(base + '/api/social', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ platform: 'github', originalPlatform: 'linkedin', url: 'https://github.com/example' }) })).status, 500);
        assert.ok(!state.queries.some(query => query.sql.startsWith('DELETE FROM social_links')));
        assert.ok(state.queries.some(query => query.sql === 'ROLLBACK'));
    });
});

test('public portfolio data explicitly bypasses caches after edits', async () => {
    const { app } = harness();
    await serve(app, async base => {
        const response = await fetch(base + '/api/data');
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
    });
});

test('blocked PDF delivery reports an actionable error instead of a saved URL', async () => {
    const { app } = harness(undefined, { blockPDF: true });
    await serve(app, async base => {
        const form = new FormData(); form.append('image', new Blob(['PDF'], { type: 'application/pdf' }), 'certificate.pdf');
        const response = await fetch(base + '/api/upload', { method: 'POST', headers: { Authorization: adminHeaders.Authorization }, body: form });
        assert.equal(response.status, 422);
        assert.match((await response.json()).error, /Allow delivery of PDF and ZIP files/);
    });
});
test('startup does not reseed about content when a profile already exists', async () => {
    const state = harness();
    await state.setupDatabase();
    assert.ok(state.queries.find(query => query.sql.includes('INSERT INTO profile')).sql.includes('WHERE NOT EXISTS'));
    assert.ok(!state.queries.some(query => query.sql.includes('INSERT INTO about_paragraphs')));
});
test('health reports database failures and contact rejects invalid content', async () => {
    const { app } = harness(async () => { throw new Error('DB unavailable'); });
    await serve(app, async base => {
        assert.equal((await fetch(base + '/api/health')).status, 503);
        const response = await fetch(base + '/api/contact-out', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: ' ', email: 'invalid', message: ' ', channel: 'email' }) });
        assert.equal(response.status, 400);
    });
});
test('owner overview returns authenticated inquiry and content totals', async () => {
    const overview = { inquiries: 3, conversations: 2, credential_files: 1, projects: 4, about_paragraphs: 2, profile_ready: true };
    const { app } = harness(async () => ({ rows: [overview], rowCount: 1 }));
    await serve(app, async base => {
        const response = await fetch(base + '/api/admin/overview', { headers: adminHeaders });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { success: true, overview });
    });
});

test('authenticated media uploads go to Cloudinary without storing file bytes in PostgreSQL', async () => {
    const { app, queries, uploads } = harness();
    const token = jwt.sign({ id: 7 }, 'isolated-test-secret');
    await serve(app, async base => {
        for (const [name, type, resource] of [['certificate.pdf', 'application/pdf', 'image'], ['notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'raw'], ['intro.mp4', 'video/mp4', 'video']]) {
            const form = new FormData();
            form.append('image', new Blob(['isolated test file'], { type }), name);
            const response = await fetch(base + '/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
            assert.equal(response.status, 200);
            assert.ok((await response.json()).url.startsWith('https://res.cloudinary.com/'));
            assert.equal(uploads.at(-1).options.resource_type, resource);
            if (resource === 'raw') assert.ok(uploads.at(-1).options.public_id.endsWith('-notes.docx'));
        }
        assert.equal(queries.length, 0);
        assert.equal((await fetch(base + '/api/upload', { method: 'POST' })).status, 401);
    });
});
