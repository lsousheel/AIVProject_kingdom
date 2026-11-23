# Assignment 6: feedback and guided onboarding

## Deployment status

The implementation is complete locally, but **hosted feedback collection is not verified or live** until you configure Supabase, deploy the Vercel function and complete the live checks below. There was no existing backend, database configuration or Supabase credential in this checkout. No real participant reviews have been created.

The game still uses Vite and Three.js. Vercel serves the game and the admin page; a Node function at `/api/feedback` stores reviews in Supabase Postgres. A static ZIP or `vite preview` alone cannot collect server-backed feedback.

## 1. Create the database

1. Create a Supabase project in your account. Store its database password securely.
2. Open **SQL Editor**, create a query, paste the entire contents of [001_feedback.sql](../supabase/migrations/001_feedback.sql), and run it once.
3. Confirm that `kw_feedback` and `kw_feedback_limits` exist. Both have row-level security enabled. Do not add public policies or grant anonymous/authenticated users access.
4. Under project settings / API keys, copy the project URL and the **legacy JWT keys** named `anon` and `service_role`. These are used only by the Vercel function. Never place the service role key in a browser script or a `VITE_` variable.

The SQL creates two service-role-only functions. One atomically inserts a response or recognizes a retry; the other maintains an hourly rate limit across server instances. Limits are 60 new submissions per connection per hour, allowing a classroom's shared Wi-Fi, and 10 sign-in attempts per connection per hour. A honeypot and bounded JSON/text fields provide additional basic spam protection. This is not a CAPTCHA or proof of participant identity.

## 2. Create your administrator account

1. In Supabase **Authentication > Providers**, enable email/password sign-in.
2. Disable new user sign-ups; this study does not need public accounts.
3. Under **Authentication > Users**, use **Add user / Create user** to create your own email/password account. Use a strong unique password, and confirm the email using the dashboard option or the verification email.
4. Copy that user's UUID. Only this exact UUID will be permitted to read reviews, save observation notes or export CSV.
5. If you forget the password, reset it through Supabase's administration/authentication tools. There is deliberately no public admin registration or password-reset form in the game.

The website validates credentials with Supabase Auth on the server. The access token is held in a Secure, HttpOnly, SameSite=Strict cookie, never localStorage. Each read/export/update checks the token with Supabase and checks the allowed UUID. Sessions expire after at most one hour; sign in again. Sign out clears the cookie and requests Supabase logout.

## 3. Configure Vercel

Import/update this repository using the **Vite** preset, build command `npm run build`, output `dist`. Keep the root `api/`, `server/`, `vercel.json`, and migration in source control. Vercel detects `api/feedback.js` as a serverless function. Do not deploy only the contents of `dist`.

Add these variables in **Project Settings > Environment Variables**, then redeploy:

| Variable | Exact value to provide |
| --- | --- |
| `SUPABASE_URL` | Your project's `https://PROJECT_REF.supabase.co` URL |
| `SUPABASE_SERVICE_ROLE_KEY` | The legacy `service_role` JWT key from Supabase |
| `SUPABASE_ANON_KEY` | The legacy `anon` JWT key, used server-side for sign-in |
| `FEEDBACK_ADMIN_USER_ID` | Your administrator's Supabase Auth UUID |
| `FEEDBACK_RATE_SALT` | A random secret of at least 32 characters |
| `APP_ORIGIN` | Your exact public game origin, e.g. `https://kingdom-wars-theta.vercel.app`, no path |
| `FEEDBACK_TEST_MODE` | `true` for your verification deployment; change to `false` and redeploy before real participants |

Generate the rate salt locally with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Never prefix these variables with `VITE_`. The only build value intentionally included in the client is `VERCEL_GIT_COMMIT_SHA`, when Vercel provides it; local builds report `local-development`.

Use a separate Supabase test project for preview/development if possible. Scope Vercel Production and Preview variables deliberately. A preview URL needs its own matching `APP_ORIGIN`; mismatches reject submissions and sign-ins. Use HTTPS in deployment. Keep test mode enabled on previews.

For local API development, copy `.env.example` to `.env.local`, fill the values using a test project, set `APP_ORIGIN=http://127.0.0.1:5173`, and run `npm run dev -- --host 127.0.0.1`. Open that exact origin. Vite's development middleware runs the same handler. Without credentials, it correctly returns 503 and the player can keep their draft for retry.

## 4. Player and administrator access

Players choose **Give Feedback** in the toolbar, even during an unfinished battle. Every victory, defeat or draw also shows a review invitation with **Not now**. The form temporarily pauses the game and restores the previous paused/running state on close.

Open **`https://YOUR-GAME-DOMAIN/admin/feedback`** and sign in with the account created above. Use **Refresh responses**, edit **Private observation notes**, and click **Save notes**. Use **Download CSV** for all rows including notes and tutorial context.

The public admin HTML is only a sign-in shell: it contains no reviews. The API requires the authorized session for all reads, exports and note changes. Responses use no-store caching and are not put into public build files.

CSV includes a UTF-8 BOM for Excel, quoted fields with escaped quotes and preserved newlines, and an apostrophe before formula-like values. Development tests are clearly marked and excluded from statistics. Protect downloaded CSV files as private research data.

The qualifying count uses self-reported outside-group classmates, excludes server-marked tests, and deduplicates case-insensitive trimmed nicknames. The average uses each qualifying nickname's latest rating. Ask classmates to use a consistent, distinct nickname. This is an aid to your observed study, not identity verification. Obtain at least five actual classmates; do not use test submissions as evidence.

## 5. Guided tutorial

The five-scene king's briefing remains available. On a new device, the interactive guide starts after the briefing closes. It has 11 steps: objective, troops, formation, start, class selection, movement, spacing, pause, camera, inspector, and results.

Troop placement, formation changes, starting war, selecting a class, accepted movement orders and spacing changes advance their steps only after real game actions. Invalid orders do not advance. Explanation steps have Next. The guide waits for a result to explain Replay and Give Feedback. An early result jumps to that explanation.

**Skip tutorial** and **Help / Tutorial** are always available. Completion/dismissal and the last step are saved on this device. Restarting the guide starts a new tutorial attempt. Feedback records tutorial state and last step when the form first opens, alongside the phase/outcome, build, level, browser, viewport, server submission time and response ID.

Explanation steps hold simulation without changing the user's pause setting. Action steps allow the game to run; a Resume button appears if the player had paused. Feedback takes priority over the tutorial. Reset, lost selection, demo entry and early outcomes are handled without leaving unusable highlights. Keyboard users can choose **Focus highlighted control**, then use native buttons/selects; the game itself retains its mouse-based movement orders. Reduced motion is respected. The form works on small screens; gameplay remains desktop-first.

Drafts are kept in sessionStorage on that browser tab, not shared with other visitors. Closing/reopening retains answers. A network-uncertain submission is locked so Retry sends exactly the same UUID and payload. The database atomically deduplicates it even when the first response was lost. **Discard draft** starts a new response; do not use it to retry a request whose result is uncertain.

## 6. Required live check before recruiting classmates

1. Deploy with `FEEDBACK_TEST_MODE=true`. Open the game in a private browser, play, open Give Feedback, and submit a nickname such as “DEVELOPMENT TEST — not a participant”.
2. In a separate browser/profile, open `/admin/feedback` and sign in. Confirm that review appears with **DEVELOPMENT TEST**, the right phase/tutorial fields, and a qualifying count of zero.
3. Add an observation note and save. Refresh the admin page, sign out and back in, and confirm the response and note remain.
4. Download the CSV and open it in Excel. Confirm one row for the response, correct accents/newlines, tutorial fields and the private note.
5. In a logged-out browser, request `/api/feedback` and `/api/feedback?action=export`. Confirm 401 and no response data. A different Supabase user must get 403.
6. Submit an incomplete form and confirm it highlights required fields. Simulate offline mode after opening a filled form; submit, restore the network, and retry. Confirm the answers remain and only one row appears.
7. Change `FEEDBACK_TEST_MODE=false` for Production and redeploy. Keep existing development rows marked as tests. Now recruit five outside-group classmates, observe their think-aloud play, and avoid explaining controls unless they are completely stuck. Record assistance in private notes.

If the function reports 503, check all six required configuration values and whether the migration was run. If it reports 403 on submission/sign-in, check the exact origin. If sign-in succeeds in Supabase but this app rejects it, check the allowed user UUID. Do not share the link as a working collection tool before the persistent cross-browser check passes.

## Verification performed locally

- Automated validation, authorization, CSV and statistics tests.
- The migration ran in PGlite (real embedded PostgreSQL): anonymous/authenticated roles were denied, service-role access worked, retries inserted once, quota enforcement worked, and notes/responses survived closing and reopening a database on disk.
- Browser test with the real API handler, the SQL migration in a local PGlite test database and fixture authentication: full first-time guide, skipping, restarting, returning after completion/dismissal, actual action events, spotlight alignment, mobile form, retry after a lost success response, independent player/admin browser contexts, notes persistence on refresh and CSV export.
- No real participants were fabricated. All local fixture submissions are server-marked test records in disposable databases.
- **Not verified:** hosted Supabase Auth, live Vercel function execution, remote cross-browser persistence, and an actual Excel application session. These require your setup and the live checklist above. Local tests do not replace those checks.

Run `npm test` and `npm run build`. For browser tests, install Microsoft Edge, run `npm run dev -- --host 127.0.0.1 --port 5186`, then `npm run test:playtesting` in another terminal. Set `TEST_ORIGIN` to change the test origin. Browser tests intercept only their isolated test contexts; they never submit to the production database.

Implementation references: [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords), [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js).
