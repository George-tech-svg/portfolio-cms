// Owner-only recovery through database access; no public reset endpoint.
const bcrypt = require('bcrypt');

class RecoveryInputError extends Error {}

function recoveryErrorMessage(error) {
    if (error instanceof RecoveryInputError) return error.message;
    if (['28P01', '28000'].includes(error?.code)) return 'Database sign-in failed. Check DATABASE_URL in the backend environment.';
    if (error?.code === '42P01') return 'The users table was not found. Check that DATABASE_URL points to your portfolio database.';
    return 'Could not complete recovery. Check database access and try again. Database details are hidden to protect credentials.';
}

async function resetPassword(pool, username, password) {
    if (!username.trim()) throw new RecoveryInputError('Enter the existing admin username.');
    if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
        throw new RecoveryInputError('Password must have at least 12 characters and at most 72 UTF-8 bytes. Nothing changed.');
    }
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query('UPDATE users SET password_hash = $1 WHERE username = $2 RETURNING id', [hash, username.trim()]);
    if (result.rowCount !== 1) throw new RecoveryInputError('Admin username not found. Run with --list to find it.');
}

async function main() {
    require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env'), quiet: true });
    if (!process.env.DATABASE_URL) throw new RecoveryInputError('Set DATABASE_URL in the backend environment first.');
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
    try {
        if (process.argv.includes('--list')) {
            const { rows } = await pool.query('SELECT username FROM users ORDER BY id');
            console.log(rows.length ? rows.map(row => row.username).join('\n') : 'No admin account exists. Use the admin registration page.');
            return;
        }
        if (!process.stdin.isTTY) throw new RecoveryInputError('Run this command in an interactive terminal so the password can be hidden.');
        const { Writable } = require('node:stream');
        let muted = false;
        const output = new Writable({ write(chunk, encoding, callback) { if (!muted) process.stdout.write(chunk); callback(); } });
        const rl = require('node:readline/promises').createInterface({ input: process.stdin, output, terminal: true });
        rl.on('SIGINT', () => { rl.close(); process.exitCode = 1; });
        try {
            const username = await rl.question('Existing admin username: ');
            process.stdout.write('New password (12+ characters, hidden): ');
            muted = true;
            const password = await rl.question('');
            process.stdout.write('\nConfirm password (hidden): ');
            const confirmation = await rl.question('');
            muted = false;
            process.stdout.write('\n');
            if (password !== confirmation) throw new RecoveryInputError('Passwords do not match. Nothing changed.');
            await resetPassword(pool, username, password);
            console.log('Admin password updated. Sign in with the same username and your new password.');
        } finally { rl.close(); }
    } finally { await pool.end(); }
}

if (require.main === module) main().catch(error => {
    console.error('Recovery failed: ' + recoveryErrorMessage(error));
    process.exitCode = 1;
});
module.exports = { resetPassword, recoveryErrorMessage, RecoveryInputError };
