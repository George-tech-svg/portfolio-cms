# George's Portfolio App

A workspace for discovering projects, viewing actual credentials, saving interesting work, and starting a project conversation. Built with HTML, CSS, JavaScript, Express, PostgreSQL, and Cloudinary.

The public app includes recent project highlights, search, category filters, sorting, saved projects, shareable project screens, photos and videos, case study text, downloadable attachments, image/PDF credential viewing, quick navigation, dark mode, and installation support.

Visitors can submit structured project inquiries or register for website chat. The owner workspace manages content, credentials, uploads, resumes, inquiries, and conversations, with a readiness checklist and inquiry counts.

## Run locally

```powershell
npm ci
npm start
```

In another terminal:

```powershell
npm run build:frontend
npm run preview
```

Open `http://127.0.0.1:4173`. The backend reads your private `.env` file; see `.env.example`. Your existing database and Cloudinary account can be reused.

## Fresh deployment

**Vercel serves the frontend in `dist/`. Render runs the Node API with `npm start`.**

See [DEPLOYMENT.md](DEPLOYMENT.md) for the order and settings, [the backend environment template](.env.example), and [the public frontend environment template](.env.frontend.example). Frontend builds accept `PUBLIC_API_BASE_URL` and `PUBLIC_SITE_URL`, so new domains do not require source edits. `render.yaml` configures a fresh backend service.

## Verification

```powershell
npm test
node tests/portfolio.browser.cjs
node tests/portfolio.browser.cjs --admin
```

Backend tests use a fake database. Browser checks use fixture content and an installed Chromium browser. Deployment still needs its real database, Cloudinary account, and final frontend/API origins configured.
