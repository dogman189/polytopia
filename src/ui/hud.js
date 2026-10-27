// In-game HUD overlay for Voxel Coastal City.

export function ensureHUD() {
  if (typeof document === "undefined") return null;
  let hud = document.getElementById("hud");
  if (!hud) hud = document.querySelector("#hud");
  if (!hud) {
    hud = document.createElement("div");
    hud.id = "hud";
    document.body.appendChild(hud);
  }
  return hud;
}

const CONTROL_GUIDE = [
  "WASD walk / steer",
  "Mouse drag camera",
  "Shift sprint (on foot)",
  "E enter / exit vehicle",
  "W throttle · S brake/reverse · A/D steer (driving)"
].join("  ·  ");

export function updateHUD(mode = "onFoot", prompt = "", speed = 0) {
  const hud = ensureHUD();
  if (!hud) return null;

  const safeMode = String(mode || "onFoot");
  const safePrompt = String(prompt || "");
  const safeSpeed = typeof speed === "number" && Number.isFinite(speed) ? speed : 0;
  const modeLabel = safeMode === "driving" ? "Driving" : "On foot";

  hud.innerHTML = "";

  const title = document.createElement("div");
  title.style.fontWeight = "700";
  title.style.marginBottom = "4px";
  title.textContent = "Voxel Coastal City — " + modeLabel;
  hud.appendChild(title);

  const controls = document.createElement("div");
  controls.style.fontSize = "12px";
  controls.style.opacity = "0.9";
  controls.textContent = CONTROL_GUIDE;
  hud.appendChild(controls);

  if (safePrompt) {
    const promptLine = document.createElement("div");
    promptLine.style.marginTop = "6px";
    promptLine.textContent = safePrompt;
    hud.appendChild(promptLine);
  }

  const speedLine = document.createElement("div");
  speedLine.style.marginTop = "6px";
  speedLine.textContent = "Speed: " + safeSpeed.toFixed(1) + " m/s";
  hud.appendChild(speedLine);

  return hud;
}

export default updateHUD;