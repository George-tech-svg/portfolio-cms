# George's Portfolio App

A workspace for discovering projects, viewing actual credentials, saving interesting work, and starting a project conversation. Built with HTML, CSS, JavaScript, Express, PostgreSQL, and Cloudinary.

Media uploads live in **Cloudinary**. All structured content, accounts, inquiries, conversations, and media URLs live in **Neon PostgreSQL**.

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

## Recover the owner account

The super user is the single admin account in the `users` table. Passwords are hashed, so reset a forgotten password rather than trying to retrieve it. In a trusted backend terminal with the correct `DATABASE_URL` (or this project's `.env`), run:

```powershell
npm run admin:recover -- --list
npm run admin:recover
```

The first command lists admin usernames. The second asks for the existing username and a new password twice, with password input hidden. Use at least 12 characters (at most 72 UTF-8 bytes). It updates only that account's password and preserves portfolio content. Existing sessions expire normally; recovery does not revoke them. No public password reset endpoint is exposed.

Login now displays invalid credentials separately from server connectivity failures. If the server cannot be reached, check that the API is running, `PUBLIC_API_BASE_URL` points to it, and its `FRONTEND_URL` / `CORS_ORIGINS` include the frontend origin. Local frontend builds read `.env.frontend`; hosting environment settings take priority. Rebuild and redeploy the frontend after changing its API address.

## Verification commands

```powershell
npm test
node tests/portfolio.browser.cjs
node tests/portfolio.browser.cjs --admin
```

Backend tests use a fake database. Browser checks use fixture content and an installed Chromium browser. Deployment still needs its real database, Cloudinary account, and final frontend/API origins configured.
