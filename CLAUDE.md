# SortMyLife

Personal gamified todo dashboard. Single user, self-hosted on Windows, reached over Tailscale.
Clockwork-HUD aesthetic + code-drawn pixel art.

## Working agreement

- **Always use superpowers skills** (brainstorming before building, systematic-debugging before fixing).
- **Always use ponytail** (`full`). Laziest solution that works. Stdlib > native platform > existing dep > new dep.
- **Be brief.** Code first, then at most three short lines. No essays, no feature tours.
- **Read `docs/CHECKPOINTS.md` first, not the codebase.** It exists so a new chat can make a small change
  without reading everything. Append a line there whenever you finish something.

## Commands

```
npm run dev      # vite dev --host  → http://localhost:5173, also on LAN/Tailscale
npm run build    # → build/
npm start        # node build/index.js  (PORT env, default 3000)
start.cmd        # build + start, for the Windows box
```

DB file: `data/sortmylife.db` (gitignored). Delete it to reset everything.
Override with `SML_DB=path`.

## Stack

SvelteKit 2 (Svelte 5 runes) + `node:sqlite` (Node 24 builtin — **no ORM, no db dependency**).
No TypeScript, no test framework, no auth (Tailscale is the perimeter).

## Map

| File | What |
|---|---|
| `src/lib/game.js` | All game math: XP, levels, streaks, countdown, effort, task scoring (`rankTasks`/`nextUp`), avoidance clock, focus timer. Pure, no I/O. |
| `src/lib/server/db.js` | Schema + every query. **Every query takes `u` (user id) first and filters on it.** Migrations = append to `MIGRATIONS[]`, never edit a shipped one. |
| `src/lib/server/auth.js` | scrypt hashing, users, sessions, login throttling. |
| `src/hooks.server.js` | Session cookie → `locals.user`, route guarding, first-run `/setup` gate, starts the scheduler. |
| `src/routes/api/+server.js` | The only mutation path. `POST /api {op, ...}` → `OPS` table, each op is `(body, userId, event)`. Validation and authorization live here. |
| `src/routes/calendar/` + `src/lib/calendar.js` | Day/week grid, overlap packing, free-time gaps. `calendar.js` is pure. |
| `src/routes/admin/` | Admin-only account management. Guarded in hooks *and* by `ADMIN_OPS` in the API. |
| `src/lib/api.js` | Client side of the above: `call(op, data)` then `invalidateAll()`. |
| `src/routes/+page.svelte` | BRIDGE — capture box, HUD, orbit, NEXT UP hero, inbox/avoiding/upcoming/waiting strips, queue. Derives everything client-side from `data.open` so it ticks with the clock. |
| `src/routes/focus/` | FOCUS mode — one task, timer ring, pause/bank/done. Holds a wake lock while running. |
| `src/routes/habits/` | Routine — habits grouped by slot, tap-to-log rings, streaks, 7-day heatmap. |
| `src/routes/settings/` | Telegram setup + reminder CRUD. Never returns the bot token to the client. |
| `src/lib/server/scheduler.js` | The only background timer. 30s tick → fire due reminders, poll Telegram. Started once from `src/hooks.server.js`. |
| `src/lib/server/telegram.js` | Bot API wrapper. One server-wide token (`settings.user_id = 0`, admin-only), one `tg_chat` per user. Inbound messages route by chat ID to that user's Inbox; unclaimed chats get told their own ID. `diagnose()` is the "why isn't it working" call. |
| `src/routes/lists/` | Area grid + single area view. Inbox is just a list with `kind='inbox'`. |
| `src/lib/Capture.svelte` | Quick capture. Title only, straight to Inbox, box clears before the request lands. |
| `src/lib/TaskRow.svelte` | A task + the cross-off animation. |
| `src/lib/sprites.js` | 8x8 pixel art as char grids. `src/lib/Sprite.svelte` renders them as SVG rects. |
| `src/lib/theme.js` | Palette list + the two lines that persist the choice. The palettes themselves are CSS at the top of `app.css`. |
| `src/app.css` | Design tokens, clockwork scrollbars, and `.panel`/`.label`/`.btn`/`.bar`/`.field.two` primitives. Page styles stay in components. |

## Conventions

- **Every new query must be user-scoped.** Take `u` as the first parameter and put `user_id = ?` in
  the WHERE clause. A query without it leaks one user's data to another. Ops get `u` from
  `locals.user.id` — never from the request body.
- New feature = add an op to `OPS`, a query to `db.js`, call it with `call()`. Don't add routes for mutations.
- Public ops go in `PUBLIC_OPS`, admin ops in `ADMIN_OPS`. Anything else requires a session.
- **Every page sets its own `<title>` via `svelte:head`.** Do not put one in `app.html` — a static
  title renders before `%sveltekit.head%` and beats every page title.
- New game rule goes in `game.js` as a pure function.
- Colours only from the tokens in `app.css` — never a raw hex or `rgba()`, it breaks the light theme. Uppercase mono labels, `//` as the separator.
- **Never add `white-space: nowrap` to a shared class** — it caused the app-wide overflow. Put
  `.nowrap` on the single element that needs it. New flex/grid containers need `min-width: 0` on
  their children or they will burst their panel.
- Timestamps are epoch ms. Day keys are local-time `YYYY-MM-DD` via `dayKey()`.
