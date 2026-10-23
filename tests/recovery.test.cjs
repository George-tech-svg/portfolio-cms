const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { resetPassword } = require('../scripts/recover-admin.cjs');

test('owner recovery hashes the replacement password and updates only the named account', async () => {
    let update;
    await resetPassword({ async query(sql, params) { update = { sql, params }; return { rowCount: 1 }; } }, ' owner ', 'a-new-owner-password');
    assert.match(update.sql, /WHERE username = \$2/);
    assert.equal(update.params[1], 'owner');
    assert.notEqual(update.params[0], 'a-new-owner-password');
    assert.equal(await bcrypt.compare('a-new-owner-password', update.params[0]), true);
});

test('owner recovery rejects weak or oversized passwords before writing', async () => {
    const pool = { query() { assert.fail('Must not write invalid passwords'); } };
    await assert.rejects(resetPassword(pool, 'owner', 'short'), /12 characters/);
    await assert.rejects(resetPassword(pool, 'owner', 'é'.repeat(40)), /72 UTF-8 bytes/);
});

test('owner recovery never creates an account when the username is unknown', async () => {
    await assert.rejects(resetPassword({ async query() { return { rowCount: 0 }; } }, 'unknown', 'a-new-owner-password'), /not found/);
});
