# WorthSheet — handoff

Current state of the worthsheet.com rebuild (static Astro 5 site) and what is left before and after the production cutover. The owner (Dominik) writes in Polish; reply in Polish, concise, with screenshots or evidence for visual changes.

## Authoritative sources

- **Code is the spec.** There is no PRD, design spec or README in the repo. Design decisions live in code comments: `src/styles/global.css`, `src/styles/motion.css` and `src/scripts/motion.ts`. Commit messages on `main` are the change log.
- `docs/source/legacy-*.md` are snapshots of the old WordPress site's copy. They are historical reference only.
- `apps-script/Code.gs` is the source of truth for the lead-capture backend. The deployed copy lives in the owner's Google Apps Script project and must be updated by hand (see below).
- Docs are in sync with the code as of this handoff; the only canonical doc is this file.

## Repo and branches

- **Repo:** `ziarnooo/worthsheet` (public), local path `/Users/dominikziarno/Documents/repositories/airlog/wortsheet`.
- **`main`:** deploys automatically to GitHub Pages at https://ziarnooo.github.io/worthsheet/ via `.github/workflows/deploy.yml`.
  - Staging config: `SITE=https://ziarnooo.github.io`, `BASE=/worthsheet`, `PUBLIC_NOINDEX=true`.
- **`v3`:** working branch. `main` is fast-forwarded from it after every verified round.
  - Workflow: edit on `v3` → gates → `git checkout main && git merge --ff-only v3 && git push origin main` → push `v3`.
- **`prod-domain`:** `v3` plus one commit that switches the build to `https://worthsheet.com`, `BASE=/`, indexable, and adds `public/CNAME`.
  - Rebase it on `v3` after every round: worktree `/tmp/ws-prod` (if it was wiped, recreate it with `git worktree add`), then `git rebase v3 && git push -f origin prod-domain`.
  - **Do not merge it until DNS points to GitHub** (see Cutover).
- **`damian-redesign` / PR #1:** Damian's (designer, GitHub `FejdaszDamian`) homepage redesign. It is already merged in spirit into `v3`/`main`. The PR can be closed with a thank-you once the owner agrees.

## Verification gates (run before every push to main)

```sh
npx astro check            # expect 0 errors / 0 warnings
npm run build              # 106 pages, plus 2 redirect pages
node /tmp/audit-dist.mjs dist
```

- `/tmp/audit-dist.mjs` checks broken links, the base prefix, the h1 count, JSON-LD and duplicate titles. If `/tmp` was wiped, recreate it.
- Its h1 and duplicate-title warnings for `/author/worthsheet/` and `/category/uncategorized/` are expected: those two are redirect pages.

Then check visually in the browser at 1440px and 390px. Lighthouse (mobile) was 99–100 performance on every page type and 100 accessibility after the contrast fix:

```sh
npx -y lighthouse@13 <url> --only-categories=performance,accessibility
```

Watch the deploy:

```sh
gh run watch $(gh run list -R ziarnooo/worthsheet --workflow deploy.yml -L 1 --json databaseId -q '.[0].databaseId') -R ziarnooo/worthsheet --exit-status
```

If a Pages deploy gets stuck "in progress", cancel it with `gh api -X POST repos/ziarnooo/worthsheet/pages/deployments/<id>/cancel` and rerun the workflow.

Local services, if they are still running:
- `v3-dev`: `astro dev --port 4402`. It occasionally serves stale component CSS after many edits; restart it.
- `main-preview`: `astro preview --port 4401`, which serves `dist`.

## Design system (v3) — where things live

- **Cards:** every section is a `<Sheet>` (`src/components/Sheet.astro`).
  - Gridded heroes use `<Sheet grid seed={N}>`. The home hero is hand-built in `src/pages/index.astro` with its own `glow` cell list.
  - Glow cells: columns ≥12 render right-anchored (`.right`) and rows ≤-100 render below the sheet (`.below`).
- **Closing CTA:** `src/components/CtaBand.astro` (navy card, variant A).
  - 1300px wide at ≥1332px viewports, with its section grid shifted half a column so the edges land on grid lines.
  - 3 grid rows above and 3 below.
- **Motion:** everything is in `src/scripts/motion.ts` plus `src/styles/motion.css`.
  - Load sequence: plain grid → hero card fade → content → drifting gradient cells. Constants `INTRO_INNER` / `INTRO_DONE` must match `--intro-inner`.
  - Grid drift: `DRIFT_LIT = 16` cells at once and `DRIFT_SEED = 8` already sliding at load. Pools with ≤16 cells stay static.
  - Illustration pieces (`.wsi-pt`) can be pushed by the cursor and dragged/dropped. Opt out with `data-no-push` on the svg.
  - The cursor-revealed iso grid (`[data-cursor-sheet]`) reads pitch and phase from the illustration's grid path. The selectors are structural (IsoTiles, ShieldSecure), so changing those illustrations' markup breaks it.
  - Rules: animate only transform, opacity, filter, background-position and stroke-dashoffset. Easing `cubic-bezier(0.23,1,0.32,1)`. Hover only under `(hover:hover) and (pointer:fine)`. Respect reduced motion. Content must be visible without JS. Never CSS-transform an SVG element that has a `transform` attribute; wrap it in a plain `<g>`.
- **Illustrations:** `src/components/illustrations/*`.
- **OG image:** `public/og/default.png`, 1200×630, rendered from a throwaway HTML page with a headless browser screenshot. Regenerate the same way if the brand changes.
- **Old WordPress URLs:** all are covered; two archive URLs redirect to `/blog/` (`redirects` in `astro.config.mjs`).

## Open items

1. **Production cutover**, blocked on Selden (the site owner) changing DNS.
   - DNS is hosted at **SiteGround**, not GoDaddy (`ns1/ns2.siteground.net`). Email MX records are there too and must not be touched.
   - Requested records: four A records for `@` pointing to `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`; `www` as a CNAME to `ziarnooo.github.io` (delete the old www A record). Keep the MX records and the TXT records (SPF, `google-site-verification`).
   - After DNS resolves:
     1. Merge `prod-domain` → `main`.
     2. Set the custom domain: `gh api -X PUT repos/ziarnooo/worthsheet/pages -f cname=worthsheet.com`.
     3. Once the certificate is issued, enforce HTTPS: `-F https_enforced=true`.
     4. Test the download form, the Sheets `/copy` link, the Excel export, redirects and GA4 Realtime.
2. **Lead notification emails are not being sent.** Rows reach the sheet, but the email fails silently.
   - The fix is already in `apps-script/Code.gs`: errors are logged to an "Errors" tab and `testNotify()` triggers mail authorization.
   - The owner must, in the leads sheet:
     1. Open Extensions → Apps Script and paste the new `Code.gs`.
     2. Run `testNotify` and grant the Gmail permission.
     3. Set the `NOTIFY_EMAILS` script property.
     4. Go to Deploy → Manage deployments → edit the existing deployment → **New version**. The URL stays the same.
   - Unverified until the owner does this.
3. **Pending owner answers:**
   - The privacy-policy contact email; the placeholder `hello@...` is in `src/pages/privacy-policy.astro`.
   - The `NOTIFY_EMAILS` recipients.
   - Closing PR #1.
4. **Google Search Console** (owner or Selden; the domain already has a DNS verification TXT record, so a property likely exists):
   - Get access to it.
   - Remove the old Yoast sitemap `/sitemap_index.xml` and submit `https://worthsheet.com/sitemap-index.xml`.
   - Request indexing for `/`, `/download/`, the calculators, `/banks/` and `/blog/`.
   - Watch the Pages "Not found" report for 2–3 weeks and add redirects for any old WordPress paths that show up (e.g. `/feed/`).
   - No Change of Address is needed (same domain).
5. **Blog posts' og:image:** post pages no longer set their own image. They use the default from `Base.astro`, which has not been verified.

## Last shipped rounds

Everything below is on `main` and deployed; `prod-domain` is rebased on it.
- Mobile menu (`Header.astro`):
  - Open/close motion: burger→× morph, panel fade/slide, row stagger.
  - The CTA (`.nav-cta-wrap`) is pinned to the bottom of the panel (sticky, safe-area padding).
  - The Calculators submenu expands and collapses with animation. It uses `data-open`, not `hidden`, because global `[hidden]` is `display:none !important`.
  - No duplicate CTA inside the submenu.
  - Nav hover pills are gated to fine pointers.
- `body { overflow-x: clip }` plus header `overflow-x: clip` to stop sideways panning on mobile.
- Logo mark cropped to the squares (`viewBox="14 14 36 36"`, 22px) in the Header and Footer.
- Blue ShieldSecure illustration and blue "Why WorthSheet" chip.
- Cursor iso grid: navy lines at `.09` alpha (`SHEET_STROKE`), 260ms in and 1400ms out, synced to the illustration grids.
- Cream page gap below the FAQ card (`#faq` margin-bottom). Reveal stagger is 70ms.

## Experimental branch (not merged)

- `icons-refresh`, in worktree `/tmp/ws-icons`: the iso-tile glyphs (IsoIcon, IsoTiles, StepTile, CtaTiles…) are swapped for a refined open-source set (Lucide, ISC).
- The owner will decide after seeing it. If approved: `git checkout v3 && git merge icons-refresh`, then run the gates and ship. If rejected: delete the branch.

Next session: see **Open items** above. The owner reviews visually and sends screenshots with small tweaks; iterate in rounds on `v3`, then fast-forward `main`.

## Suggested skills

- `checkout-customization`: not relevant here unless the owner adds payments.
- No project-specific skill exists. Use the browser tool (headless tab, 1440px and 390px viewports) for visual verification, and the `task` subagents for parallel page work. Give each file one owner, and have agents skip builds so the orchestrator runs the gates.
