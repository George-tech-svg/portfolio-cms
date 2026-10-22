const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const jwt = require('jsonwebtoken');

// Real Express routing and JWT verification, with an isolated fake database.
function harness(query = async () => ({ rows: [], rowCount: 0 })) {
    const queries = [];
    let released = false;
    class Pool {
        async query(sql, params) { queries.push({ sql, params }); return query(sql, params); }
        async connect() { return { query: this.query.bind(this), release() { released = true; } }; }
    }
    const module = { exports: {} };
    const customRequire = name => {
        if (name === 'pg') return { Pool };
        if (name === 'dotenv') return { config() {} };
        if (name === 'cloudinary') return { v2: { config() {} } };
        return require(name);
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8'), {
        require: customRequire, module,
        process: { env: { JWT_SECRET: 'isolated-test-secret', CORS_ORIGINS: ' https://preview.example.com ' } },
        console: { log() {}, error() {}, warn() {} },
        Buffer
    });
    return { ...module.exports, queries, released: () => released };
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
        for (const origin of ['https://portfolio-cms-seven-blush.vercel.app', 'https://preview.example.com']) {
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
