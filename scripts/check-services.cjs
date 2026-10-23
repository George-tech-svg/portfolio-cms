// Read-only checks by default. --upload creates tiny temporary test assets,
// verifies their public delivery, then deletes only those assets.
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env'), quiet: true });
const { pool, uploadCloudinaryFile } = require('../server');
const cloudinary = require('cloudinary').v2;
const fs = require('node:fs');
const path = require('node:path');
const publicPath = path.resolve(__dirname, '../.env.frontend');
const publicEnv = fs.existsSync(publicPath) ? require('dotenv').parse(fs.readFileSync(publicPath)) : {};
const apiOrigin = process.env.PUBLIC_API_BASE_URL || publicEnv.PUBLIC_API_BASE_URL;
const siteOrigin = process.env.PUBLIC_SITE_URL || publicEnv.PUBLIC_SITE_URL || process.env.FRONTEND_URL;

async function check(name, work) {
    try { console.log(JSON.stringify({ check: name, status: 'PASS', details: await work() })); }
    catch (error) {
        console.log(JSON.stringify({ check: name, status: 'FAIL', code: error.http_code || error.code || error.name || 'unavailable', reason: error.deliveryReason, details: error.details }));
        process.exitCode = 1;
    }
}

function samplePDF() {
    const stream = 'BT /F1 14 Tf 30 70 Td (Portfolio upload verification) Tj ET';
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 100] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
    let pdf = '%PDF-1.4\n'; const offsets = [0];
    objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf);
}

async function main() {
    try {
        await Promise.all([
            check('database read', async () => {
                const client = await pool.connect();
                try { const result = await client.query({ text: 'SELECT (SELECT count(*)::int FROM projects) AS projects, (SELECT count(*)::int FROM certifications) AS certificates', query_timeout: 15000 }); return result.rows[0]; }
                finally { client.release(); }
            }),
            check('Cloudinary credentials', async () => ({ status: (await cloudinary.api.ping({ timeout: 15000 })).status, productEnvironment: process.env.CLOUD_NAME })),
            check('hosted API and frontend CORS', async () => {
                if (!apiOrigin || !siteOrigin) return 'Not configured; set PUBLIC_API_BASE_URL and PUBLIC_SITE_URL to check hosting.';
                const response = await fetch(apiOrigin + '/api/health', { headers: { Origin: siteOrigin }, signal: AbortSignal.timeout(25000) });
                if (!response.ok) throw { code: `HTTP_${response.status}` };
                if (response.headers.get('access-control-allow-origin') !== siteOrigin) throw { code: 'CORS_ORIGIN_MISMATCH' };
                return { http: response.status, cors: 'allowed' };
            })
        ]);
        if (process.argv.includes('--existing-media')) await check('published Cloudinary media', async () => {
            const { rows } = await pool.query(`SELECT 'profile photo ' || id AS location, profile_image AS url FROM profile
                UNION ALL SELECT 'about photo ' || id, about_image FROM profile
                UNION ALL SELECT 'CV ' || id, resume FROM profile
                UNION ALL SELECT 'project photo ' || id, url FROM project_images
                UNION ALL SELECT 'project video ' || id, url FROM project_videos
                UNION ALL SELECT 'project attachment ' || id, data FROM project_files
                UNION ALL SELECT 'certificate ' || id, file FROM certifications
                UNION ALL SELECT 'welcome video ' || id, url FROM welcome_video`);
            let checked = 0; const failures = [];
            for (const row of rows) {
                if (!row.url?.startsWith(`https://res.cloudinary.com/${process.env.CLOUD_NAME}/`)) continue;
                checked++;
                try {
                    const response = await fetch(row.url, { headers: { Range: 'bytes=0-255' }, signal: AbortSignal.timeout(15000) });
                    await response.body?.cancel();
                    if (!response.ok) failures.push({ location: row.location, http: response.status, reason: response.headers.get('x-cld-error') });
                } catch { failures.push({ location: row.location, reason: 'Could not reach media delivery server' }); }
            }
            if (failures.length) throw { code: 'PUBLISHED_MEDIA_UNAVAILABLE', details: { checked, failures } };
            return { checked };
        });
        if (process.argv.includes('--upload')) {
            const files = [
                { originalname: 'portfolio-verification.png', mimetype: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aU1sAAAAASUVORK5CYII=', 'base64') },
                { originalname: 'portfolio-verification.pdf', mimetype: 'application/pdf', buffer: samplePDF() },
                { originalname: 'portfolio-verification.txt', mimetype: 'text/plain', buffer: Buffer.from('Portfolio attachment verification.') }
            ];
            for (const file of files) await check(`Cloudinary ${file.mimetype} upload and delivery`, async () => {
                const result = await uploadCloudinaryFile(file);
                try {
                    const response = await fetch(result.secure_url, { signal: AbortSignal.timeout(15000) });
                    if (!response.ok) throw { code: `DELIVERY_HTTP_${response.status}` };
                    const size = (await response.arrayBuffer()).byteLength;
                    if (!size) throw { code: 'EMPTY_FILE' };
                    return { http: response.status, bytes: size };
                } finally {
                    const deleted = await cloudinary.uploader.destroy(result.public_id, { resource_type: result.resource_type, invalidate: true, timeout: 15000 });
                    if (deleted.result !== 'ok') throw { code: 'TEMPORARY_ASSET_CLEANUP_FAILED' };
                }
            });
        }
    } finally { await pool.end(); }
}

main().catch(() => { console.error('Service checks could not complete. Check the backend environment.'); process.exitCode = 1; });
