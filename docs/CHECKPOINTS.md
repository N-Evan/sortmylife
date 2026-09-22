# Checkpoints

Newest last. One line each: date — what changed — where. Read this instead of the codebase.

- 2026-08-14 — **v0.1 shipped.** SvelteKit + `node:sqlite`. Three screens (bridge / lists / list), XP+levels,
  streaks with daily quota, cross-off animation + 5s undo, code-drawn pixel sprites, PWA manifest.
  Verified: build passes, all routes 200, API ops + validation + streak banking + undo tested by hand.
- 2026-08-14 — Design decisions worth not re-litigating: no ORM (Node 24 ships `node:sqlite`), no auth
  (Tailscale), no tests yet (user tests manually), mutations go through one `POST /api` op table.

- 2026-08-14 — **P1 shipped** (schema v2). Quick capture → Inbox, life areas, effort estimates
  (5/15/30/60/120m), waiting-on blocking, avoidance clock (`touched_at`, 7+ days), "what should I do
  next?" scoring, focus mode with pause/bank timer, bridge rebuilt into TODAY/CURRENTLY/UPCOMING/
  WAITING/INBOX/AVOIDING. Nav went to 4 slots. Verified: v1→v2 migration on the live DB kept all data;
  ranking, blocking, avoidance and timer math checked by hand.
- 2026-08-14 — Roadmap agreed: **P2** focus polish + Ctrl+K command bar · **P3** projects →
  milestones → tasks, recurring tasks · **P4** calendar (self-contained, no external sync) ·
  **P5** habits + reminders **via Telegram bot** · **P6** weekly reset.

- 2026-08-14 — **P5 shipped** (schema v3). Habits/routines (morning/day/evening slots, weekday masks,
  per-habit streaks, optional targets+units, 7-day heatmap), Telegram reminders (`at` and
  `unless-done` kinds) driven by a 30s scheduler tick, inbound Telegram → Inbox capture, context tags
  (`@home`/`@computer`/`@phone`/`@errand`/`@outside`) with a Bridge filter. Nav went to 5 slots.
  Verified: live DB migrated v2→v3 intact; habit XP awards once and refunds on unlog; streak math
  correct across gaps, grace-day and weekday masks; `unless` reminders self-settle when the habit is
  already logged; invalid contexts/times coerce instead of erroring; scheduler runs without a token
  and doesn't crash the server.

- 2026-08-14 — **Multi-user + P4 shipped** (schema v5). Auth had to land first: it re-scopes every
  table, so building the calendar single-user would have meant rewriting it. Users/sessions/admin
  (scrypt via `node:crypto`, DB sessions, per-username login throttle), first-run `/setup` claim,
  signup/login pages, admin panel (create / delete / disable / reset password / clear data).
  Calendar: day+week grid, overlap packing, task deadlines on the grid, and **available time** —
  free gaps in the 08:00–22:00 window matched against tasks whose effort estimate fits.
  Nav restructured to 5 slots + a MORE sheet, so P2/P3/P6 have somewhere to go.
  Verified: live DB migrated v3→v5, all data owned by user 1, zero orphans; cross-user isolation
  (B cannot read, complete or delete A's task, and gets 404 on A's list); identical login error for
  unknown user vs wrong password; throttle at 8 failures, per-username; admin cannot delete or
  disable itself; disabled and deleted accounts cannot log in; event validation rejects reversed,
  absurd and non-numeric spans; overlap packing and gap math checked by hand.

- 2026-08-14 — **Telegram reworked + page titles** (schema v6). One bot per server: the token moved
  to the reserved `settings.user_id = 0` scope and is admin-only; `tg_chat` stays per user and is the
  only Telegram setting a normal user owns. Admin can also set any user's chat ID from `/admin`.
  Dropped "first chat to message claims the bot" — with multiple users that let the first person to
  message steal the account. The bot now **replies with your chat ID** and you paste it in. Added
  `CHECK BOT` (getMe + getWebhookInfo + pending count) and `DELETE WEBHOOK`. Every route now sets a
  `<title>`; the static one in `app.html` was removed — it rendered before `%sveltekit.head%` and
  won, which is why every tab showed the bare host.
  Verified: live DB migrated v5→v6 with the token relocated to scope 0 and data intact; non-admins
  get 403 on token/diagnose/other-user-chat; chat IDs validated (numeric, negatives for groups) and
  refused when already claimed; token never reaches the client; diagnose returns Telegram's real
  error for a bad token; every page emits exactly one correct title.

- 2026-08-14 — **UI pass: scrollbars, toast, overflow, month view.** No schema change.
  Clockwork scrollbars (toothed track, notched sage thumb) via `::-webkit-scrollbar` plus
  `scrollbar-width/color` for Firefox. Completion toast is a bottom bar on mobile but a
  bottom-right card ≥720px, so it no longer blankets the panel underneath. **Root cause of the
  overflow was `.label { white-space: nowrap }` in `app.css`** — every long label pushed its
  container sideways instead of wrapping; removed and replaced with an opt-in `.nowrap`. Added
  `overflow-wrap: anywhere` on body, `min-width: 0` on direct children of `.row`/`.stack`/`.panel`,
  wrapping `.btn`, and a shared `.field.two` that collapses to one column under 520px.
  Calendar gained a **month view** (6×7 grid, adjacent months dimmed, event chips + deadline flags,
  click a day to drop into it), driven by `?v=day|week|month` in the URL so reloads keep it.
  Verified: all three views 200 and render their own markup, month grid is exactly 42 cells with
  events and deadline flags, prev/next month headings correct, unknown `?v=` falls back to day;
  every CSS rule confirmed present in the built stylesheet with no component-level overrides left.

## Layout rules that keep biting

- Never put `white-space: nowrap` on a shared class. Use `.nowrap` on the one element that needs it.
- Flex and grid children default to `min-width: auto` and refuse to shrink below their content —
  that is what bursts a panel. `.row > *`, `.stack > *` and `.panel > *` are already covered;
  new containers need the same.
- `.truncate` only works if its parent can shrink.
- Two-column form rows: use `class="field two"` and let `app.css` handle the collapse.

## Telegram model (v6)

| Setting | Scope | Who can change it |
|---|---|---|
| `tg_token` | `user_id = 0` (server-wide) | admin only, or `SML_TG_TOKEN` env |
| `tg_offset` | `user_id = 0` | internal — the getUpdates cursor |
| `tg_chat` | per user | the user, or an admin on their behalf |

`poll()` is a single global loop. Each inbound message is routed by chat ID to whichever account
claimed it; an unclaimed chat is told its own ID instead of being bound to anyone. A chat ID can
only belong to one account at a time.

## Auth notes

**Your existing data is now owned by user 1, `admin`, with no password.** The first page load
redirects to `/setup` to claim it — do that before anything else can reach the server.

Session cookie `sml_session`, httpOnly, sameSite=lax, `secure` only when served over HTTPS (so it
still works over plain-http Tailscale). 30-day expiry. Changing a password kills every session.
Signup is **open** to anyone who can reach the server — the tailnet is the perimeter. Admin accounts
cannot be deleted or disabled through the admin panel, deliberately: it removes the way to lock
yourself out. To demote an admin, edit the DB.

## Scoring rules (P1)

`scoreTask` in `game.js`: overdue +100, due ≤24h +60, due ≤72h +30; priority ×10; effort ≤15m +15,
≤30m +8; untouched 7+ days +20. Anything with `waiting_on` set is excluded entirely. Ties break on
smaller effort. `touched_at` updates on create, edit and focus-start — not on merely viewing.

## Reminders (P5)

Scheduler ticks every 30s from `hooks.server.js`. A reminder fires when: enabled, today's weekday bit
is set, `at_time <= now`, and `last_sent_day != today`. `at_time <= now` is deliberate — a reminder
whose moment passed while the PC was off still fires once on the next tick rather than vanishing.
`unless` reminders go quiet (and mark themselves sent) when their task/habit is already done.

Telegram credentials live in the `settings` table so they can be pasted in the UI; `SML_TG_TOKEN` /
`SML_TG_CHAT` env vars override them if set. The token is never sent to the client.

## Not built yet (deliberately)

- **Location-based reminders are not possible** in a web app — no background GPS. Context tags are
  the shipped substitute.
- Reminder time is local-server time with a 30s granularity. No timezone handling — single user,
  single machine.
- Habit targets are informational: logging records the number but nothing enforces hitting it.
- One context per task, not many. Add a join table only if that genuinely bites.
- **Calendar has no external sync** — self-contained by choice. No ICS, no Google, no OAuth.
- No recurring events (recurring *tasks* are P3). No timezone handling; server-local throughout.
- Working window for "available time" is a constant 08:00–22:00 in `calendar.js`. Make it a
  per-user setting when it actually annoys you.
- Login throttle is in-memory, so a restart clears it. Fine on a tailnet; move to the DB if this
  is ever exposed publicly.
- No password reset by email — the admin resets passwords. There is no email in this system at all.
- Combo/cascade multiplier and achievements — user didn't pick them; the CASCADE slot became STREAK.
- Skipped suggestions ("something else") are client-side only and reset on reload. Deliberate.
- Undo on a completed task refunds XP but leaves a banked streak alone.
- The old seed lists `Today` and `Life` still exist alongside the new areas — rename or delete in-app.
- PNG icons — manifest is SVG-only. Add if Android refuses the install prompt.
- Streak shields / grace days. Miss a day and it resets to 0.

- 2026-08-19 — **Themes + declutter.** Five palettes (Clockwork / Moss / Dusk / Harbour / Parchment —
  the last one light) picked in Settings → Appearance. A theme is one block of eight hex values at the
  top of `app.css`; `--line/--line-2/--dim/--tint` are `color-mix`ed off `--bone`/`--sage` so a new
  theme is hex only. Choice lives in `localStorage['sml.theme']` (per device, no migration) and is
  applied to `<html data-theme>` by the inline script in `app.html` before first paint. Every
  hardcoded `rgba()` in the components was converted to `color-mix` on a token — new CSS must use
  tokens or the light theme breaks. Bridge decluttered without dropping anything: the instrument deck
  (field record / countdown / cycle / orbit / status) is now a `<details>` collapsed by default
  (`localStorage['sml.deck']`) whose one-line summary keeps the headline + LVL/streak/quota/countdown,
  and Inbox/Avoiding/Upcoming/Waiting moved into a "Trays" `<details>` under their counts. Always
  visible: capture, headline line, CURRENTLY, context filter, NEXT UP, Routine, Schedule, queue.
  Verified: build passes with no new warnings.

- 2026-08-19 — **Bridge layout pass + 2 more themes.** Fixed: the head comment in `app.html`
  contained a literal `%sveltekit.head%`, so SvelteKit substituted the real head *inside the comment*
  and the tail leaked as visible text on every page — never put a `%sveltekit.*%` token in a comment.
  Bridge is now a two-zone grid: main column (capture, deck, context filter, NEXT UP, queue) and a
  side rail (routine, schedule, trays) that only splits at ≥900px, single column and in reading order
  below that. Deck and trays both default open where the rail exists, collapsed on a phone, each
  remembered in localStorage. The orbit lost its duplicate headline (it lives in the deck summary
  line), shrank, and now sits beside the status panel. `.zone > *` gets `min-width: 0` — grid children
  default to `min-width: auto` and burst the page. `.label` uses `overflow-wrap: break-word` so
  captions stop splitting mid-word ("SCO / RE") when a column tightens; the hudtop only goes 3-up at
  1180px now that it lives in a column. New themes: Matrix (neon green, Courier, phosphor glow) and
  Neon (cyan/purple, console face) — a theme may now override `--mono` and `--glow` too.
  Verified: headless-Chrome screenshots at 390 / 1000 / 1440 in Clockwork, Matrix, Neon and
  Parchment; no horizontal overflow at 390.

- Two more palettes from reference screenshots: Orchid (deep plum / hot pink / mauve) and
  Emerald (near-black green / mint / violet accent). Pure CSS blocks in `app.css` plus two
  lines in `theme.js`; both set `--mono` and `--glow` like Matrix/Neon. Build clean.

- 2026-08-20 — **Bridge rebuilt as NOW / TODAY / REST.** The two previous passes only *collapsed*
  panels; the page still had ten siblings of equal weight and no reading order. Now one column
  capped at 760px: capture → **NOW** (the alarm line + either the live focus session or the single
  top pick with FOCUS/SKIP/DETAILS, plus the context chips that feed the pick) → **TODAY** (one
  chronological agenda merging overdue "LATE" rows, today's events and tasks due today, then the
  habit rings, then one footer line carrying quota dots + ± , LVL, streak, XP and the next-deadline
  countdown) → **REST** (a chip row of counts: inbox / queue / avoiding / waiting / areas; inbox and
  areas are links, the other three take turns in **one** shared drawer of `TaskRow`s, so the landing
  page never shows two lists at once). Deleted from the Bridge: field-record, next-deadline, cycle-dial
  and status panels, the deck and trays `<details>` and their localStorage flags, the separate
  routine/schedule strips, the upcoming tray (the calendar answers "beyond today" now) and the
  standalone queue zone. The **orbit moved to `/lists`** above the area grid — same markup and CSS,
  reached from the `AREAS` chip. **Calendar now defaults to month** (`'day'` → `'month'` in
  `calendar/+page.server.js`); `?v=` still overrides and month-day clicks still drop into day view.
  Verified: build clean, no new warnings.

- 2026-08-20 — **Mobile fixes + NEXT / RECORD / commit-to-today** (schema v7). Four root causes, not
  four patches: (1) touch browsers force-zoom any focused field under 16px → `@media (pointer: coarse)`
  sets inputs to 16px in `app.css`; (2) the keyboard popped because every dialog had `autofocus` on its
  first text field → `openModal()` in `api.js` is now the one entry point, the `<form>` is the dialog's
  focus delegate (`tabindex="-1" autofocus`) and the field is only focused when `(pointer: fine)`;
  (3) dialog buttons wrapped their own labels because `.actions` was a non-wrapping flex row of four
  buttons — one shared `.actions` in `app.css` with `flex-wrap` (the four identical component copies
  are gone), so a phone gets `[DELETE FOCUS] / [CANCEL SAVE]`; (4) the Bridge footer overflowed because
  three `.nowrap` labels shared one flex row — `nowrap` cannot shrink. Quota segments became one
  continuous fill bar; a segment per task was 2px of fill between two 1px borders past a quota of ~8.
  Added: **NEXT** tier (tomorrow + 7-day counts and the three nearest deadlines — the only part of the
  page that looks past midnight), **RECORD** tier (XP bar, level, quota bar + ±, streak, longest — the
  payoff back at a readable size), and **commit to today**: `tasks.planned_day` holds a local day key,
  so the promise expires by itself at midnight. The ★ on any `TaskRow` toggles it via `planToday`
  (server stamps the day, never the client), `scoreTask` gives it +45 so NOW respects what you promised,
  and committed tasks sit under the LATE rows in TODAY as `YOURS`.
  Verified: build clean; live DB copy migrated v6→v7 with `planned_day` present and all rows intact;
  server boots on the migrated copy and serves.

- 2026-09-23 — **Initiatives** (schema v8). `/initiatives` (MORE sheet): standalone cards moving
  idea → pitched → doing → shipped → impact (+ dropped). XP per stage in `game.js` (`STAGE_XP`,
  pitched 40 / impact 50); a stage pays once — its `<stage>_at` stamp is the receipt — and delete
  refunds, so bouncing/deleting can't farm. Reaching IMPACT forces an impact note via the editor.
  COPY FOR REVIEW builds plain text of everything pitched+; falls back to a textarea because
  `navigator.clipboard` is blocked over plain-http Tailscale. Telegram `/idea …` creates an idea
  instead of an Inbox task. Not linked to tasks, deliberately.
  Verified: build clean; live DB copy migrated v7→v8; XP once-per-stage, refund on delete, and
  cross-user isolation asserted in a script; `/idea` regex checked (`/idea@Bot x` ok, `/ideas` not).
