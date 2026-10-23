# Portfolio verification — 23 October 2026

## Changes

- Project cards, detail summaries, and full project write-ups use the shared green, underlined more/hide controls. Long search previews are compact. Expanding a card does not open the project accidentally.
- Profile and biography save in one database transaction. Photo and CV uploads update only their own profile fields. Failed profile, photo, and skill edits preserve the previous local state.
- Repeated form submissions are guarded. Pending or failed project media cannot silently disappear from a project save. Uploads have a longer client timeout and return actionable errors.
- Project category changes persist. Existing attachments survive edits and category moves, and can be removed explicitly. Partial API edits preserve omitted media; missing projects return 404.
- Welcome-video updates use the actual database row ID. Social-link renames run in a transaction.
- Public data bypasses caches, and another portfolio tab refreshes after a successful admin content update.
- New PDF uploads are checked for public delivery. A blocked PDF produces an actionable error and the unusable new asset is deleted.

## Results

| Check | Result |
| --- | --- |
| Automated backend, API client, deployment, login, and recovery tests | 25 passed |
| Admin browser workflow | Passed: profile, skills, education, experience, categories, certificates, project files, upload failure/retry, and duplicate-submit protection |
| Public browser workflow | Passed: page order, navigation, project cards/details, more/hide, search, saved projects, certificates, chat, contact, and retry |
| Desktop and narrow phone layouts | Passed browser checks, including dark mode |
| Configured PostgreSQL database | Read check passed |
| Hosted API health and configured frontend CORS | Passed |
| Cloudinary credentials | Passed |
| Real temporary PNG, PDF, and text uploads and downloads | Passed; temporary assets deleted |
| Existing published Cloudinary media | All 31 checked URLs passed, including the saved CV PDF |

Cloudinary PDF delivery initially returned HTTP 401. After the owner enabled PDF delivery for product environment `sijo8po5`, the new PDF upload/download check and the existing saved CV check passed.

## Reproduce

```powershell
npm test
node tests/portfolio.browser.cjs
node tests/portfolio.browser.cjs --admin
npm run check:services -- --existing-media
npm run check:services -- --upload
npm run build:frontend
```

Browser tests use fixture data and an installed Chromium browser. Live service checks use configured credentials; database checks only read records. Upload checks create and delete small generated fixtures. Video upload routing is covered by mocked backend tests; a new real video upload was not part of the temporary upload check.

## Deployment

The application fixes are local and require deployment. Deploy the Render backend first, then the Vercel frontend: the updated profile editor uses `/api/profile-content`. The Cloudinary account-setting fix is already effective on existing files. The written biography in `portfolio-content.md` remains a draft and was not automatically imported into production records.
