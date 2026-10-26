// Mouse drag state for follow-camera yaw. Dragging starts on canvas mousedown,
// updates on window mousemove, and releases on mouseup or window blur.

export function createMouseState(canvas) {
  const state = {
    yaw: 0,
    pitch: 0,
    dragging: false,
    sensitivity: 0.005,
    pitchSensitivity: 0.005,
    lastX: 0,
    lastY: 0,
    buttons: 0
  };

  const target = canvas || (typeof window !== "undefined" ? window : null);

  function start(e) {
    if (e && typeof e.button === "number" && e.button !== 0) return;
    state.dragging = true;
    state.lastX = (e && typeof e.clientX === "number") ? e.clientX : 0;
    state.lastY = (e && typeof e.clientY === "number") ? e.clientY : 0;
    state.buttons = (e && typeof e.buttons === "number") ? e.buttons : 1;
    if (canvas && canvas.setPointerCapture && e && e.pointerId != null) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
  }

  function move(e) {
    if (!state.dragging) return;
    const x = (e && typeof e.clientX === "number") ? e.clientX : state.lastX;
    const y = (e && typeof e.clientY === "number") ? e.clientY : state.lastY;
    const dx = x - state.lastX;
    const dy = y - state.lastY;
    state.lastX = x;
    state.lastY = y;
    state.yaw += dx * state.sensitivity;
    // pitch is inverted for natural feel; clamped by consumer if desired.
    state.pitch += dy * state.pitchSensitivity;
  }

  function end() {
    state.dragging = false;
    state.buttons = 0;
  }

  function blur() {
    // Never leave a drag stuck; keep accumulated yaw so camera does not snap.
    state.dragging = false;
    state.buttons = 0;
  }

  if (target) {
    target.addEventListener("mousedown", start);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    window.addEventListener("blur", blur);
  }

  state.reset = function reset() {
    state.yaw = 0;
    state.pitch = 0;
    state.dragging = false;
    state.buttons = 0;
  };

  state.destroy = function destroy() {
    if (target) target.removeEventListener("mousedown", start);
    if (typeof window !== "undefined") {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
      window.removeEventListener("blur", blur);
    }
  };

  return state;
}

export default createMouseState;