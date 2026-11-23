# Security review: Night Shift saloon

Reviewer: one native Kiro CLI agent (model `claude-opus-5.5`) working in the
`12-expert-reviews` worktree. The same agent wrote every review in this panel,
each through a different lens.

Scope: defensive reading of the live transport, the untrusted feed boundary
and the local journal reads that requirements 2.7, 3 and 4.4 define. No
server was started, no request was sent, and nothing was probed. No command
ran in this pass, because the session's shell calls were refused before they
could start. Each result below comes from reading the code. The acceptance
checks name the tests that would prove it.

## S1. Passed reading: the loopback server is read-only, refuses other origins and sends no CORS headers

- **Question:** Does the server meet requirement 3.2 (only same-origin `GET`
  and `HEAD`, a foreign `Host` or cross-origin request refused, no CORS allow
  headers, no writes)?
- **Record:** [`scripts/night-shift-saloon.mjs`](../../../scripts/night-shift-saloon.mjs):
  - `trusted()` refuses any `Host` outside the allowed loopback names on the
    bound port, which blocks DNS rebinding.
  - It refuses an `Origin` other than `http://<that host>`, and a
    `Sec-Fetch-Site` other than `same-origin` or `none`.
  - Methods other than `GET` and `HEAD` get 405.
  - Only `/` and `/night-shift/events` are routed, and everything else gets
    404.
  - `BASE_HEADERS` sets `no-store`, `nosniff`, `X-Frame-Options: DENY`,
    `Referrer-Policy: no-referrer` and `Cross-Origin-Resource-Policy:
    same-origin`. No `Access-Control-Allow-*` header is set.
  - The server listens on `127.0.0.1` only. The build file is opened with
    `O_NOFOLLOW` after an `lstat` that requires a regular file.
- **Exception:** `[::1]:<port>` is also accepted as a Host. It is low risk and
  is recorded in [rules-lawyer-review.md](rules-lawyer-review.md) L3.
- **Status:** answered.
- **Acceptance check:** A server test (port 0) asserts each case:
  - 403 for `Host: evil.test:<port>`;
  - 403 for `Origin: http://evil.test`;
  - 403 for `Sec-Fetch-Site: cross-site`;
  - 405 for `POST /night-shift/events`;
  - 404 for `/../package.json`;
  - no `access-control-allow-origin` header on any response;
  - the journal directory's file list unchanged after the requests.

## S2. Passed reading: every feed record is rebuilt from an allowlist before it reaches state or the DOM

- **Question:** Can an unexpected field or value in the feed reach the page
  (requirements 2.7 and 3.5)?
- **Record:**
  [`src/ui/night-shift-events.js`](../../../src/ui/night-shift-events.js):
  - `cleanEvent`, `cleanPatch` and `cleanActivity` return new objects that
    hold only known keys. They read fields with `hasOwnProperty`, so
    inherited or prototype keys are ignored.
  - `id` matches `^[a-z0-9][a-z0-9-]{0,63}$`, slugs are capped at 48
    characters, `commit` must be 40 hex characters, and `at` must be a real
    UTC calendar time.
  - `cleanList` caps its input at 10,000 items and removes duplicate ids.
  - The client
    ([`night-shift-saloon.js`](../../../src/ui/showdown-3d/night-shift-saloon.js))
    passes the feed through `normalizeFeed` → `cleanFeed`. It writes text
    with `textContent`; its one `innerHTML` is the constant `ROOM_HTML`.
  - Only ids it knows reach the art atlas (`art()` checks `TYPES[id]`).
  - Patch links are built as `COMMIT_BASE + commit` after the 40-hex check.
- **Status:** answered.
- **Acceptance check:** A `cleanFeed` test passes in one payload containing a
  `__proto__` key, an extra `prompt` field, an id with `<`, a 49-character
  slug, the date `2026-02-30T00:00:00Z`, a non-hex commit and 10,001 events.
  It asserts that only valid allowlisted records come out, at most `limit`
  per board, and that the output contains no `prompt` key.

## S3. Passed reading: live mode cannot be switched on from a public page

- **Question:** Can a deployed page be made to poll a feed (requirements 3.3
  and 3.4)?
- **Record:** `shiftMode()` in `night-shift-saloon.js` returns `"live"` only
  when `?saloon=live` is set and `protocol === "http:"` and the hostname is
  in `LOOPBACK` (line 28). Otherwise it returns `"recorded-only"` or
  `"recorded"`.
- **Observed (archived):** [tasks.md](tasks.md) records that on a simulated
  non-loopback HTTPS origin in Chromium, the bundled page made zero feed
  requests.
- **Status:** answered.
- **Acceptance check:** A pure test of `shiftMode` covers
  `https://127.0.0.1/?saloon=live` → `recorded-only`,
  `http://example.test/?saloon=live` → `recorded-only` and
  `http://localhost:4179/?saloon=live` → `live`.

## S4. Untrusted Git state reaches the patch reader; the hardening is in place

- **Question:** Requirement 4.4 says the reader shall not throw, write or
  fetch. Is it hardened against local Git configuration?
- **Record:** [`scripts/saloon-patches.mjs`](../../../scripts/saloon-patches.mjs)
  `GLOBAL_ARGS` (`--no-replace-objects`, `-c protocol.allow=never`,
  `core.fsmonitor=false`, `log.showSignature=false`). Only the full refs
  `refs/remotes/origin/main` and `refs/heads/main` are read. `readMainPatches`
  wraps everything in `try`/`catch` and returns `[]`. The design adds that
  `GIT_*` is cleared and 3 s per call and 6 s total time limits apply.
- **Observed:** On Apple Git 2.39.5, the version recorded in tasks.md,
  `GIT_NO_LAZY_FETCH` has no effect. `protocol.allow=never` is the control
  that blocks fetches, and it is present. The field-trial scripts do not have
  this hardening; see
  [night-shift-repair/security-reviewer-review.md](../night-shift-repair/security-reviewer-review.md)
  S1.
- **Status:** answered for the saloon.
- **Acceptance check:** `node --test tests/match/night-shift-patches.test.js`
  passes. This pass did not run it, so its result is pending. The suite
  should include a temporary repository with a `refs/replace` entry over a
  card blob, and assert that the reported patch uses the original content.
