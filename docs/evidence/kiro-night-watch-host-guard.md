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
