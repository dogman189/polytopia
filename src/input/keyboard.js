// Central keyboard state. Listens on window; clears on blur/hidden.
// Returns a state object whose pressed keys can be queried via isDown/code and `.keys`.

export function createKeyboardState() {
  const keys = new Set();

  const addValues = (e) => {
    if (e && e.code) keys.add(e.code);
    if (e && typeof e.key === "string" && e.key.length > 0) {
      keys.add(e.key);
      if (e.key.length === 1) keys.add(e.key.toLowerCase());
    }
  };
  const removeValues = (e) => {
    if (e && e.code) keys.delete(e.code);
    if (e && typeof e.key === "string" && e.key.length > 0) {
      keys.delete(e.key);
      if (e.key.length === 1) keys.delete(e.key.toLowerCase());
    }
  };

  function onKeyDown(e) {
    addValues(e);
  }
  function onKeyUp(e) {
    removeValues(e);
  }
  function clear() {
    keys.clear();
  }
  function onBlur() {
    clear();
  }
  function onVisibility() {
    if (document.hidden) clear();
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisibility);

  function hasKey(code) {
    if (keys.has(code)) return true;
    const lowered = String(code).toLowerCase();
    for (const k of keys) {
      if (String(k).toLowerCase() === lowered) return true;
    }
    // common aliases: accept "w" for "KeyW", etc.
    const alias = code && code.length === 1 ? "Key" + String(code).toUpperCase() : null;
    if (alias && keys.has(alias)) return true;
    return false;
  }

  const state = {
    keys,
    isDown(code) {
      return hasKey(code);
    },
    down(code) {
      return hasKey(code);
    },
    clear,
    destroy() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };

  // Allow `state["KeyW"]` style access.
  return new Proxy(state, {
    get(target, prop, receiver) {
      if (Object.prototype.hasOwnProperty.call(target, prop)) {
        return target[prop];
      }
      if (typeof prop === "string") {
        return hasKey(prop);
      }
      return undefined;
    }
  });
}

export default createKeyboardState;