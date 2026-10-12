/*
 * Neumorphism für Home Assistant: Einstellungen, Formung und Anpassung von allem
 *
 * - Zeigt im Profil unter "Design" alle Einstellungen (Farben, Hintergrund, Effektstärke,
 *   Licht, Oberfläche, Kontrast, Rundung, Schrift, Sektionen, Bewegung, Bereiche, Gerät),
 *   sobald das Theme "Neumorphism" gewählt ist.
 * - Stellt die Karte "custom:neumorphism-color-card" bereit (gleiche Einstellungen).
 * - Wendet die Einstellungen auf das aktive Theme an.
 * - Formt die Bausteine von Home Assistant (Schalter, Schieber, Knöpfe, Reiter,
 *   Eingabefelder, Tabellen ...) erhaben oder eingelassen, damit alles aus einem Guss wirkt.
 * - Alles, was nicht von Home Assistant stammt (eigene Karten, Seiten und Dialoge von
 *   Integrationen, HACS, Oberflächen von Add-ons), wird automatisch erkannt und nach Farbe
 *   und Form eingeordnet, ohne Regeln für einzelne Integrationen oder Add-ons.
 *
 * Gespeichert wird beim Benutzer in den Theme-Einstellungen (primaryColor, accentColor und
 * neumorphism..., siehe USER_KEYS), dort wo Home Assistant auch die Farben des Standard-Themes
 * ablegt, oder nur für dieses Gerät im Browser (DEVICE_KEY). Standard für alle Benutzer und
 * Vorgaben aus Automationen kommen von der Integration (neumorphism/subscribe).
 *
 * Wird von der Integration "Neumorphism" automatisch in das Frontend geladen.
 */

const VERSION = "8.4.0";
const STYLE_ID = "neumorphism-colors";
const PICKER_TAG = "neumorphism-color-picker";
// Diese Variable setzt nur das Neumorphism-Theme. Ist sie leer, ist ein anderes Theme aktiv.
const MARKER_VAR = "--neumorphism-inset-shadow";

const PRESETS = [
  ["Blau", "#3d7bfd"],
  ["Indigo", "#5c6bc0"],
  ["Violett", "#8e6cf0"],
  ["Rosa", "#e5609a"],
  ["Rot", "#e5534b"],
  ["Orange", "#ff8a3d"],
  ["Bernstein", "#f2a922"],
  ["Grün", "#2fb67c"],
  ["Türkis", "#14a7a0"],
  ["Graphit", "#5f7389"],
];

const HEX_RE = /^#[0-9a-f]{6}$/i;
// Effektstärke als Faktor für alle Schatten: 1 ist der Standard, negativ kehrt den Effekt um
// (erhaben wird eingelassen und umgekehrt). Der Regler zeigt -100 bis +100, also Faktor * 50.
const STRENGTH_MAX = 2;
const STRENGTH_SCALE = 50;
// Rundung als Faktor für alle Radien: 1 ist der Standard, 0 eckig. Der Regler zeigt Prozent.
const RADIUS_MAX = 2;
// Schriftgröße als Faktor (Regler in Prozent)
const FONT_SCALE_MIN = 0.85;
const FONT_SCALE_MAX = 1.3;

// ---------------------------------------------------------------------------
// Farbrechnung (sRGB <-> OKLCH), wie im Home-Assistant-Frontend
// ---------------------------------------------------------------------------

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const rgbToHex = (rgb) =>
  "#" + rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0")).join("");
const toLinear = (c) => (Math.abs(c) <= 0.04045 ? c / 12.92 : Math.sign(c) * ((Math.abs(c) + 0.055) / 1.055) ** 2.4);
const fromLinear = (c) =>
  Math.abs(c) <= 0.0031308 ? 12.92 * c : Math.sign(c) * (1.055 * Math.abs(c) ** (1 / 2.4) - 0.055);

function hexToOklch(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(a, bb), Math.atan2(bb, a)];
}

function oklchToLinear(L, C, h) {
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/**
 * Wie im HA-Frontend, aber außerhalb von sRGB wird die Sättigung verringert statt
 * abgeschnitten. So kippt der Farbton bei sehr dunklen oder hellen Stufen nicht.
 */
function oklchToHex(L, C, h) {
  const inGamut = (rgb) => rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4);
  let rgb = oklchToLinear(L, C, h);
  if (!inGamut(rgb)) {
    let low = 0;
    let high = C;
    for (let i = 0; i < 20; i++) {
      const mid = (low + high) / 2;
      if (inGamut(oklchToLinear(L, mid, h))) low = mid;
      else high = mid;
    }
    rgb = oklchToLinear(L, low, h);
  }
  return rgbToHex(rgb.map(fromLinear));
}

/** Stufen 05..95 wie generateColorPalette() im HA-Frontend (Basis = 50). */
function palette(base) {
  const [L, C, h] = hexToOklch(base);
  const shades = {};
  for (const step of [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95]) {
    if (step === 50) {
      shades[step] = oklchToHex(L, C, h);
    } else if (step < 50) {
      const f = step / 50;
      shades[step] = oklchToHex(L * f, C * (0.9 + 0.1 * f), h);
    } else {
      const f = (step - 50) / 45;
      shades[step] = oklchToHex(Math.min(1, L + (1 - L) * f), C * Math.max(0, 1 - f * 0.7), h);
    }
  }
  return shades;
}

const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Textfarbe auf einer Farbfläche, gleiche Regel wie im HA-Frontend. */
function textOn(hex) {
  const l1 = luminance(hex);
  const l2 = luminance("#212121");
  const contrast = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return contrast < 6 ? "#ffffff" : "#212121";
}

function colorVars(primary, accent) {
  const vars = {};
  if (primary) {
    const p = palette(primary);
    Object.assign(vars, {
      "primary-color": primary,
      "light-primary-color": p[80],
      "dark-primary-color": p[40],
      "darker-primary-color": p[30],
      "text-primary-color": textOn(primary),
      "text-light-primary-color": textOn(p[80]),
      "ha-color-on-primary-loud": textOn(p[40]),
    });
    for (const [step, color] of Object.entries(p)) {
      vars[`ha-color-primary-${String(step).padStart(2, "0")}`] = color;
    }
  }
  if (accent) {
    vars["accent-color"] = accent;
    vars["text-accent-color"] = textOn(accent);
  }
  for (const key of ["primary-color", "accent-color", "text-primary-color", "light-primary-color", "dark-primary-color"]) {
    if (vars[key]) vars[`rgb-${key}`] = hexToRgb(vars[key]).map((c) => Math.round(c * 255)).join(", ");
  }
  return vars;
}

// ---------------------------------------------------------------------------
// Einstellungen: Ebenen, Speichern, Anwenden
// ---------------------------------------------------------------------------
//
// Jede Einstellung kommt aus der obersten Ebene, die sie festlegt:
//   Automation (Aktion neumorphism.set_style, gilt für alle)
//   > dieses Gerät (wenn eigene Einstellungen eingeschaltet sind, im Browser gespeichert)
//   > Benutzer (Theme-Einstellungen im Profil, auf allen Geräten des Benutzers gleich)
//   > Standard für alle Benutzer (Integration, vom Administrator festgelegt)
//   > eingebaute Standardwerte

// Jeder Schritt für sich: Ein Fehler in einem Teil soll die anderen nicht aufhalten.
// Die letzten Fehler, für die Diagnose
const recentWarnings = [];

function safely(fn) {
  try {
    return fn();
  } catch (err) {
    console.warn("Neumorphism:", err);
    recentWarnings.push(String(err?.stack || err).slice(0, 300));
    if (recentWarnings.length > 10) recentWarnings.shift();
    return undefined;
  }
}

const normalize = (value) => (typeof value === "string" && HEX_RE.test(value.trim()) ? value.trim().toLowerCase() : "");
const getRoot = () => document.querySelector("home-assistant");
const getHass = () => getRoot()?.hass;
const haDark = () => !!getHass()?.themes?.darkMode;

const clampStrength = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(STRENGTH_MAX, Math.max(-STRENGTH_MAX, number)) : null;
};
const clampRadius = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(RADIUS_MAX, Math.max(0, number)) : null;
};
const clampFontScale = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, number)) : null;
};

// Auswahlwerte, gleiche Namen wie in der Integration (Standard für alle, Aktionen)
const CHOICES = {
  light: ["top_left", "top", "top_right", "sun"],
  surface: ["flat", "convex", "concave"],
  tint: ["standard", "gray", "warm", "sand", "mint", "rose", "blue", "primary"],
  font: ["standard", "round", "modern", "legible"],
  contrast: ["normal", "high"],
  glow: ["on", "off"],
  motion: ["on", "off"],
  sections: ["open", "well", "raised"],
  pressed: ["off", "on"],
  grain: ["off", "fine", "strong"],
  density: ["compact", "normal", "airy"],
  charts: ["theme", "standard"],
  cards: ["full", "frame", "off"],
  apps: ["full", "off"],
};
// Abendmodus: was sich zwischen Sonnenuntergang und Sonnenaufgang ändert
const EVENING_EFFECTS = ["warm", "flat", "dark"];
// Name in den Theme-Einstellungen des Benutzers (wie primaryColor von Home Assistant)
const USER_KEYS = {
  primary: "primaryColor",
  accent: "accentColor",
  strength: "neumorphismStrength",
  light: "neumorphismLight",
  surface: "neumorphismSurface",
  tint: "neumorphismTint",
  radius: "neumorphismRadius",
  font: "neumorphismFont",
  contrast: "neumorphismContrast",
  glow: "neumorphismGlow",
  motion: "neumorphismMotion",
  sections: "neumorphismSections",
  pressed: "neumorphismPressed",
  grain: "neumorphismGrain",
  density: "neumorphismDensity",
  fontScale: "neumorphismFontScale",
  charts: "neumorphismCharts",
  evening: "neumorphismEvening",
  cards: "neumorphismCards",
  apps: "neumorphismApps",
  appsOff: "neumorphismAppsOff",
};
const SETTING_KEYS = Object.keys(USER_KEYS);
const BUILTIN = {
  primary: "",
  accent: "",
  strength: 1,
  light: "top_left",
  surface: "flat",
  tint: "standard",
  radius: 1,
  font: "standard",
  contrast: "normal",
  glow: "on",
  motion: "on",
  sections: "open",
  pressed: "off",
  grain: "off",
  density: "normal",
  fontScale: 1,
  charts: "theme",
  evening: [],
  cards: "full",
  apps: "full",
  appsOff: [],
};
// Was zum Aussehen gehört (Vorlagen, Teilen); Bereiche und Abendmodus bleiben davon unberührt
const STYLE_KEYS = SETTING_KEYS.filter((key) => !["cards", "apps", "appsOff", "evening"].includes(key));

function parseSetting(key, value) {
  if (value === undefined || value === null) return null;
  if (key === "primary" || key === "accent") return normalize(value) || null;
  if (key === "strength") return clampStrength(value);
  if (key === "radius") return clampRadius(value);
  if (key === "fontScale") return clampFontScale(value);
  if (key === "appsOff") return Array.isArray(value) ? value.filter((v) => typeof v === "string") : null;
  if (key === "evening") return Array.isArray(value) ? EVENING_EFFECTS.filter((effect) => value.includes(effect)) : null;
  if (key === "tint" && normalize(value)) return normalize(value); // eigene Farbe
  return CHOICES[key]?.includes(value) ? value : null;
}

/** Gültige Werte einer Ebene; names übersetzt die Schlüssel (Theme-Einstellungen des Benutzers). */
function readLayer(source, names = null) {
  const out = {};
  if (!source || typeof source !== "object") return out;
  for (const key of SETTING_KEYS) {
    const value = parseSetting(key, source[names ? names[key] : key]);
    if (value !== null) out[key] = value;
  }
  return out;
}

// Dieses Gerät: { own: eigene Einstellungen?, settings, mode: "light" | "dark", saver: Sparmodus }
const DEVICE_KEY = "neumorphism-device";
let deviceCache = null;

function device() {
  if (!deviceCache) {
    try {
      const data = JSON.parse(localStorage.getItem(DEVICE_KEY) || "{}");
      deviceCache = data && typeof data === "object" ? data : {};
    } catch {
      deviceCache = {}; // privates Fenster oder gesperrter Speicher
    }
  }
  return deviceCache;
}

function saveDevice(patch) {
  const next = { ...device(), ...patch };
  for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
  deviceCache = next;
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(next));
  } catch {
    // nur für diese Sitzung
  }
}

const saver = () => device().saver === true;

// Von der Integration: Standard für alle Benutzer, Stil pro Dashboard und Vorgaben aus Automationen
const backend = { defaults: {}, style: {}, dashboards: {}, connection: null, available: false };

function subscribeBackend() {
  const connection = getHass()?.connection;
  if (!connection || backend.connection === connection) return;
  backend.connection = connection;
  connection
    .subscribeMessage(
      (message) => {
        backend.defaults = readLayer(message.defaults);
        backend.style = readLayer(message.style);
        backend.dashboards = Object.fromEntries(
          Object.entries(message.dashboards || {}).map(([url, values]) => [url, readLayer(values)])
        );
        backend.available = true;
        tick();
        scheduleReport();
      },
      { type: "neumorphism/subscribe" }
    )
    .catch((err) => {
      // Integration noch nicht bereit: beim nächsten Takt erneut (ohne die Schnittstelle: nie)
      if (err?.code !== "unknown_command") backend.connection = null;
    });
}

const userLayer = (hass = getHass()) => readLayer(hass?.selectedTheme, USER_KEYS);
const deviceLayer = () => (device().own ? readLayer(device().settings) : {});

/** Dashboard der aktuellen Seite (seine Adresse), sonst "". */
function currentDashboard(hass = getHass()) {
  const path = location.pathname.split("/")[1] || "";
  return hass?.panels?.[path]?.component_name === "lovelace" ? path : "";
}

// Sonnenstand aus Home Assistant (Integration "Sonne"), für Abendmodus und Licht nach der Sonne
const sunState = (hass = getHass()) => hass?.states?.["sun.sun"];
const isEvening = (hass = getHass()) => sunState(hass)?.state === "below_horizon";

// Vorschau aus den Einstellungen: Abend jetzt ansehen, Stil eines Dashboards auf dieser Seite zeigen.
// evening und owner: die Einstellungen, die die Vorschau eingeschaltet haben (nur sie schalten sie aus).
const previewState = { evening: null, dashboard: "", owner: null };
const eveningNow = (hass) => !!previewState.evening || isEvening(hass);

/** Abendmodus: wärmer und flacher zwischen Sonnenuntergang und Sonnenaufgang (dunkel: siehe applyDeviceMode). */
function eveningLayer(s, hass) {
  if (!s.evening.length || !eveningNow(hass)) return {};
  const out = {};
  if (s.evening.includes("warm")) out.tint = "warm";
  if (s.evening.includes("flat")) out.strength = Math.round(s.strength * 50) / 100;
  return out;
}

// Vorschau beim Ziehen, bevor der Wert gespeichert ist.
const preview = {};

/**
 * Wohin gespeichert wird: zum Benutzer, nur auf diesem Gerät oder (Administratoren) für ein
 * Dashboard. Ohne Angabe: wie oben im Profil gewählt.
 */
const defaultTarget = () => ({ kind: device().own ? "device" : "user" });

/** Ebenen bis einschließlich des Ziels, also was dort bearbeitet wird. */
function baseSettings(hass = getHass(), target = defaultTarget()) {
  const out = { ...BUILTIN, ...backend.defaults, ...userLayer(hass) };
  if (target.kind !== "user") Object.assign(out, deviceLayer());
  if (target.kind === "dashboard") Object.assign(out, backend.dashboards[target.dashboard] || {});
  return out;
}

/** Was gerade gilt (auf dem angegebenen Dashboard, sonst auf der aktuellen Seite). */
function settings(hass = getHass(), dashboard = previewState.dashboard || currentDashboard(hass)) {
  const s = { ...BUILTIN, ...backend.defaults, ...userLayer(hass), ...deviceLayer(), ...(backend.dashboards[dashboard] || {}) };
  return { ...s, ...eveningLayer(s, hass), ...backend.style, ...preview };
}

/** Gespeicherte Werte der Ebene des Ziels (für "Zurücksetzen"). */
function targetLayer(target, hass = getHass()) {
  if (target.kind === "dashboard") return backend.dashboards[target.dashboard] || {};
  return target.kind === "device" ? readLayer(device().settings) : userLayer(hass);
}

/** Speichert in die Ebene des Ziels. undefined entfernt einen Wert. */
function saveSettings(patch, target = defaultTarget()) {
  const merge = (current) => {
    const next = { ...current };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete next[key];
      else next[key] = value;
    }
    return next;
  };
  if (target.kind === "dashboard") {
    const next = merge(backend.dashboards[target.dashboard]);
    backend.dashboards = { ...backend.dashboards, [target.dashboard]: next };
    return getHass()
      ?.callWS({ type: "neumorphism/set_dashboard", url_path: target.dashboard, settings: next })
      .catch((err) => console.warn("Neumorphism:", err));
  }
  if (target.kind === "device") {
    saveDevice({ settings: merge(device().settings) });
    return undefined;
  }
  const detail = {};
  for (const [key, value] of Object.entries(patch)) detail[USER_KEYS[key]] = value;
  getRoot()?.dispatchEvent(new CustomEvent("settheme", { detail, bubbles: true, composed: true }));
  return undefined;
}

// Lichtrichtung: Versatz der Schatten (der Schatten fällt vom Licht weg) und Winkel der Wölbung
const LIGHTS = {
  top_left: {},
  top: { "neumorphism-light-x": "0", "neumorphism-light-y": "1.3", "neumorphism-light-angle": "180deg" },
  top_right: { "neumorphism-light-x": "-1", "neumorphism-light-y": "1", "neumorphism-light-angle": "225deg" },
};

/**
 * Licht nach der Sonne: morgens (Osten) von links, mittags von oben, abends (Westen) von rechts,
 * höchstens 60° aus der Senkrechten; nachts von oben. In 5°-Schritten, damit nicht ständig neu
 * gezeichnet wird. Ohne Sonne in Home Assistant wie "oben links".
 */
function lightVars(light, hass) {
  if (light !== "sun") return LIGHTS[light] || {};
  const sun = sunState(hass)?.attributes;
  const azimuth = Number(sun?.azimuth);
  if (!Number.isFinite(azimuth)) return {};
  const angle = Number(sun.elevation) < 0 ? 0 : Math.round((Math.sin((azimuth * Math.PI) / 180) * 60) / 5) * 5;
  const rad = (angle * Math.PI) / 180;
  const round = (n) => String(Math.round(n * 100) / 100);
  return {
    "neumorphism-light-x": round(Math.SQRT2 * Math.sin(rad)),
    "neumorphism-light-y": round(Math.SQRT2 * Math.cos(rad)),
    "neumorphism-light-angle": `${180 - angle}deg`,
  };
}

// Hintergrund-Farbton: Farbton (Grad, null = Primärfarbe) und Buntheit im Hell- und Dunkelmodus.
// Helligkeiten bleiben wie im Theme, nur Farbton und Buntheit ändern sich.
const TINTS = {
  gray: [0, 0, 0],
  warm: [75, 0.012, 0.01],
  sand: [85, 0.024, 0.016],
  mint: [170, 0.025, 0.018],
  rose: [15, 0.022, 0.016],
  blue: [255, 0.025, 0.035],
  primary: [null, 0.025, 0.022],
};
const BASE_PALETTE = {
  light: { bg: "#e4e8ef", inset: "#dce1e9", track: "#d5dbe4", thumb: "#f2f4f8", shadowDark: "#a3aec2", shadowLight: "#ffffff" },
  dark: { bg: "#292d35", inset: "#25292f", track: "#22252b", thumb: "#343943", shadowDark: "#0c0d10", shadowLight: "#464d5b" },
};
const rgbTriplet = (hex) => hexToRgb(hex).map((c) => Math.round(c * 255)).join(", ");

/**
 * Eigene Hintergrundfarbe: Farbton und Sättigung der Farbe; hell auch ihre Helligkeit, begrenzt auf
 * einen Bereich, in dem die Schatten noch wirken, dunkel die Helligkeit des Themes. Alle Töne der
 * Palette (Mulden, Spuren, Schatten) werden mitverschoben.
 */
function customPalette(hex, dark) {
  const base = BASE_PALETTE[dark ? "dark" : "light"];
  const [L, C, h] = hexToOklch(hex);
  const [baseL, baseC] = hexToOklch(base.bg);
  const shift = dark ? 0 : Math.min(0.97, Math.max(0.78, L)) - baseL;
  const chroma = Math.min(C, dark ? 0.03 : 0.09);
  const out = {};
  for (const [name, color] of Object.entries(base)) {
    const [Lb, Cb] = hexToOklch(color);
    const c = baseC ? Math.min(0.12, chroma * (Cb / baseC)) : chroma;
    out[name] = oklchToHex(Math.min(1, Math.max(0, Lb + shift)), c, h);
  }
  return out;
}

const isCustomTint = (tint) => typeof tint === "string" && tint.startsWith("#");

function tintPalette(tint, dark, primary) {
  const base = BASE_PALETTE[dark ? "dark" : "light"];
  if (isCustomTint(tint)) return customPalette(tint, dark);
  const spec = TINTS[tint];
  if (!spec) return base;
  const bgChroma = hexToOklch(base.bg)[1];
  const hue = spec[0] === null ? hexToOklch(primary || "#3d7bfd")[2] : (spec[0] * Math.PI) / 180;
  const chroma = spec[dark ? 2 : 1];
  const out = {};
  for (const [name, hex] of Object.entries(base)) {
    const [L, C] = hexToOklch(hex);
    out[name] = oklchToHex(L, bgChroma ? chroma * (C / bgChroma) : chroma, hue);
  }
  return out;
}

function tintVars(tint, dark, primary) {
  if (!TINTS[tint] && !isCustomTint(tint)) return {};
  const p = tintPalette(tint, dark, primary);
  return {
    "primary-background-color": p.bg,
    "card-background-color": p.bg,
    "secondary-background-color": p.inset,
    "rgb-primary-background-color": rgbTriplet(p.bg),
    "rgb-card-background-color": rgbTriplet(p.bg),
    "rgb-secondary-background-color": rgbTriplet(p.inset),
    "neumorphism-track": p.track,
    "neumorphism-thumb": p.thumb,
    "neumorphism-shadow-dark-rgb": rgbTriplet(p.shadowDark),
    "neumorphism-shadow-light-rgb": rgbTriplet(p.shadowLight),
    "mdc-dialog-scrim-color": `rgba(${rgbTriplet(dark ? p.shadowDark : p.bg)}, 0.55)`,
  };
}

// Kontrastmodus: kräftigere Schrift und Linien (Schatten und Kanten regelt das Theme)
const CONTRAST_TEXT = {
  light: ["#1d2330", "#4a5365", "#7f8798"],
  dark: ["#f6f7f9", "#c8cdd6", "#8c93a1"],
};

function contrastVars(dark) {
  const [text, text2, disabled] = CONTRAST_TEXT[dark ? "dark" : "light"];
  const ink = rgbTriplet(text);
  return {
    "neumorphism-contrast": "1",
    "primary-text-color": text,
    "secondary-text-color": text2,
    "disabled-text-color": disabled,
    "rgb-primary-text-color": ink,
    "rgb-secondary-text-color": rgbTriplet(text2),
    "divider-color": `rgba(${ink}, 0.16)`,
    "outline-color": `rgba(${ink}, 0.16)`,
    "ha-color-border-neutral-quiet": `rgba(${ink}, 0.16)`,
  };
}

// Schriften (SIL Open Font License), liegen der Integration bei und werden erst bei Bedarf geladen
const FONTS = {
  round: { family: "Nunito Neumorphism", file: "nunito", weight: "200 1000" },
  modern: { family: "Inter Neumorphism", file: "inter", weight: "100 900" },
  legible: { family: "Atkinson Neumorphism", file: "atkinson-hyperlegible-next", weight: "200 800" },
};
const FONT_SUBSETS = [
  ["latin-ext", "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"],
  ["latin", "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"],
];

function fontFaces(font) {
  const spec = FONTS[font];
  if (!spec) return "";
  return FONT_SUBSETS.map(
    ([subset, range]) =>
      `@font-face { font-family: "${spec.family}"; font-style: normal; font-display: swap; font-weight: ${spec.weight};
  src: url(/neumorphism_static/fonts/${spec.file}-${subset}-wght-normal.woff2) format("woff2"); unicode-range: ${range}; }`
  ).join("\n");
}

function fontVars(font) {
  const spec = FONTS[font];
  if (!spec) return {};
  const stack = `"${spec.family}", Roboto, Noto, sans-serif`;
  return {
    "ha-font-family-body": stack,
    "ha-font-family-heading": stack,
    "mdc-typography-font-family": stack,
    "paper-font-common-base_-_font-family": stack,
  };
}

// Abstände: Faktor für die Abstände von Home Assistant (--ha-space-1 = 4px ...) und das Raster der Sektionen
const DENSITY = { compact: 0.75, airy: 1.25 };

function densityVars(density) {
  const k = DENSITY[density];
  if (!k) return {};
  const px = (n) => `${Math.round(n * k * 10) / 10}px`;
  const vars = {};
  for (let i = 1; i <= 20; i++) vars[`ha-space-${i}`] = px(4 * i);
  vars["ha-section-grid-row-gap"] = px(8);
  vars["ha-section-grid-column-gap"] = px(8);
  vars["ha-view-sections-row-gap"] = px(24);
  vars["ha-view-sections-column-gap"] = px(32);
  return vars;
}

/**
 * Diagramme in Themenfarben: Primär- und Akzentfarbe, dann deren Farbtöne in Schritten von 60°,
 * gleich hell und kräftig, im Dunkelmodus etwas heller.
 */
function chartVars(primary, accent, dark) {
  const [, , h0] = hexToOklch(primary);
  const [, , h1] = hexToOklch(accent);
  const L = dark ? 0.74 : 0.62;
  const vars = { "graph-color-1": primary, "graph-color-2": accent };
  for (let i = 1; i < 6; i++) {
    const turn = (i * Math.PI) / 3;
    vars[`graph-color-${2 * i + 1}`] = oklchToHex(L, 0.14, h0 + turn);
    vars[`graph-color-${2 * i + 2}`] = oklchToHex(L, 0.14, h1 + turn);
  }
  return vars;
}

// Schrift muss lesbar bleiben (WCAG AA: 4,5:1), auf jedem Hintergrund-Farbton und im Kontrastmodus
// die Hauptschrift noch deutlicher (7:1). Zu schwache Farben werden abgedunkelt bzw. aufgehellt.
const THEME_TEXT = { light: ["#3d4657", "#7a8496"], dark: ["#e3e6ec", "#9aa2b1"] };
const contrastRatio = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

function readable(text, bg, ratio, dark) {
  let [L, C, h] = hexToOklch(text);
  let out = text;
  for (let i = 0; i < 60 && contrastRatio(out, bg) < ratio; i++) {
    L = dark ? Math.min(1, L + 0.01) : Math.max(0, L - 0.01);
    out = oklchToHex(L, C, h);
  }
  return out;
}

function readableVars(vars, dark, high) {
  const mode = dark ? "dark" : "light";
  const bg = vars["primary-background-color"] || BASE_PALETTE[mode].bg;
  const out = {};
  [["primary-text-color", high ? 7 : 4.5], ["secondary-text-color", 4.5]].forEach(([name, ratio], i) => {
    const text = vars[name] || THEME_TEXT[mode][i];
    const fixed = readable(text, bg, ratio, dark);
    if (fixed !== text || vars[name]) {
      out[name] = fixed;
      out[`rgb-${name}`] = rgbTriplet(fixed);
    }
  });
  return out;
}

// Farben aus dem Theme, falls im Profil keine eigenen gewählt sind
const THEME_PRIMARY = "#3d7bfd";
const THEME_ACCENT = "#ff8a3d";

/** Alle eigenen Variablen für die aktuellen Einstellungen. */
function settingsVars(s, dark, hass = getHass()) {
  const primary = s.primary || THEME_PRIMARY;
  const vars = colorVars(s.primary, s.accent);
  // Alle Schatten des Themes sind mit dieser Variable multipliziert.
  if (s.strength !== 1) vars["neumorphism-strength"] = String(s.strength);
  Object.assign(vars, lightVars(s.light, hass));
  if (s.radius !== 1) vars["neumorphism-radius"] = String(s.radius);
  if (s.surface !== "flat") vars["neumorphism-surface-image"] = `var(--neumorphism-${s.surface})`;
  Object.assign(vars, tintVars(s.tint, dark, primary));
  if (s.contrast === "high") Object.assign(vars, contrastVars(dark));
  Object.assign(vars, readableVars(vars, dark, s.contrast === "high"));
  Object.assign(vars, fontVars(s.font), densityVars(s.density));
  if (s.fontScale !== 1) vars["ha-font-size-scale"] = String(s.fontScale);
  if (s.charts === "theme") Object.assign(vars, chartVars(primary, s.accent || THEME_ACCENT, dark));
  // Weichgezeichneter Hintergrund hinter Dialogen kostet auf schwachen Geräten viel
  if (saver()) vars["ha-dialog-scrim-backdrop-filter"] = "none";
  return vars;
}

// Körnung: feine Struktur über allem, mischt sich mit Hell und Dunkel der Flächen darunter
const GRAIN = { fine: 0.22, strong: 0.45 };
const grainCss = (grain) =>
  GRAIN[grain]
    ? `html::after { content: ""; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;
  background: url(/neumorphism_static/grain.png) repeat; background-size: 160px; opacity: ${GRAIN[grain]}; mix-blend-mode: soft-light; }`
    : "";

let applied = null;
let appliedVars = {}; // eigene Variablen, auch für eingebettete Seiten
let fontCss = "";

function neumorphismActive() {
  return getComputedStyle(document.documentElement).getPropertyValue(MARKER_VAR).trim() !== "";
}

function applySettings() {
  safely(subscribeBackend);
  safely(applyDeviceMode);
  const active = neumorphismActive();
  const s = settings();
  const dark = haDark();
  setControlsActive(active, s);
  const key = active ? JSON.stringify([s, dark, saver(), s.light === "sun" ? lightVars("sun") : 0]) : "";
  if (key === applied) return;
  applied = key;

  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  appliedVars = active ? settingsVars(s, dark) : {};
  fontCss = active ? fontFaces(s.font) : "";
  // !important schlägt die Inline-Variablen, die Home Assistant für das Theme auf <html> setzt.
  const body = Object.entries(appliedVars)
    .map(([name, value]) => `--${name}: ${value} !important;`)
    .join(" ");
  const grain = active && !saver() ? grainCss(s.grain) : "";
  style.textContent = `${fontCss}\n${body ? `html { ${body} }` : ""}\n${grain}`;
  if (!active) return;
  // Home Assistant färbt <html> beim Theme-Wechsel mit dem Hintergrund (sichtbar beim Überscrollen)
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--primary-background-color").trim();
  if (bg && document.documentElement.style.backgroundColor !== bg) document.documentElement.style.backgroundColor = bg;
  // Statusleiste von Browser und App in der Hintergrundfarbe
  const meta = document.querySelector("meta[name=theme-color]");
  if (bg && meta && meta.getAttribute("content") !== bg) {
    meta.setAttribute("content", bg);
    getHass()?.auth?.external?.fireMessage?.({ type: "theme-update" });
  }
}

/**
 * Fester Hell- oder Dunkelmodus nur für dieses Gerät: Home Assistant wählt den Modus beim
 * Anwenden des Themes aus den Einstellungen des Benutzers. Für dieses Gerät wird dort nur
 * der Modus ersetzt, gespeichert wird nichts.
 */
let modeApplied = ""; // "" = wie im Profil

/**
 * Fester Modus: dieses Gerät, sonst dunkel im Abendmodus, sonst "" (wie im Profil).
 * Nur mit Neumorphism: bei einem anderen Theme gibt es die Einstellung im Profil nicht.
 */
function forcedMode() {
  if (!neumorphismActive()) return "";
  const mode = device().mode;
  if (mode === "light" || mode === "dark") return mode;
  return settings().evening.includes("dark") && eveningNow() ? "dark" : "";
}
function applyDeviceMode() {
  const root = getRoot();
  if (!root || typeof root._applyTheme !== "function") return;
  if (!root.__neumorphismMode) {
    const original = root._applyTheme;
    root._applyTheme = function (...args) {
      scheduleTick(); // Theme, Modus oder Einstellungen des Benutzers geändert (auch von anderen Geräten)
      const mode = forcedMode();
      const selected = this.hass?.selectedTheme;
      if ((mode !== "light" && mode !== "dark") || !this.hass) return original.apply(this, args);
      this.hass.selectedTheme = { ...selected, dark: mode === "dark" };
      try {
        return original.apply(this, args);
      } finally {
        if (this.hass) this.hass.selectedTheme = selected;
      }
    };
    root.__neumorphismMode = true;
  }
  // Auch beim Start: Home Assistant hat das Theme womöglich schon vor diesem Skript angewendet
  const mode = forcedMode();
  if (mode === modeApplied) return;
  modeApplied = mode;
  root._applyTheme(matchMedia("(prefers-color-scheme: dark)").matches);
}

// ---------------------------------------------------------------------------
// Bedienelemente erhaben oder eingelassen formen
// ---------------------------------------------------------------------------

// Bausteine aus dem Theme, skalieren mit der Effektstärke.
const RAISED = "var(--neumorphism-raised-shadow)";
const RAISED_L = "var(--neumorphism-raised-shadow-l)";
// Kleiner Schatten für Pillen in schmalen Leisten (passt in die Leiste, wird nicht abgeschnitten)
const RAISED_S = "var(--neumorphism-raised-shadow-s, var(--neumorphism-raised-shadow))";
const INSET = "var(--neumorphism-inset-shadow)";
const INSET_S = "var(--neumorphism-inset-shadow-s)";
const INSET_L = "var(--neumorphism-inset-shadow-l, var(--neumorphism-inset-shadow))";
const SURFACE = "var(--card-background-color)";
// Gewölbte oder gemuldete Oberfläche erhabener Flächen (Verlauf über der Flächenfarbe), sonst none
const SHEEN = "var(--neumorphism-surface-image, none)";
const PILL = "var(--ha-border-radius-pill, 999px)";
const STRENGTH = "var(--neumorphism-strength, 1)";
// Knopfgruppen liegen über ihrer Tropfenform (siehe updateDroplets).
const GROUP = "position: relative; z-index: 1;";
// Gut sichtbarer Fokus bei Bedienung per Tastatur (die Flächen haben keine Ränder mehr)
const FOCUS = "outline: 2px solid var(--primary-color) !important; outline-offset: 2px;";
// Statt einer Kante läuft der Inhalt unter der Titelleiste weich aus.
const HEADER_BG = "var(--app-header-background-color, var(--primary-background-color))";
const HEADER_FADE = `content: ""; position: absolute; left: 0; right: 0; top: 100%; height: 32px;
  pointer-events: none;
  background: linear-gradient(to bottom, ${HEADER_BG}, color-mix(in srgb, ${HEADER_BG} 65%, transparent) 35%, transparent);`;

// Pro Element (Tag) zusätzliche Regeln für dessen Shadow DOM.
const CONTROL_STYLES = {
  // Knöpfe in Kacheln und Detailansichten (z. B. +/–, Modus, Szenen)
  "ha-control-button": `
    .button { background: ${SURFACE}; background-image: ${SHEEN}; box-shadow: ${RAISED}; }
    .button::before { opacity: max(0, calc((var(--control-button-background-opacity) - 0.2) * 1.25)) !important; }
    .button:not(:disabled):active { box-shadow: ${INSET_S}; }
    .button:focus-visible { ${FOCUS} }
  `,
  // Ein/Aus-Schalter in Kacheln: eingelassene Spur, erhabener Griff
  "ha-control-switch": `
    .switch { box-shadow: ${INSET}; }
    .switch .background { opacity: 0 !important; }
    .switch[checked] .background { opacity: 0.12 !important; }
    .switch .button { background-color: ${SURFACE} !important; background-image: ${SHEEN}; color: var(--secondary-text-color); box-shadow: ${RAISED}; }
    .switch[checked] .button { background-color: var(--control-switch-on-color) !important; color: white; }
    .switch:focus-visible { ${FOCUS} }
  `,
  // Auswahlknöpfe (Modus, Stufen): eingelassene Leiste, gewählte Option erhaben
  "ha-control-select": `
    .container { box-shadow: ${INSET}; border-radius: var(--control-select-border-radius); }
    .container::before { opacity: 0 !important; }
    .option.selected { box-shadow: ${RAISED}; background-image: ${SHEEN}; }
    .option:focus-visible { ${FOCUS} }
  `,
  // Schieber (Helligkeit, Position ...): eingelassene Spur
  "ha-control-slider": `
    .slider { box-shadow: ${INSET}; }
    .slider .slider-track-background { opacity: 0 !important; }
  `,
  // Runder Regler (Thermostat, Luftbefeuchter): erhabener Ring
  "ha-control-circular-slider": `
    svg { filter:
      drop-shadow(calc(3px * ${STRENGTH}) calc(3px * ${STRENGTH}) calc(4px * ${STRENGTH}) var(--neumorphism-shadow-dark))
      drop-shadow(calc(-3px * ${STRENGTH}) calc(-3px * ${STRENGTH}) calc(4px * ${STRENGTH}) var(--neumorphism-shadow-light)); }
    .background { stroke: ${SURFACE} !important; opacity: 1 !important; }
  `,
  // Runde Knöpfe mit Rahmen (z. B. +/– am Thermostat)
  "ha-outlined-icon-button": `
    :host { --md-outlined-icon-button-outline-width: 0px; --md-outlined-icon-button-outline-color: transparent; }
    .icon-button { background: ${SURFACE}; background-image: ${SHEEN}; box-shadow: ${RAISED_L}; }
    .icon-button:active { box-shadow: ${INSET_S}; }
    .icon-button:focus-visible { ${FOCUS} }
  `,
  // Symbol links in Kacheln
  "ha-tile-icon": `
    .container { box-shadow: ${RAISED}; }
  `,
  // Kachel (neuere Versionen): die anklickbare Fläche liegt in ha-tile-container, ältere in der Karte
  "ha-tile-container": `
    .background:focus-visible { ${FOCUS} }
  `,
  "hui-tile-card": `
    .background:focus-visible { ${FOCUS} }
  `,
  // Karten: Wölbung (die Fläche selbst kommt aus dem Theme)
  "ha-card": `
    :host { background-image: ${SHEEN}; }
    :host(:focus-visible) { ${FOCUS} }
  `,
  // Symbole: Leuchten (siehe FEATURE_STYLES) auf dem inneren Symbol, weil der Baustein selbst
  // teils einen eigenen Filter trägt (z. B. Helligkeit einer Lampe)
  "ha-state-icon": `
    ha-icon, ha-svg-icon { filter: var(--nm-icon-glow,); }
  `,
  // Umschalter in Listen und Einstellungen
  "ha-switch": `
    .switch { box-shadow: ${INSET_S}; }
  `,
  // Eingabefelder und Auswahlfelder: eingelassen
  "ha-input": `
    wa-input::part(base) { box-shadow: ${INSET_S}; border-radius: var(--ha-border-radius-lg); }
    :host([appearance="material"]:not(:focus-within)) wa-input::part(base)::after { opacity: 0; }
  `,
  "ha-picker-field": `
    ha-combo-box-item { box-shadow: ${INSET_S}; border-radius: var(--ha-border-radius-lg) !important; }
  `,
  // Hülle jeder Dashboard-Karte; dient nur dazu, eigene Karten zu finden
  "hui-card": "",
  // Seiten in eingebetteten Fenstern (HACS, Add-ons, Webseiten); nur zum Finden
  "ha-panel-custom": "",
  // Design-Einstellungen im Profil; nur zum Finden (siehe injectIntoProfile)
  "ha-theme-settings": "",
  "ha-pick-theme-row": "",
  "ha-panel-app": "",
  "ha-panel-iframe": "",
  "hui-iframe-card": "",
  // Symbol-Knöpfe sind flach, erhaben werden sie erst als Gruppe in der Titelleiste
  // Buttons, die mit Nachbarn eine gemeinsame Form haben (siehe updateButtonGroups)
  "ha-button": `
    :host([appearance="outlined"]) .button { border-color: transparent !important; background-color: ${SURFACE}; background-image: ${SHEEN}; }
    :host([slot="fab"]) .button { box-shadow: ${RAISED_L} !important; }
    :host([neumorphism-merged]) { position: relative; z-index: 1; }
    :host([neumorphism-merged]) .button { box-shadow: none !important; }
    .button:focus-visible { ${FOCUS} }
  `,
  "ha-icon-button": `
    ha-button { --ha-button-box-shadow: none; }
  `,
  // Titelleisten: keine Linie, kein Schatten, Knöpfe rechts als gemeinsame Pille
  "hui-root": `
    .header { box-shadow: none !important; overflow-x: clip; }
    .header::after { ${HEADER_FADE} }
    .edit-mode .header::after { background: linear-gradient(to bottom, var(--app-header-edit-background-color), transparent); }
    .toolbar { border-bottom: none !important; position: relative; }
    .action-items, .toolbar > ha-menu-button, .toolbar > ha-icon-button-arrow-prev, .toolbar > ha-tab-group { ${GROUP} }
  `,
  "ha-top-app-bar-fixed": `
    .row, .sub-row { border-bottom: none !important; }
    .top-app-bar, .top-app-bar.scrolled:not(.pane-header) { box-shadow: none !important; }
    .top-app-bar { overflow-x: clip; }
    .top-app-bar::after { ${HEADER_FADE} }
    #actions, #navigation { position: relative; }
    #actions slot[name="actionItems"], slot[name="navigationIcon"] { display: flex; align-items: center; ${GROUP} }
  `,
  "hass-subpage": `
    .toolbar { position: relative; z-index: 2; overflow-x: clip; }
    .toolbar::after { ${HEADER_FADE} }
    .toolbar-content { border-bottom: none !important; position: relative; }
    slot[name="toolbar-icon"] { display: flex; align-items: center; ${GROUP} }
    .toolbar-content > ha-menu-button, .toolbar-content > ha-icon-button-arrow-prev { ${GROUP} }
  `,
  "hass-tabs-subpage": `
    .toolbar { border-bottom: none !important; position: relative; z-index: 2; overflow-x: clip; }
    .toolbar::after { ${HEADER_FADE} }
    .toolbar-content, #toolbar-icon { position: relative; }
    #toolbar-icon slot[name="toolbar-icon"] { display: flex; align-items: center; ${GROUP} }
    .toolbar-content > ha-menu-button, .toolbar-content > ha-icon-button-arrow-prev { ${GROUP} }
  `,
  // --- Seiten von Home Assistant: Einstellungen, Werkzeuge, Listen, Kalender ...
  // Reiter: der gewählte als erhabene Pille statt Unterstrich
  "ha-tab": `
    div { isolation: isolate; }
    :host(:not([narrow])[active]) div { border-bottom: none !important; }
    :host([active]) div::after { content: ""; position: absolute; inset: 9px 8px; z-index: -1;
      border-radius: ${PILL}; background: ${SURFACE}; background-image: ${SHEEN}; box-shadow: ${RAISED_S}; }
    :host([narrow][active]) div::after { inset: 7px 4px; border-radius: 18px; }
  `,
  "ha-tab-group": `
    :host { --track-color: transparent !important; --indicator-color: transparent !important; }
    .indicator { display: none !important; }
    /* Waagrechte Reiterleisten scrollen nur seitlich, nie senkrecht (auch nicht bei Rundungsfehlern) */
    .tab-group-top .nav, .tab-group-bottom .nav { overflow-y: hidden !important; }
    /* Home Assistant blendet die Enden mit einer Fläche in Hintergrundfarbe aus; die legt sich als
       Streifen über Schatten und Tropfenform. Stattdessen blenden die Reiter selbst weich aus. */
    .scroll-button { background: none !important; }
    /* Reiter laufen an den Enden weich aus statt an einer harten Kante */
    .tab-group-top .nav, .tab-group-bottom .nav {
      -webkit-mask-image: linear-gradient(to right, transparent, #000 14px, #000 calc(100% - 14px), transparent);
      mask-image: linear-gradient(to right, transparent, #000 14px, #000 calc(100% - 14px), transparent); }
  `,
  // Die Pille liegt in der Reiterfläche, ohne sie zu vergrößern: sonst wird die Reiterleiste
  // höher als die Titelleiste, lässt sich verschieben und schneidet den Schatten ab.
  "ha-tab-group-tab": `
    .tab { position: relative; isolation: isolate; }
    :host([active]) .tab::before { content: ""; position: absolute; inset: 9px 2px; z-index: -1;
      border-radius: ${PILL}; background: ${SURFACE}; background-image: ${SHEEN}; box-shadow: ${RAISED_S}; }
    /* In der Titelleiste gehört die Pille zur Tropfenform der Knöpfe (siehe headerTabsGroup) */
    :host([neumorphism-header][active]) .tab::before { display: none; }
    .tab:focus-visible { ${FOCUS} border-radius: ${PILL}; }
  `,
  // Filter- und Auswahl-Chips: erhaben statt umrandet
  "ha-assist-chip": `
    :host([appearance="outlined"]) .button { border-color: transparent !important; background-color: ${SURFACE}; background-image: ${SHEEN}; box-shadow: ${RAISED}; }
    /* ältere Fassung (z. B. in HACS) */
    .container:has(> .outline) { background: ${SURFACE}; box-shadow: ${RAISED}; }
    .outline { border-color: transparent !important; }
  `,
  // Aufklappbare Abschnitte mit Rahmen: erhaben statt umrandet
  "ha-expansion-panel": `
    :host([outlined]) { border-color: transparent !important; background: ${SURFACE}; background-image: ${SHEEN}; box-shadow: ${RAISED}; }
    .top.focused { background: transparent; }
  `,
  // Ältere umrandete Eingabefelder (z. B. die Suche in HACS): eingelassen
  "ha-outlined-field": `
    .field:not(.focused):not(.error) .outline { opacity: 0; }
    .container-overflow { box-shadow: ${INSET_S}; }
  `,
  // Code-Editor: eingelassen
  "ha-code-editor": `
    .cm-editor { border-radius: var(--ha-border-radius-lg, 12px) !important; box-shadow: ${INSET}; overflow: hidden; }
    .cm-gutters, .code-editor-toolbar { background: transparent !important; }
    :host(.hasToolbar) .cm-content { border-top-color: var(--divider-color) !important; }
  `,
  // Tabellen: Zeilen flach, ausgewählte Zeilen eingelassen
  "ha-data-table": `
    .mdc-data-table__row--selected { background: transparent !important; box-shadow: ${INSET_S}; }
  `,
  // Gewählter Eintrag in Listen und Menüs (To-do-Listen, Sortierung ...): eingelassen
  "ha-dropdown-item": `
    :host([selected]) { background-color: transparent !important; box-shadow: ${INSET_S}; }
  `,
  "ha-list-item": `
    :host([activated]) { background: transparent !important; box-shadow: ${INSET_S}; border-radius: var(--ha-border-radius-md, 8px); }
    :host([activated]) .fake-activated-ripple::before { opacity: 0 !important; }
  `,
  // Gewählter Eintrag in der Seitenleiste: eingelassen
  "ha-sidebar": `
    ha-list-item-button.selected { box-shadow: ${INSET_S}; border-radius: var(--ha-border-radius-md); }
    ha-list-item-button.selected::before { opacity: 0 !important; }
  `,
};

// Zuschaltbare Teile (Einstellungen im Profil), pro Element wie CONTROL_STYLES.
const GLOW_ICON = "drop-shadow(0 0 5px color-mix(in srgb, currentColor 70%, transparent))";
const NOT_UNKNOWN = ':not([data-state="unavailable"]):not([data-state="unknown"])';
const motion = (css) => `@media (prefers-reduced-motion: no-preference) { ${css} }`;
const FEATURE_STYLES = {
  // Aktive Geräte leuchten sanft in ihrer Zustandsfarbe
  glow: {
    "hui-tile-card": `ha-card.active { --nm-glow-color: var(--tile-color); }`,
    "ha-tile-icon": `.container { box-shadow: ${RAISED},
      0 0 18px 2px color-mix(in srgb, var(--nm-glow-color, transparent) 50%, transparent); }`,
    "hui-entity-badge": `ha-badge.active { --nm-icon-glow: ${GLOW_ICON}; }`,
    // Schaltfläche und Zeilen: die Zustandsfarbe aktiver Geräte verweist nicht auf "inactive"
    "hui-button-card": `ha-card[style*="--state-color"]:not([style*="inactive"]) ha-state-icon${NOT_UNKNOWN} { --nm-icon-glow: ${GLOW_ICON}; }`,
    "state-badge": `ha-state-icon[style*="color"]:not([style*="inactive"])${NOT_UNKNOWN} { --nm-icon-glow: ${GLOW_ICON}; }`,
    "ha-control-switch": `.switch[checked] .button { box-shadow: ${RAISED},
      0 0 14px 1px color-mix(in srgb, var(--control-switch-on-color) 55%, transparent); }`,
  },
  // Drücken sinkt ein, Wechsel gleiten statt zu springen
  motion: {
    "ha-control-button": motion(`.button { transition: box-shadow 180ms ease, transform 140ms ease; }
      .button:not(:disabled):active { transform: scale(0.96); }`),
    "ha-control-switch": motion(`.switch .button { transition: transform 180ms ease-in-out, box-shadow 240ms ease, background-color 240ms ease !important; }`),
    "ha-control-select": motion(`.option { transition: box-shadow 240ms ease, background-color 240ms ease, color 240ms ease; }`),
    "ha-outlined-icon-button": motion(`.icon-button { transition: box-shadow 160ms ease, transform 120ms ease; }
      .icon-button:active { transform: scale(0.95); }`),
    "ha-button": motion(`.button { transition: box-shadow 160ms ease, transform 120ms ease, background-color 160ms ease; }
      :host(:not([disabled])) .button:active { transform: scale(0.97); box-shadow: ${INSET_S} !important; }`),
    "hui-tile-card": motion(`ha-card { transition: box-shadow 220ms ease, transform 160ms ease; }
      ha-card:has(> .background:active) { transform: scale(0.985); box-shadow: ${RAISED_S}; }`),
    // Kachel drücken: die Fläche sinkt ein (Bedienelemente der Kachel bleiben ausgenommen)
    "ha-tile-container": motion(`.background { transition: box-shadow 180ms ease; }
      .background:active { box-shadow: ${INSET_S}; }`),
    "hui-button-card": motion(`ha-card { transition: box-shadow 220ms ease, transform 160ms ease; }
      ha-card:active { transform: scale(0.97); box-shadow: ${INSET}; }`),
    "ha-tile-icon": motion(`.container { transition: box-shadow 300ms ease; }`),
    "ha-switch": motion(`.switch { transition: box-shadow 200ms ease; }`),
    "ha-tab-group-tab": motion(`:host([active]) .tab::before { animation: nm-pill 260ms ease-out; }
      @keyframes nm-pill { from { opacity: 0; transform: scale(0.85); } }`),
    "ha-tab": motion(`:host([active]) div::after { animation: nm-pill 260ms ease-out; }
      @keyframes nm-pill { from { opacity: 0; transform: scale(0.85); } }`),
    "ha-sidebar": motion(`ha-list-item-button { transition: box-shadow 200ms ease; }`),
    "ha-list-item": motion(`:host { transition: box-shadow 200ms ease; }`),
    "ha-dropdown-item": motion(`:host { transition: box-shadow 200ms ease; }`),
  },
  // Sektionen eines Dashboards als Mulden, die Karten liegen erhaben darin
  wells: {
    "hui-sections-view": `
      .section > .section-container { padding: var(--ha-space-3, 12px); box-shadow: ${INSET_L};
        border-radius: calc(var(--ha-card-border-radius, 28px) + var(--ha-space-3, 12px)); }`,
  },
  // Zustand als Tiefe: eingeschaltete Geräte gedrückt (eingelassen), ausgeschaltete erhaben
  pressed: {
    "hui-tile-card": `ha-card.active { --ha-card-box-shadow: ${INSET_L}; }`,
    "hui-button-card": `ha-card[style*="--state-color"]:not([style*="inactive"]):not([style*="unavailable"]) { --ha-card-box-shadow: ${INSET_L}; }`,
    "hui-entity-badge": `ha-badge.active { --ha-card-box-shadow: ${INSET}; }`,
  },
  // Diagramme: Fläche eingelassen (die Farben setzt chartVars)
  charts: {
    "ha-chart-base": `.chart-container { box-shadow: ${INSET_S}; border-radius: var(--ha-border-radius-lg, 12px); }`,
  },
  // Sektionen als herausgehobene Platten, die Karten liegen erhaben darauf
  plates: {
    "hui-sections-view": `
      .section > .section-container { padding: var(--ha-space-3, 12px);
        background-color: ${SURFACE}; background-image: ${SHEEN}; box-shadow: var(--neumorphism-card-shadow);
        border-radius: calc(var(--ha-card-border-radius, 28px) + var(--ha-space-3, 12px)); }`,
  },
};

const supportsSheets =
  typeof CSSStyleSheet !== "undefined" &&
  "replaceSync" in CSSStyleSheet.prototype &&
  "adoptedStyleSheets" in Document.prototype;
// Stylesheets lassen sich nur im eigenen Dokument verwenden, deshalb je Dokument
// (Hauptfenster, HACS, Add-ons ...) ein eigener Satz.
const sheetSets = new Map(); // Dokument -> Map(Tag -> Stylesheet)
let controlsActive = false;

function controlSheet(tag, doc = document) {
  let sheets = sheetSets.get(doc);
  if (!sheets) {
    sheets = new Map();
    sheetSets.set(doc, sheets);
  }
  let sheet = sheets.get(tag);
  if (!sheet) {
    sheet = new doc.defaultView.CSSStyleSheet();
    sheet.replaceSync(controlCss(tag));
    sheets.set(tag, sheet);
  }
  return sheet;
}

function adoptControlStyle(root, tag) {
  if (!root || !root.adoptedStyleSheets || !root.ownerDocument?.defaultView) return;
  const sheet = controlSheet(tag, root.ownerDocument);
  if (!root.adoptedStyleSheets.includes(sheet)) {
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  }
}

let activeFeatures = [];
let controlsKey = "";

function controlCss(tag) {
  if (!controlsActive) return "";
  return [CONTROL_STYLES[tag] || "", ...activeFeatures.map((name) => FEATURE_STYLES[name][tag] || "")].join("\n");
}

const FEATURE_ON = {
  glow: (s) => s.glow === "on",
  motion: (s) => s.motion === "on" && !saver(),
  pressed: (s) => s.pressed === "on",
  charts: (s) => s.charts === "theme",
  wells: (s) => s.sections === "well",
  plates: (s) => s.sections === "raised",
};

/** Ein gemeinsames Stylesheet pro Element: neu füllen genügt, um alles umzuschalten. */
function setControlsActive(active, s) {
  const features = active ? Object.keys(FEATURE_STYLES).filter((name) => FEATURE_ON[name](s)) : [];
  const key = `${active}|${features.join(",")}`;
  if (key === controlsKey) return;
  controlsKey = key;
  controlsActive = active;
  activeFeatures = features;
  for (const [doc, sheets] of sheetSets) {
    if (doc !== document && !doc.defaultView) {
      sheetSets.delete(doc); // Fenster geschlossen
      continue;
    }
    for (const [tag, sheet] of sheets) sheet.replaceSync(controlCss(tag));
  }
}

function findAllDeep(selector, doc = document) {
  const found = [];
  const stack = [doc];
  while (stack.length) {
    const node = stack.pop();
    found.push(...node.querySelectorAll(selector));
    for (const el of node.querySelectorAll("*")) {
      if (el.shadowRoot) stack.push(el.shadowRoot);
    }
  }
  return found;
}

/**
 * Home Assistant hängt Seiten und Ansichten beim Zurückkehren wieder ein, ohne sie neu zu bauen.
 * Damit sich solche Elemente dann wieder melden, bekommen sie einen Lit-Controller; so können
 * abgehängte Elemente sofort vergessen werden (kein Speicher für längst geschlossene Seiten).
 */
function watchReconnect(el, tag) {
  if (el.__neumorphismReconnect || typeof el.addController !== "function") return;
  el.__neumorphismReconnect = true;
  el.addController({ hostConnected: () => trackHost(el, tag) });
}

/** Abgehängte Elemente vergessen; ohne Controller (siehe oben) erst ab limit Einträgen. */
function forgetDetached(collection, limit, onForget) {
  for (const el of collection.keys()) {
    if (el.isConnected || (!el.__neumorphismReconnect && collection.size <= limit)) continue;
    collection.delete(el);
    onForget?.(el);
  }
}

/** Merkt sich Elemente, die später noch bearbeitet werden (Tropfen, Karten, eingebettete Seiten). */
function trackHost(el, tag) {
  watchReconnect(el, tag);
  if (DROPLET_GROUPS[tag]) {
    dropletHosts.set(el, tag);
    layoutObserver?.observe(el); // Titelleiste breiter oder schmaler (z. B. Seitenleiste): neu zeichnen
  }
  if (tag === "ha-button") buttonHosts.add(el);
  if (tag === "hui-card") cardHosts.add(el);
  if (FRAME_HOSTS.includes(tag)) frameHosts.add(el);
  // Neue Seite, neuer Dialog, neue Karte ...: einmal alles prüfen
  if (DROPLET_GROUPS[tag] || tag === "ha-button" || tag === "hui-card" || FRAME_HOSTS.includes(tag) || PROFILE_TAGS.includes(tag)) {
    scheduleTick();
  }
}

/**
 * Hängt das Stylesheet an alle vorhandenen und künftigen Exemplare eines Elements.
 * Lifecycle-Callbacks liest der Browser nur bei der Registrierung, deshalb wird
 * createRenderRoot erweitert: Lit ruft es für jedes neue Exemplar auf.
 * Gilt für das Hauptfenster und für eingebettete Seiten mit eigenen Bausteinen (HACS).
 */
function patchControls(win = window) {
  if (!supportsSheets || win.__neumorphismPatched) return;
  win.__neumorphismPatched = true;
  const tags = new Set([...Object.keys(CONTROL_STYLES), ...Object.values(FEATURE_STYLES).flatMap(Object.keys)]);
  // Schon vorhandene Exemplare: alle gerade registrierten Bausteine in einem Durchgang durch die Seite
  const found = new Set();
  const collect = () => {
    const batch = [...found];
    found.clear();
    for (const el of findAllDeep(batch.join(","), win.document)) {
      adoptControlStyle(el.shadowRoot, el.localName);
      trackHost(el, el.localName);
    }
  };
  for (const tag of tags) {
    if (tag.startsWith("__")) continue;
    win.customElements.whenDefined(tag).then(() => {
      const proto = win.customElements.get(tag).prototype;
      const original = proto.createRenderRoot;
      if (typeof original === "function" && !Object.prototype.hasOwnProperty.call(proto, "__neumorphismPatched")) {
        proto.createRenderRoot = function () {
          const root = original.call(this);
          adoptControlStyle(root, tag);
          trackHost(this, tag);
          return root;
        };
        proto.__neumorphismPatched = true;
      }
      if (!found.size) queueMicrotask(() => safely(collect));
      found.add(tag);
    });
  }
}

// ---------------------------------------------------------------------------
// Knopfgruppen in der Titelleiste: wie zusammenlaufende Tropfen
// ---------------------------------------------------------------------------

// Wo in den Titelleisten Knöpfe liegen: rechts die Aktionen, links Menü oder Zurück.
const slotGroup = (slot) => slot && { anchor: slot, elements: slot.assignedElements({ flatten: true }) };
const childGroup = (el) => el && { anchor: el, elements: [...el.children] };
const singleGroup = (el) => el && { anchor: el, elements: [el] };
const NAV_BUTTON = ":scope > ha-menu-button, :scope > ha-icon-button-arrow-prev";
const DROPLET_GROUPS = {
  "hui-root": [
    (root) =>
      !root.querySelector(".edit-mode") &&
      (headerTabsGroup(root) || childGroup(root.querySelector(".toolbar .action-items"))),
    (root) =>
      !root.querySelector(".edit-mode") &&
      !activeHeaderTab(root) &&
      singleGroup(root.querySelector(".toolbar")?.querySelector(NAV_BUTTON)),
  ],
  "ha-top-app-bar-fixed": [
    (root) => slotGroup(root.querySelector('#actions slot[name="actionItems"]')),
    (root) => slotGroup(root.querySelector('#navigation slot[name="navigationIcon"]')),
  ],
  "hass-subpage": [
    (root) => slotGroup(root.querySelector('slot[name="toolbar-icon"]')),
    (root) => singleGroup(root.querySelector(".toolbar-content")?.querySelector(NAV_BUTTON)),
  ],
  "hass-tabs-subpage": [
    (root) => slotGroup(root.querySelector('#toolbar-icon slot[name="toolbar-icon"]')),
    (root) => singleGroup(root.querySelector(".toolbar-content")?.querySelector(NAV_BUTTON)),
  ],
};
const DROPLET_MARGIN = 24; // Platz für die Schatten rund um die Form
const DROPLET_INSET = 4; // Kreise etwas kleiner als die Knopffläche
const DROPLET_NECK = 0.5; // halbe Halsbreite im Verhältnis zum Radius
const dropletHosts = new Map(); // Element -> Tag, dessen Gruppen gelten (auch für Unterklassen)
const buttonHosts = new Set();
const cardHosts = new Set();
const BUTTON_GAP = 24; // Buttons mit höchstens diesem Abstand laufen zusammen
let dropletProbe = null;

/** Sichtbare Fläche eines Elements; Hüllen mit display: contents (z. B. Menüs) über ihren Auslöser. */
function itemRects(el) {
  if (el.hidden || el.classList.contains("neumorphism-droplet")) return [];
  if (getComputedStyle(el).display !== "contents") {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? [rect] : [];
  }
  // Nur Auslöser berücksichtigen, keine (geöffneten) Menüeinträge
  return [...el.children]
    .filter((child) => [null, "trigger"].includes(child.getAttribute("slot")) && !/item$/.test(child.localName))
    .flatMap(itemRects)
    .slice(0, 1);
}

function groupItems(group) {
  return group.elements.flatMap(itemRects).sort((a, b) => a.left - b.left);
}

const activeHeaderTab = (root) => root.querySelector(".toolbar ha-tab-group > ha-tab-group-tab[active]");

/**
 * Titelleiste mit Ansichten: Menüknopf, gewählte Ansicht und Knöpfe rechts in einer Form.
 * Die Pille der gewählten Ansicht liegt mit in der Tropfenform; beim Wischen läuft sie wie ein
 * Tropfen in die Knöpfe hinein (sichtbar nur zwischen deren Mitten).
 */
function headerTabsGroup(root) {
  const active = activeHeaderTab(root);
  const inner = active?.shadowRoot?.querySelector(".tab");
  if (!inner) return null;
  const toolbar = root.querySelector(".toolbar");
  const tabs = active.parentElement;
  watchTabScroll(tabs);
  for (const tab of tabs.children) tab.toggleAttribute?.("neumorphism-header", true);
  const nav = toolbar.querySelector(NAV_BUTTON);
  const actions = toolbar.querySelector(".action-items");
  const navRects = nav ? itemRects(nav) : [];
  const actionRects = actions ? [...actions.children].flatMap(itemRects).sort((a, b) => a.left - b.left) : [];
  const t = inner.getBoundingClientRect();
  if (!t.width) return null;
  // Senkrecht auf Text und Symbol zentriert, nicht auf den Reiter: Home Assistant gibt ihm oben
  // mehr Innenabstand als unten. Seitlich 2px Rand, plus DROPLET_INSET (zieht drawDroplet wieder ab).
  const range = document.createRange();
  range.selectNodeContents(active);
  const content = range.getBoundingClientRect();
  const cy = content.height ? (content.top + content.bottom) / 2 : (t.top + t.bottom) / 2;
  const half = Math.min(18, t.height / 2 - 6);
  const pill = {
    left: t.left + 2 - DROPLET_INSET,
    right: t.right - 2 + DROPLET_INSET,
    top: cy - half - DROPLET_INSET,
    bottom: cy + half + DROPLET_INSET,
    clipLeft: navRects[0] ? navRects[0].left + navRects[0].width / 2 : undefined,
    clipRight: actionRects[0] ? actionRects[0].left + actionRects[0].width / 2 : undefined,
    dynamic: true, // verbindet sich erst bei Berührung (siehe dropletNeck)
  };
  pill.width = pill.right - pill.left;
  pill.height = pill.bottom - pill.top;
  return { anchor: toolbar.firstElementChild, rects: [...navRects, pill, ...actionRects] };
}

const watchedTabNavs = new WeakSet();
function watchTabScroll(tabs) {
  const nav = tabs.shadowRoot?.querySelector(".nav");
  if (!nav || watchedTabNavs.has(nav)) return;
  watchedTabNavs.add(nav);
  nav.addEventListener("scroll", scheduleDroplets, { passive: true });
  // Andere Ansicht gewählt: die Pille wandert mit
  new MutationObserver(scheduleDroplets).observe(tabs, { subtree: true, attributes: true, attributeFilter: ["active"] });
}

let dropletFrame = 0;
function scheduleDroplets() {
  if (dropletFrame) return;
  dropletFrame = requestAnimationFrame(() => {
    dropletFrame = 0;
    safely(updateDroplets);
  });
}

// Farben und Werte der Schatten: neu gelesen nur nach Änderung der Einstellungen oder des Themes
let themeGeneration = 0; // zählt Änderungen der Theme-Variablen auf <html>
let paintCache = null;

function dropletPaint() {
  const key = `${applied}|${themeGeneration}`;
  if (paintCache?.key !== key) paintCache = { key, value: readPaint() };
  return paintCache.value;
}

/** Farben und Stärke aus dem Theme, aufgelöst über ein unsichtbares Element. */
function readPaint() {
  if (!dropletProbe) {
    dropletProbe = document.createElement("div");
    dropletProbe.style.cssText =
      "position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;" +
      "color:var(--neumorphism-shadow-dark);background-color:var(--neumorphism-shadow-light);" +
      "border:0 solid var(--card-background-color);outline:0 solid var(--neumorphism-sheen);" +
      "text-decoration-color:var(--neumorphism-shade);caret-color:rgba(var(--rgb-primary-text-color),0.16);";
    document.body.appendChild(dropletProbe);
  }
  const css = getComputedStyle(dropletProbe);
  const root = getComputedStyle(document.documentElement);
  const number = (name, fallback) => {
    const value = parseFloat(root.getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  };
  const s = settings();
  return {
    dark: css.color,
    light: css.backgroundColor,
    fill: css.borderTopColor,
    strength: clampStrength(number("--neumorphism-strength", 1)) ?? 1,
    lx: number("--neumorphism-light-x", 1),
    ly: number("--neumorphism-light-y", 1),
    edge: number("--neumorphism-contrast", 0) > 0 ? css.caretColor : "",
    surface:
      s.surface === "flat"
        ? null
        : { angle: number("--neumorphism-light-angle", 135), convex: s.surface === "convex", sheen: css.outlineColor, shade: css.textDecorationColor },
  };
}

const fmt = (n) => (Math.round(n * 100) / 100).toString();

/**
 * Kreis oder Pille (von x0 bis x1) als Pfad im Uhrzeigersinn, nur der Teil zwischen den
 * senkrechten Linien left und right (für Pillen, die unter einem Knopf verschwinden).
 */
function capsulePath(x0, x1, cy, r, left = x0, right = x1) {
  const c0 = x0 + r;
  const c1 = Math.max(c0, x1 - r);
  const h = (x) => (x < c0 ? Math.sqrt(Math.max(0, r * r - (c0 - x) ** 2)) : x > c1 ? Math.sqrt(Math.max(0, r * r - (x - c1) ** 2)) : r);
  const pt = (x, y) => `${fmt(x)} ${fmt(y)}`;
  const xs = [left, ...[c0, c1].filter((x) => x > left && x < right), right];
  const edge = (a, b, sign) => {
    const mid = (a + b) / 2;
    return mid < c0 || mid > c1 ? `A${fmt(r)} ${fmt(r)} 0 0 1 ${pt(b, cy + sign * h(b))}` : `L${pt(b, cy + sign * h(b))}`;
  };
  let d = `M${pt(left, cy - h(left))}`;
  for (let i = 1; i < xs.length; i++) d += edge(xs[i - 1], xs[i], -1); // oben nach rechts
  d += `L${pt(right, cy + h(right))}`;
  for (let i = xs.length - 1; i > 0; i--) d += edge(xs[i], xs[i - 1], 1); // unten zurück
  return d + "Z";
}

/**
 * Halsbreite (halbe Höhe) zwischen zwei Tropfen mit Mittelpunktabstand dist und Radiensumme
 * sum: null, solange sie sich nicht berühren. Danach füllt der Hals zuerst nur die Kerbe am
 * Schnittpunkt und wird mit wachsender Überlappung stetig breiter, ohne Sprung.
 */
function dropletNeck(dist, sum, r) {
  const overlap = sum - dist;
  const half = dist / 2;
  if (overlap <= 0 || half <= 0) return null;
  const notch = Math.sqrt(Math.max(0, r * r - half * half)); // Höhe des Schnittpunkts
  return notch + (r - notch) * 0.6 * (1 - Math.exp(-overlap / r));
}

/** Eingeschnürte Brücke zwischen zwei Kreisen: Hohlkehlen tangential an beide Kreise. */
function bridgePath(x1, x2, cy, r, h = DROPLET_NECK * r) {
  const a = (x2 - x1) / 2;
  if (a <= 0 || a > 2 * r) return "";
  const R = (a * a + h * h - r * r) / (2 * (r - h));
  if (!(R > 0)) return "";
  const m = x1 + a;
  const yR = h + R;
  const touch = (cx, fy) => {
    const len = Math.hypot(m - cx, fy);
    return [cx + (r * (m - cx)) / len, cy + (r * fy) / len];
  };
  const [t1x, t1y] = touch(x1, -yR);
  const [t2x, t2y] = touch(x2, -yR);
  const [b2x, b2y] = touch(x2, yR);
  const [b1x, b1y] = touch(x1, yR);
  return (
    `M${fmt(t1x)} ${fmt(t1y)}A${fmt(R)} ${fmt(R)} 0 0 0 ${fmt(t2x)} ${fmt(t2y)}` +
    `L${fmt(b2x)} ${fmt(b2y)}A${fmt(R)} ${fmt(R)} 0 0 0 ${fmt(b1x)} ${fmt(b1y)}Z`
  );
}

const rgbaParts = (color) => {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return ["rgb(0,0,0)", 0];
  const [r, g, b, a = "1"] = m[1].split(",").map((v) => v.trim());
  return [`rgb(${r},${g},${b})`, Number(a)];
};

/** Anfang und Ende eines Verlaufs (SVG, 0..1) aus dem Winkel wie bei linear-gradient(). */
function gradientEnds(deg) {
  const rad = (deg * Math.PI) / 180;
  const [dx, dy] = [Math.sin(rad) / 2, -Math.cos(rad) / 2];
  return [0.5 - dx, 0.5 - dy, 0.5 + dx, 0.5 + dy].map(fmt);
}

/**
 * Form mit Schatten: erhaben, bei negativer Effektstärke eingelassen (Schatten innen).
 * caps: die einzelnen Pillen, für die Wölbung je mit eigenem Verlauf.
 */
function dropletSvg(width, height, d, paint, id, caps = []) {
  const s = Math.abs(paint.strength);
  const [dark, darkA] = rgbaParts(paint.dark);
  const [light, lightA] = rgbaParts(paint.light);
  // Schatten fällt vom Licht weg (Lichtrichtung aus dem Theme)
  const shade = (source, k, color, alpha, result) =>
    `<feOffset in="${source}" dx="${fmt(k * s * paint.lx)}" dy="${fmt(k * s * paint.ly)}" result="${result}o"/>` +
    `<feFlood flood-color="${color}" flood-opacity="${alpha}"/><feComposite in2="${result}o" operator="in" result="${result}"/>`;
  // Kontrastmodus: feine Kante rund um die ganze Form
  const [edgeColor, edgeA] = paint.edge ? rgbaParts(paint.edge) : [];
  const edge = paint.edge
    ? `<feMorphology in="SourceAlpha" operator="dilate" radius="1" result="e0"/>` +
      `<feComposite in="e0" in2="SourceAlpha" operator="out" result="e1"/>` +
      `<feFlood flood-color="${edgeColor}" flood-opacity="${edgeA}"/><feComposite in2="e1" operator="in" result="e"/>`
    : "";
  const edgeNode = paint.edge ? `<feMergeNode in="e"/>` : "";
  const filter =
    paint.strength >= 0
      ? `<feGaussianBlur in="SourceAlpha" stdDeviation="${fmt(4.5 * s)}" result="b"/>` +
        shade("b", 4, dark, darkA, "d") +
        shade("b", -4, light, lightA, "l") +
        edge +
        `<feMerge><feMergeNode in="d"/><feMergeNode in="l"/><feMergeNode in="SourceGraphic"/>${edgeNode}</feMerge>`
      : // Innenschatten: Umgebung der Form weichzeichnen, versetzen und auf die Form beschneiden
        `<feComponentTransfer in="SourceAlpha" result="inv"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>` +
        `<feGaussianBlur in="inv" stdDeviation="${fmt(4.5 * s)}" result="b"/>` +
        shade("b", 4, dark, darkA, "d0") +
        `<feComposite in="d0" in2="SourceAlpha" operator="in" result="d"/>` +
        shade("b", -4, light, lightA, "l0") +
        `<feComposite in="l0" in2="SourceAlpha" operator="in" result="l"/>` +
        edge +
        `<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="d"/><feMergeNode in="l"/>${edgeNode}</feMerge>`;
  // Wölbung: jede Pille mit eigenem Verlauf über der Fläche, bei negativer Stärke umgekehrt
  let sheen = "";
  if (paint.surface && caps.length) {
    const [x1, y1, x2, y2] = gradientEnds(paint.surface.angle);
    const forward = paint.surface.convex === paint.strength >= 0;
    const [from, to] = forward ? [paint.surface.sheen, paint.surface.shade] : [paint.surface.shade, paint.surface.sheen];
    const k = Math.min(1, s);
    const stop = (offset, color) => {
      const [c, a] = rgbaParts(color);
      return `<stop offset="${offset}" stop-color="${c}" stop-opacity="${fmt(a * k)}"/>`;
    };
    sheen = `<linearGradient id="${id}-g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stop(0, from)}${stop(1, to)}</linearGradient>`;
  }
  const capPaths = sheen ? caps.map((cap) => `<path class="cap" fill="url(#${id}-g)" d="${cap}"/>`).join("") : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">${filter}</filter>${sheen}</defs>` +
    `<path class="shape" filter="url(#${id})" fill="${paint.fill}" d="${d}"/>${capPaths}</svg>`
  );
}

/** Zeichnet hinter jeder Knopfgruppe eine Form: Kreise, verbunden wie zwei Tropfen. */
function updateDroplets() {
  forgetDetached(dropletHosts, 50, (host) => layoutObserver?.unobserve(host));
  // Sparmodus: keine Tropfenformen, die Ansicht in der Titelleiste bekommt wieder ihre eigene Pille
  const enabled = controlsActive && !saver();
  for (const [host, tag] of dropletHosts) {
    const root = host.shadowRoot;
    if (!host.isConnected || !root) continue;
    if (!enabled) {
      for (const tab of root.querySelectorAll("ha-tab-group-tab[neumorphism-header]")) tab.removeAttribute("neumorphism-header");
    }
    DROPLET_GROUPS[tag].forEach((find, index) => {
      const existing = root.querySelector(`.neumorphism-droplet[data-group="${index}"]`);
      const group = (enabled && find(root)) || null;
      const items = group ? group.rects || groupItems(group) : [];
      const parent = group?.anchor.parentElement;
      if (!items.length || !parent) {
        existing?.remove();
        return;
      }
      drawDroplet(existing, parent, group.anchor, items, index, DROPLET_INSET);
    });
  }
}

/**
 * Zeichnet die Form hinter einer Reihe von Elementen in ihr (positioniertes) Elternelement.
 * Jedes Element wird zu einer Pille (bei quadratischen Knöpfen ein Kreis), benachbarte
 * Pillen werden an ihren zugewandten Enden mit einem Tropfen-Hals verbunden.
 */
let dropletIds = 0;

function drawDroplet(existing, parent, anchor, items, group, inset) {
  const box = parent.getBoundingClientRect();
  const offsetX = box.left + parent.clientLeft - parent.scrollLeft;
  const offsetY = box.top + parent.clientTop - parent.scrollTop;
  const pills = [];
  for (const rect of items) {
    const r = Math.min(rect.width, rect.height) / 2 - inset;
    const x0 = rect.left + inset - offsetX;
    const x1 = rect.right - inset - offsetX;
    // Teil einer Pille, der zwischen den Knöpfen sichtbar ist (rect.clipLeft/clipRight)
    const left = rect.clipLeft === undefined ? x0 : Math.max(x0, rect.clipLeft - offsetX);
    const right = rect.clipRight === undefined ? x1 : Math.min(x1, rect.clipRight - offsetX);
    if (right - left < 0.5) continue;
    pills.push({ x0, x1, left, right, cy: rect.top + rect.height / 2 - offsetY, r, dynamic: !!rect.dynamic });
  }
  if (!pills.length) {
    existing?.remove();
    return null;
  }
  pills.sort((a, b) => a.left - b.left);
  const left = Math.min(...pills.map((p) => p.left)) - DROPLET_MARGIN;
  const top = Math.min(...pills.map((p) => p.cy - p.r)) - DROPLET_MARGIN;
  const width = Math.max(...pills.map((p) => p.right)) + DROPLET_MARGIN - left;
  const height = Math.max(...pills.map((p) => p.cy + p.r)) + DROPLET_MARGIN - top;
  const local = pills.map((p) => ({
    ...p,
    x0: p.x0 - left,
    x1: p.x1 - left,
    left: p.left - left,
    right: p.right - left,
    cy: p.cy - top,
  }));
  const shapes = local.map((p) => capsulePath(p.x0, p.x1, p.cy, p.r, p.left, p.right));
  for (let i = 1; i < local.length; i++) {
    const a = local[i - 1];
    const b = local[i];
    const r = Math.min(a.r, b.r);
    const ca = a.x1 - a.r; // Mittelpunkte der einander zugewandten Enden
    const cb = b.x0 + b.r;
    if (a.dynamic || b.dynamic) {
      // Bewegte Pille: wie Wassertropfen erst ab der Berührung verbunden, der Hals wächst stetig mit
      const neck = dropletNeck(cb - ca, a.r + b.r, r);
      if (neck) shapes.push(bridgePath(ca, cb, (a.cy + b.cy) / 2, r, neck));
    } else {
      shapes.push(bridgePath(ca, cb, (a.cy + b.cy) / 2, r));
    }
  }
  const paint = dropletPaint();
  // Am rechten Bildschirmrand enden: Was darüber hinausragt, macht die Leiste seitlich verschiebbar
  const viewRight = parent.ownerDocument.documentElement.clientWidth - offsetX;
  const shown = Math.max(0, Math.min(width, viewRight - left));
  const frame = [fmt(left), fmt(top), fmt(shown), fmt(width), fmt(height), JSON.stringify(paint), local.length].join("|");
  const d = shapes.join("");
  // Pillen einzeln (ohne Hälse) für die Wölbung
  const caps = shapes.slice(0, local.length);

  let droplet = existing;
  if (!droplet) {
    droplet = parent.ownerDocument.createElement("div");
    droplet.className = "neumorphism-droplet";
    droplet.dataset.group = String(group);
    droplet.dataset.id = `neumorphism-droplet-${++dropletIds}`;
    droplet.setAttribute("aria-hidden", "true");
    droplet.style.cssText = "position:absolute;pointer-events:none;z-index:0;overflow:hidden;";
  }
  if (droplet.parentElement !== parent || droplet.nextSibling !== anchor) parent.insertBefore(droplet, anchor);
  if (droplet.dataset.frame !== frame) {
    // Größe, Farben oder Stärke geändert: neu aufbauen
    droplet.dataset.frame = frame;
    Object.assign(droplet.style, { left: `${left}px`, top: `${top}px`, width: `${shown}px`, height: `${height}px` });
    droplet.innerHTML = dropletSvg(width, height, d, paint, droplet.dataset.id, caps);
  } else {
    // Nur die Form bewegt sich (z. B. beim Wischen der Reiterleiste): nur die Umrisse tauschen
    const path = droplet.querySelector("path.shape");
    if (path && path.getAttribute("d") !== d) path.setAttribute("d", d);
    droplet.querySelectorAll("path.cap").forEach((cap, i) => {
      if (caps[i] && cap.getAttribute("d") !== caps[i]) cap.setAttribute("d", caps[i]);
    });
  }
  return droplet;
}

/**
 * Buttons, die direkt nebeneinander liegen (z. B. „Profil bearbeiten“ und „Abmelden“),
 * bekommen statt eigener Schatten eine gemeinsame Tropfenform.
 */
const buttonDroplets = new Map(); // Elternelement -> gezeichnete Formen

function updateButtonGroups() {
  forgetDetached(buttonHosts, 500);
  const byParent = new Map();
  if (controlsActive && !saver()) {
    for (const btn of buttonHosts) {
      if (!btn.isConnected || !btn.parentElement) continue;
      // In Slots eines Bausteins (z. B. Fußzeile von Dialogen) wäre die Form unsichtbar: Knöpfe einzeln lassen
      if (btn.parentElement.shadowRoot) continue;
      // Symbol-Knöpfe sind flach; ihre Gruppen in der Titelleiste zeichnet updateDroplets
      if (btn.getRootNode().host?.localName === "ha-icon-button") continue;
      const list = byParent.get(btn.parentElement) || [];
      list.push(btn);
      byParent.set(btn.parentElement, list);
    }
  }

  const merged = new Set();
  const used = new Map();
  for (const [parent, buttons] of byParent) {
    if (buttons.length < 2) continue;
    const entries = buttons
      .map((btn) => ({ btn, rect: btn.getBoundingClientRect() }))
      .filter((e) => e.rect.width > 0 && e.rect.height > 0)
      .sort((a, b) => a.rect.left - b.rect.left);
    // Reihen: gleiche Höhe und Zeile, kleiner Abstand
    const runs = [];
    for (const entry of entries) {
      const run = runs[runs.length - 1];
      const last = run?.[run.length - 1];
      const sameRow =
        last &&
        Math.abs(last.rect.top + last.rect.height / 2 - (entry.rect.top + entry.rect.height / 2)) < 4 &&
        Math.abs(last.rect.height - entry.rect.height) < 4 &&
        entry.rect.left - last.rect.right <= BUTTON_GAP &&
        entry.rect.left - last.rect.right >= -1;
      if (sameRow) run.push(entry);
      else runs.push([entry]);
    }
    const drawn = [];
    runs.filter((run) => run.length > 1).forEach((run, index) => {
      if (getComputedStyle(parent).position === "static") {
        parent.style.position = "relative";
        parent.dataset.neumorphismPositioned = "";
      }
      const existing = buttonDroplets.get(parent)?.[index];
      const droplet = drawDroplet(existing, parent, run[0].btn, run.map((e) => e.rect), `b${index}`, 0);
      if (droplet) drawn.push(droplet);
      for (const e of run) merged.add(e.btn);
    });
    if (drawn.length) used.set(parent, drawn);
  }

  // Aufräumen: nicht mehr benötigte Formen und Markierungen entfernen
  for (const [parent, droplets] of buttonDroplets) {
    const keep = used.get(parent) || [];
    for (const d of droplets) if (!keep.includes(d)) d.remove();
    if (!keep.length) layoutObserver?.unobserve(parent);
    if (!keep.length && parent.dataset.neumorphismPositioned !== undefined) {
      parent.style.position = "";
      delete parent.dataset.neumorphismPositioned;
    }
  }
  // Knopfgruppen: Größe des Elternelements geändert (Karte breiter, Dialog umgebrochen): neu zeichnen
  for (const parent of used.keys()) if (!buttonDroplets.has(parent)) layoutObserver?.observe(parent);
  buttonDroplets.clear();
  for (const [parent, droplets] of used) buttonDroplets.set(parent, droplets);
  for (const btn of buttonHosts) btn.toggleAttribute("neumorphism-merged", merged.has(btn));
}

// ---------------------------------------------------------------------------
// Eigene Karten (HACS, selbst geschrieben): Rahmen und Flächen formen
// ---------------------------------------------------------------------------
//
// Gilt für alle Karten, die nicht von Home Assistant selbst stammen. Jede bringt
// ihre eigenen Bausteine mit, deshalb wird nach Farbe und Form eingeordnet:
//   - Rahmen: die Karte selbst oder ein innerer Rahmen, der sie ausfüllt
//     (z. B. bei M3 Cards) -> erhaben, ohne Rand, ohne Glas-Effekt
//   - neutrale oder leicht getönte Fläche -> erhaben in der Kartenfarbe
//   - kräftig gefärbte Fläche (aktiver Zustand) -> Farbe bleibt, erhaben
//   - Fläche in einer Fläche, schmale Spur -> eingelassen
// Bilder, Verläufe, Overlays und die Bausteine von Home Assistant bleiben unberührt.
// Karten in einer Karte mit Rahmen bekommen keinen zweiten Rahmenschatten.

const CARD_STYLE = `
  [nm-card-shadow] {
    box-shadow: var(--neumorphism-card-shadow) !important;
    border-color: transparent !important;
    border-radius: var(--nm-frame-radius, var(--ha-card-border-radius)) !important;
  }
  [nm-frame-inner] {
    border-color: transparent !important;
    background: var(--card-background-color) !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
  [nm-raised] { background: var(--card-background-color) ${SHEEN} !important; box-shadow: ${RAISED} !important; }
  [nm-accent] { box-shadow: ${RAISED} !important; }
  [nm-inset] { background: var(--card-background-color) !important; box-shadow: ${INSET_S} !important; }
`;
const CARD_MARKS = ["nm-card-shadow", "nm-frame-inner", "nm-raised", "nm-accent", "nm-inset"];
const ACCENT_DISTANCE = 90; // Abstand zur Kartenfarbe, ab dem eine Fläche als farbig gilt
const cardTags = new Set(); // Namen der gefundenen eigenen Karten (für die Diagnose)
const framedCards = new WeakSet();
const cardPending = new Set();
const observedRoots = new WeakSet();
let cardsKey = ""; // Stand der Einstellungen; jede Karte merkt sich, für welchen Stand sie eingeordnet ist

const isCardElement = (el) =>
  el.localName !== "hui-card" && el.localName.endsWith("-card") && typeof el.setConfig === "function";

const NUM = "([\\d.e+-]+%?|none)";
const OK_RE = new RegExp(`^(oklch|oklab)\\(\\s*${NUM}\\s+${NUM}\\s+${NUM}(?:\\s*\\/\\s*${NUM})?\\s*\\)`);
const num = (v, scale = 1) => (v === undefined || v === "none" ? 0 : v.endsWith("%") ? (parseFloat(v) / 100) * scale : +v);

function parseColor(value) {
  let m = value.match(/^rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b, a = "1"] = m[1].split(/[\s,/]+/).filter(Boolean);
    return { r: +r, g: +g, b: +b, a: +a };
  }
  m = value.match(/^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.e-]+))?\)/);
  if (m) return { r: m[1] * 255, g: m[2] * 255, b: m[3] * 255, a: m[4] === undefined ? 1 : +m[4] };
  // Neuere Seiten (z. B. mit Tailwind) liefern Farben in OKLCH oder OKLab
  m = value.match(OK_RE);
  if (m) {
    const L = num(m[2]);
    let C, h;
    if (m[1] === "oklch") {
      C = num(m[3], 0.4);
      h = (num(m[4]) * Math.PI) / 180;
    } else {
      const a = num(m[3], 0.4);
      const b = num(m[4], 0.4);
      C = Math.hypot(a, b);
      h = Math.atan2(b, a);
    }
    const [r, g, b] = oklchToLinear(L, C, h).map((c) => Math.min(1, Math.max(0, fromLinear(c))) * 255);
    return { r, g, b, a: m[5] === undefined ? 1 : num(m[5], 1) };
  }
  return null;
}

const bgAlpha = (css) => parseColor(css.backgroundColor)?.a ?? 0;

function registerCard(card) {
  // Karten von Home Assistant haben eigene Regeln, die eigene Karte formt sich selbst
  if (card.localName.startsWith("hui-") || card.localName.startsWith("neumorphism-")) return;
  cardTags.add(card.localName);
  if (card.__neumorphismCards !== cardsKey) scheduleCard(card);
}

// Karten, die sich ständig ändern (z. B. animierte Inline-Styles), höchstens viermal pro Sekunde
const CARD_SCAN_GAP = 250;

function scheduleCard(card) {
  if (cardPending.has(card)) return;
  cardPending.add(card);
  const run = () =>
    requestAnimationFrame(() => {
      cardPending.delete(card);
      try {
        if (card.isConnected) scanCard(card);
      } catch (err) {
        console.warn("Neumorphism:", err);
      }
    });
  const wait = (card.__neumorphismScanAt || 0) + CARD_SCAN_GAP - Date.now();
  if (wait > 0) setTimeout(run, wait);
  else run();
}

// Karten ohne Fläche (versteckt, eingeklappt, in Pop-ups): einordnen, sobald sie sichtbar werden
const cardsWaiting = new Map(); // Element ohne Fläche -> Karte
const cardSizeWatch =
  typeof ResizeObserver === "function"
    ? new ResizeObserver((entries) => {
        for (const entry of entries) {
          const size = entry.borderBoxSize?.[0];
          if (!(size ? size.inlineSize && size.blockSize : entry.contentRect.width && entry.contentRect.height)) continue;
          const card = cardsWaiting.get(entry.target);
          cardsWaiting.delete(entry.target);
          cardSizeWatch.unobserve(entry.target);
          if (card?.isConnected) scheduleCard(card);
        }
      })
    : null;

function waitForSize(el, card) {
  if (!cardSizeWatch) {
    card.__neumorphismCards = undefined; // ohne ResizeObserver: beim nächsten Takt erneut
    return;
  }
  if (cardsWaiting.has(el)) return;
  cardsWaiting.set(el, card);
  cardSizeWatch.observe(el);
}

function observeRoot(root, card) {
  if (observedRoots.has(root)) return;
  observedRoots.add(root);
  adoptControlStyle(root, "__cards");
  new MutationObserver(() => scheduleCard(card)).observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["style", "class"],
  });
}

/** Elemente einer Karte, auch in verschachtelten Bausteinen; eingebettete Karten werden eigens behandelt. */
function collectCard(root, card, out) {
  observeRoot(root, card);
  const nestedCards = [];
  for (const el of root.querySelectorAll("*")) {
    if (el.localName === "svg" || el.closest("svg")) continue;
    if (nestedCards.some((n) => n.contains(el))) continue;
    if (isCardElement(el)) {
      nestedCards.push(el);
      registerCard(el);
      continue;
    }
    // Bausteine von Home Assistant: eigene Regeln (die Karte selbst wird geformt)
    if (el.localName !== "ha-card" && isCoreElement(el, card)) continue;
    out.push(el);
    if (el.shadowRoot && el.localName !== "ha-card") collectCard(el.shadowRoot, card, out);
  }
}

/** Liegt die Karte in einer anderen Karte mit sichtbarem Rahmen? */
function insideFramedCard(card) {
  for (let node = card.parentElement || card.getRootNode().host; node; node = node.parentElement || node.getRootNode().host) {
    if (framedCards.has(node)) return true;
    if (node.localName === "ha-card" && bgAlpha(getComputedStyle(node)) > 0.5) return true;
  }
  return false;
}

function cardsMode() {
  const mode = settings().cards;
  return saver() && mode === "full" ? "frame" : mode; // Sparmodus: nur Rahmen, kein Durchsuchen der Flächen
}

function scanCard(card) {
  const root = card.shadowRoot;
  if (!root) return;
  card.__neumorphismCards = cardsKey;
  card.__neumorphismScanAt = Date.now();
  const elements = [];
  collectCard(root, card, elements);
  for (const el of elements) for (const attr of CARD_MARKS) if (el.hasAttribute(attr)) el.removeAttribute(attr);
  framedCards.delete(card);
  const mode = cardsMode();
  if (!controlsActive || mode === "off") return;

  // Rahmen: die oberste ha-card oder ein innerer Rahmen, der die Karte ausfüllt
  const haCard = elements.find((el) => el.localName === "ha-card");
  const box = (haCard || card).getBoundingClientRect();
  if (!box.width || !box.height) {
    waitForSize(haCard || card, card);
    return;
  }
  let frame = null;
  let inner = null;
  if (haCard) {
    const css = getComputedStyle(haCard);
    if (bgAlpha(css) > 0.5 || css.backgroundImage !== "none") frame = haCard;
  }
  if (!frame) {
    inner = elements.find((el) => {
      if (el === haCard) return false;
      const r = el.getBoundingClientRect();
      if (r.width < box.width * 0.95 || r.height < box.height * 0.9) return false;
      const css = getComputedStyle(el);
      return bgAlpha(css) > 0.05 || parseFloat(css.borderTopWidth) > 0 || css.backdropFilter !== "none";
    });
    if (inner) frame = haCard || inner;
  }
  if (frame && !insideFramedCard(card)) {
    frame.setAttribute("nm-card-shadow", "");
    // Nur bei Änderung schreiben: das style-Attribut löst sonst gleich den nächsten Durchgang aus
    const radius = getComputedStyle(inner || frame).borderTopLeftRadius;
    if (frame.style.getPropertyValue("--nm-frame-radius") !== radius) frame.style.setProperty("--nm-frame-radius", radius);
    framedCards.add(card);
  }
  if (inner) inner.setAttribute("nm-frame-inner", "");
  if (mode !== "full") return;

  // Flächen in der Karte
  const surface = parseColor(dropletPaint().fill) || { r: 0, g: 0, b: 0 };
  const cardArea = box.width * box.height;
  const marks = [];
  for (const el of elements) {
    if (el === haCard || el === inner) continue;
    const css = getComputedStyle(el);
    if (css.backgroundImage !== "none" || css.position === "fixed") continue; // Bilder, Verläufe, Popups
    const bg = parseColor(css.backgroundColor);
    if (!bg || bg.a < 0.05) continue;
    const rect = el.getBoundingClientRect();
    if (!rect.width || rect.width * rect.height > cardArea * 0.6) continue; // Overlays, große Container
    const blend = (c, s) => c * bg.a + s * (1 - bg.a);
    const distance = Math.hypot(
      blend(bg.r, surface.r) - surface.r,
      blend(bg.g, surface.g) - surface.g,
      blend(bg.b, surface.b) - surface.b
    );
    const accent = distance > ACCENT_DISTANCE;
    // Schmale Spur (Schieber, Fortschritt): eingelassen; farbige Füllungen bleiben unverändert
    if (rect.height >= 3 && rect.height <= 12 && rect.width >= 60 && rect.width > rect.height * 6) {
      if (!accent) marks.push({ el, kind: "inset" });
      continue;
    }
    if (rect.width < 20 || rect.height < 14) continue; // Punkte, Griffe, Farbtupfer
    if (parseFloat(css.borderTopLeftRadius) < 4) continue; // eckige Flächen sind keine Bausteine
    marks.push({ el, kind: accent ? "accent" : "raised" });
  }
  // Fläche in einer Fläche (auch über Shadow-DOM-Grenzen): eingelassen
  const marked = new Set(marks.map((m) => m.el));
  for (const mark of marks) {
    if (mark.kind !== "raised") continue;
    for (let p = mark.el.parentElement || mark.el.getRootNode().host; p && p !== card; p = p.parentElement || p.getRootNode().host) {
      if (marked.has(p)) {
        mark.kind = "inset";
        break;
      }
    }
  }
  for (const mark of marks) mark.el.setAttribute(`nm-${mark.kind}`, "");
}

/**
 * Neue Karten aufnehmen; nach Theme-, Modus- oder Einstellungswechsel alle neu einordnen
 * (Karten in Karten über ihre äußere Karte). Wieder eingehängte Ansichten melden sich über
 * ihre hui-card (watchReconnect) und werden eingeordnet, falls sich inzwischen etwas geändert hat.
 */
function updateCards() {
  if (!supportsSheets) return;
  CONTROL_STYLES.__cards = CARD_STYLE;
  cardsKey = `${controlsActive}|${dropletPaint().fill}|${cardsMode()}`;
  forgetDetached(cardHosts, 500);
  for (const [el, card] of cardsWaiting) {
    if (el.isConnected) continue;
    // Abgehängt, solange sie noch ohne Fläche war: beim Wiedereinhängen neu einordnen
    cardsWaiting.delete(el);
    cardSizeWatch.unobserve(el);
    card.__neumorphismCards = undefined;
  }
  for (const host of cardHosts) {
    // Direkt im Dashboard ist jedes Kind von hui-card eine Karte, egal wie sie heißt
    const card = host.isConnected && host.firstElementChild;
    if (card && card.shadowRoot && typeof card.setConfig === "function") registerCard(card);
  }
}

// ---------------------------------------------------------------------------
// Fremde Bausteine erkennen: von Home Assistant oder von Integrationen, Karten, Add-ons
// ---------------------------------------------------------------------------
//
// Entscheidend ist, woher der Code eines Bausteins geladen wurde, nicht sein Name
// (manche Integrationen nennen ihre Bausteine ebenfalls "ha-..."). Dazu wird
// customElements.define beobachtet. Was schon vor diesem Skript registriert war,
// wird nach dem Namen eingeordnet.

const CORE_SCRIPT = /\/(frontend_latest|frontend_es5)\//;
const OWN_SCRIPT = "/neumorphism_static/";
const CORE_PREFIX =
  /^(ha-|hui-|hass-|mwc-|md-|wa-|paper-|iron-|state-|more-info-|entity-|dialog-|search-input|developer-tools|partial-panel-resolver|home-assistant|notification-|lit-virtualizer)/;
const coreTags = new Set();
const thirdPartyTags = new Set();
const thirdPartyElements = new Set(); // angeschlossene fremde Bausteine (Kandidaten für eigene Bereiche)

/** Woher der gerade registrierte Baustein stammt, aus der Aufrufkette. */
function definedBy() {
  const urls = (new Error().stack || "").match(/https?:\/\/[^\s)]+/g) || [];
  const other = urls.find((url) => !url.includes(OWN_SCRIPT));
  if (other) return CORE_SCRIPT.test(other) ? "core" : "third";
  return urls.length ? "own" : "unknown";
}

function hookDefine() {
  const registry = window.customElements;
  const define = registry.define;
  registry.define = function (name, cls, options) {
    safely(() => {
      const source = definedBy();
      if (source === "third") {
        thirdPartyTags.add(name);
        watchThirdParty(cls);
      } else if (source !== "unknown") {
        coreTags.add(name);
      }
    });
    return define.call(this, name, cls, options);
  };
}

/** Jedes angeschlossene Exemplar melden (Lifecycle-Callbacks liest der Browser bei der Registrierung). */
function watchThirdParty(cls) {
  const proto = cls?.prototype;
  if (!proto || Object.prototype.hasOwnProperty.call(proto, "__neumorphismWatched")) return;
  const connected = proto.connectedCallback;
  proto.connectedCallback = function (...args) {
    const result = connected?.apply(this, args);
    thirdPartyElements.add(this);
    scheduleTick(250); // Karten, die ihren Inhalt ständig neu bauen: höchstens viermal pro Sekunde
    return result;
  };
  proto.__neumorphismWatched = true;
}

const namespaceOf = (tag) => tag.split("-").slice(0, 2).join("-");

/**
 * Baustein von Home Assistant (eigene Regeln) oder fremd (wird eingeordnet)?
 * root: der fremde Baustein, in dem das Element liegt. Gleicher Namensraum wie er
 * (z. B. "ha-washdata-...") heißt fremd, auch wenn er vor diesem Skript registriert wurde.
 */
function isCoreElement(el, root) {
  const tag = el.localName;
  if (!tag.includes("-") || thirdPartyTags.has(tag)) return false;
  if (coreTags.has(tag)) return true;
  if (root && root !== el && namespaceOf(tag) === namespaceOf(root.localName)) return false;
  return CORE_PREFIX.test(tag);
}

// ---------------------------------------------------------------------------
// Eingebettete Seiten: HACS, Add-ons, Webseiten
// ---------------------------------------------------------------------------
//
// Eingebettete Fenster mit derselben Adresse wie Home Assistant sind erreichbar,
// fremde Adressen sperrt der Browser. Seiten aus Home-Assistant-Bausteinen (HACS)
// bekommen die Theme-Variablen und dieselbe Formung wie das Hauptfenster, alle
// anderen (Add-ons) werden nach Farbe und Form eingeordnet (siehe unten).

const FRAME_HOSTS = ["ha-panel-custom", "ha-panel-app", "ha-panel-iframe", "hui-iframe-card"];
const frameHosts = new Set();
const FRAME_STYLE_ID = "neumorphism-theme";

function frameDocument(iframe) {
  try {
    return iframe.contentDocument; // bei fremder Adresse null oder Fehler
  } catch {
    return null;
  }
}

function setFrameStyle(doc, css) {
  let style = doc.getElementById(FRAME_STYLE_ID);
  if (!style) {
    if (!css) return;
    style = doc.createElement("style");
    style.id = FRAME_STYLE_ID;
  }
  // Als letztes Stylesheet, damit es gleichrangige Regeln der Seite schlägt
  if (doc.head.lastElementChild !== style) doc.head.appendChild(style);
  if (style.textContent !== css) style.textContent = css;
}

/**
 * Theme-Variablen des Hauptfensters, eigene Farben mit Vorrang. Für fremde Seiten nur die
 * Farben (z. B. --primary-color): Abstände, Schriften und Bausteine von Home Assistant
 * (--ha-space-..., --wa-...) gehören nicht dorthin und brächten deren Layout durcheinander.
 */
const COLOR_VAR = /color|background|^--rgb-|primary|accent|text|divider|shadow|neumorphism/;
const LAYOUT_VAR = /^--(wa-|md-|mdc-(?!theme)|safe-|ha-font|ha-space|ha-border-radius|ha-line-height|ha-animation|ha-shadow-offset)/;

function haFrameCss(colorsOnly = false) {
  if (!controlsActive) return "";
  const keep = (name) => !colorsOnly || (COLOR_VAR.test(name) && !LAYOUT_VAR.test(name));
  const style = document.documentElement.style;
  const vars = [];
  for (let i = 0; i < style.length; i++) {
    const name = style[i];
    if (name.startsWith("--") && keep(name)) vars.push(`${name}: ${style.getPropertyValue(name)};`);
  }
  const own = Object.entries(appliedVars)
    .filter(([name]) => keep(`--${name}`))
    .map(([name, value]) => `--${name}: ${value} !important;`);
  return `${colorsOnly ? "" : fontCss}\n:root { ${vars.join(" ")} }\n:root, body { ${own.join(" ")} }`;
}

/** Schlüssel für Ausnahmen in den Einstellungen: Add-on oder Seite einer Integration. */
function hostKey(host) {
  if (host.localName === "ha-panel-app") return host._addon?.slug || host.panel?.config?.addon || "";
  if (host.localName === "ha-panel-custom") return host.panel?.url_path ? `panel:${host.panel.url_path}` : "";
  return "";
}

/** Ist die Formung fremder Oberflächen für diese Stelle eingeschaltet? */
function foreignEnabled(key) {
  const s = settings();
  return foreignOn(s) && !(key && s.appsOff.includes(key));
}

// Sparmodus: fremde Oberflächen nicht einordnen (das kostet bei großen Seiten am meisten)
const foreignOn = (s = settings()) => controlsActive && s.apps === "full" && !saver();

function updateFrames() {
  forgetDetached(frameHosts, 50);
  let haCss = null; // nur bei Bedarf: liest alle Theme-Variablen
  for (const host of frameHosts) {
    if (!host.isConnected) continue;
    const iframes = [...host.querySelectorAll("iframe"), ...(host.shadowRoot?.querySelectorAll("iframe") || [])];
    if (iframes.length) haCss ??= haFrameCss();
    for (const iframe of iframes) updateFrame(iframe, host, haCss);
    // Seite einer Integration direkt im Hauptfenster (z. B. WashData, Vacuum Agent): immer fremd
    const panel = host.localName === "ha-panel-custom" && host.firstElementChild;
    if (panel && panel.localName.includes("-")) thirdPartyElements.add(panel);
  }
}

function updateFrame(iframe, host, haCss) {
  if (!iframe.__neumorphismFrame) {
    iframe.__neumorphismFrame = true;
    // Neue Seite im Fenster (z. B. Navigation im Add-on): gleich anwenden, nicht erst beim nächsten Takt
    iframe.addEventListener("load", () => safely(() => updateFrame(iframe, host, haFrameCss())));
  }
  const doc = frameDocument(iframe);
  if (!doc?.head || !doc.body) return;
  const key = hostKey(host);
  if (host.localName === "ha-panel-custom") {
    // Seite einer Integration im eigenen Fenster: aus Home-Assistant-Bausteinen (HACS) oder eigene Oberfläche
    const registry = doc.defaultView.customElements;
    const haTags = ["ha-svg-icon", "ha-icon-button", "ha-card"];
    const haPage = haTags.some((tag) => registry?.get(tag));
    if (!haPage && registry && !doc.__neumorphismWaiting) {
      // Bausteine von Home Assistant kommen womöglich erst nach dem Laden (HACS): dann neu einordnen
      doc.__neumorphismWaiting = true;
      Promise.race(haTags.map((tag) => registry.whenDefined(tag))).then(() => scheduleTick());
    }
    if (!haPage && doc.readyState !== "complete") return; // Bausteine werden noch geladen
    if (haPage) {
      safely(() => localBrandIcons(doc.defaultView));
      if (scopes.has(doc)) resetScope(scopes.get(doc));
      const css = controlsActive && !settings().appsOff.includes(key) ? haCss : "";
      setFrameStyle(doc, css + (css ? HA_FRAME_EXTRA : ""));
      if (css) patchControls(doc.defaultView);
      return;
    }
  }
  updateForeignDoc(doc, key);
}

// Ältere Home-Assistant-Bausteine in HACS (eigene Kopie im eingebetteten Fenster)
const HA_FRAME_EXTRA = `
  :root, body { --md-assist-chip-outline-color: transparent; --md-sys-color-outline: transparent; }`;

// ---------------------------------------------------------------------------
// Symbole in HACS über Home Assistant laden
// ---------------------------------------------------------------------------
//
// HACS lädt die Symbole der Integrationen von brands.home-assistant.io. Dort kommen keine
// eigenen Integrationen mehr hinzu: Seit Home Assistant 2026.3 bringen sie ihr Symbol im
// Ordner brand/ selbst mit, und Home Assistant liefert es unter /api/brands/... aus (für alle
// anderen wie bisher aus der zentralen Sammlung, mit demselben Platzhalter). In HACS werden
// die Adressen deshalb auf Home Assistant umgestellt, für alle Integrationen. Ältere
// Versionen ohne diese Schnittstelle bleiben unverändert.

const BRANDS_CDN = /^https:\/\/brands\.home-assistant\.io\/(?:_\/)?([a-z0-9_]+)\/((?:dark_)?(?:icon|logo)(?:@2x)?\.png)$/;
const BRANDS_TOKEN_AGE = 20 * 60 * 1000; // Home Assistant wechselt den Schlüssel alle 30 Minuten
const brands = { token: "", time: 0, pending: false };
const brandOriginals = new WeakMap(); // Bild -> ursprüngliche Adresse (falls Home Assistant es nicht liefert)
const brandWatched = new WeakSet();

function refreshBrandsToken() {
  const hass = getHass();
  if (!hass?.callWS || brands.pending || Date.now() - brands.time < BRANDS_TOKEN_AGE) return;
  brands.pending = true;
  hass.callWS({ type: "brands/access_token" }).then(
    (result) => {
      const token = result?.token || "";
      const changed = token !== brands.token;
      Object.assign(brands, { token, time: Date.now(), pending: false });
      if (changed && token) scheduleTick(); // schon angezeigte Bilder umstellen
    },
    () => Object.assign(brands, { time: Date.now(), pending: false }) // ältere Version: später erneut
  );
}

const localBrandUrl = (url) => {
  const match = brands.token && typeof url === "string" && url.match(BRANDS_CDN);
  return match ? `/api/brands/integration/${match[1]}/${match[2]}?token=${brands.token}` : null;
};

/**
 * Bilder von Zuständen im Hauptfenster, z. B. die Updates aus HACS in den Einstellungen:
 * HACS gibt ihnen die Adresse von brands.home-assistant.io.
 */
function hookStateBadges() {
  customElements.whenDefined("state-badge").then(() => {
    const proto = customElements.get("state-badge").prototype;
    if (Object.prototype.hasOwnProperty.call(proto, "__neumorphismBrands")) return;
    const updated = proto.updated;
    proto.updated = function (...args) {
      const result = updated?.apply(this, args);
      const match = this.style.backgroundImage.match(/^url\("?(https:\/\/brands\.home-assistant\.io\/[^")]+)"?\)$/);
      const local = match && localBrandUrl(match[1]);
      if (local) this.style.backgroundImage = `url("${local}")`;
      return result;
    };
    proto.__neumorphismBrands = true;
  });
}

/** Stellt Bilder von brands.home-assistant.io im Fenster win auf Home Assistant um. */
function localBrandIcons(win) {
  refreshBrandsToken();
  if (!brands.token) return;
  if (!win.__neumorphismBrands) {
    win.__neumorphismBrands = true;
    // Bausteine setzen die Bildadresse als Attribut, auch beim Wiederverwenden von Zeilen
    const setAttribute = win.Element.prototype.setAttribute;
    const restore = (ev) => {
      const original = brandOriginals.get(ev.target);
      if (original) setAttribute.call(ev.target, "src", original);
      brandOriginals.delete(ev.target);
    };
    win.Element.prototype.setAttribute = function (name, value) {
      if (name === "src" && this.localName === "img") {
        const local = localBrandUrl(value);
        if (local) {
          if (!brandWatched.has(this)) this.addEventListener("error", restore);
          brandWatched.add(this);
          brandOriginals.set(this, value);
          return setAttribute.call(this, name, local);
        }
      }
      return setAttribute.call(this, name, value);
    };
  }
  // Schon angezeigte Bilder (einmal pro Schlüssel)
  if (win.__neumorphismBrandsToken === brands.token) return;
  win.__neumorphismBrandsToken = brands.token;
  for (const img of findAllDeep('img[src^="https://brands.home-assistant.io/"]', win.document)) {
    img.setAttribute("src", img.getAttribute("src"));
  }
}

// ---------------------------------------------------------------------------
// Fremde Oberflächen: Add-ons, Seiten von Integrationen, alles nicht von Home Assistant
// ---------------------------------------------------------------------------
//
// Eine Einordnung für alles, was nicht von Home Assistant stammt: Oberflächen von
// Add-ons, Seiten und Dialoge von Integrationen, Webseiten-Karten. Jedes Element
// wird nach Farbe und Form eingeordnet:
//   - Seitenhintergrund, Leisten und große neutrale Flächen -> Theme-Hintergrund, flach
//   - neutrale Flächen mit Rundung, Rahmen oder Schatten (Karten, Dialoge, Menüs)
//     -> erhaben; kleinere Flächen darin -> eingelassen
//   - Knöpfe -> erhaben, gedrückt eingelassen; kräftig gefärbte behalten ihre Farbe
//   - Eingabe- und Auswahlfelder, Code-Editoren -> eingelassen
//   - neutral hervorgehobene Einträge (gewählte Zeile) -> eingelassen
//   - neutrale Schrift und Linien -> Farben des Themes; farbige Schrift bleibt
// Ganze Seiten in eingebetteten Fenstern bekommen zusätzlich die Theme-Variablen,
// ihre eigenen Farb-Variablen werden umgestellt und ihr Dunkelmodus folgt Home Assistant.
// Bilder, Grafiken, Videos und Verläufe bleiben unberührt. Bausteine von Home Assistant
// mitten in einer fremden Seite behalten ihre eigenen Regeln.

const FX = "nm-x"; // Einordnung der Fläche
const FX_FG = "nm-x-fg"; // 1 = Schrift, 2 = leise Schrift
const FX_LINE = "nm-x-line"; // Linien in der Farbe der Trennlinien
const FX_ROUND = "nm-x-round"; // eckige Bausteine abrunden
const FX_PRESS = "nm-x-press"; // gedrückt eingelassen
const FX_INVERT = "nm-x-invert"; // heller Code-Editor im Dunkelmodus
const FX_MARKS = [FX, FX_FG, FX_LINE, FX_ROUND, FX_PRESS, FX_INVERT];

const FOREIGN_VARS = {
  bg: "primary-background-color",
  surface: "card-background-color",
  text: "primary-text-color",
  text2: "secondary-text-color",
  divider: "divider-color",
  primary: "primary-color",
  accent: "accent-color",
  "on-primary": "text-primary-color",
  raised: "neumorphism-raised-shadow",
  "raised-l": "neumorphism-raised-shadow-l",
  card: "neumorphism-card-shadow",
  inset: "neumorphism-inset-shadow",
  "inset-s": "neumorphism-inset-shadow-s",
  sheen: "neumorphism-surface-image",
};

/** Theme-Werte unter eigenem Namen, damit sie sich nicht mit Variablen der Seite mischen. */
function foreignVarsCss(resolved) {
  const css = getComputedStyle(document.documentElement);
  const vars = Object.entries(FOREIGN_VARS).map(
    ([key, name]) => `--nm-${key}: ${resolved ? css.getPropertyValue(`--${name}`).trim() : `var(--${name})`};`
  );
  return vars.join(" ");
}

// Regeln für eingeordnete Elemente (im Hauptfenster, in eingebetteten Seiten und ihren Shadow DOMs)
const FOREIGN_MARK_STYLE = `
  [nm-x="flat"] { background-color: var(--nm-bg) !important; box-shadow: none !important; }
  [nm-x="plain"] { background-color: var(--nm-surface) !important; box-shadow: none !important; }
  [nm-x="raised"], [nm-x="raised-l"] { background-color: var(--nm-surface) !important;
    background-image: var(--nm-sheen) !important; border-color: transparent !important; box-shadow: var(--nm-raised) !important; }
  [nm-x="raised-l"] { box-shadow: var(--nm-card) !important; }
  [nm-x="accent"] { border-color: transparent !important; box-shadow: var(--nm-raised) !important; }
  [nm-x="sunken"], [nm-x="field"] { background-color: var(--nm-bg) !important;
    border-color: transparent !important; box-shadow: var(--nm-inset-s) !important; }
  [nm-x="field"]:focus, [nm-x="field"]:focus-within { outline: none !important;
    box-shadow: var(--nm-inset-s), 0 0 0 2px color-mix(in srgb, var(--nm-primary) 55%, transparent) !important; }
  [nm-x="field"]::placeholder { color: var(--nm-text2) !important; opacity: 0.8 !important; }
  [nm-x="code"] { border-color: transparent !important; box-shadow: var(--nm-inset) !important; }
  [nm-x="tab"] { border-color: transparent !important; box-shadow: none !important; }
  [nm-x="tab-on"] { background-color: var(--nm-surface) !important; background-image: var(--nm-sheen) !important; border-color: transparent !important;
    box-shadow: var(--nm-raised) !important; border-radius: 999px !important; }
  [nm-x="tablist"] { border-color: transparent !important; box-shadow: none !important; }
  [nm-x-invert] { filter: invert(1) hue-rotate(180deg) !important; }
  [nm-x-press]:active { box-shadow: var(--nm-inset-s) !important; }
  [nm-x-press]:focus-visible { outline: 2px solid var(--nm-primary) !important; outline-offset: 2px; }
  [nm-x-round="s"] { border-radius: 10px !important; }
  [nm-x-round="l"] { border-radius: 16px !important; }
  [nm-x-fg="1"] { color: var(--nm-text) !important; }
  [nm-x-fg="2"] { color: var(--nm-text2) !important; }
  [nm-x-line] { border-color: var(--nm-divider) !important; }
`;
// Nur für ganze Seiten in eingebetteten Fenstern
const FOREIGN_PAGE_STYLE = `
  :root { color-scheme: var(--nm-scheme); accent-color: var(--nm-primary); }
  html { background-color: var(--nm-bg); }
`;
const MAIN_FOREIGN_STYLE_ID = "neumorphism-foreign";

// Nicht einordnen (samt Inhalt): Grafiken, Medien, Skripte, eingebettete Seiten
const FOREIGN_SKIP = new Set([
  "svg", "canvas", "img", "video", "picture", "iframe", "object", "embed", "audio", "script", "style",
  "link", "meta", "template", "noscript", "br", "wbr", "option", "optgroup", "head", "title", "math", "slot",
]);
// Code-Editoren und Terminals: eingelassen, ihr Inneres bleibt unverändert
const CODE_SELECTOR = ".cm-editor, .CodeMirror, .monaco-editor, .ace_editor, .xterm";
const FIELD_SELECTOR = [
  "textarea", "select", "input:not([type])",
  ...["text", "search", "email", "password", "number", "url", "tel", "date", "time", "datetime-local", "month", "week"].map(
    (type) => `input[type="${type}"]`
  ),
  '[contenteditable=""]', '[contenteditable="true"]',
  '[role="textbox"]', '[role="searchbox"]', '[role="combobox"]', '[role="spinbutton"]',
].join(", ");
const BUTTON_SELECTOR = 'button, input[type="button"], input[type="submit"], input[type="reset"], [role="button"], summary';
const TABLE_TAGS = /^(table|thead|tbody|tfoot|tr|td|th|caption|colgroup|col)$/;
const MAX_DEEP = 3000; // so viele Elemente pro Änderung höchstens neu einordnen

// Bereiche, die eingeordnet werden: ganze Seiten (Schlüssel: Dokument) oder fremde
// Bausteine im Hauptfenster (Schlüssel: Element)
const scopes = new Map();
const foreignInfo = new WeakMap(); // Element -> ursprüngliche Farben (vor dem Formen)
const foreignRole = new WeakMap(); // Element -> Einordnung
const skippedRoots = new WeakMap(); // fremde Bausteine ohne sichtbare Fläche -> Anzahl Versuche

function rgbToOklch({ r, g, b }) {
  return hexToOklch(rgbToHex([r / 255, g / 255, b / 255]));
}
// Grau, auch leicht bläulich; helle Töne gelten schon bei wenig Farbe als farbig (Markierungen)
const isNeutral = (c) => {
  const [L, C] = rgbToOklch(c);
  return C < (L < 0.5 ? 0.045 : 0.022);
};
const lum = ({ r, g, b }) => 0.2126 * toLinear(r / 255) + 0.7152 * toLinear(g / 255) + 0.0722 * toLinear(b / 255);
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const sameColor = (a, b) => a && b && Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 3;
const parentOf = (el) => el.parentElement || el.getRootNode().host || null;

/** Fremde Bausteine im Hauptfenster: Seiten, Dialoge und alles außerhalb von Dashboard-Karten. */
function updateForeignElements() {
  const enabled = foreignOn();
  let style = document.getElementById(MAIN_FOREIGN_STYLE_ID);
  if (!style && enabled) {
    style = document.createElement("style");
    style.id = MAIN_FOREIGN_STYLE_ID;
    document.head.appendChild(style);
  }
  const css = enabled ? `html { ${foreignVarsCss(false)} }\n${FOREIGN_MARK_STYLE}` : "";
  if (style && style.textContent !== css) style.textContent = css;

  for (const el of thirdPartyElements) {
    if (!el.isConnected) {
      thirdPartyElements.delete(el);
      continue;
    }
    if (scopes.has(el) || !enabled) continue;
    const context = foreignContext(el);
    if (!context) {
      thirdPartyElements.delete(el); // in einer Dashboard-Karte oder in einem schon erfassten Bereich
      continue;
    }
    if (!foreignEnabled(context.key)) continue; // Ausnahme in den Einstellungen
    // Noch ohne Fläche (wird gerade aufgebaut) oder unsichtbar (z. B. reine Stil-Helfer): später erneut
    const rect = el.getBoundingClientRect();
    if (!rect.width && !rect.height && !el.shadowRoot?.childElementCount) {
      const tries = (skippedRoots.get(el) || 0) + 1;
      skippedRoots.set(el, tries);
      if (tries > 5) thirdPartyElements.delete(el);
      continue;
    }
    startScope({ key: el, doc: document, view: window, page: false, exception: context.key });
  }

  // Geschlossene oder ersetzte Fenster (Add-on verlassen, neue Seite im Fenster): vergessen
  for (const state of [...scopes.values()]) {
    if (!state.page || (state.doc.defaultView && state.view.frameElement?.isConnected)) continue;
    state.observer.disconnect();
    clearTimeout(state.timer);
    scopes.delete(state.key);
  }
  for (const doc of sheetSets.keys()) if (doc !== document && !doc.defaultView) sheetSets.delete(doc);

  const dark = haDark();
  for (const state of [...scopes.values()]) {
    if (state.page) continue;
    if (!state.key.isConnected || !enabled || !foreignEnabled(state.exception)) {
      resetScope(state);
      if (state.key.isConnected) thirdPartyElements.add(state.key); // wieder aufnehmen, sobald eingeschaltet
      continue;
    }
    const colors = themeKey();
    if (state.colorsKey !== colors) {
      state.colorsKey = colors;
      state.colors = foreignColors();
    }
    if (state.dark !== dark) {
      if (state.dark !== null) queueForeign(state, state.key, true); // Code-Editoren neu einordnen
      state.dark = dark;
    }
  }
}

/**
 * Wo liegt ein fremder Baustein? Null, wenn er schon erfasst ist (in einer Dashboard-Karte,
 * die die Karten-Formung übernimmt, oder in einem anderen Bereich).
 */
function foreignContext(el) {
  let key = "";
  for (let node = parentOf(el); node; node = parentOf(node)) {
    if (node.localName === "hui-card" || scopes.has(node)) return null;
    if (node.localName === "ha-panel-custom" && !key) key = hostKey(node);
  }
  return { key };
}

const themeKey = () => `${applied}|${haDark()}`;

/** Ganze Seite in einem eingebetteten Fenster (Add-on, Webseiten-Karte). */
function updateForeignDoc(doc, key) {
  let state = scopes.get(doc);
  if (!foreignEnabled(key)) {
    if (state) resetScope(state);
    return;
  }
  if (!state) state = startScope({ key: doc, doc, view: doc.defaultView, page: true, exception: key });
  const dark = haDark();
  if (state.dark !== null && state.dark !== dark) queueForeign(state, doc.documentElement, true);
  state.dark = dark;
  setForeignMode(state, dark);
  const vars = `:root { ${foreignVarsCss(true)} --nm-scheme: ${dark ? "dark" : "light"}; }`;
  const css = `${haFrameCss(true)}\n${vars}\n${foreignTokens(state)}\n${FOREIGN_PAGE_STYLE}\n${FOREIGN_MARK_STYLE}`;
  setFrameStyle(doc, css);
  if (state.css !== css) {
    state.css = css;
    state.colors = foreignColors();
  }
}

// Farb-Variablen der Seite (z. B. Node-RED, Zigbee2MQTT, Web Awesome, Vuetify, Bootstrap):
// neutrale Hintergründe, Schriften und Linien und die Primärfarbe auf das Theme umstellen.
const TOKEN_LINE = /border|divider|outline|separator|stroke|(^|-)rule/i;
const TOKEN_BG = /background|(^|-)bg($|-)|backdrop/i;
const TOKEN_TEXT = /text|content|foreground|(^|-)fg($|-)|(^|-)ink|(^|-)on-/i;
const TOKEN_SURFACE = /surface|base|fill|canvas|paper|panel|menu|card|popover|dropdown|header|sidebar|toolbar|tooltip/i;
const TOKEN_PRIMARY = /(^|[-_])(primary|brand)([-_](color|main|base|default))?$/i;
const TOKEN_ON_PRIMARY = /((primary|brand)[-_]?(content|contrast[-_]?text|contrast|foreground)|on[-_]?(primary|brand))$/i;
// Statusfarben und Schrift auf anderen Farbflächen bleiben
const TOKEN_KEEP = /brand|accent|success|info|warning|error|danger|critical|alert|secondary[-_]?(content|on)|on[-_]?secondary/i;
const TOKEN_TARGETS = ':root, body, [data-theme], [data-bs-theme], [class*="theme"]';
const HSL_TRIPLET = /^(\d+(?:\.\d+)?)(?:deg)?\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/; // z. B. "0 0% 100%" (shadcn)
const RGB_TRIPLET = /^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/; // z. B. "255,255,255" (Vuetify)

function tokenColor(value) {
  let m = value.match(HSL_TRIPLET);
  if (m) return { color: parseColor(toRgb(`hsl(${m[1]} ${m[2]}% ${m[3]}%)`)), format: "hsl" };
  m = value.match(RGB_TRIPLET);
  if (m) return { color: { r: +m[1], g: +m[2], b: +m[3], a: 1 }, format: "rgb" };
  if (!CSS.supports("color", value) || /currentcolor|inherit|transparent/i.test(value)) return null;
  return { color: parseColor(toRgb(value)), format: "color" };
}

function rgbToHslTriplet({ r, g, b }) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return `${Math.round(((h * 60) + 360) % 360)} ${Math.round(sat * 1000) / 10}% ${Math.round(l * 1000) / 10}%`;
}

/** Liest die Farb-Variablen der Seite (ohne die eigene Umstellung) und ordnet sie zu. */
function foreignTokens(state) {
  const style = state.doc.getElementById(FRAME_STYLE_ID);
  const count = state.view.getComputedStyle(state.doc.documentElement).length;
  const key = `${count}|${themeKey()}`;
  if (state.tokenKey === key) return state.tokens;
  if (style?.sheet) style.sheet.disabled = true;
  try {
    const view = state.view;
    const cs = view.getComputedStyle(state.doc.documentElement);
    const page = [state.doc.body, state.doc.documentElement]
      .map((el) => parseColor(view.getComputedStyle(el).backgroundColor))
      .find((c) => c && c.a >= 0.5) || { r: 255, g: 255, b: 255, a: 1 };
    const theme = themeColors();
    const lines = [];
    for (const name of cs) {
      if (!name.startsWith("--") || name.startsWith("--nm-")) continue;
      const value = cs.getPropertyValue(name).trim();
      if (!value || value.length > 60) continue;
      const parsed = tokenColor(value);
      if (!parsed?.color || parsed.color.a < 0.9) continue;
      let kind = null;
      if (TOKEN_ON_PRIMARY.test(name)) kind = "on-primary";
      else if (TOKEN_PRIMARY.test(name)) kind = isNeutral(parsed.color) ? null : "primary";
      else if (!TOKEN_KEEP.test(name) && isNeutral(parsed.color)) {
        kind = TOKEN_LINE.test(name) ? "divider" : TOKEN_BG.test(name) ? "bg" : TOKEN_TEXT.test(name) ? "text" : TOKEN_SURFACE.test(name) ? "bg" : null;
        if (kind === "text" && contrast(parsed.color, page) < 4.5) kind = "text2";
      }
      if (!kind) continue;
      const target = theme[kind];
      const out =
        parsed.format === "hsl" ? rgbToHslTriplet(target)
        : parsed.format === "rgb" ? `${Math.round(target.r)},${Math.round(target.g)},${Math.round(target.b)}`
        : `var(--nm-${kind})`;
      lines.push(`${name}: ${out} !important;`);
    }
    state.tokens = lines.length ? `${TOKEN_TARGETS} { ${lines.join(" ")} }` : "";
  } finally {
    if (style?.sheet) style.sheet.disabled = false;
  }
  state.tokenKey = key;
  return state.tokens;
}

/** Theme-Farben als RGB (für Variablen, die Farben als Zahlen ablegen); Linien auf den Hintergrund gemischt. */
function themeColors() {
  const css = getComputedStyle(document.documentElement);
  const get = (name) => parseColor(toRgb(css.getPropertyValue(`--${name}`).trim())) || { r: 0, g: 0, b: 0, a: 1 };
  const bg = get("primary-background-color");
  const line = get("divider-color");
  const mix = (key) => line[key] * line.a + bg[key] * (1 - line.a);
  return {
    bg,
    text: get("primary-text-color"),
    text2: get("secondary-text-color"),
    divider: { r: mix("r"), g: mix("g"), b: mix("b"), a: 1 },
    primary: get("primary-color"),
    "on-primary": get("text-primary-color"),
  };
}

// Hell/Dunkel der Seite an Home Assistant anpassen, wo die Seite das selbst anbietet.
// Gesucht wird in ihren Stylesheets nach Schaltern an <html> oder <body>, z. B. die Klasse
// "dark" (Tailwind), "nr-theme-dark" oder Attribute wie data-theme="dark" und data-bs-theme="dark".
// Vorhandene Klassen und Attribute mit light/dark (z. B. wa-light) werden umgeschaltet.
const MODE_ATTRS = ["data-theme", "data-bs-theme", "data-color-scheme", "data-color-mode", "data-mode", "theme"];
const MODE_CLASS = /^((?:.*[-_])?(?:theme|mode|scheme)[-_]{0,2}|wa-|)(light|dark)$/i;
const DARK_CLASS = /^dark$|(theme|mode|scheme).*dark|dark.*(theme|mode|scheme)/i;
const DARK_ATTR = /theme|mode|scheme/i;

/** Schalter für den Dunkelmodus aus den Stylesheets der Seite. */
function scanDarkHooks(doc) {
  const hooks = new Map(); // "class:html:dark" -> { kind, target, name, value }
  const visit = (rules) => {
    for (const rule of rules) {
      if (rule.cssRules && !rule.selectorText) {
        visit(rule.cssRules); // @media, @supports, @layer
        continue;
      }
      const text = rule.selectorText;
      if (!text || !/dark/i.test(text)) continue;
      for (const part of text.split(",")) {
        const sel = part.trim().replace(/^:(is|where)\(/, "");
        const head = sel.split(/[\s>+~(]/)[0];
        if (!/^(html|:root|body)?[.[]/.test(head)) continue;
        const target = head.startsWith("body") ? "body" : "html";
        for (const m of head.matchAll(/\.([\w-]*dark[\w-]*)/gi)) {
          if (DARK_CLASS.test(m[1])) hooks.set(`class:${target}:${m[1]}`, { kind: "class", target, name: m[1] });
        }
        for (const m of head.matchAll(/\[([\w-]+)=["']?([\w-]*dark[\w-]*)["']?\]/gi)) {
          if (DARK_ATTR.test(m[1])) hooks.set(`attr:${target}:${m[1]}`, { kind: "attr", target, name: m[1], value: m[2] });
        }
      }
    }
  };
  for (const sheet of doc.styleSheets) {
    try {
      visit(sheet.cssRules);
    } catch {
      // Stylesheet von fremder Adresse: nicht lesbar
    }
  }
  return [...hooks.values()];
}

function setForeignMode(state, dark) {
  const doc = state.doc;
  const mode = dark ? "dark" : "light";
  const record = (key, undo) => {
    if (!state.undo.has(key)) state.undo.set(key, undo);
  };
  const elements = { html: doc.documentElement, body: doc.body };
  // Vorhandene Schalter umstellen
  for (const el of Object.values(elements)) {
    for (const attr of MODE_ATTRS) {
      const value = el.getAttribute(attr);
      if ((value === "light" || value === "dark") && value !== mode) {
        record(`${el.tagName}:${attr}`, () => el.setAttribute(attr, value));
        el.setAttribute(attr, mode);
      }
    }
    for (const cls of [...el.classList]) {
      const m = cls.match(MODE_CLASS);
      if (!m || m[2].toLowerCase() === mode) continue;
      const other = m[1] + (m[2] === m[2].toUpperCase() ? mode.toUpperCase() : mode);
      record(`${el.tagName}:${cls}`, () => el.classList.replace(other, cls));
      el.classList.replace(cls, other);
    }
  }
  // Schalter aus den Stylesheets (neu suchen, wenn Stylesheets dazukommen)
  if (state.hookSheets !== doc.styleSheets.length) {
    state.hookSheets = doc.styleSheets.length;
    state.hooks = scanDarkHooks(doc);
  }
  for (const hook of state.hooks) {
    const el = elements[hook.target];
    if (!el) continue;
    if (hook.kind === "class") {
      const has = el.classList.contains(hook.name);
      if (has === dark) continue;
      record(`${hook.target}:class:${hook.name}`, () => el.classList.toggle(hook.name, has));
      el.classList.toggle(hook.name, dark);
    } else {
      const value = el.getAttribute(hook.name);
      if (dark ? value === hook.value : value !== hook.value) continue;
      record(`${hook.target}:attr:${hook.name}`, () => (value === null ? el.removeAttribute(hook.name) : el.setAttribute(hook.name, value)));
      if (dark) el.setAttribute(hook.name, hook.value);
      else el.setAttribute(hook.name, "light");
    }
  }
}

/** Aufgelöste Schriftfarben des Themes: geerbte Schrift erkennen statt erneut einordnen. */
function foreignColors() {
  const css = getComputedStyle(document.documentElement);
  return [css.getPropertyValue("--primary-text-color"), css.getPropertyValue("--secondary-text-color")].map((v) =>
    parseColor(toRgb(v.trim()))
  );
}

let colorProbe = null;
const rgbCache = new Map();

function toRgb(color) {
  let rgb = rgbCache.get(color);
  if (rgb === undefined) {
    if (rgbCache.size > 1000) rgbCache.clear();
    rgb = readRgb(color);
    // Mit Variablen hängt das Ergebnis vom Theme ab
    if (!color.includes("var(")) rgbCache.set(color, rgb);
  }
  return rgb;
}

function readRgb(color) {
  if (!colorProbe) {
    colorProbe = document.createElement("div");
    colorProbe.style.cssText = "position:absolute;width:0;height:0;visibility:hidden;pointer-events:none;";
    document.body.appendChild(colorProbe);
  }
  colorProbe.style.color = "";
  colorProbe.style.color = color;
  return getComputedStyle(colorProbe).color;
}

/**
 * Neuer Bereich: ganze Seite (page) oder fremder Baustein im Hauptfenster.
 * exception = Schlüssel für Ausnahmen in den Einstellungen.
 */
function startScope({ key, doc, view, page, exception }) {
  const state = {
    key,
    doc,
    view,
    page,
    exception,
    css: "",
    colors: foreignColors(),
    colorsKey: themeKey(),
    tokens: "",
    tokenKey: "",
    hooks: [],
    hookSheets: -1,
    dark: null,
    undo: new Map(), // Änderungen an Hell/Dunkel der Seite, zum Zurücksetzen
    roots: new WeakSet(),
    queue: new Map(), // Element -> mit Inhalt?
    timer: 0,
    last: 0,
    observer: new view.MutationObserver((records) => onForeignMutations(state, records)),
  };
  scopes.set(key, state);
  if (page) {
    observeForeignRoot(state, doc);
    queueForeign(state, doc.documentElement, true);
  } else {
    observeForeignRoot(state, key); // Inhalt im Light DOM
    queueForeign(state, key, true);
  }
  return state;
}

const foreignMarkSheets = new WeakMap(); // Fenster -> Stylesheet für die Markierungen

function observeForeignRoot(state, root) {
  if (state.roots.has(root)) return;
  state.roots.add(root);
  if (root instanceof state.view.ShadowRoot) {
    // Ein gemeinsames Stylesheet je Fenster; wirkt nur auf markierte Elemente und bleibt deshalb hängen
    let sheet = foreignMarkSheets.get(state.view);
    if (!sheet) {
      sheet = new state.view.CSSStyleSheet();
      sheet.replaceSync(FOREIGN_MARK_STYLE);
      foreignMarkSheets.set(state.view, sheet);
    }
    if (!root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  }
  state.observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden", "open", "disabled", "checked", "selected", "aria-selected", "aria-expanded", "aria-pressed", "aria-current", "data-state", "data-active"],
  });
}

function onForeignMutations(state, records) {
  for (const record of records) {
    if (record.type === "childList") {
      for (const node of record.addedNodes) if (node.nodeType === 1) queueForeign(state, node, true);
    } else if (record.target.nodeType === 1) {
      queueForeign(state, record.target, true);
    }
  }
}

function queueForeign(state, el, deep) {
  if (!el || FOREIGN_SKIP.has(el.localName) || el.closest?.("svg")) return;
  state.queue.set(el, deep || state.queue.get(el) || false);
  if (state.timer) return;
  // Viele Änderungen (z. B. beim Ziehen) gebündelt, höchstens etwa sechsmal pro Sekunde
  const wait = Math.max(0, state.last + 160 - Date.now());
  state.timer = setTimeout(() => state.view.requestAnimationFrame(() => safely(() => runForeign(state))), wait);
}

function resetScope(state) {
  state.observer.disconnect();
  scopes.delete(state.key);
  for (const undo of [...state.undo.values()].reverse()) safely(undo);
  if (state.page) state.doc.getElementById(FRAME_STYLE_ID)?.remove();
  const selector = FX_MARKS.map((m) => `[${m}]`).join(",");
  const start = state.page ? state.doc : state.key;
  const stack = [start];
  if (!state.page && state.key.shadowRoot) stack.push(state.key.shadowRoot);
  while (stack.length) {
    const root = stack.pop();
    if (root.nodeType === 1) for (const m of FX_MARKS) root.removeAttribute(m);
    for (const el of root.querySelectorAll(selector)) for (const m of FX_MARKS) el.removeAttribute(m);
    for (const el of root.querySelectorAll("*")) if (el.shadowRoot) stack.push(el.shadowRoot);
  }
}

/** Elemente in Dokumentreihenfolge, durch offene Shadow-DOMs hindurch. */
function collectForeign(state, el, deep, out, seen) {
  if (seen.has(el) || FOREIGN_SKIP.has(el.localName)) return;
  seen.add(el);
  // Bausteine von Home Assistant mitten in einer fremden Seite: eigene Regeln, nur ihr
  // Inhalt aus der fremden Seite (Light DOM) wird eingeordnet
  // Dashboard-Karten formt die Karten-Formung (auch in fremden Seiten)
  if (!state.page && el.localName === "hui-card") return;
  if (!state.page && el !== state.key && isCoreElement(el, state.key)) {
    if (deep) for (const child of el.children) collectForeign(state, child, true, out, seen);
    return;
  }
  out.push(el);
  if (!deep || out.length > MAX_DEEP || el.matches(CODE_SELECTOR)) return;
  if (el.shadowRoot) {
    observeForeignRoot(state, el.shadowRoot);
    for (const child of el.shadowRoot.children) collectForeign(state, child, true, out, seen);
  }
  for (const child of el.children) collectForeign(state, child, true, out, seen);
}

function runForeign(state) {
  state.timer = 0;
  state.last = Date.now();
  if (scopes.get(state.key) !== state || !state.doc.defaultView) return;
  const list = [];
  const seen = new Set();
  for (const [el, deep] of state.queue) if (el.isConnected) collectForeign(state, el, deep, list, seen);
  state.queue.clear();
  // Ein Durchgang: erst alle Markierungen lösen, dann lesen, dann schreiben (kein Hin und Her im Layout)
  for (const el of list) for (const m of FX_MARKS) if (el.hasAttribute(m)) el.removeAttribute(m);
  const infos = list.map((el) => readForeign(state, el));
  const view = { w: state.view.innerWidth, h: state.view.innerHeight };
  const results = list.map((el, i) => decideForeign(state, el, infos[i], view));
  list.forEach((el, i) => writeForeign(el, results[i]));
}

function readForeign(state, el) {
  const cs = state.view.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  let text = el.childElementCount === 0;
  if (!text) for (const n of el.childNodes) if (n.nodeType === 3 && n.data.trim()) { text = true; break; }
  const info = {
    cs,
    rect,
    text,
    bg: parseColor(cs.backgroundColor) || { r: 0, g: 0, b: 0, a: 0 },
    image: cs.backgroundImage !== "none",
    color: parseColor(cs.color),
    hidden: cs.display === "none" || cs.visibility === "hidden" || (!rect.width && !rect.height),
  };
  foreignInfo.set(el, info);
  return info;
}

/** Ursprüngliche Hintergrundfarbe unter einem Element (über Eltern hinweg). */
function effectiveBg(el, state) {
  for (let node = el; node; node = parentOf(node)) {
    const info = foreignInfo.get(node);
    if (info) {
      if (info.image) return null; // Bild oder Verlauf: Schrift nicht anfassen
      if (info.bg.a >= 0.5) return info.bg;
    } else if (!state.page && node.nodeType === 1) {
      // Im Hauptfenster: Hintergrund eines Bausteins von Home Assistant (Karte, Dialog ...)
      const bg = parseColor(getComputedStyle(node).backgroundColor);
      if (bg && bg.a >= 0.5) return bg;
    }
  }
  if (!state.page) return parseColor(toRgb(getComputedStyle(document.documentElement).getPropertyValue("--primary-background-color").trim()));
  return { r: 255, g: 255, b: 255, a: 1 };
}

/** Sichtbarer Rahmen; box = rundherum (Umrandung), sonst Trennlinie. */
function borderInfo(cs) {
  const sides = ["Top", "Right", "Bottom", "Left"].filter((side) => {
    const color = parseColor(cs[`border${side}Color`]);
    return (parseFloat(cs[`border${side}Width`]) || 0) > 0 && color && color.a >= 0.1;
  });
  if (!sides.length) return null;
  return { box: sides.length === 4, neutral: isNeutral(parseColor(cs[`border${sides[0]}Color`])) };
}

/**
 * Neutral hervorgehobener Eintrag (gewählte Zeile, aktiver Menüpunkt): gleichartige Geschwister
 * gleicher Größe haben einen anderen Hintergrund.
 */
function highlighted(el, info) {
  const { rect, bg } = info;
  if (rect.height > 72 || bg.a < 0.5) return false;
  const parent = el.parentElement;
  if (!parent || parent.childElementCount > 200) return false;
  const lightness = rgbToOklch(bg)[0];
  for (const sibling of parent.children) {
    if (sibling === el || sibling.localName !== el.localName) continue;
    const other = foreignInfo.get(sibling);
    if (!other || other.hidden) continue;
    if (Math.abs(other.rect.height - rect.height) > rect.height * 0.3 || Math.abs(other.rect.width - rect.width) > rect.width * 0.1) continue;
    if (other.bg.a < 0.5 || Math.abs(rgbToOklch(other.bg)[0] - lightness) > 0.03) return true;
  }
  return false;
}

function nearestRole(el) {
  for (let node = parentOf(el); node; node = parentOf(node)) {
    const role = foreignRole.get(node);
    if (role && ["raised", "raised-l", "sunken", "field", "accent", "plain"].includes(role.kind)) return { node, ...role };
  }
  return null;
}

/** Hintergrund eines Code-Editors (auch wenn er auf einem inneren Element liegt). */
function editorBg(el, view) {
  for (const node of [el, el.firstElementChild, el.querySelector(".cm-scroller, .monaco-editor-background, .ace_scroller, .xterm-viewport")]) {
    if (!node) continue;
    const bg = parseColor(view.getComputedStyle(node).backgroundColor);
    if (bg && bg.a >= 0.5) return bg;
  }
  return null;
}

function decideForeign(state, el, info, view) {
  const result = { kind: null, fg: null, line: false, round: null, press: false, invert: false };
  foreignRole.set(el, result);
  if (el.matches(CODE_SELECTOR)) {
    result.kind = "code";
    // Heller Editor im Dunkelmodus: umkehren, statt eine weiße Fläche stehen zu lassen
    const bg = editorBg(el, state.view);
    result.invert = !!bg && haDark() && lum(bg) > 0.45;
    return result;
  }
  const { cs, rect, bg } = info;
  const w = rect.width;
  const h = rect.height;
  const area = w * h;
  const screen = view.w * view.h;
  const hasBg = bg.a >= 0.05 && !info.image;
  const neutralBg = hasBg && isNeutral(bg);
  const radius = parseFloat(cs.borderTopLeftRadius) || 0;
  const border = borderInfo(cs);
  const shadow = cs.boxShadow !== "none";
  const field = el.matches(FIELD_SELECTOR);
  const button = !field && (el.matches(BUTTON_SELECTOR) || (el.localName === "a" && (hasBg || border?.box)));
  const visible = !info.hidden && w > 0 && h > 0;

  const role = el.getAttribute("role");
  if (visible && role === "tablist") {
    result.kind = "tablist";
  } else if (visible && role === "tab") {
    // Reiter (nach ARIA): der gewählte als erhabene Pille wie in Home Assistant, kräftig gefärbte bleiben
    const selected = el.getAttribute("aria-selected") === "true" || el.getAttribute("aria-current") === "page";
    result.kind = selected ? (hasBg && !neutralBg ? "accent" : "tab-on") : "tab";
  } else if (visible) {
    if (field && (hasBg || border || shadow)) {
      result.kind = "field";
      if (radius < 4 && h < 120) result.round = "s";
    } else if (button && w >= 16 && h >= 16 && area < screen * 0.25 && (hasBg || border?.box)) {
      result.kind = neutralBg || !hasBg ? "raised" : "accent";
      result.press = true;
      if (radius < 4) result.round = "s";
    } else if (hasBg && !neutralBg) {
      // farbige Fläche: Chips und Abzeichen erhaben, große Flächen (Leisten, Banner) bleiben
      if (radius >= 4 && w >= 20 && h >= 14 && area < screen * 0.1) result.kind = "accent";
    } else if (neutralBg) {
      // Leisten und Seitenleisten: eckig über (fast) die ganze Breite oder Höhe des Fensters oder Elternelements
      const outer = parentOf(el)?.getBoundingClientRect();
      const edge =
        w >= view.w * 0.9 || h >= view.h * 0.9 || (radius < 4 && outer && (w >= outer.width * 0.95 || h >= outer.height * 0.95));
      if (!TABLE_TAGS.test(el.localName) && highlighted(el, info)) {
        result.kind = "sunken"; // gewählter Eintrag in einer Liste
      } else if (area > screen * 0.6 || edge || TABLE_TAGS.test(el.localName)) {
        if (bg.a >= 0.9) result.kind = "flat";
      } else if ((radius >= 4 || shadow || border?.box || cs.backdropFilter !== "none") && w >= 40 && h >= 24) {
        result.kind = area >= 200 * 120 ? "raised-l" : "raised";
        if (radius < 4) result.round = result.kind === "raised-l" ? "l" : "s";
      } else if (bg.a >= 0.9) {
        result.kind = "flat";
      }
    }
    // Fläche in einer Fläche: über die ganze Breite gehört sie zur Fläche, sonst eingelassen
    if (result.kind === "raised" || result.kind === "raised-l") {
      const outer = !result.press && nearestRole(el);
      if (outer && outer.kind !== "accent") {
        const outerWidth = outer.node.getBoundingClientRect().width;
        result.kind = w >= outerWidth * 0.9 ? "plain" : "sunken";
        if (result.kind === "plain") result.round = null;
      }
    }
  }
  if (border?.neutral && !["raised", "raised-l", "sunken", "field", "accent", "code", "tab", "tab-on", "tablist"].includes(result.kind)) result.line = true;

  // Schrift: neutrale Farben auf neutralem Grund folgen dem Theme
  const color = info.color;
  if ((info.text || field || button) && color && color.a >= 0.3 && isNeutral(color)) {
    const under = hasBg && bg.a >= 0.5 ? bg : effectiveBg(parentOf(el) || el, state);
    const [text, text2] = state.colors;
    const inherited = sameColor(color, text) || sameColor(color, text2);
    if (under && isNeutral(under) && !inherited) {
      result.fg = contrast(color, under) < 4.5 || color.a < 0.8 ? "2" : "1";
    }
  }
  return result;
}

function writeForeign(el, result) {
  if (result.kind) el.setAttribute(FX, result.kind);
  if (result.fg) el.setAttribute(FX_FG, result.fg);
  if (result.line) el.setAttribute(FX_LINE, "");
  if (result.round) el.setAttribute(FX_ROUND, result.round);
  if (result.press) el.setAttribute(FX_PRESS, "");
  if (result.invert) el.setAttribute(FX_INVERT, "");
}

// ---------------------------------------------------------------------------
// Farbwähler (im Profil und in der Karte)
// ---------------------------------------------------------------------------

// Texte je Sprache nur einmal zusammenstellen (Home Assistant meldet sich bei jeder Zustandsänderung)
let textsCache = null;

function texts(hass) {
  const language = hass?.language || navigator.language || "";
  if (textsCache?.language !== language || textsCache.localize !== hass?.localize) {
    textsCache = { language, localize: hass?.localize, value: buildTexts(hass) };
  }
  return textsCache.value;
}

function buildTexts(hass) {
  const de = (hass?.language || navigator.language || "").toLowerCase().startsWith("de");
  const loc = (key, fallback) => hass?.localize?.(key) || fallback;
  const t = (deText, enText) => (de ? deText : enText);
  const themeMode = loc("ui.panel.profile.themes.theme_mode", t("Design-Modus", "Theme mode"));
  return {
    title: "Neumorphism",
    primary: loc("ui.panel.profile.themes.primary_color", t("Primärfarbe", "Primary color")),
    accent: loc("ui.panel.profile.themes.accent_color", t("Akzentfarbe", "Accent color")),
    reset: t("Zurücksetzen", "Reset"),
    primaryHint: t("Buttons, Symbole, Auswahl", "Buttons, icons, selection"),
    accentHint: t("Schalter, Hervorhebungen", "Switches, highlights"),
    fromTheme: t("aus dem Theme", "from theme"),
    // Gruppen
    groupPresets: t("Vorlagen", "Presets"),
    groupColors: t("Farben", "Colors"),
    groupDepth: t("Licht und Tiefe", "Light and depth"),
    groupShape: t("Form und Schrift", "Shape and font"),
    groupMotion: t("Bewegung", "Motion"),
    groupEvening: t("Abendmodus", "Evening mode"),
    groupAreas: t("Bereiche", "Areas"),
    groupDevice: t("Dieses Gerät", "This device"),
    // Vorschau
    eveningPreview: t("Abend ansehen", "Preview evening"),
    customStyle: t("Eigene Einstellungen", "Custom settings"),
    colorsFromTheme: t("Farben aus dem Theme", "Colors from theme"),
    summaryRadius: t("Rundung", "Roundness"),
    summaryFont: t("Schrift", "Font"),
    summarySize: t("Größe", "Size"),
    summaryDensity: t("Abstände", "Spacing"),
    summarySections: t("Sektionen", "Sections"),
    summaryCharts: t("Diagramme", "Charts"),
    summaryCards: t("Karten", "Cards"),
    summaryApps: t("Add-ons", "Add-ons"),
    summaryOff: t("Aus", "Off"),
    // Speichern für
    scope: t("Einstellungen speichern für", "Save settings for"),
    scope_user: t("Meinen Benutzer", "My user"),
    scope_device: t("Nur dieses Gerät", "This device only"),
    scope_dashboard: t("Ein Dashboard", "A dashboard"),
    scopeHint_user: t("Gilt auf allen Geräten, auf denen du angemeldet bist.", "Applies on all devices you are logged in on."),
    scopeHint_device: t(
      "Gilt nur in diesem Browser oder dieser App, zum Beispiel für ein Wandtablet.",
      "Applies only in this browser or app, for example on a wall tablet."
    ),
    scopeHint_dashboard: t(
      "Gilt für alle auf diesem Dashboard und geht dort den Einstellungen von Benutzern und Geräten vor. Nur festgelegte Werte gelten, alles andere bleibt, wie es ist.",
      "Applies to everyone on this dashboard and takes precedence there over user and device settings. Only the values set here apply, everything else stays as it is."
    ),
    // Vorlagen
    preset_classic: t("Klassisch", "Classic"),
    preset_soft: t("Warm & weich", "Warm & soft"),
    preset_contrast: t("Kontrastreich", "High contrast"),
    preset_flat: t("Flach & modern", "Flat & modern"),
    preset_mint: "Mint",
    preset_paper: t("Papier", "Paper"),
    presetsHint: t(
      "Eine Vorlage stellt das Aussehen auf einmal ein; Bereiche und Abendmodus bleiben. Danach lässt sich alles weiter anpassen.",
      "A preset sets the whole look at once; areas and evening mode stay. You can keep adjusting everything afterwards."
    ),
    presetSave: t("Als Vorlage speichern", "Save as preset"),
    presetName: t("Name der Vorlage", "Preset name"),
    presetSaveOk: t("Speichern", "Save"),
    presetDelete: t("Vorlage löschen", "Delete preset"),
    codeCopy: t("Code kopieren", "Copy code"),
    codeCopied: t("Code kopiert. Woanders unter „Code einfügen“ übernehmen.", "Code copied. Apply it elsewhere with “Paste code”."),
    codeManual: t("Diesen Code kopieren:", "Copy this code:"),
    codePaste: t("Code einfügen", "Paste code"),
    codeApply: t("Übernehmen", "Apply"),
    codeInvalid: t("Das ist kein gültiger Neumorphism-Code.", "This is not a valid Neumorphism code."),
    // Farben
    tint: t("Hintergrund", "Background"),
    tint_standard: "Standard",
    tint_gray: t("Grau", "Gray"),
    tint_warm: t("Warm", "Warm"),
    tint_sand: "Sand",
    tint_mint: "Mint",
    tint_rose: t("Rosé", "Rose"),
    tint_blue: t("Blau", "Blue"),
    tint_primary: t("Primärfarbe", "Primary"),
    tint_custom: t("Eigene", "Custom"),
    tintHint: t("Flächen, Mulden und Schatten", "Surfaces, wells and shadows"),
    charts: t("Diagramme", "Charts"),
    charts_theme: t("Themenfarben", "Theme colors"),
    charts_standard: t("Wie Home Assistant", "As Home Assistant"),
    chartsHint: t(
      "Verlauf, Statistik und andere Diagramme in Farben passend zu Primär- und Akzentfarbe, die Fläche eingelassen.",
      "History, statistics and other charts in colors matching the primary and accent color, the area inset."
    ),
    // Licht und Tiefe
    strength: t("Effektstärke", "Effect strength"),
    strengthHint: t(
      "Positiv: erhaben wie gewohnt. 0: flach. Negativ: umgekehrt, Erhabenes wird eingelassen und Eingelassenes erhaben.",
      "Positive: raised as usual. 0: flat. Negative: inverted, raised becomes inset and inset becomes raised."
    ),
    inverted: t("umgekehrt", "inverted"),
    flat: t("flach", "flat"),
    light: t("Lichtrichtung", "Light direction"),
    light_top_left: t("Oben links", "Top left"),
    light_top: t("Oben", "Top"),
    light_top_right: t("Oben rechts", "Top right"),
    light_sun: t("Sonne", "Sun"),
    lightHint: t(
      "Woher das Licht fällt; die Schatten liegen auf der Gegenseite. Sonne: wandert mit dem Sonnenstand, morgens von links, abends von rechts.",
      "Where the light comes from; shadows fall on the opposite side. Sun: follows the sun, from the left in the morning, from the right in the evening."
    ),
    surface: t("Oberfläche", "Surface"),
    surface_flat: t("Flach", "Flat"),
    surface_convex: t("Gewölbt", "Convex"),
    surface_concave: t("Gemuldet", "Concave"),
    surfaceHint: t(
      "Erhabene Flächen eben, gewölbt wie ein Kissen oder gemuldet wie eine Schale.",
      "Raised surfaces even, curved outward like a pillow or inward like a bowl."
    ),
    contrast: t("Kontrast", "Contrast"),
    contrast_normal: "Normal",
    contrast_high: t("Hoch", "High"),
    contrastHint: t(
      "Hoch: kräftigere Schrift, Linien und Schatten und eine feine Kante um jede Fläche.",
      "High: stronger text, lines and shadows and a fine edge around every surface."
    ),
    pressed: t("Zustand als Tiefe", "State as depth"),
    pressed_off: t("Aus", "Off"),
    pressed_on: t("An", "On"),
    pressedHint: t(
      "Eingeschaltete Geräte erscheinen gedrückt wie ein eingerasteter Taster, ausgeschaltete erhaben.",
      "Devices that are on appear pressed like a latched push button, devices that are off raised."
    ),
    grain: t("Körnung", "Grain"),
    grain_off: t("Aus", "Off"),
    grain_fine: t("Fein", "Fine"),
    grain_strong: t("Kräftig", "Strong"),
    grainHint: t("Feine Struktur auf allen Flächen, wie Papier oder Stoff.", "Fine texture on all surfaces, like paper or fabric."),
    // Form und Schrift
    radius: t("Rundung", "Roundness"),
    square: t("eckig", "square"),
    font: t("Schrift", "Font"),
    font_standard: "Standard",
    font_round: t("Rund", "Rounded"),
    font_modern: t("Modern", "Modern"),
    font_legible: t("Gut lesbar", "Legible"),
    fontHint: t(
      "Rund: Nunito. Modern: Inter. Gut lesbar: Atkinson Hyperlegible. Liegen der Integration bei.",
      "Rounded: Nunito. Modern: Inter. Legible: Atkinson Hyperlegible. Shipped with the integration."
    ),
    fontScale: t("Schriftgröße", "Font size"),
    density: t("Abstände", "Spacing"),
    density_compact: t("Kompakt", "Compact"),
    density_normal: "Normal",
    density_airy: t("Luftig", "Airy"),
    densityHint: t("Kompakt passt mehr auf kleine Bildschirme, luftig wirkt ruhiger auf großen.", "Compact fits more on small screens, airy looks calmer on large ones."),
    sections: t("Sektionen", "Sections"),
    sections_open: t("Frei", "Open"),
    sections_well: t("Eingelassen", "Inset"),
    sections_raised: t("Herausgehoben", "Raised"),
    sectionsHint: t(
      "In Dashboards mit Sektionen liegen die Karten jeder Sektion in einer eingelassenen Mulde oder auf einer herausgehobenen Platte.",
      "In section dashboards, the cards of each section sit in an inset well or on a raised plate."
    ),
    // Bewegung
    motion: t("Animationen", "Animations"),
    motion_on: t("An", "On"),
    motion_off: t("Aus", "Off"),
    motionHint: t(
      "Knöpfe sinken beim Drücken ein, Schalter und Auswahl gleiten. Folgt der Systemeinstellung „Bewegung reduzieren“.",
      "Buttons sink in when pressed, switches and selections glide. Follows the system setting “reduce motion”."
    ),
    glow: t("Leuchten aktiver Geräte", "Glow of active devices"),
    glow_on: t("An", "On"),
    glow_off: t("Aus", "Off"),
    glowHint: t("Eingeschaltete Geräte leuchten sanft in ihrer Zustandsfarbe.", "Devices that are on glow softly in their state color."),
    // Abendmodus
    evening: t("Zwischen Sonnenuntergang und Sonnenaufgang", "Between sunset and sunrise"),
    evening_warm: t("Wärmer", "Warmer"),
    evening_flat: t("Flacher", "Flatter"),
    evening_dark: t("Dunkel", "Dark"),
    eveningHint: t(
      "Wärmer: Hintergrund Warm. Flacher: halbe Effektstärke. Dunkel: Dunkelmodus. Nichts gewählt: aus. Braucht die Integration „Sonne“.",
      "Warmer: warm background. Flatter: half the effect strength. Dark: dark mode. Nothing selected: off. Needs the “Sun” integration."
    ),
    // Bereiche
    cards: t("Eigene Karten", "Custom cards"),
    cardsHint: t(
      "Karten aus HACS oder selbst geschrieben. „Nur Rahmen“ oder „Aus“, falls eine Karte nicht richtig aussieht.",
      "Cards from HACS or self-written. Use “Frame only” or “Off” if a card does not look right."
    ),
    cards_full: t("Vollständig", "Full"),
    cards_frame: t("Nur Rahmen", "Frame only"),
    cards_off: t("Aus", "Off"),
    apps: t("Add-ons und Integrationen", "Add-ons and integrations"),
    appsHint: t(
      "Oberflächen von Add-ons und Seiten von Integrationen im selben Design, automatisch für alle, auch künftige.",
      "Add-on interfaces and integration pages in the same design, automatically for all, including future ones."
    ),
    apps_full: t("Angepasst", "Adapted"),
    apps_off: t("Aus", "Off"),
    appsExceptions: t("Abgewählte behalten ihr eigenes Aussehen.", "Unchecked ones keep their own look."),
    // Dieses Gerät
    mode: t("Ausnahme für hell oder dunkel", "Light or dark exception"),
    mode_user: t("Keine", "None"),
    modeSummary_user: t(`Hell/Dunkel wie ${themeMode}`, `Light/dark as ${themeMode}`),
    mode_light: t("Immer hell", "Always light"),
    mode_dark: t("Immer dunkel", "Always dark"),
    modeHint: t(
      `Hell oder dunkel stellst du oben beim „${themeMode}“ ein, das gilt für deinen Benutzer auf allen Geräten. Hier nur, wenn dieses eine Gerät abweichen soll, z. B. ein Wandtablet, das immer dunkel bleibt.`,
      `Light or dark is set above under “${themeMode}”, for your user on all devices. Use this only if this one device should differ, e.g. a wall tablet that always stays dark.`
    ),
    sampleRoom: t("Wohnzimmer", "Living room"),
    saver: t("Sparmodus", "Saver mode"),
    saver_off: t("Aus", "Off"),
    saver_on: t("An", "On"),
    saverHint: t(
      "Für schwache Geräte: ohne Tropfenformen, Animationen, Körnung und Weichzeichner, seltener geprüft; Add-ons bleiben unverändert, eigene Karten bekommen nur den Rahmen.",
      "For weak devices: no droplet shapes, animations, grain or blur, checked less often; add-ons stay unchanged, custom cards only get their frame."
    ),
    defaults: t("Als Standard für alle", "Use as default for everyone"),
    defaultsSaved: t("Als Standard für alle Benutzer gespeichert", "Saved as default for all users"),
    defaultsFailed: t("Standard konnte nicht gespeichert werden", "Could not save default"),
    automation: t("Von einer Automation festgelegt:", "Set by an automation:"),
    overlay: t("Gerade überlagert, gespeichert wird trotzdem hier:", "Currently overridden, still saved here:"),
    overlayEvening: t("Abendmodus", "Evening mode"),
    overlayDashboard: t("Stil dieses Dashboards", "This dashboard's style"),
    automationReset: t("Aufheben", "Clear"),
    perUser: t(`Gilt für deinen Benutzer · Version ${VERSION}`, `Applies to your user · version ${VERSION}`),
    perDevice: t(`Gilt nur für dieses Gerät · Version ${VERSION}`, `Applies to this device only · version ${VERSION}`),
    perDashboard: t(`Gilt auf dem gewählten Dashboard · Version ${VERSION}`, `Applies on the selected dashboard · version ${VERSION}`),
    inactive: t(
      "Wähle im Profil das Theme „Neumorphism“, dann wirken diese Einstellungen.",
      "Select the theme “Neumorphism” in your profile to use these settings."
    ),
  };
}

const ROWS = [
  { key: "primary", cssVar: "--primary-color" },
  { key: "accent", cssVar: "--accent-color" },
];

// Aufgeklappte Gruppen, gemerkt auf diesem Gerät
const GROUPS_KEY = "neumorphism-picker-groups";

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // privates Fenster: nur für diese Sitzung
  }
}

// Fertige Vorlagen; was fehlt, steht auf dem Standard
const STYLE_PRESETS = {
  classic: {},
  soft: { tint: "warm", surface: "convex", radius: 1.4, strength: 0.8, font: "round", accent: "#f2a922" },
  contrast: { tint: "gray", contrast: "high", strength: 1.4, font: "legible" },
  flat: { strength: 0.3, radius: 0.6, font: "modern", glow: "off", density: "compact" },
  mint: { tint: "mint", primary: "#14a7a0", surface: "concave", grain: "fine", radius: 1.2 },
  paper: { tint: "sand", grain: "strong", pressed: "on", font: "round", radius: 0.8, accent: "#e5534b" },
};
const MAX_OWN_PRESETS = 20;
const CODE_PREFIX = "NEUMORPHISM-1:";

/** Aussehen als Code zum Teilen (Base64 von JSON, nur Werte, die vom Standard abweichen). */
function styleCode(s) {
  const values = Object.fromEntries(STYLE_KEYS.filter((key) => JSON.stringify(s[key]) !== JSON.stringify(BUILTIN[key])).map((key) => [key, s[key]]));
  const bytes = new TextEncoder().encode(JSON.stringify(values));
  return CODE_PREFIX + btoa(String.fromCharCode(...bytes));
}

function parseStyleCode(code) {
  const text = (code || "").trim();
  if (!text.startsWith(CODE_PREFIX)) return null;
  try {
    const bytes = Uint8Array.from(atob(text.slice(CODE_PREFIX.length)), (c) => c.charCodeAt(0));
    const values = readLayer(JSON.parse(new TextDecoder().decode(bytes)));
    return Object.fromEntries(Object.entries(values).filter(([key]) => STYLE_KEYS.includes(key)));
  } catch {
    return null;
  }
}

/** Eigene Vorlagen des Benutzers (in seinen Theme-Einstellungen, auf allen Geräten). */
function ownPresets(hass = getHass()) {
  const list = hass?.selectedTheme?.neumorphismPresets;
  return Array.isArray(list)
    ? list.filter((p) => p && typeof p.name === "string" && p.settings && typeof p.settings === "object").slice(0, MAX_OWN_PRESETS)
    : [];
}

/** Patch, der genau die Werte einer Vorlage setzt (übrige Werte des Aussehens auf Standard). */
const presetPatch = (values) => Object.fromEntries(STYLE_KEYS.map((key) => [key, values[key]]));
const sameStyle = (s, values) => STYLE_KEYS.every((key) => JSON.stringify(s[key]) === JSON.stringify(values[key] ?? BUILTIN[key]));

// Auswahlfelder je Gruppe. Gespeichert wird wie die übrigen Einstellungen.
const SEGMENTS = {
  colors: ["charts"],
  depth: ["light", "surface", "contrast", "pressed", "grain"],
  shape: ["font", "density", "sections"],
  motion: ["motion", "glow"],
};
// Über die ganze Breite (viele oder lange Werte)
const WIDE_SEGMENTS = ["light", "font", "sections", "cards", "apps", "scope"];
// Nur für dieses Gerät (nicht beim Benutzer gespeichert)
const DEVICE_SEGMENTS = {
  mode: ["user", "light", "dark"],
  saver: ["off", "on"],
};
// Bezeichnungen für den Hinweis auf Werte aus Automationen
const SETTING_LABELS = {
  primary: "primary", accent: "accent", strength: "strength", light: "light", surface: "surface", tint: "tint",
  radius: "radius", font: "font", contrast: "contrast", glow: "glow", motion: "motion", sections: "sections",
  pressed: "pressed", grain: "grain", density: "density", fontScale: "fontScale", charts: "charts",
  evening: "groupEvening", cards: "cards", apps: "apps", appsOff: "apps",
};

// ---------------------------------------------------------------------------
// Muster in den Einstellungen: jede Auswahl zeigt im Kleinen, was sie bewirkt
// ---------------------------------------------------------------------------

/**
 * Schatten wie im Theme, aber mit eigenen Werten: Muster zeigen auch Auswahlen, die gerade nicht
 * gelten (die Schatten-Variablen des Themes sind auf <html> schon ausgerechnet).
 */
function sampleShadow({ x = 1, y = 1, strength = 1, contrast = 0, inset = false, d = 4, blur = 9 } = {}) {
  const s = inset ? -strength : strength;
  const k = Math.abs(s);
  const pre = s < 0 ? "inset " : "";
  const a = Math.round(k * (1 + 0.5 * contrast) * 100) / 100;
  const px = (n) => `${Math.round(n * 10) / 10}px`;
  const out = [];
  if (k) {
    out.push(`${pre}${px(d * k * x)} ${px(d * k * y)} ${px(blur * k)} rgba(var(--neumorphism-shadow-dark-rgb), calc(var(--neumorphism-shadow-dark-alpha, 0.65) * ${a}))`);
    out.push(`${pre}${px(-d * k * x)} ${px(-d * k * y)} ${px(blur * k)} rgba(var(--neumorphism-shadow-light-rgb), calc(var(--neumorphism-shadow-light-alpha, 0.9) * ${a}))`);
  }
  if (contrast) out.push(`${inset ? "inset " : ""}0 0 0 1px rgba(var(--rgb-primary-text-color), 0.16)`);
  return out.join(", ") || "none";
}

/** Lichtrichtung als Zahlen: Versatz der Schatten und Winkel der Wölbung. */
function lightOf(light, hass) {
  const vars = lightVars(light, hass);
  return {
    x: Number(vars["neumorphism-light-x"] ?? 1),
    y: Number(vars["neumorphism-light-y"] ?? 1),
    angle: parseFloat(vars["neumorphism-light-angle"] ?? 135),
  };
}

/** Wölbung wie im Theme: Glanz zum Licht hin, Schatten auf der Gegenseite (gemuldet umgekehrt). */
function surfaceImage(surface, strength, angle) {
  if (surface === "flat" || !strength) return "none";
  const p = Math.round(Math.min(1, Math.abs(strength)) * 100);
  let [from, to] = ["var(--neumorphism-sheen)", "var(--neumorphism-shade)"];
  if ((surface === "concave") !== (strength < 0)) [from, to] = [to, from];
  return `linear-gradient(${angle}deg, color-mix(in srgb, ${from} ${p}%, transparent), color-mix(in srgb, ${to} ${p}%, transparent))`;
}

const BULB_PATH =
  "M12,2A7,7 0 0,0 5,9C5,11.38 6.19,13.47 8,14.74V17A1,1 0 0,0 9,18H15A1,1 0 0,0 16,17V14.74C17.81,13.47 19,11.38 19,9A7,7 0 0,0 12,2M9,21A1,1 0 0,0 10,22H14A1,1 0 0,0 15,21V20H9V21Z";
const bulb = (color) => `<svg viewBox="0 0 24 24"><path fill="${color}" d="${BULB_PATH}"/></svg>`;
const LAMP_ON = "var(--state-light-active-color, var(--amber-color, #ffc107))";
const LAMP_OFF = "var(--state-inactive-color, var(--disabled-text-color, #9aa2b1))";
const CHART_LINES = ["0,22 12,18 24,19 36,10 48,12 60,4", "0,27 12,25 24,26 36,21 48,23 60,18", "0,13 12,16 24,9 36,14 48,7 60,11"];
const HA_CHART_COLORS = ["#4269d0", "#f4bd4a", "#ff725c"];
const chartSample = (colors, inset) =>
  `<i class="s-chart${inset ? " inset" : ""}"><svg viewBox="0 0 60 30" preserveAspectRatio="none">${CHART_LINES.map(
    (points, i) => `<polyline points="${points}" style="stroke:${colors[i]}"/>`
  ).join("")}</svg></i>`;
const beforeAfter = (before, after) => `${before}<span class="s-arrow">›</span>${after}`;
const swatch = (bg) => `<i class="s-swatch" style="background:${bg}"></i>`;

/**
 * Muster je Auswahl. c: aktuelle Einstellungen (s), Modus (dark), Licht (light), deutliche
 * Effektstärke (vivid), Kontrast (contrast), Farben (primary, accent), Home Assistant (hass), Texte (t).
 */
const SAMPLES = {
  // Lichtquelle als Punkt, Schatten auf der Gegenseite
  light: (value, c) => {
    const l = lightOf(value, c.hass);
    const len = Math.hypot(l.x, l.y) || 1;
    const dot = `left:calc(50% - 4px + ${Math.round((-l.x / len) * 17)}px);top:calc(50% - 4px + ${Math.round((-l.y / len) * 15)}px)`;
    const shadow = sampleShadow({ ...l, strength: c.vivid, contrast: c.contrast });
    return `<i class="s-stage"><i class="s-tile" style="box-shadow:${shadow};background-image:${surfaceImage(c.s.surface, c.vivid, l.angle)}"></i><i class="s-sun${value === "sun" ? " sun" : ""}" style="${dot}"></i></i>`;
  },
  surface: (value, c) =>
    `<i class="s-ball" style="box-shadow:${sampleShadow({ ...c.light, strength: c.vivid, contrast: c.contrast })};background-image:${surfaceImage(value, c.vivid, c.light.angle)}"></i>`,
  contrast: (value, c) => {
    const high = value === "high";
    const [text, text2] = (high ? CONTRAST_TEXT : THEME_TEXT)[c.dark ? "dark" : "light"];
    return `<i class="s-card" style="box-shadow:${sampleShadow({ ...c.light, strength: c.vivid, contrast: high ? 1 : 0 })}"><b style="color:${text}">Aa</b><u style="background:${text2}"></u></i>`;
  },
  // Eingeschaltetes Gerät (Lampe an) gedrückt, ausgeschaltetes erhaben
  pressed: (value, c) => {
    const small = { ...c.light, strength: c.vivid, contrast: c.contrast, d: 2.5, blur: 6 };
    return `<i class="s-dot" style="box-shadow:${sampleShadow({ ...small, inset: value === "on" })}">${bulb(LAMP_ON)}</i><i class="s-dot" style="box-shadow:${sampleShadow(small)}">${bulb(LAMP_OFF)}</i>`;
  },
  // Auf der kleinen Fläche dichter und kräftiger, sonst wäre kein Unterschied zu sehen
  grain: (value) => `<i class="s-tile s-grain" style="--grain:${Math.min(1, (GRAIN[value] || 0) * 2)}"></i>`,
  font: (value) => `<b class="s-font" style="font-family:${FONTS[value] ? `'${FONTS[value].family}', ` : ""}Roboto, Noto, sans-serif">Aa</b>`,
  density: (value) => {
    const gap = { compact: 2, normal: 4, airy: 7 }[value];
    return `<i class="s-grid" style="gap:${gap}px;padding:${gap}px">${"<i></i>".repeat(4)}</i>`;
  },
  sections: (value) => `<i class="s-section ${value}"><i></i><i></i></i>`,
  charts: (value, c) =>
    value === "theme" ? chartSample(Object.values(chartVars(c.primary, c.accent, c.dark)), true) : chartSample(c.haColors, false),
  motion: (value) => `<i class="s-press${value === "on" ? " anim" : ""}"></i>`,
  glow: (value) => `<i class="s-dot${value === "on" ? " glow" : ""}">${bulb(LAMP_ON)}</i>`,
  cards: (value) => `<i class="s-custom ${value}"><i></i></i>`,
  // Oberfläche eines Add-ons: angepasst oder wie vom Add-on vorgesehen
  apps: (value, c) =>
    value === "full"
      ? `<i class="s-app full"><i></i><i></i></i>`
      : `<i class="s-app" style="background:${c.dark ? "#1f1f1f" : "#fff"}"><i style="background:${c.dark ? "#2d2d2d" : "#f1f1f1"}"></i><i style="background:#2196f3;box-shadow:none"></i></i>`,
  // Dieses Gerät: wie beim Benutzer (hell oder dunkel) oder fest
  mode: (value, c) => {
    const light = tintPalette(c.s.tint, false, c.primary).bg;
    const dark = tintPalette(c.s.tint, true, c.primary).bg;
    if (value === "light") return swatch(light);
    if (value === "dark") return swatch(dark);
    return `<i class="s-swatch"><i style="background:${light}"></i><i style="background:${dark}"></i></i>`;
  },
};

// Abendmodus: vorher und nachher
const EFFECT_SAMPLES = {
  warm: (c) => beforeAfter(swatch(c.bg), swatch(tintPalette("warm", c.dark, c.primary).bg)),
  flat: (c) =>
    beforeAfter(
      `<i class="s-mini" style="box-shadow:${sampleShadow({ ...c.light, strength: c.vivid, d: 3, blur: 7 })}"></i>`,
      `<i class="s-mini" style="box-shadow:${sampleShadow({ ...c.light, strength: c.vivid / 2, d: 3, blur: 7 })}"></i>`
    ),
  dark: (c) => beforeAfter(swatch(tintPalette(c.s.tint, false, c.primary).bg), swatch(tintPalette(c.s.tint, true, c.primary).bg)),
};

// Regler: der aktuelle Wert, auch während des Ziehens
const RANGE_SAMPLES = {
  strength: (c) => {
    const o = { ...c.light, strength: c.s.strength, contrast: c.contrast };
    return `<i class="s-tile" style="box-shadow:${sampleShadow(o)}"></i><i class="s-well" style="box-shadow:${sampleShadow({ ...o, inset: true })}"></i><i class="s-press" style="box-shadow:${sampleShadow({ ...o, d: 2.5, blur: 6 })}"></i>`;
  },
  radius: (c) => {
    const r = c.s.radius;
    return `<i class="s-card wide" style="border-radius:${Math.round(14 * r)}px"></i><i class="s-press" style="border-radius:${Math.round(Math.min(10, 10 * r))}px"></i><i class="s-mini" style="border-radius:${Math.round(Math.min(11, 6 * r))}px"></i>`;
  },
  fontScale: (c) =>
    `<span class="s-text" style="font-size:${Math.round(15 * c.s.fontScale)}px">${c.t.sampleRoom}</span><span class="s-text quiet" style="font-size:${Math.round(13 * c.s.fontScale)}px">21,5 °C</span>`,
};

// Schriften für die Muster: alle bekannt machen (geladen wird eine Datei erst, wenn sie gebraucht wird)
function ensureSampleFonts() {
  if (document.getElementById("neumorphism-sample-fonts")) return;
  const style = document.createElement("style");
  style.id = "neumorphism-sample-fonts";
  style.textContent = Object.keys(FONTS).map(fontFaces).join("\n");
  document.head.appendChild(style);
}

const segmentHtml = (name, values, attr = "data-value") => `
  <div class="setting${WIDE_SEGMENTS.includes(name) ? " wide" : ""}" data-setting="${name}">
    <div class="label"></div>
    <div class="segmented${SAMPLES[name] ? " visual" : ""}">${values
      .map((value) => `<button ${attr}="${value}">${SAMPLES[name] ? '<span class="sample" aria-hidden="true"></span><span class="text"></span>' : ""}</button>`)
      .join("")}</div>
    <div class="hint"></div>
  </div>`;

const rangeHtml = (name, min, max, step) => `
  <div class="setting wide" data-setting="${name}">
    <div class="setting-head"><span class="label"></span><span class="value"></span></div>
    <input type="range" min="${min}" max="${max}" step="${step}">
    ${RANGE_SAMPLES[name] ? '<div class="range-sample" aria-hidden="true"></div>' : ""}
    <div class="hint"></div>
  </div>`;

// Regler: Einstellung, Faktor zwischen Regler und Wert, Markierung (Prozent der Spur)
const RANGES = {
  strength: { scale: STRENGTH_SCALE, mark: 50 },
  radius: { scale: 100, mark: 0 },
  fontScale: { scale: 100, mark: null },
};

// Offene Einstellungen (Profil, Dashboard-Karten): bei jedem Takt aktualisiert
const pickers = new Set();

/** Hat sich etwas geändert, das die Einstellungen betrifft? (nicht jede Zustandsänderung) */
const hassChanged = (a, b) =>
  !a || a === b || ["selectedTheme", "themes", "user", "panels", "language", "localize", "config"].some((key) => a[key] !== b[key]) ||
  a.states?.["sun.sun"] !== b.states?.["sun.sun"];

class NeumorphismColorPicker extends HTMLElement {
  set hass(hass) {
    const previous = this._hass;
    this._hass = hass;
    if (hassChanged(previous, hass)) this._render();
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    pickers.add(this);
    this._render();
  }

  disconnectedCallback() {
    pickers.delete(this);
    // Vorschauen gelten nur, solange die Einstellungen offen sind
    let changed = false;
    if (previewState.evening === this) {
      previewState.evening = null;
      changed = true;
    }
    if (previewState.owner === this) {
      previewState.owner = null;
      previewState.dashboard = "";
      changed = true;
    }
    if (changed) scheduleTick();
  }

  _render() {
    if (!this._hass || !this.isConnected) return;
    if (!this.shadowRoot) this._build();
    this._update();
  }

  /** Wohin gespeichert wird (oben gewählt). */
  _target() {
    if (this._scope === "dashboard" && this._dashboard && this._hass?.user?.is_admin) {
      return { kind: "dashboard", dashboard: this._dashboard };
    }
    return defaultTarget();
  }

  /** Dashboards zur Auswahl (Adresse, Titel). */
  _dashboards() {
    return Object.values(this._hass?.panels || {})
      .filter((panel) => panel.component_name === "lovelace")
      .map((panel) => ({ url: panel.url_path, title: panel.title || panel.url_path }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  _build() {
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host { display: block; }
        :host([in-profile]) { padding: 4px var(--ha-space-4, 16px) var(--ha-space-4, 16px); }
        :host([in-profile][inactive]) { display: none; }
        .headline { color: var(--primary-text-color); font-size: var(--ha-font-size-m, 14px);
          font-weight: var(--ha-font-weight-medium, 500); padding: 8px 0 4px; }
        :host(:not([in-profile])) .headline { display: none; }
        h3 { margin: 22px 0 2px; color: var(--secondary-text-color); font-size: 0.78rem; font-weight: var(--ha-font-weight-medium, 500);
          letter-spacing: 0.06em; text-transform: uppercase; }
        .info { color: var(--secondary-text-color); font-size: 0.85rem; line-height: 1.4; }
        .info.warning { color: var(--warning-color); padding-bottom: 8px; }
        .notice { display: flex; align-items: center; gap: 12px; margin: 8px 0; padding: 10px 14px; border-radius: 16px;
          color: var(--primary-text-color); font-size: 0.85rem; box-shadow: var(--neumorphism-inset-shadow-s, none); }
        .notice span { flex: 1; }
        [hidden] { display: none !important; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0 32px; }
        .grid > .wide { grid-column: 1 / -1; }
        .row { display: flex; align-items: center; gap: 16px; padding: 12px 0 10px; }
        .text { flex: 1; min-width: 0; }
        .label { color: var(--primary-text-color); font-size: 1rem; }
        .hint { color: var(--secondary-text-color); font-size: 0.85rem; margin-top: 2px; line-height: 1.35; }
        .hint:empty { display: none; }
        .value { color: var(--secondary-text-color); font-family: var(--ha-font-family-code, monospace);
          font-size: 0.8rem; margin-top: 4px; }
        .picker { width: 56px; height: 56px; flex: none; border-radius: 50%; padding: 7px; box-sizing: border-box;
          background: var(--card-background-color); background-image: var(--neumorphism-surface-image, none); box-shadow: var(--ha-box-shadow-m); }
        input[type="color"] { -webkit-appearance: none; appearance: none; display: block; width: 100%; height: 100%;
          border: none; padding: 0; border-radius: 50%; background: none; cursor: pointer; }
        input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
        input[type="color"]::-webkit-color-swatch { border: none; border-radius: 50%; }
        input[type="color"]::-moz-color-swatch { border: none; border-radius: 50%; }
        .presets { display: flex; flex-wrap: wrap; gap: 10px; padding: 2px 2px 8px; }
        .dot { width: 26px; height: 26px; border-radius: 50%; border: none; padding: 0; cursor: pointer;
          box-shadow: var(--ha-box-shadow-s); outline-offset: 3px; }
        .dot.selected { outline: 2px solid var(--primary-text-color); }
        .setting { padding: 14px 0 2px; }
        .setting-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
        .bg-block { padding-top: 6px; }
        .bg-block .tints { padding-top: 4px; }
        .tints, .styles { display: flex; flex-wrap: wrap; gap: 14px 10px; padding: 10px 2px 4px; }
        .tint { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 58px; padding: 0; border: none;
          background: none; cursor: pointer; color: var(--secondary-text-color); font: inherit; font-size: 0.75rem; }
        .tint .swatch { width: 34px; height: 34px; border-radius: 50%; box-shadow: var(--ha-box-shadow-s); outline-offset: 3px; }
        .tint.selected { color: var(--primary-text-color); }
        .tint.selected .swatch { outline: 2px solid var(--primary-color); }
        .style { position: relative; display: flex; align-items: center; gap: 10px; padding: 8px 14px 8px 8px; border: none; cursor: pointer;
          border-radius: var(--ha-border-radius-pill, 999px); background: var(--card-background-color);
          background-image: var(--neumorphism-surface-image, none); box-shadow: var(--neumorphism-raised-shadow, none);
          color: var(--primary-text-color); font: inherit; font-size: 0.85rem; outline-offset: 3px; }
        .style.selected { box-shadow: var(--neumorphism-inset-shadow-s, none); color: var(--primary-color); }
        .style .swatch { width: 26px; height: 26px; border-radius: 50%; flex: none; box-shadow: var(--neumorphism-raised-shadow-s, none);
          display: grid; place-items: center; }
        .style .swatch::after { content: ""; width: 9px; height: 9px; border-radius: 50%; background: var(--dot); }
        .style .delete { margin-left: 2px; padding: 0 2px; color: var(--secondary-text-color); font-size: 1rem; line-height: 1; }
        .style-actions { display: flex; flex-wrap: wrap; gap: 10px; padding-top: 6px; }
        .inline { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding-top: 10px; }
        .inline input[type="text"] { flex: 1; min-width: 180px; border: none; border-radius: 12px; padding: 10px 14px; font: inherit;
          font-size: 0.9rem; color: var(--primary-text-color); background: var(--card-background-color);
          box-shadow: var(--neumorphism-inset-shadow-s, inset 0 0 0 1px var(--divider-color)); }
        .inline input[type="text"]:focus { outline: 2px solid var(--primary-color); outline-offset: 2px; }
        .inline .message { flex-basis: 100%; color: var(--secondary-text-color); font-size: 0.85rem; }
        select.dashboard { margin-top: 8px; border: none; border-radius: 12px; padding: 10px 14px; font: inherit; font-size: 0.9rem;
          color: var(--primary-text-color); background: var(--card-background-color);
          box-shadow: var(--neumorphism-inset-shadow-s, inset 0 0 0 1px var(--divider-color)); }
        input[type="range"] { -webkit-appearance: none; appearance: none; width: 100%; height: 32px; margin: 6px 0 0;
          background: transparent; cursor: pointer; --from: 50%; --to: 50%; --mark: 50%;
          --track: linear-gradient(to right, transparent calc(var(--mark) - 1px), var(--divider-color) calc(var(--mark) - 1px) calc(var(--mark) + 1px), transparent calc(var(--mark) + 1px)),
            linear-gradient(to right, var(--secondary-background-color) var(--from), var(--primary-color) var(--from) var(--to),
              var(--secondary-background-color) var(--to)); }
        input[type="range"]::-webkit-slider-runnable-track { height: 10px; border-radius: 5px; background: var(--track);
          box-shadow: var(--neumorphism-inset-shadow, none); }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 28px; height: 28px;
          margin-top: -9px; border: none; border-radius: 50%; box-shadow: var(--ha-box-shadow-s);
          background: radial-gradient(circle, var(--primary-color) 0 5px, var(--card-background-color) 6px); }
        input[type="range"]::-moz-range-track { height: 10px; border-radius: 5px; background: var(--track);
          box-shadow: var(--neumorphism-inset-shadow, none); }
        input[type="range"]::-moz-range-thumb { width: 28px; height: 28px; border: none; border-radius: 50%;
          box-shadow: var(--ha-box-shadow-s);
          background: radial-gradient(circle, var(--primary-color) 0 5px, var(--card-background-color) 6px); }
        input[type="range"]:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 4px; border-radius: 8px; }
        .segmented { display: flex; gap: 6px; padding: 5px; margin: 8px 0 6px; border-radius: var(--ha-border-radius-pill, 999px);
          box-shadow: var(--neumorphism-inset-shadow-s, none); }
        .segmented button { flex: 1; border: none; border-radius: var(--ha-border-radius-pill, 999px); padding: 8px 6px; cursor: pointer;
          background: transparent; color: var(--secondary-text-color); font: inherit; font-size: 0.85rem; white-space: nowrap;
          transition: box-shadow 200ms ease, color 200ms ease; }
        .segmented button.selected { background: var(--card-background-color); background-image: var(--neumorphism-surface-image, none);
          color: var(--primary-color); font-weight: var(--ha-font-weight-medium, 500); box-shadow: var(--neumorphism-raised-shadow, none); }
        button:focus-visible, .dot:focus-visible, .tint:focus-visible .swatch { outline: 2px solid var(--primary-color); outline-offset: 2px; }
        .apps-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 2px 16px; margin: 8px 0 2px; }
        .apps-list label { display: flex; align-items: center; gap: 10px; padding: 6px 0; cursor: pointer;
          color: var(--primary-text-color); font-size: 0.9rem; }
        .apps-list input { -webkit-appearance: none; appearance: none; flex: none; width: 20px; height: 20px; margin: 0;
          border-radius: 6px; cursor: pointer; background: var(--card-background-color) center / 14px no-repeat;
          box-shadow: var(--neumorphism-inset-shadow-s, inset 0 0 0 1px var(--divider-color)); }
        .apps-list input:checked { background-color: var(--primary-color);
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='white' d='M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z'/%3E%3C/svg%3E");
          box-shadow: var(--neumorphism-raised-shadow, none); }
        .footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding-top: 20px; }
        .actions { display: flex; flex-wrap: wrap; gap: 12px; }
        button.action { border: none; background: var(--card-background-color); background-image: var(--neumorphism-surface-image, none);
          color: var(--primary-color); border-radius: var(--ha-border-radius-pill, 999px); padding: 9px 18px; font: inherit;
          font-size: 0.9rem; cursor: pointer; box-shadow: var(--ha-box-shadow-s); }
        button.action:active, .dot:active, .tint:active .swatch, .style:active { box-shadow: var(--neumorphism-inset-shadow, none); }
        button.action.small { padding: 6px 14px; font-size: 0.82rem; }
        button.action[aria-pressed="true"] { box-shadow: var(--neumorphism-inset-shadow-s, none); }
        button.action:disabled { opacity: 0.5; cursor: default; }
        /* Gruppen zum Aufklappen, in der Kopfzeile die aktuellen Werte */
        .group { border-top: 1px solid var(--divider-color); }
        .group-head { display: flex; width: 100%; align-items: center; gap: 12px; padding: 14px 4px; border: none; background: none;
          cursor: pointer; text-align: left; font: inherit; color: var(--primary-text-color); border-radius: 12px; }
        .g-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .g-title { font-size: 1rem; font-weight: var(--ha-font-weight-medium, 500); }
        .g-summary { color: var(--secondary-text-color); font-size: 0.82rem; line-height: 1.35; }
        .chevron { flex: none; width: 8px; height: 8px; margin: 0 8px 4px; border-right: 2px solid var(--secondary-text-color);
          border-bottom: 2px solid var(--secondary-text-color); transform: rotate(45deg); transition: transform 200ms ease; }
        .group.open > .group-head .chevron { transform: rotate(225deg); margin-bottom: -4px; }
        @media (prefers-reduced-motion: reduce) { .chevron, .segmented button { transition: none; } }
        .group-body { margin-top: -10px; padding: 0 0 18px; } /* erste Zeile (auch zweispaltig) dicht unter der Kopfzeile */
        .group:not(.open) > .group-body { display: none; }
        .evening-preview { margin-top: 10px; }
        /* Auswahl mit Mustern: jede Möglichkeit zeigt im Kleinen, was sie bewirkt */
        .segmented.visual { display: grid; grid-template-columns: repeat(auto-fit, minmax(68px, 1fr)); gap: 6px; padding: 6px; border-radius: 20px; }
        .segmented.visual button { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; padding: 10px 4px 8px;
          border-radius: 15px; white-space: normal; line-height: 1.2; }
        .segmented.visual .text { text-align: center; }
        .sample { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; height: 44px; pointer-events: none;
          color: var(--primary-text-color); font-weight: normal; }
        .range-sample { display: flex; align-items: center; gap: 18px; min-height: 44px; padding: 8px 6px 2px; pointer-events: none; }
        :where(.sample, .range-sample) i { display: block; flex: none; font-style: normal; }
        .s-tile, .s-well { width: 32px; height: 32px; border-radius: 9px; background-color: var(--card-background-color); }
        .s-stage { position: relative; width: 56px; height: 44px; display: grid; place-items: center; }
        .s-sun { position: absolute; width: 8px; height: 8px; border-radius: 50%; background: #fffbe6; box-shadow: 0 0 6px 2px rgba(255, 214, 102, 0.85); }
        .s-sun.sun { background: #ffd54f; }
        .s-ball { width: 32px; height: 32px; border-radius: 50%; background-color: var(--card-background-color); }
        .s-card { display: flex; flex-direction: column; justify-content: center; gap: 3px; width: 48px; height: 32px; box-sizing: border-box;
          padding: 0 8px; border-radius: 9px; background: var(--card-background-color); }
        .s-card.wide { width: 58px; height: 38px; box-shadow: var(--s-raised); }
        .s-card b { font-size: 13px; line-height: 1; }
        .s-card u { display: block; width: 70%; height: 3px; border-radius: 2px; text-decoration: none; }
        .s-dot { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--card-background-color);
          box-shadow: var(--s-raised-s); }
        .s-dot svg { width: 16px; height: 16px; }
        .s-dot.glow { box-shadow: var(--s-raised-s), 0 0 14px 3px color-mix(in srgb, ${LAMP_ON} 55%, transparent); }
        .s-grain { position: relative; overflow: hidden; width: 44px; box-shadow: var(--s-raised); }
        .s-grain::after { content: ""; position: absolute; inset: 0; background: url(/neumorphism_static/grain.png) repeat; background-size: 70px;
          opacity: var(--grain); mix-blend-mode: soft-light; }
        .s-font { font-size: 22px; font-weight: 500; line-height: 1; }
        .s-grid { display: grid; grid-template-columns: 12px 12px; border-radius: 7px; }
        .s-grid > i { height: 9px; border-radius: 3px; background: var(--card-background-color); box-shadow: var(--s-raised-s); }
        .s-section { display: flex; gap: 4px; padding: 5px; border-radius: 10px; }
        .s-section > i { width: 14px; height: 22px; border-radius: 5px; background: var(--card-background-color); box-shadow: var(--s-raised-s); }
        .s-section.well { box-shadow: var(--s-inset); }
        .s-section.raised { background: var(--card-background-color); box-shadow: var(--s-raised); }
        .s-chart { width: 54px; height: 30px; box-sizing: border-box; padding: 3px 5px; border-radius: 8px; }
        .s-chart.inset { box-shadow: var(--s-inset); }
        .s-chart svg { display: block; width: 100%; height: 100%; overflow: visible; }
        .s-chart polyline { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
        .s-press { width: 38px; height: 20px; border-radius: 10px; background: var(--card-background-color); box-shadow: var(--s-raised); }
        @media (prefers-reduced-motion: no-preference) { .s-press.anim { animation: s-press 1.8s ease-in-out infinite; } }
        @keyframes s-press { 0%, 40%, 100% { box-shadow: var(--s-raised); transform: none; } 55%, 80% { box-shadow: var(--s-inset); transform: scale(0.94); } }
        .s-mini { width: 24px; height: 24px; border-radius: 6px; background: var(--card-background-color); box-shadow: var(--s-raised-s); }
        .s-custom { display: grid; place-items: center; width: 48px; height: 32px; border-radius: 8px; background: var(--card-background-color); }
        .s-custom > i { width: 26px; height: 10px; border-radius: 5px; }
        .s-custom.full, .s-custom.frame { box-shadow: var(--s-raised); }
        .s-custom.full > i { background: var(--card-background-color); box-shadow: var(--s-raised-s); }
        .s-custom.frame > i, .s-custom.off > i { background: rgba(var(--rgb-primary-text-color), 0.12); }
        .s-custom.off { border-radius: 4px; box-shadow: inset 0 0 0 1px rgba(var(--rgb-primary-text-color), 0.2); }
        .s-custom.off > i { border-radius: 2px; }
        .s-app { display: flex; flex-direction: column; align-items: center; width: 48px; height: 32px; overflow: hidden; border-radius: 6px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25); }
        .s-app > i:first-child { align-self: stretch; height: 8px; }
        .s-app > i:last-child { width: 24px; height: 9px; margin-top: 6px; border-radius: 4px; }
        .s-app.full { background: var(--primary-background-color); box-shadow: var(--s-raised-s); }
        .s-app.full > i:last-child { border-radius: 5px; background: var(--card-background-color); box-shadow: var(--s-raised-s); }
        .s-swatch { display: flex; width: 30px; height: 24px; overflow: hidden; border-radius: 7px; box-shadow: var(--s-raised-s); }
        .s-swatch > i { flex: 1; }
        .s-arrow { color: var(--secondary-text-color); font-size: 15px; }
        .s-text { color: var(--primary-text-color); line-height: 1.2; }
        .s-text.quiet { color: var(--secondary-text-color); }
      </style>
      <style class="sample-vars"></style>
      <div class="headline"></div>
      <div class="info warning" hidden></div>
      <div class="notice automation" hidden><span></span><button class="action automation-reset" hidden></button></div>
      <div class="notice overlay" hidden><span></span></div>
      <div class="setting wide" data-setting="scope">
        <div class="label"></div>
        <div class="segmented">${["user", "device", "dashboard"].map((scope) => `<button data-scope="${scope}"></button>`).join("")}</div>
        <select class="dashboard" hidden></select>
        <div class="hint"></div>
      </div>

      <section class="group" data-group="presets">
        <button class="group-head" aria-expanded="false">
          <span class="g-text"><span class="g-title" data-text="groupPresets"></span><span class="g-summary"></span></span>
          <span class="chevron" aria-hidden="true"></span>
        </button>
        <div class="group-body">
      <div class="styles"></div>
      <div class="hint presets-hint"></div>
      <div class="style-actions">
        <button class="action preset-save"></button>
        <button class="action code-copy"></button>
        <button class="action code-paste"></button>
      </div>
      <div class="inline preset-form" hidden>
        <input type="text" class="preset-name" maxlength="40">
        <button class="action preset-save-ok"></button>
      </div>
      <div class="inline code-form" hidden>
        <input type="text" class="code-input">
        <button class="action code-apply"></button>
        <span class="message"></span>
      </div>
        </div>
      </section>

      <section class="group" data-group="colors">
        <button class="group-head" aria-expanded="false">
          <span class="g-text"><span class="g-title" data-text="groupColors"></span><span class="g-summary"></span></span>
          <span class="chevron" aria-hidden="true"></span>
        </button>
        <div class="group-body">
      <div class="grid">
        ${ROWS.map(
          (row) => `
          <div class="block" data-key="${row.key}">
            <div class="row">
              <div class="picker"><input type="color"></div>
              <div class="text">
                <div class="label"></div>
                <div class="hint"></div>
                <div class="value"></div>
              </div>
            </div>
            <div class="presets">
              ${PRESETS.map(([name, hex]) => `<button class="dot" title="${name}" data-color="${hex}" style="background:${hex}"></button>`).join("")}
            </div>
          </div>`
        ).join("")}
      </div>
      <div class="setting wide bg-block" data-setting="tint">
        <div class="row">
          <div class="picker"><input type="color" class="tint-input"></div>
          <div class="text">
            <div class="label"></div>
            <div class="hint"></div>
            <div class="value"></div>
          </div>
        </div>
        <div class="tints">${CHOICES.tint.map((tint) => `<button class="tint" data-value="${tint}"><span class="swatch"></span><span class="name"></span></button>`).join("")}</div>
      </div>
      <div class="grid">${SEGMENTS.colors.map((name) => segmentHtml(name, CHOICES[name])).join("")}</div>
        </div>
      </section>

      <section class="group" data-group="depth">
        <button class="group-head" aria-expanded="false">
          <span class="g-text"><span class="g-title" data-text="groupDepth"></span><span class="g-summary"></span></span>
          <span class="chevron" aria-hidden="true"></span>
        </button>
        <div class="group-body">
      <div class="grid">
        ${rangeHtml("strength", -STRENGTH_MAX * STRENGTH_SCALE, STRENGTH_MAX * STRENGTH_SCALE, 5)}
        ${SEGMENTS.depth.map((name) => segmentHtml(name, CHOICES[name])).join("")}
      </div>
        </div>
      </section>

      <section class="group" data-group="shape">
        <button class="group-head" aria-expanded="false">
          <span class="g-text"><span class="g-title" data-text="groupShape"></span><span class="g-summary"></span></span>
          <span class="chevron" aria-hidden="true"></span>
        </button>
        <div class="group-body">
      <div class="grid">
        ${rangeHtml("radius", 0, RADIUS_MAX * 100, 10)}
        ${rangeHtml("fontScale", FONT_SCALE_MIN * 100, FONT_SCALE_MAX * 100, 5)}
        ${SEGMENTS.shape.map((name) => segmentHtml(name, CHOICES[name])).join("")}
      </div>
        </div>
      </section>

      <section class="group" data-group="motion">
        <button class="group-head" aria-expanded="false">
          <span class="g-text"><span class="g-title" data-text="groupMotion"></span><span class="g-summary"></span></span>
          <span class="chevron" aria-hidden="true"></span>
        </button>
        <div class="group-body">
      <div class="grid">${SEGMENTS.motion.map((name) => segmentHtml(name, CHOICES[name])).join("")}</div>
        </div>
      </section>

      <section class="group" data-group="evening">
        <button class="group-head" aria-expanded="false">
          <span class="g-text"><span class="g-title" data-text="groupEvening"></span><span class="g-summary"></span></span>
          <span class="chevron" aria-hidden="true"></span>
        </button>
        <div class="group-body">
      <div class="setting wide" data-setting="evening">
        <div class="label"></div>
        <div class="segmented multi visual">${EVENING_EFFECTS.map((effect) => `<button data-effect="${effect}"><span class="sample" aria-hidden="true"></span><span class="text"></span></button>`).join("")}</div>
        <div class="hint"></div>
        <button class="action small evening-preview" aria-pressed="false"></button>
      </div>
        </div>
      </section>

      <section class="group" data-group="areas">
        <button class="group-head" aria-expanded="false">
          <span class="g-text"><span class="g-title" data-text="groupAreas"></span><span class="g-summary"></span></span>
          <span class="chevron" aria-hidden="true"></span>
        </button>
        <div class="group-body">
      <div class="grid">
        ${segmentHtml("cards", CHOICES.cards)}
        ${segmentHtml("apps", CHOICES.apps)}
      </div>
      <div class="apps-list" hidden></div>
      <div class="hint apps-exceptions" hidden></div>
        </div>
      </section>

      <section class="group" data-group="device">
        <button class="group-head" aria-expanded="false">
          <span class="g-text"><span class="g-title" data-text="groupDevice"></span><span class="g-summary"></span></span>
          <span class="chevron" aria-hidden="true"></span>
        </button>
        <div class="group-body">
      <div class="grid">${Object.entries(DEVICE_SEGMENTS).map(([name, values]) => segmentHtml(name, values, "data-device")).join("")}</div>
        </div>
      </section>

      <div class="footer">
        <span class="info per-user"></span>
        <div class="actions">
          <button class="action defaults" hidden></button>
          <button class="action reset"></button>
        </div>
      </div>`;

    for (const row of ROWS) {
      const block = root.querySelector(`.block[data-key="${row.key}"]`);
      const input = block.querySelector("input");
      // Während des Ziehens nur anzeigen, gespeichert wird beim Loslassen.
      input.addEventListener("input", () => {
        preview[row.key] = input.value;
        applySettings();
      });
      input.addEventListener("change", () => this._save({ [row.key]: input.value }));
      for (const dot of block.querySelectorAll(".dot")) {
        dot.addEventListener("click", () => this._save({ [row.key]: dot.dataset.color }));
      }
    }
    for (const [name, { scale }] of Object.entries(RANGES)) {
      const input = root.querySelector(`[data-setting="${name}"] input`);
      input.addEventListener("input", () => {
        preview[name] = Number(input.value) / scale;
        applySettings();
        this._update();
      });
      input.addEventListener("change", () => this._save({ [name]: Number(input.value) / scale }));
    }
    for (const button of root.querySelectorAll("button[data-value]")) {
      const name = button.closest("[data-setting]").dataset.setting;
      button.addEventListener("click", () => this._save({ [name]: button.dataset.value }));
    }
    // Eigene Hintergrundfarbe
    const customTint = root.querySelector(".tint-input");
    customTint.addEventListener("input", () => {
      preview.tint = customTint.value;
      applySettings();
      this._update();
    });
    customTint.addEventListener("change", () => this._save({ tint: customTint.value }));
    for (const button of root.querySelectorAll("button[data-effect]")) {
      button.addEventListener("click", () => {
        const current = new Set(this._current().evening);
        if (current.has(button.dataset.effect)) current.delete(button.dataset.effect);
        else current.add(button.dataset.effect);
        this._save({ evening: EVENING_EFFECTS.filter((effect) => current.has(effect)) });
      });
    }
    for (const button of root.querySelectorAll("button[data-device]")) {
      const name = button.closest("[data-setting]").dataset.setting;
      button.addEventListener("click", () => {
        const value = button.dataset.device;
        if (name === "mode") saveDevice({ mode: value === "user" ? undefined : value });
        else saveDevice({ saver: value === "on" ? true : undefined });
        tick();
        this._render();
      });
    }
    for (const button of root.querySelectorAll("button[data-scope]")) {
      button.addEventListener("click", () => {
        const scope = button.dataset.scope;
        this._scope = scope;
        if (scope === "dashboard") {
          this._dashboard = this._dashboard || currentDashboard(this._hass) || this._dashboards()[0]?.url || "";
        } else {
          const own = scope === "device";
          // Eigene Einstellungen beginnen mit denen des Benutzers
          if (own !== !!device().own) {
            saveDevice(own ? { own: true, settings: userLayer(this._hass) } : { own: undefined, settings: undefined });
          }
        }
        tick();
        this._render();
      });
    }
    root.querySelector("select.dashboard").addEventListener("change", (ev) => {
      this._dashboard = ev.target.value;
      this._render();
    });
    root.querySelector(".styles").addEventListener("click", (ev) => {
      const del = ev.target.closest(".delete");
      const button = ev.target.closest(".style");
      if (!button) return;
      if (del) {
        const index = Number(button.dataset.own);
        const list = ownPresets(this._hass).filter((_, i) => i !== index);
        getRoot()?.dispatchEvent(new CustomEvent("settheme", { detail: { neumorphismPresets: list }, bubbles: true, composed: true }));
        setTimeout(() => this._render(), 50);
        return;
      }
      const values = button.dataset.preset ? STYLE_PRESETS[button.dataset.preset] : ownPresets(this._hass)[Number(button.dataset.own)]?.settings;
      if (values) this._save(presetPatch(readLayer(values)));
    });
    const presetForm = root.querySelector(".preset-form");
    const codeForm = root.querySelector(".code-form");
    root.querySelector(".preset-save").addEventListener("click", () => {
      presetForm.hidden = !presetForm.hidden;
      codeForm.hidden = true;
      if (!presetForm.hidden) root.querySelector(".preset-name").focus();
    });
    const savePreset = () => {
      const name = root.querySelector(".preset-name").value.trim();
      if (!name) return;
      const current = this._current();
      const values = Object.fromEntries(STYLE_KEYS.filter((key) => JSON.stringify(current[key]) !== JSON.stringify(BUILTIN[key])).map((key) => [key, current[key]]));
      const list = [...ownPresets(this._hass).filter((p) => p.name !== name), { name, settings: values }].slice(-MAX_OWN_PRESETS);
      getRoot()?.dispatchEvent(new CustomEvent("settheme", { detail: { neumorphismPresets: list }, bubbles: true, composed: true }));
      root.querySelector(".preset-name").value = "";
      presetForm.hidden = true;
      setTimeout(() => this._render(), 50);
    };
    root.querySelector(".preset-save-ok").addEventListener("click", savePreset);
    root.querySelector(".preset-name").addEventListener("keydown", (ev) => ev.key === "Enter" && savePreset());
    root.querySelector(".code-copy").addEventListener("click", () => this._copyCode());
    root.querySelector(".code-paste").addEventListener("click", () => {
      const t = texts(this._hass);
      presetForm.hidden = true;
      codeForm.hidden = codeForm.dataset.mode === "paste" ? !codeForm.hidden : false;
      codeForm.dataset.mode = "paste";
      const input = root.querySelector(".code-input");
      input.readOnly = false;
      input.value = "";
      input.placeholder = CODE_PREFIX;
      root.querySelector(".code-apply").hidden = false;
      root.querySelector(".code-form .message").textContent = "";
      if (!codeForm.hidden) input.focus();
      root.querySelector(".code-apply").textContent = t.codeApply;
    });
    const applyCode = () => {
      const values = parseStyleCode(root.querySelector(".code-input").value);
      if (!values) {
        root.querySelector(".code-form .message").textContent = texts(this._hass).codeInvalid;
        return;
      }
      codeForm.hidden = true;
      this._save(presetPatch(values));
    };
    root.querySelector(".code-apply").addEventListener("click", applyCode);
    root.querySelector(".code-input").addEventListener("keydown", (ev) => ev.key === "Enter" && !ev.target.readOnly && applyCode());
    root.querySelector(".apps-list").addEventListener("change", (ev) => {
      const off = new Set(this._current().appsOff);
      if (ev.target.checked) off.delete(ev.target.value);
      else off.add(ev.target.value);
      this._save({ appsOff: [...off] });
    });
    root.querySelector(".reset").addEventListener("click", () =>
      this._save(Object.fromEntries(SETTING_KEYS.map((key) => [key, undefined])))
    );
    root.querySelector(".defaults").addEventListener("click", () => this._saveDefaults());
    // Gruppen auf- und zuklappen (gemerkt auf diesem Gerät)
    const open = new Set(readJson(GROUPS_KEY) || ["presets"]);
    for (const group of root.querySelectorAll(".group")) {
      const head = group.querySelector(".group-head");
      const set = (state) => {
        group.classList.toggle("open", state);
        head.setAttribute("aria-expanded", String(state));
      };
      set(open.has(group.dataset.group));
      head.addEventListener("click", () => {
        const state = !group.classList.contains("open");
        set(state);
        if (state) open.add(group.dataset.group);
        else open.delete(group.dataset.group);
        writeJson(GROUPS_KEY, [...open]);
      });
    }
    root.querySelector(".evening-preview").addEventListener("click", () => {
      previewState.evening = previewState.evening ? null : this;
      tick();
      this._render();
    });
    ensureSampleFonts();
    root.querySelector(".automation-reset").addEventListener("click", () =>
      this._hass.callService("neumorphism", "reset_style", {}).catch((err) => console.warn("Neumorphism:", err))
    );
  }

  /** Code des aktuellen Aussehens in die Zwischenablage, sonst zum Markieren anzeigen. */
  async _copyCode() {
    const root = this.shadowRoot;
    const t = texts(this._hass);
    const code = styleCode(this._current());
    const form = root.querySelector(".code-form");
    const input = root.querySelector(".code-input");
    const message = root.querySelector(".code-form .message");
    root.querySelector(".preset-form").hidden = true;
    form.dataset.mode = "copy";
    form.hidden = false;
    input.readOnly = true;
    input.value = code;
    root.querySelector(".code-apply").hidden = true;
    try {
      await navigator.clipboard.writeText(code);
      message.textContent = t.codeCopied;
    } catch {
      // Ohne sichere Verbindung (http) gibt es keine Zwischenablage: zum Kopieren markieren
      message.textContent = t.codeManual;
      input.focus();
      input.select();
    }
  }

  /** Muster in den Auswahlen (jede zeigt, was sie bewirkt) und an den Reglern (aktueller Wert). */
  _renderSamples(t, current, dark) {
    const root = this.shadowRoot;
    const primary = current.primary || THEME_PRIMARY;
    const light = lightOf(current.light, this._hass);
    // Mit wenig Effektstärke wären die Unterschiede kaum zu sehen
    const vivid = Math.abs(current.strength) < 0.4 ? (current.strength < 0 ? -1 : 1) : current.strength;
    const contrast = current.contrast === "high" ? 1 : 0;
    const css = getComputedStyle(document.documentElement);
    const c = {
      s: current, dark, light, vivid, contrast, primary, t, hass: this._hass,
      accent: current.accent || THEME_ACCENT,
      bg: tintPalette(current.tint, dark, primary).bg,
      haColors: HA_CHART_COLORS.map((fallback, i) => css.getPropertyValue(`--color-${i + 1}`).trim() || fallback),
    };
    // Gemeinsame Schatten der Muster
    const shadow = { ...light, strength: vivid, contrast };
    const vars = {
      "--s-raised": sampleShadow(shadow),
      "--s-raised-s": sampleShadow({ ...shadow, d: 2, blur: 4 }),
      "--s-inset": sampleShadow({ ...shadow, inset: true, d: 3, blur: 7 }),
    };
    const holder = root.querySelector("style.sample-vars");
    const text = `:host { ${Object.entries(vars).map(([name, value]) => `${name}: ${value};`).join(" ")} }`;
    if (holder.textContent !== text) holder.textContent = text;
    const set = (el, html) => {
      if (el.__sample === html) return; // gleiches Muster: nicht neu zeichnen (Animationen laufen weiter)
      el.__sample = html;
      el.innerHTML = html;
    };
    for (const button of root.querySelectorAll(".segmented.visual button")) {
      const name = button.closest("[data-setting]").dataset.setting;
      const html = button.dataset.effect
        ? EFFECT_SAMPLES[button.dataset.effect](c)
        : SAMPLES[name]?.(button.dataset.value ?? button.dataset.device, c);
      if (html !== undefined) set(button.querySelector(".sample"), html);
    }
    for (const [name, render] of Object.entries(RANGE_SAMPLES)) {
      const el = root.querySelector(`[data-setting="${name}"] .range-sample`);
      if (el) set(el, render(c));
    }
  }

  /** Kurzfassung der Werte einer Gruppe für ihre Kopfzeile. */
  _summaries(t, current, styles) {
    const label = (name, value) => (t[`${name}_${value}`] || String(value)).replace(/^[↖↑↗☀]\s*/, "");
    const colorName = (key) => PRESETS.find(([, hex]) => hex === current[key])?.[0] || current[key];
    const colors = current.primary || current.accent
      ? `${colorName("primary") || t.fromTheme} / ${colorName("accent") || t.fromTheme}`
      : t.colorsFromTheme;
    const preset = styles.find((p) => sameStyle(current, p.values));
    const strength = Math.round(current.strength * STRENGTH_SCALE);
    const depth = [
      `${t.strength} ${strength > 0 ? "+" : ""}${strength}`,
      label("light", current.light),
      label("surface", current.surface),
      current.contrast === "high" ? `${t.contrast} ${label("contrast", "high")}` : "",
      current.pressed === "on" ? t.pressed : "",
      current.grain !== "off" ? `${t.grain} ${label("grain", current.grain)}` : "",
    ];
    const join = (items) => items.filter(Boolean).join(" · ");
    return {
      presets: preset ? preset.name : t.customStyle,
      colors: join([colors, `${t.tint} ${isCustomTint(current.tint) ? `${t.tint_custom} ${current.tint}` : label("tint", current.tint)}`, `${t.summaryCharts} ${label("charts", current.charts)}`]),
      depth: join(depth),
      shape: join([
        `${t.summaryRadius} ${Math.round(current.radius * 100)} %`,
        `${t.summaryFont} ${label("font", current.font)}`,
        `${t.summarySize} ${Math.round(current.fontScale * 100)} %`,
        `${t.summaryDensity} ${label("density", current.density)}`,
        `${t.summarySections} ${label("sections", current.sections)}`,
      ]),
      motion: join([`${t.motion} ${label("motion", current.motion)}`, `${t.glow.split(" ")[0]} ${label("glow", current.glow)}`]),
      evening: current.evening.length ? current.evening.map((effect) => t[`evening_${effect}`]).join(", ") : t.summaryOff,
      areas: join([`${t.summaryCards} ${label("cards", current.cards)}`, `${t.summaryApps} ${label("apps", current.apps)}`]),
      device: join([device().mode ? label("mode", device().mode) : t.modeSummary_user, `${t.saver} ${label("saver", saver() ? "on" : "off")}`]),
    };
  }

  /** Administratoren: aktuelle Einstellungen als Standard für alle Benutzer (Integration). */
  async _saveDefaults() {
    const t = texts(this._hass);
    let message = t.defaultsSaved;
    try {
      // Nur was gewählt wurde: Werte des Themes bleiben offen und folgen künftigen Versionen
      const target = this._target();
      const defaults = { ...backend.defaults, ...userLayer(this._hass), ...(target.kind === "device" ? deviceLayer() : {}) };
      await this._hass.callWS({ type: "neumorphism/set_defaults", defaults });
    } catch (err) {
      console.warn("Neumorphism:", err);
      message = t.defaultsFailed;
    }
    this.dispatchEvent(new CustomEvent("hass-notification", { detail: { message }, bubbles: true, composed: true }));
  }

  /** Add-ons: an/aus und Ausnahmen (Liste nur für Administratoren, aus dem Supervisor). */
  _updateApps(t, current) {
    const root = this.shadowRoot;
    if (this._apps === undefined) {
      this._apps = null;
      this._loadApps().then((apps) => {
        this._apps = apps;
        this._render();
      });
    }
    // Auch Ausnahmen für Add-ons zeigen, die gerade nicht in der Liste stehen (z. B. gestoppt)
    const apps = [...(this._apps || [])];
    for (const slug of current.appsOff) if (!apps.some((app) => app.slug === slug)) apps.push({ slug, name: slug });
    const list = root.querySelector(".apps-list");
    const visible = current.apps === "full" && apps.length > 0;
    list.hidden = !visible;
    const exceptions = root.querySelector(".apps-exceptions");
    exceptions.hidden = !visible;
    exceptions.textContent = t.appsExceptions;
    const key = apps.map((app) => `${app.slug}:${app.name}`).join("|");
    if (list.dataset.key !== key) {
      list.dataset.key = key;
      list.replaceChildren(
        ...apps.map((app) => {
          const label = document.createElement("label");
          const input = document.createElement("input");
          input.type = "checkbox";
          input.value = app.slug;
          label.append(input, document.createTextNode(app.name));
          return label;
        })
      );
    }
    for (const input of list.querySelectorAll("input")) input.checked = !current.appsOff.includes(input.value);
  }

  /**
   * Was sich abwählen lässt: Seiten von Integrationen (aus der Seitenleiste) und Add-ons mit
   * eigener Oberfläche (aus dem Supervisor, sonst aus der Seitenleiste).
   */
  async _loadApps() {
    const hass = this._hass;
    if (!hass?.user?.is_admin) return [];
    const panels = Object.values(hass.panels || {});
    const pages = panels
      .filter((panel) => panel.component_name === "custom" && panel.url_path)
      .map((panel) => ({ slug: `panel:${panel.url_path}`, name: panel.title || panel.url_path }));
    let apps = panels
      .filter((panel) => panel.component_name === "app" && panel.config?.addon)
      .map((panel) => ({ slug: panel.config.addon, name: panel.title || panel.config.addon }));
    if (hass.config?.components?.includes("hassio")) {
      const api = (endpoint) => hass.callWS({ type: "supervisor/api", endpoint, method: "get" });
      try {
        const list = (await api("/addons"))?.addons || [];
        const infos = await Promise.all(list.map((app) => api(`/addons/${app.slug}/info`).catch(() => null)));
        apps = infos.filter((info) => info?.ingress).map((info) => ({ slug: info.slug, name: info.name }));
      } catch {
        // Liste aus der Seitenleiste genügt
      }
    }
    const byName = (a, b) => a.name.localeCompare(b.name);
    return [...pages.sort(byName), ...apps.sort(byName)];
  }


  /**
   * Was im gewählten Ziel eingestellt ist (mit allem darunter), ohne Abendmodus, Automationen und
   * den Stil des Dashboards dieser Seite: Auswahl und Regler zeigen, was gespeichert wird.
   */
  _current() {
    return { ...baseSettings(this._hass, this._target()), ...preview };
  }

  /** Was gerade zu sehen ist (beim Dashboard: wie auf diesem Dashboard), für die Vorschau. */
  _effective() {
    const target = this._target();
    return settings(this._hass, target.kind === "dashboard" ? target.dashboard : undefined);
  }

  /** Was gerade über dem gewählten Ziel liegt: Stil des Dashboards dieser Seite, Abendmodus. */
  _overlays(t, current, effective, target) {
    const differs = (keys) => keys.filter((key) => JSON.stringify(effective[key]) !== JSON.stringify(current[key]));
    const labels = (keys) => [...new Set(keys.map((key) => t[SETTING_LABELS[key]]))].join(", ");
    const out = [];
    const page = target.kind === "dashboard" ? null : backend.dashboards[currentDashboard(this._hass)];
    const dashboardKeys = page ? differs(Object.keys(page)) : [];
    if (dashboardKeys.length) out.push(`${t.overlayDashboard} (${labels(dashboardKeys)})`);
    const eveningKeys = eveningNow(this._hass) ? differs(Object.keys(eveningLayer(effective, this._hass))) : [];
    if (eveningKeys.length) out.push(`${t.overlayEvening} (${labels(eveningKeys)})`);
    return out;
  }

  _save(patch) {
    const result = saveSettings(patch, this._target());
    for (const key of Object.keys(preview)) delete preview[key];
    applySettings();
    this._render();
    result?.then?.(() => this._render());
  }

  /** Regler mit Füllung von mark bis zum Wert (null: vom Anfang). */
  _range(input, value, mark) {
    const root = this.shadowRoot;
    if (root.activeElement !== input) input.value = String(value);
    const min = Number(input.min);
    const position = ((Number(input.value) - min) / (Number(input.max) - min)) * 100;
    const from = mark ?? 0;
    input.style.setProperty("--mark", mark === null ? "-10%" : `${mark}%`);
    input.style.setProperty("--from", `${Math.min(from, position).toFixed(1)}%`);
    input.style.setProperty("--to", `${Math.max(from, position).toFixed(1)}%`);
  }

  _update() {
    const root = this.shadowRoot;
    const hass = this._hass;
    const t = texts(hass);
    const active = neumorphismActive();
    const own = !!device().own;
    const isAdmin = !!hass.user?.is_admin;
    if (this._scope === undefined) this._scope = own ? "device" : "user";
    if (this._scope !== "dashboard") this._scope = own ? "device" : "user";
    if (this._scope === "dashboard" && !(isAdmin && backend.available)) this._scope = own ? "device" : "user";
    const target = this._target();
    // Beim Bearbeiten eines Dashboards zeigt die Seite dessen Stil
    // (bei mehreren offenen Einstellungen die zuerst gewählten)
    const dashboard = target.kind === "dashboard" ? target.dashboard : "";
    const owner = previewState.owner;
    if (dashboard && (!owner || owner === this || !owner.isConnected) && (owner !== this || previewState.dashboard !== dashboard)) {
      previewState.owner = this;
      previewState.dashboard = dashboard;
      scheduleTick(0);
    } else if (!dashboard && owner === this) {
      previewState.owner = null;
      previewState.dashboard = "";
      scheduleTick(0);
    }
    const current = this._current();
    const effective = this._effective();
    const dark = haDark();
    this.toggleAttribute("inactive", !active);

    // Nur neu beschriften, wenn sich etwas geändert hat (Home Assistant meldet sich bei jeder Zustandsänderung)
    const renderKey = JSON.stringify([
      current, effective, target, device(), isAdmin, backend.available, backend.style, dark, active, hass.language,
      ownPresets(hass), !!previewState.evening, (this._apps || []).map((app) => app.slug), targetLayer(target, hass),
    ]);
    if (renderKey === this._renderKey) return;
    this._renderKey = renderKey;

    root.querySelector(".headline").textContent = t.title;
    const warning = root.querySelector(".warning");
    warning.hidden = active;
    warning.textContent = t.inactive;
    for (const el of root.querySelectorAll("[data-text]")) el.textContent = t[el.dataset.text];
    root.querySelector(".per-user").textContent = { user: t.perUser, device: t.perDevice, dashboard: t.perDashboard }[target.kind];

    // Beschriftungen und gewählte Werte aller Auswahlfelder
    for (const setting of root.querySelectorAll(".setting[data-setting]")) {
      const name = setting.dataset.setting;
      setting.querySelector(".label").textContent = t[name] || "";
      const hint = setting.querySelector(".hint");
      if (hint) hint.textContent = name === "scope" ? t[`scopeHint_${target.kind}`] : t[`${name}Hint`] || "";
    }
    for (const button of root.querySelectorAll("button[data-value]")) {
      const name = button.closest("[data-setting]").dataset.setting;
      const label = t[`${name}_${button.dataset.value}`];
      (button.querySelector(".name, .text") || button).textContent = label;
      button.classList.toggle("selected", current[name] === button.dataset.value);
      button.setAttribute("aria-pressed", String(current[name] === button.dataset.value));
    }
    for (const button of root.querySelectorAll("button[data-effect]")) {
      button.querySelector(".text").textContent = t[`evening_${button.dataset.effect}`];
      button.classList.toggle("selected", current.evening.includes(button.dataset.effect));
      button.setAttribute("aria-pressed", String(current.evening.includes(button.dataset.effect)));
    }

    // Speichern für: Benutzer, Gerät oder (Administratoren) ein Dashboard
    for (const button of root.querySelectorAll("button[data-scope]")) {
      button.textContent = t[`scope_${button.dataset.scope}`];
      button.hidden = button.dataset.scope === "dashboard" && !(isAdmin && backend.available);
      button.classList.toggle("selected", button.dataset.scope === target.kind);
      button.setAttribute("aria-pressed", String(button.dataset.scope === target.kind));
    }
    const select = root.querySelector("select.dashboard");
    select.hidden = target.kind !== "dashboard";
    if (!select.hidden) {
      const dashboards = this._dashboards();
      const key = dashboards.map((d) => `${d.url}:${d.title}`).join("|");
      if (select.dataset.key !== key) {
        select.dataset.key = key;
        select.replaceChildren(...dashboards.map((d) => new Option(d.title, d.url)));
      }
      select.value = target.dashboard;
    }
    const deviceValues = { mode: device().mode || "user", saver: saver() ? "on" : "off" };
    for (const button of root.querySelectorAll("button[data-device]")) {
      const name = button.closest("[data-setting]").dataset.setting;
      (button.querySelector(".text") || button).textContent = t[`${name}_${button.dataset.device}`];
      button.classList.toggle("selected", deviceValues[name] === button.dataset.device);
      button.setAttribute("aria-pressed", String(deviceValues[name] === button.dataset.device));
    }

    // Vorlagen: fertige und eigene, die passende ist markiert
    const primaryOf = (values) => values.primary || current.primary || THEME_PRIMARY;
    const styles = [
      ...Object.entries(STYLE_PRESETS).map(([id, values]) => ({ attr: `data-preset="${id}"`, name: t[`preset_${id}`], values, own: false })),
      ...ownPresets(hass).map((preset, i) => ({ attr: `data-own="${i}"`, name: preset.name, values: readLayer(preset.settings), own: true })),
    ];
    const stylesKey = JSON.stringify([styles.map((p) => [p.name, p.values]), dark, current.primary]);
    const list = root.querySelector(".styles");
    if (list.dataset.key !== stylesKey) {
      list.dataset.key = stylesKey;
      list.innerHTML = styles
        .map((p) => {
          const bg = tintPalette(p.values.tint || "standard", dark, primaryOf(p.values)).bg;
          const name = p.name.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
          const del = p.own ? `<span class="delete" role="button" aria-label="${t.presetDelete}" title="${t.presetDelete}">×</span>` : "";
          return `<button class="style" ${p.attr}><span class="swatch" style="background:${bg};--dot:${primaryOf(p.values)}"></span>${name}${del}</button>`;
        })
        .join("");
    }
    list.querySelectorAll(".style").forEach((button, i) => button.classList.toggle("selected", sameStyle(current, styles[i].values)));
    const summaries = this._summaries(t, current, styles);
    for (const group of root.querySelectorAll(".group")) group.querySelector(".g-summary").textContent = summaries[group.dataset.group] || "";

    // Muster in den Auswahlen und an den Reglern
    this._renderSamples(t, current, dark);
    // Abend ansehen
    const eveningButton = root.querySelector(".evening-preview");
    eveningButton.textContent = t.eveningPreview;
    eveningButton.disabled = !current.evening.length && !previewState.evening;
    eveningButton.setAttribute("aria-pressed", String(!!previewState.evening));
    root.querySelector(".presets-hint").textContent = t.presetsHint;
    root.querySelector(".preset-save").textContent = t.presetSave;
    root.querySelector(".preset-name").placeholder = t.presetName;
    root.querySelector(".preset-save-ok").textContent = t.presetSaveOk;
    root.querySelector(".code-copy").textContent = t.codeCopy;
    root.querySelector(".code-paste").textContent = t.codePaste;
    root.querySelector(".code-apply").textContent = t.codeApply;

    // Hintergrund: Farbmuster im aktuellen Modus
    const primary = current.primary || THEME_PRIMARY;
    // Hintergrund: Farbwähler wie bei Primär- und Akzentfarbe, darunter die Vorgaben
    const tintInput = root.querySelector(".tint-input");
    const ownTint = isCustomTint(current.tint);
    if (root.activeElement !== tintInput) tintInput.value = ownTint ? current.tint : tintPalette(current.tint, dark, primary).bg;
    tintInput.setAttribute("aria-label", t.tint);
    root.querySelector('[data-setting="tint"] .value').textContent = ownTint ? current.tint : t[`tint_${current.tint}`];
    for (const button of root.querySelectorAll("button.tint")) {
      button.querySelector(".swatch").style.background = tintPalette(button.dataset.value, dark, primary).bg;
    }

    // Regler
    const strength = Math.round(current.strength * STRENGTH_SCALE);
    this._range(root.querySelector('[data-setting="strength"] input'), strength, 50);
    root.querySelector('[data-setting="strength"] .value').textContent =
      strength === 0 ? `0 (${t.flat})` : strength > 0 ? `+${strength}` : `−${-strength} (${t.inverted})`;
    const radius = Math.round(current.radius * 100);
    this._range(root.querySelector('[data-setting="radius"] input'), radius, 0);
    root.querySelector('[data-setting="radius"] .value').textContent = radius === 0 ? `0 % (${t.square})` : `${radius} %`;
    const fontScale = Math.round(current.fontScale * 100);
    this._range(root.querySelector('[data-setting="fontScale"] input'), fontScale, null);
    root.querySelector('[data-setting="fontScale"] .value').textContent = `${fontScale} %`;
    for (const input of root.querySelectorAll('input[type="range"]')) input.setAttribute("aria-label", t[input.closest("[data-setting]").dataset.setting]);

    this._updateApps(t, current);

    // Farben
    const css = getComputedStyle(document.documentElement);
    for (const row of ROWS) {
      const block = root.querySelector(`.block[data-key="${row.key}"]`);
      const input = block.querySelector("input");
      const value = current[row.key];
      const shown = preview[row.key] || value || normalize(css.getPropertyValue(row.cssVar)) || THEME_PRIMARY;
      if (root.activeElement !== input) input.value = shown;
      input.setAttribute("aria-label", t[row.key]);
      block.querySelector(".label").textContent = t[row.key];
      block.querySelector(".hint").textContent = t[`${row.key}Hint`];
      block.querySelector(".value").textContent = value || t.fromTheme;
      for (const dot of block.querySelectorAll(".dot")) dot.classList.toggle("selected", dot.dataset.color === value);
    }

    // Von einer Automation festgelegt
    const fixed = [...new Set(Object.keys(backend.style).map((key) => t[SETTING_LABELS[key]]))];
    const notice = root.querySelector(".automation");
    notice.hidden = !fixed.length;
    notice.querySelector("span").textContent = `${t.automation} ${fixed.join(", ")}`;
    const clear = root.querySelector(".automation-reset");
    clear.hidden = !isAdmin;
    clear.textContent = t.automationReset;
    // Abendmodus oder Stil des Dashboards liegen gerade darüber
    const overlays = this._overlays(t, current, effective, target);
    const overlay = root.querySelector(".overlay");
    overlay.hidden = !overlays.length;
    overlay.querySelector("span").textContent = `${t.overlay} ${overlays.join(" · ")}`;

    // Zurücksetzen der Ebene, in die gerade gespeichert wird; Standard für alle nur für Administratoren
    const reset = root.querySelector(".reset");
    reset.textContent = t.reset;
    reset.hidden = !Object.keys(targetLayer(target, hass)).length;
    const defaults = root.querySelector(".defaults");
    defaults.textContent = t.defaults;
    defaults.hidden = !(isAdmin && backend.available && target.kind !== "dashboard");
  }
}

class NeumorphismColorCard extends HTMLElement {
  static getStubConfig() {
    return {};
  }

  setConfig(config) {
    this._config = { title: "", ...config };
    if (this.shadowRoot) this._update();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.shadowRoot) this._build();
    this._picker.hass = hass;
    this._update();
  }

  getCardSize() {
    return 4;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  _build() {
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        ha-card { padding: 16px 20px 16px; }
        h2 { margin: 0 0 4px; font-size: var(--ha-card-header-font-size, 1.25rem);
          font-weight: var(--ha-font-weight-normal, 400); color: var(--ha-card-header-color, var(--primary-text-color)); }
      </style>
      <ha-card><h2></h2><${PICKER_TAG}></${PICKER_TAG}></ha-card>`;
    this._picker = root.querySelector(PICKER_TAG);
  }

  _update() {
    const h2 = this.shadowRoot.querySelector("h2");
    const title = this._config?.title || texts(this._hass).title;
    h2.textContent = title;
  }
}

// ---------------------------------------------------------------------------
// Einbau ins Profil: unter Design-Auswahl und Design-Modus
// ---------------------------------------------------------------------------

function findDeep(selector) {
  const stack = [document];
  while (stack.length) {
    const node = stack.pop();
    const found = node.querySelector(selector);
    if (found) return found;
    for (const el of node.querySelectorAll("*")) {
      if (el.shadowRoot) stack.push(el.shadowRoot);
    }
  }
  return null;
}

let profilePicker = null;

function injectIntoProfile() {
  // Alle offenen Einstellungen: Einstellungen der Integration, dieses Geräts oder Vorschau geändert
  for (const picker of pickers) picker._render();
  if (!location.pathname.startsWith("/profile")) return;
  if (profilePicker?.isConnected) {
    profilePicker.hass = getHass();
    return;
  }
  // Neuere Versionen: ha-theme-settings, ältere: ha-pick-theme-row.
  const host = findDeep("ha-theme-settings") || findDeep("ha-pick-theme-row");
  if (!host?.shadowRoot) return;
  profilePicker = host.shadowRoot.querySelector(PICKER_TAG);
  if (!profilePicker) {
    profilePicker = document.createElement(PICKER_TAG);
    profilePicker.setAttribute("in-profile", "");
    host.shadowRoot.appendChild(profilePicker);
  }
  profilePicker.hass = getHass();
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const PROFILE_TAGS = ["ha-theme-settings", "ha-pick-theme-row"];

function tick() {
  safely(refreshBrandsToken);
  safely(applySettings);
  safely(injectIntoProfile);
  safely(updateDroplets);
  safely(updateButtonGroups);
  safely(updateCards);
  safely(updateFrames);
  safely(updateForeignElements);
}

/**
 * Geprüft wird nur, wenn sich etwas ändert: neue Bausteine (Seiten, Dialoge, Karten, Knöpfe),
 * Seitenwechsel, Theme oder Einstellungen. Danach noch zweimal die Lage, weil Dialoge und
 * Seiten noch kurz einschweben. Dazu eine seltene Sicherheitsprüfung (siehe unten).
 */
let tickTimer = 0;
let followTimers = [];
function scheduleTick(delay = 50) {
  if (tickTimer) return;
  tickTimer = setTimeout(() => {
    tickTimer = 0;
    tick();
    for (const timer of followTimers) clearTimeout(timer);
    followTimers = [350, 900].map((ms) => setTimeout(scheduleLayout, ms));
  }, delay);
}

// Lage der Knöpfe geändert (Größe): nur die Tropfenformen neu
let layoutFrame = 0;
function scheduleLayout() {
  if (layoutFrame) return;
  layoutFrame = requestAnimationFrame(() => {
    layoutFrame = 0;
    safely(updateDroplets);
    safely(updateButtonGroups);
  });
}
const layoutObserver = typeof ResizeObserver === "function" ? new ResizeObserver(scheduleLayout) : null;

// Kurzer Bericht dieses Geräts für die Diagnose der Integration (einmal pro Laden der Seite)
const DEVICE_ID_KEY = "neumorphism-device-id";
let reportScheduled = false;

function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return "session";
  }
}

function scheduleReport() {
  if (reportScheduled) return;
  reportScheduled = true;
  setTimeout(() => safely(sendReport), 20000);
}

function sendReport() {
  const hass = getHass();
  if (!hass?.callWS) return;
  const report = {
    version: VERSION,
    time: new Date().toISOString(),
    browser: navigator.userAgent,
    app: !!hass.auth?.external,
    screen: `${innerWidth}x${innerHeight}@${devicePixelRatio}`,
    language: hass.language,
    theme: hass.themes?.theme,
    active: neumorphismActive(),
    dark: haDark(),
    device: { own: !!device().own, mode: device().mode || "user", saver: saver() },
    settings: settings(hass),
    layers: {
      defaults: Object.keys(backend.defaults),
      user: Object.keys(userLayer(hass)),
      device: Object.keys(deviceLayer()),
      dashboards: Object.keys(backend.dashboards),
      automation: Object.keys(backend.style),
    },
    // Fremde Bausteine nach Herkunft (Namensanfang) gezählt, z. B. { mushroom: 60, m3: 90 }
    custom_elements: [...thirdPartyTags].reduce((out, tag) => {
      const parts = tag.split("-");
      const prefix = ["ha", "hui", "hass"].includes(parts[0]) ? parts.slice(0, 2).join("-") : parts[0];
      out[prefix] = (out[prefix] || 0) + 1;
      return out;
    }, {}),
    custom_cards: [...cardTags].sort(),
    embedded_pages: [...new Set([...frameHosts].map(hostKey).filter(Boolean))],
    foreign_areas: scopes.size,
    warnings: recentWarnings,
  };
  hass.callWS({ type: "neumorphism/report", device: deviceId(), report }).catch(() => {});
}

if (!customElements.get(PICKER_TAG)) {
  customElements.define(PICKER_TAG, NeumorphismColorPicker);
  customElements.define("neumorphism-color-card", NeumorphismColorCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "neumorphism-color-card",
    name: "Neumorphism Farben",
    description: "Alle Einstellungen des Neumorphism-Themes: Farben, Hintergrund, Effektstärke, Licht, Form und mehr.",
    preview: true,
  });

  hookDefine();
  patchControls();
  hookStateBadges();
  window.addEventListener("resize", scheduleLayout);
  // Theme- oder Moduswechsel: Home Assistant schreibt die Theme-Variablen in das style-Attribut von <html>.
  new MutationObserver(() => {
    themeGeneration++;
    scheduleTick(0);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
  window.addEventListener("location-changed", () => scheduleTick(100));
  document.addEventListener("visibilitychange", () => !document.hidden && scheduleTick());
  // Einstellungen dieses Geräts in einem anderen Fenster geändert
  window.addEventListener("storage", (ev) => {
    if (ev.key !== DEVICE_KEY) return;
    deviceCache = null;
    tick();
  });
  // Sonnenstand (Licht nach der Sonne, Abendmodus) meldet sich nicht: alle 5 Sekunden, im Sparmodus
  // alle 15, die Einstellungen prüfen (günstig). Dazu jede Minute eine vollständige Sicherheitsprüfung
  // für alles andere. Nicht bei verdeckter Seite.
  let last = 0;
  let lastFull = Date.now();
  setInterval(() => {
    if (document.hidden || Date.now() - last < (saver() ? 14900 : 4900)) return;
    last = Date.now();
    if (last - lastFull > 59000) {
      lastFull = last;
      tick();
    } else {
      const before = applied;
      safely(applySettings);
      if (applied !== before) scheduleTick(0); // z. B. Sonnenuntergang: alles neu
    }
  }, 5000);
  tick();

  console.info(`%c NEUMORPHISM-COLORS %c ${VERSION} `, "background:#3d7bfd;color:#fff", "");
}
