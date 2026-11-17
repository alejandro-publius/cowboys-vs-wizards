# Night Watch Host guard (issue #68)

Agent: Kiro CLI 3.4.0. Base: main 7ff323f. Files: `apps/night-watch/backend/server.py`, `test_night_watch.py`.

## Change
The standalone server binds 127.0.0.1 but served any Host header. `Handler.parse_request` now returns 403 unless Host is exactly `127.0.0.1:<listen port>` or `localhost:<listen port>` (case-insensitive). Missing Host, other names and wrong or absent ports are refused. The port comes from the socket (`server_address`), so `PORT=0`-style ephemeral ports work. `X-Forwarded-Host` is never read. API prefixes are unaffected.

## Gateway assumption (unverified)
The Crew gateway was not run or inspected. `app.json` declares `"port": "auto"` and a `/health` check. The guard assumes Crew proxies to `127.0.0.1:<port>` or `localhost:<port>` and forwards or sets a matching Host. If Crew forwards the browser's Host (for example the dashboard origin), requests would be refused. That needs a check in a real Crew install, which is pending.

## Results (observed)
- `python3 -m unittest discover -s apps/night-watch/backend -p 'test_*.py'`: 7 tests, OK. New test uses an ephemeral port and a temp `NIGHT_WATCH_DATA_DIR`. Positive: 127.0.0.1 and localhost on `/health`, `/apps/kiroween-night-watch/api/health`, `/api/state`. Negative: `evil.domain`, `evil.domain:<port>`, wrong port, no port, missing Host, and spoofed X-Forwarded-Host, all 403.
- Local smoke (`PORT=48768`, temp data dir, curl): `127.0.0.1:48768` 200, `localhost:48768` 200, `evil.domain` 403, `127.0.0.1:1` 403, API-prefixed `/health` 200, evil Host with X-Forwarded-Host 403.
- Not run: Crew install, scheduler, browser UI, node check (UI untouched).

## Coordinator gateway-compatibility review — November 17, 2026

This is an **additional coordinator check**, not work performed by the earlier Kiro author. I inspected the installed Kiro Crew source on the authorized Mac, specifically `kiro_crew/apps/routes_proxy.py`. In that installed revision, managed-app backend URLs are resolved as `http://127.0.0.1:<port>` (near line 187); the proxy deliberately drops the inbound `Host` header (line 337); and it sends a request to that local backend URL using `aiohttp.ClientSession.request` (near line 432). Consequently, aiohttp normally supplies `Host: 127.0.0.1:<actual port>`, which the standalone guard accepts. This is **static inspection of the installed gateway**, not a live Crew gateway integration run; other versions or proxy setups may differ. Manifest: `apps/night-watch/app.json`, with `backend.port=auto` and `healthCheck=/health`. Public reference: https://kiro.dev/docs/crew/apps/manifest/ .

Fresh local checks in the PR #70 worktree at `41fc0132bbeac456294b67eef5969bea7e83ebfd`:

- `python3 -m unittest discover -s apps/night-watch/backend -p 'test_*.py' -v`: **7 tests, 7 passed**, including valid/invalid Host, actual ephemeral port, API paths and untrusted forwarded Host.
- Separate temporary, loopback-only local HTTP server (not installed, not the live Crew app), with `NIGHT_WATCH_DATA_DIR` pointed at a temporary directory: unsigned direct `GET /health` = **200**; `aiohttp.ClientSession` with an external-looking `X-Forwarded-Host`, but no explicit `Host`, generated `Host: 127.0.0.1:<port>` and returned **200** for `/health`, `/api/state`, and the legacy API-prefixed health path. A request with `Host: evil.invalid` and forged `X-Forwarded-Host: localhost:<port>` returned **403**.
- The first ad hoc smoke attempt failed to load the server module because its test harness omitted the backend directory from `sys.path`. The harness was corrected and rerun successfully. This is not a production-code failure.

**Limits:** No real Crew installation, enabled-app gateway request, authenticated proxy integration, scheduler, UI, POST /run, other device or other Kiro Crew version was exercised. The code closes the narrow Host-header DNS-rebinding finding (#59.6), **not** CSRF protection, proxy HMAC authentication, local-process isolation or all possible browser-origin attacks. Those claims must not be inferred from these tests.
