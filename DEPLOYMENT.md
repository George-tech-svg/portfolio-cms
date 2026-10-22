# Fresh deployment: Vercel frontend + Render backend

Build locally first, then create the two deployments from this repository. Neither service depends on the previous deployment URLs.

## 1. Deploy the backend on Render

Create a **Web Service** with the Node runtime from the repository root. The included `render.yaml` Blueprint is another way to configure it.

| Setting | Value |
| --- | --- |
| Build command | `npm ci` |
| Start command | `npm start` |
| Health check | `/api/health` |
| Node version | `24.x` (set in `package.json`) |

Import your private backend `.env` values into Render. Required values:

```dotenv
DATABASE_URL=your-existing-PostgreSQL-connection-string
JWT_SECRET=your-long-random-signing-secret
CLOUD_NAME=your-cloudinary-cloud
API_KEY=your-cloudinary-key
API_SECRET=your-cloudinary-secret
FRONTEND_URL=https://your-new-frontend.vercel.app
```

Reuse your current `DATABASE_URL` and Cloudinary account to keep content while recreating the app deployments. Render provides `PORT`; the app binds it on `0.0.0.0`. Database setup runs before accepting requests and does not overwrite an existing profile.

When creating the backend manually, `FRONTEND_URL` can initially remain unset. Set it to your final Vercel origin after step 2 and restart/redeploy the backend. `CORS_ORIGINS` supports additional comma-separated exact origins, such as a preview domain.

Copy Render's newly assigned URL. Confirm `https://YOUR-NEW-API.onrender.com/api/health` returns `{"status":"OK"}`. The backend root intentionally returns API JSON.

## 2. Deploy the frontend on Vercel

Create a fresh Vercel project from this repository. Use the repository root and the **Other** framework preset. `vercel.json` already defines:

| Setting | Value |
| --- | --- |
| Install command | `npm ci --ignore-scripts` |
| Build command | `npm run build:frontend` |
| Output directory | `dist` |

Add these public variables in Vercel's environment settings:

```dotenv
PUBLIC_API_BASE_URL=https://YOUR-NEW-API.onrender.com
PUBLIC_SITE_URL=https://YOUR-NEW-FRONTEND.vercel.app
```

Use `.env.frontend.example` as your frontend import template. `PUBLIC_SITE_URL` is optional; the build uses it to generate the canonical URL and sitemap. Vercel's `VERCEL_PROJECT_PRODUCTION_URL` is also supported. Redeploy after changing public variables.

The build reads only these public values, writes `dist/js/config.js`, and copies an explicit public-file allowlist. Private `.env` files, server code, database files, tests, and dependencies are excluded. Your private backend `.env` belongs on Render and is not needed on Vercel.

Set Render's `FRONTEND_URL` to your new Vercel URL, without a path. Both applications now know how to reach each other.

## 3. Complete your content

Open the frontend's `/register.html` to create the first admin, or `/login.html` when reusing a database with an admin. Registration closes after the first admin account exists.

Update your name, title, story, photos, resume, skills, projects, and credentials in the admin workspace. Upload actual certificate images or PDFs in **Certifications**. Project inquiries and website conversations appear in their sidebar sections. The dashboard shows content readiness and inquiry totals.

## Local development

Keep private backend values in the ignored `.env` file. In one terminal:

```powershell
npm ci
npm start
```

In another terminal:

```powershell
npm run build:frontend
npm run preview
```

Open `http://127.0.0.1:4173`. Development builds default to the API at `http://localhost:3000`. Set `PUBLIC_API_BASE_URL` before building to preview a different backend.

## Verification

```powershell
npm test
node tests/portfolio.browser.cjs
node tests/portfolio.browser.cjs --admin
```

Browser tests use an installed Chrome/Edge and isolated fixture data; they never send live messages or change production content. Set `PORTFOLIO_TEST_BROWSER` for another Chromium executable and `PORTFOLIO_TEST_WIDTH=1280` for desktop checks.

Check these after configuring both new deployments:

- Vercel `/` returns app HTML, not API JSON.
- Vercel `/js/config.js` points to the new Render API.
- Render `/api/health` returns 200 with `{"status":"OK"}`.
- Render `/api/data` loads from the frontend without a CORS error.
- Uploaded certificates are visible publicly and open in the full-size viewer.
- A real inquiry, submitted when ready, appears in the admin workspace.

The app is installable on supporting browsers. Its service worker caches only the public shell; portfolio data and chat need a connection. Saved projects stay in that visitor's browser. Inquiries are stored for you to read and reply; there is no automatic email, phone, or WhatsApp delivery service.

Platform references: [Vercel environment variables](https://vercel.com/docs/environment-variables) and [Render Blueprints](https://render.com/docs/blueprint-spec).
