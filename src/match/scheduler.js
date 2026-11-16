// Epoch-tagged scheduler: the single entry point for Orb Duel timers,
// animation frames, impact callbacks and CPU requests. Time is injected: the
// caller passes the clock to tick(nowMs) (for example a requestAnimationFrame
// timestamp, or plain numbers in tests). Nothing here calls setTimeout or
// requestAnimationFrame. Call tick once with the current time before
// scheduling, so delays count from that time rather than from 0.
//
// Every entry records the epoch current when it was scheduled. advance()
// starts a new epoch and drops every pending entry, so nothing scheduled for
// an older match runs. guard(fn) gives the same protection to a callback that
// is invoked from outside the scheduler.

// Callbacks run by one tick, including zero-delay chains scheduled during it.
const MAX_RUNS_PER_TICK = 100000;

export function createScheduler() {
  let epoch = 0;
  let now = 0;
  let nextId = 1;
  const timers = new Map(); // id -> { at, epoch, fn }; ids grow, so they also give insertion order
  const frames = new Map(); // id -> { last, epoch, fn }

  // The due timer with the earliest time, then the earliest insertion.
  function nextDue() {
    let found = null;
    for (const [id, timer] of timers) {
      if (timer.at <= now && (found === null || timer.at < found.timer.at)) found = { id, timer };
    }
    return found;
  }

  return {
    epoch: () => epoch,
    now: () => now,

    // Run fn once, `ms` after the current time.
    after(ms, fn) {
      if (!Number.isFinite(ms) || ms < 0) throw new RangeError(`delay must be a finite number >= 0, got ${ms}`);
      if (typeof fn !== "function") throw new TypeError("after needs a callback");
      const id = nextId++;
      timers.set(id, { at: now + ms, epoch, fn });
      return id;
    },

    // Call fn(dtMs, nowMs) on every tick until it returns false. dtMs is the
    // time since the previous call, or since registration for the first one.
    frame(fn) {
      if (typeof fn !== "function") throw new TypeError("frame needs a callback");
      const id = nextId++;
      frames.set(id, { last: now, epoch, fn });
      return id;
    },

    cancel(id) {
      return timers.delete(id) || frames.delete(id);
    },

    // Move the clock to nowMs (never backwards), run due timers in order of
    // time then insertion, including ones that become due during this tick,
    // then call each frame registered before the frame pass began.
    tick(nowMs) {
      if (!Number.isFinite(nowMs)) throw new TypeError(`tick needs a finite time, got ${nowMs}`);
      now = Math.max(now, nowMs);

      let runs = 0;
      for (let due = nextDue(); due !== null; due = nextDue()) {
        timers.delete(due.id);
        if (due.timer.epoch !== epoch) continue;
        if (++runs > MAX_RUNS_PER_TICK) throw new Error(`more than ${MAX_RUNS_PER_TICK} timer callbacks in one tick`);
        due.timer.fn();
      }

      for (const [id, entry] of [...frames]) {
        // Cancelled, or dropped by advance(), while this pass was running.
        if (frames.get(id) !== entry || entry.epoch !== epoch) continue;
        const dt = now - entry.last;
        entry.last = now;
        if (entry.fn(dt, now) === false) frames.delete(id);
      }
    },

    // Start a new epoch: every pending timer and frame is dropped.
    advance() {
      epoch += 1;
      timers.clear();
      frames.clear();
      return epoch;
    },

    pending: () => timers.size + frames.size,

    // Wrap fn so it runs only while the epoch is the one current now.
    guard(fn) {
      const tagged = epoch;
      return (...args) => (epoch === tagged ? fn(...args) : undefined);
    },
  };
}
