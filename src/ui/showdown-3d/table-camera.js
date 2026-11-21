import * as T from "three";

export function tableCamera(canvas, camera, changed, initialZoom = 1) {
  const turn = new T.Vector3();
  const focus = new T.Vector3(0, 0.62, 1.3);
  const ray = new T.Raycaster();
  const floor = new T.Plane(new T.Vector3(0, 1, 0));
  const touches = new Map();
  let azimuth = 0.34,
    pitch = 0.61,
    zoom = initialZoom,
    press = null;
  let w = 0,
    h = 0;
  const scale = (value, low, high) => T.MathUtils.clamp(value, low, high);
  function fit() {
    const aspect = w / h;
    const spread = Math.max(8.55, 19.02 / aspect) / zoom;
    Object.assign(camera, { left: -spread * aspect, right: spread * aspect, top: spread, bottom: -spread });
    const radius = 51 * Math.cos(pitch);
    turn.set(radius * Math.sin(azimuth), 51 * Math.sin(pitch), radius * Math.cos(azimuth));
    camera.position.copy(focus).add(turn);
    camera.lookAt(focus);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }
  function refresh() {
    if (w && h) {
      fit();
      changed(azimuth, pitch);
    }
  }
  function point(x, y) {
    const box = canvas.getBoundingClientRect();
    ray.setFromCamera(
      new T.Vector2((2 * (x - box.x)) / box.width - 1, 1 - (2 * (y - box.y)) / box.height),
      camera,
    );
    return ray.ray.intersectPlane(floor, new T.Vector3());
  }
  function zoomAt(amount, x, y) {
    if (!w || !h) return;
    const prior = point(x, y);
    zoom = scale(zoom * amount, 0.72, 2.7);
    fit();
    const after = point(x, y);
    if (prior && after) {
      focus.x = scale(focus.x + prior.x - after.x, -15, 15);
      focus.z = scale(focus.z + prior.z - after.z, -7.2, 9.7);
    }
    refresh();
  }
  canvas.addEventListener(
    "wheel",
    (event) => {
      if (!w || !h) return;
      event.preventDefault();
      zoomAt(
        Math.exp(-event.deltaY * (event.ctrlKey ? 0.007 : 0.00155) * (event.deltaMode === 1 ? 16 : 1)),
        event.clientX,
        event.clientY,
      );
    },
    { passive: false },
  );
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("pointerdown", (event) => {
    const pos = { x: event.clientX, y: event.clientY };
    touches.set(event.pointerId, pos);
    canvas.setPointerCapture(event.pointerId);
    press = { ...pos, pan: event.button === 1 || event.button === 2 || event.shiftKey };
    canvas.classList.add("table-drag");
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!press || !touches.has(event.pointerId)) return;
    const previous = touches.get(event.pointerId);
    const pos = { x: event.clientX, y: event.clientY };
    const other = [...touches.entries()].find(([key]) => key !== event.pointerId)?.[1];
    touches.set(event.pointerId, pos);
    if (other) {
      const length = Math.hypot(previous.x - other.x, previous.y - other.y);
      if (length > 3)
        zoomAt(
          Math.hypot(pos.x - other.x, pos.y - other.y) / length,
          (pos.x + other.x) * 0.5,
          (pos.y + other.y) * 0.5,
        );
      return;
    }
    const dx = pos.x - press.x,
      dy = pos.y - press.y;
    if (press.pan) {
      const p0 = point(press.x, press.y),
        p1 = point(pos.x, pos.y);
      if (p0 && p1) {
        focus.x = scale(focus.x + p0.x - p1.x, -15, 15);
        focus.z = scale(focus.z + p0.z - p1.z, -7.2, 9.7);
      }
    } else {
      azimuth -= dx * 0.0094;
      pitch = scale(pitch + dy * 0.0051, 0.44, 1.19);
    }
    press = { ...pos, pan: press.pan };
    refresh();
  });
  function end(event) {
    touches.delete(event.pointerId);
    if (touches.size === 0) {
      press = null;
      canvas.classList.remove("table-drag");
    } else press = { ...[...touches.values()][0], pan: false };
  }
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  function reset() {
    focus.set(0, 0.62, 1.3);
    azimuth = 0.34;
    pitch = 0.61;
    zoom = initialZoom;
    refresh();
  }
  return {
    frame(nextZoom) {
      initialZoom = nextZoom;
      reset();
    },
    resize(width, height) {
      w = width;
      h = height;
      fit();
    },
    key(event) {
      if (event.key === "0") reset();
      else if (event.key.toLowerCase() === "q" || event.key.toLowerCase() === "e") {
        azimuth += event.key.toLowerCase() === "q" ? -Math.PI / 4 : Math.PI / 4;
        refresh();
      } else if (event.key === "+" || event.key === "=" || event.key === "-") {
        zoom = scale(zoom * (event.key === "-" ? 0.84 : 1.19), 0.72, 2.7);
        refresh();
      }
    },
    view() {
      return { azimuth, pitch, zoom };
    },
  };
}
