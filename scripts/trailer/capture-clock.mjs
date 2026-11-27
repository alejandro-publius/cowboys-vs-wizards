// Installed before navigation so callbacks already queued during real-time scene setup survive the handoff.
export function installFrameSampler() {
  const request = window.requestAnimationFrame.bind(window);
  const cancel = window.cancelAnimationFrame.bind(window);
  const callbacks = new Map();
  const animations = new WeakMap();
  const movies = new WeakMap();
  let origin;
  let nextId = 0;

  window.requestAnimationFrame = (callback) => {
    const id = ++nextId;
    const entry = { callback };
    callbacks.set(id, entry);
    if (origin === undefined) {
      entry.native = request((now) => {
        callbacks.delete(id);
        callback(now);
      });
    }
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    const entry = callbacks.get(id);
    if (entry?.native !== undefined) cancel(entry.native);
    callbacks.delete(id);
  };

  async function sampleMovies(elapsed) {
    for (const video of document.querySelectorAll("video")) {
      if (!video.paused) {
        movies.set(video, { at: elapsed, offset: video.currentTime, rate: video.playbackRate });
        video.pause();
      }
      const movie = movies.get(video);
      if (!movie) continue;
      if (!(video.duration > 0 && Number.isFinite(video.duration))) {
        throw new Error("Cannot sample an unready or live video: " + video.currentSrc);
      }
      const seconds = movie.offset + (elapsed - movie.at) * movie.rate / 1000;
      const target = video.loop ? seconds % video.duration : Math.min(seconds, video.duration);
      if (Math.abs(video.currentTime - target) < 0.000001) continue;
      await new Promise((resolve, reject) => {
        const listeners = new AbortController();
        const finish = (event) => {
          listeners.abort();
          if (event.type === "error") reject(new Error("Video seek failed: " + video.currentSrc));
          else resolve();
        };
        video.addEventListener("seeked", finish, { signal: listeners.signal });
        video.addEventListener("error", finish, { signal: listeners.signal });
        video.currentTime = target;
      });
    }
  }

  window.trailerSampler = {
    start() {
      origin = performance.now();
      for (const entry of callbacks.values()) cancel(entry.native);
    },
    async sample(elapsed) {
      const now = performance.now();
      if (origin === undefined || Math.abs(now - origin - elapsed) > 0.5) {
        throw new Error(`Page clock advanced ${now - origin} ms, expected ${elapsed} ms`);
      }
      // Callbacks registered during this batch belong to the next frame.
      for (const id of [...callbacks.keys()]) {
        const entry = callbacks.get(id);
        if (!entry) continue;
        callbacks.delete(id);
        entry.callback(now);
        await Promise.resolve();
      }
      // The document timeline is held from navigation, including during slow shader/font setup.
      for (const animation of document.getAnimations()) {
        const last = animations.get(animation) ?? elapsed;
        animations.set(animation, elapsed);
        if (animation.playState === "running" && elapsed !== last) {
          animation.currentTime = (animation.currentTime ?? 0) + (elapsed - last) * animation.playbackRate;
        }
      }
      await sampleMovies(elapsed);
    },
  };
}
