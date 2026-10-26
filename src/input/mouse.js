// Mouse look using the Pointer Lock API: clicking the canvas locks the cursor,
// and moving the mouse updates yaw/pitch continuously until ESC unlocks it.
// When canvas is null (tests/SSR) falls back to a plain state object.
export function createMouseState(canvas) {
  const state = {
    yaw: 0,
    pitch: 0,
    dragging: false,
    sensitivity: 0.0028,
    pitchSensitivity: 0.0028,
    lastX: 0,
    lastY: 0,
    buttons: 0
  };

  if (!canvas || typeof document === "undefined") return state;

  function requestLock() {
    if (document.pointerLockElement !== canvas) {
      try { canvas.requestPointerLock(); } catch (e) { /* ignore */ }
    }
  }

  function onPointerLockChange() {
    state.dragging = document.pointerLockElement === canvas;
    if (!state.dragging) {
      state.buttons = 0;
    }
  }

  function onPointerLockError() {
    state.dragging = false;
  }

  function onMove(e) {
    if (document.pointerLockElement !== canvas) return;
    state.yaw   -= (e.movementX || 0) * state.sensitivity;
    state.pitch += (e.movementY || 0) * state.pitchSensitivity;
    // Clamp pitch in the consumer-friendly range (no pointerlock helper here).
    if (state.pitch < -1.2) state.pitch = -1.2;
    if (state.pitch > 1.2) state.pitch = 1.2;
  }

  // Clicking the canvas requests the lock (first click; subsequent clicks re-lock).
  canvas.addEventListener("click", requestLock);
  document.addEventListener("pointerlockchange", onPointerLockChange);
  document.addEventListener("pointerlockerror", onPointerLockError);
  document.addEventListener("mousemove", onMove);

  state.reset = function reset() {
    state.yaw = 0;
    state.pitch = 0;
    state.dragging = false;
    state.buttons = 0;
  };

  state.destroy = function destroy() {
    try { document.exitPointerLock(); } catch (e) { /* ignore */ }
    canvas.removeEventListener("click", requestLock);
    document.removeEventListener("pointerlockchange", onPointerLockChange);
    document.removeEventListener("pointerlockerror", onPointerLockError);
    document.removeEventListener("mousemove", onMove);
  };

  return state;
}

export default createMouseState;
