# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

AgriSync is a WhatsApp bot acting as a Kenyan "Field Officer" that advises farmers (English/Swahili/Sheng) on agronomy, pest/livestock diagnosis, and market info. It links to WhatsApp via `whatsapp-web.js` (Puppeteer driving WhatsApp Web), generates replies with **Google Gemini**, pulls partner-shop data from Google Sheets, persists per-farmer chat history to disk, and logs every message to a Google Sheet.

This working copy was pulled from the production server (`admin@agrisync.vps.webdock.cloud:~/agrisync-farmers-assistant-v6`). It corresponds to **uncommitted working-tree changes** on top of the last git commit — the live server is running exactly this code, so treat these edits as the source of truth over what's committed.

## Server / deployment

- **Host:** `agrisync.vps.webdock.cloud` (Webdock VPS). Connect with the dedicated key:
  ```bash
  ssh -i ~/.ssh/agrisync_webdock admin@agrisync.vps.webdock.cloud
  ```
  (Note: an older/stale `agrisyclab2.vps.webdock.cloud` name points elsewhere — always use `agrisync.vps.webdock.cloud`.)
- **Process manager:** runs under **PM2** as `agrisync-bot` (Node v20). Common ops on the server:
  ```bash
  pm2 status
  pm2 logs agrisync-bot          # live logs (the console.log/latency/token lines below show up here)
  pm2 restart agrisync-bot       # after deploying code changes
  ```
- **No `rsync` on the server.** To move files, use `tar` over SSH, e.g. pull:
  ```bash
  ssh -i ~/.ssh/agrisync_webdock admin@agrisync.vps.webdock.cloud \
    'cd ~/agrisync-farmers-assistant-v6 && tar czf - --exclude=node_modules --exclude=.wwebjs_auth --exclude=.wwebjs_cache --exclude=agrisync_backup.tar.gz .' \
    | tar xzf - -C .
  ```
- **Git remote:** `origin` → `github.com/k1pyegon/agrisync-farmers-assistant-v6`. Deploying can be done either by `tar`-ing changes up and `pm2 restart`, or committing/pushing and pulling on the server.

## Running locally

No build step, no `start` script. Run from the project root:
```bash
npm install
node index.js        # prints a QR code to scan on first run; session persists in .wwebjs_auth/
```
- **Must run from the project root** — `src/database.js` reads `town_map.json` relative to the process CWD, not `__dirname`.
- There is **no test suite** (`npm test` is a stub that exits 1). The CI workflow runs `npx webpack`, but there's no webpack config, so it's not meaningful.

## Architecture

`index.js` is the entry point and wires everything together. Its `message_create` handler runs in strict order: dedup/loop guard → drop WhatsApp system-message types (`e2e_notification`, `protocol`, `ciphertext`, `call_log`, `gp2`, `broadcast_notification`, `revoked`) and empty messages → `!dm` admin commands → ignore-self → keyword triggers → **enqueue AI task**.

Key structural pieces that span multiple files:

### Async task queue (`index.js`)
AI-bound messages are pushed onto `aiTaskQueue` and drained **sequentially** by `processTaskQueue()`. This serializes the slow Gemini + WhatsApp calls so concurrent messages don't overload the bot or reorder replies. Everything after trigger-checking (typing indicator, media download, history load, Gemini call, reply, logging, history save) happens inside the queued task.

### Gemini dual-brain with failover (`src/ai.js`)
- Uses `@google/generative-ai`. **Primary:** `gemini-2.5-flash`; **Backup:** `gemini-2.5-flash-lite`. If the primary throws, it retries on the backup; if both fail, it returns a Swahili "network trouble" fallback.
- `generateSmartResponse(...)` returns an **object** `{ text, tokens, failed }` (not a string). `index.js` uses this to log latency + token counts and to **save history only when `failed` is false** — failed/fallback replies are not persisted.
- The system prompt is imported from `persona.js` (the persona lives there, not inlined).

### Persistent chat history (`src/history.js`)
- Replaces the old in-memory Map. Reads/writes `chat_history.json` in the project root (`getChatHistory(phone, 6)` / `saveChatMessage(phone, role, text)`). Survives restarts. Capped at 20 messages per farmer; the last 6 are fed to the model as context.
- **The whole JSON file is rewritten on every saved message** — fine at current volume, a bottleneck if traffic grows.

### Live shop data from Google Sheets (`src/shops.js` → `src/database.js`)
- On `ready`, and every 6 hours, `syncShopsFromSheet()` loads the shop directory from a Google Sheet into an in-memory cache (`getShopCache()`).
- `src/database.js`'s `getDatabaseContext(text)` reads from that cache (not from `shops.json` on disk), matches the farmer's town via `town_map.json`, and injects matching partner shops into the prompt with a "MANDATORY: recommend these" header.
- `shops.js` also has a `getNearestShop()` haversine helper, but it is **not wired into the message flow** (no farmer GPS is captured).

### Triggers (`src/triggers.js`) and logging (`src/sheets.js`)
- `checkTriggers` short-circuits the AI for danger words (poison/emergency), support words, and greetings — returning a canned reply.
- `logToSheet(...)` appends every incoming/outgoing message to a Google Sheet. In the updated `index.js` these calls are **fire-and-forget (not awaited)** so logging never blocks a reply.

### Lifecycle
`SIGINT` triggers a graceful shutdown that calls `client.destroy()` to kill the headless Chromium (prevents zombie browser processes across restarts).

## Config & gotchas

- **Two different Google auth mechanisms coexist:** `src/shops.js` uses env vars (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `SHOPS_SHEET_ID`), while `src/sheets.js` (logging) still uses the committed `credentials.json` file **and a hardcoded spreadsheet ID** (`GOOGLE_SHEET_ID` in `.env` is not actually read by it).
- `.env` keys in use: `GEMINI_API_KEY`, `ADMIN_NUMBER`/`ADMIN_PHONE`, `SHOPS_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`. There is **no Anthropic key** — this version is Gemini-only.
- `index.js` calls `getDatabaseContext(msg.body, getShopCache())`, but `database.js` ignores the second argument (it imports `getShopCache` itself). Redundant, harmless.
- The greeting menu (`triggers.js`) invites farmers to send a **voice note**, but `ai.js` rejects audio with a "can't listen yet" fallback — mismatched promise.
- `triggers.js` returns a `logToCsv: true` flag on danger/support hits, but `index.js` never acts on it (no CSV logging path). Dead flag.
- `credentials.json`, service-account keys, and spreadsheet IDs are committed to the repo. `.gitignore` covers `node_modules/`, `.env`, `.wwebjs_auth/`, `.wwebjs_cache/`, `farmer_data.csv`.
- `index.js.save` is a stray editor backup; `agrisync_backup.tar.gz` (~61MB) is a snapshot — neither is part of the app.
- README still says "Gemini 2.0"; the code actually runs Gemini **2.5**.

### Modules present but NOT used by the running bot
`src/labs.js`, `src/users.js`, `src/upload_shops.js`, `src/sync_shops.js` are not imported by `index.js`. `upload_shops.js`/`sync_shops.js` are one-off maintenance scripts (run manually with `node src/…`) that each hardcode their own spreadsheet ID. Editing these has no effect on the live bot.
