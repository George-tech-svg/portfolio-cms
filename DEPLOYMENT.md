# Vercel frontend + Render API

The same repository contains two applications. Vercel must publish only the static frontend; Render runs `server.js`.

## Existing Vercel project

Use the existing project that owns https://portfolio-cms-seven-blush.vercel.app/.

- Root directory: repository root.
- Framework preset: **Other** (the tracked `vercel.json` sets `framework: null`).
- Build command: `npm run build:frontend`.
- Output directory: `dist`.
- Install command: `npm ci --ignore-scripts`.
- Redeploy the commit containing these changes. Do not reuse a deployment built from an earlier commit.

`vercel.json` overrides build/output settings. `scripts/build-frontend.cjs` publishes an explicit list of public files and excludes `.env`, database content, server code, and dependencies. `backend.js` was a misnamed Vercel configuration, not a backend; it has been replaced by `vercel.json`.

After deployment, `/` must return HTML, `/js/api.js` must contain the Render address below, and `/admin.html` must return the admin page. Unknown asset URLs should return 404; do not rewrite all requests to `index.html`.

## Existing Render service

Use the existing service at https://portfolio-0umz.onrender.com if it is a Node Web Service, and preserve its database and environment settings.

Live checks during this change found that this address serves portfolio HTML and JavaScript, while `/api/test` and `/api/data` return 404. Verify its service type and connected source: it is currently serving the frontend rather than this API. These instructions require a **Node Web Service**, not a Static Site. If the existing service is a Static Site and cannot run Node, create a Web Service for the API, keep the database, and update `js/api.js` to its assigned URL before redeploying Vercel. Changing repository files alone cannot turn a static host into a running Node process.

- Runtime: Node.
- Root directory: repository root.
- Build command: `npm ci`.
- Start command: `npm start`.
- Health check: `/api/health`.
- Required environment variables: `DATABASE_URL`, `JWT_SECRET`, `CLOUD_NAME`, `API_KEY`, `API_SECRET`.
- `CORS_ORIGINS`: `https://portfolio-cms-seven-blush.vercel.app` (comma-separated additional exact origins are supported).
- Keep the existing database and Cloudinary account. Real values belong in Render's environment settings, never frontend files.

The app binds Render's `PORT` on `0.0.0.0`. Database setup must succeed before the HTTP listener opens. Startup seeds default content only when no profile exists. The API root intentionally returns `{"message":"Portfolio API running"}`; that response belongs on Render, not the Vercel homepage.

## Verify

```powershell
npm run build:frontend
npm test
node tests/portfolio.browser.cjs
node tests/portfolio.browser.cjs --admin
```

Browser tests use an installed Chrome/Edge and fixture data; set `PORTFOLIO_TEST_BROWSER` for another Chromium executable. Set `PORTFOLIO_TEST_WIDTH=1280` to check a wider viewport. They never send test messages or save changes to the live API.

Check these live URLs after both deployments finish:

- https://portfolio-cms-seven-blush.vercel.app/ — HTML app.
- https://portfolio-0umz.onrender.com/api/test — API liveness.
- https://portfolio-0umz.onrender.com/api/health — database readiness.
- https://portfolio-0umz.onrender.com/api/data — portfolio JSON.

The app manifest offers installation on supporting browsers. Its service worker caches only the public shell: it does not cache API data, credentials, chat responses, tokens, or admin pages. Project bookmarks stay in that visitor's browser. Contact forms save messages for the owner to read and reply; there is no automatic email, phone, or WhatsApp delivery service.
