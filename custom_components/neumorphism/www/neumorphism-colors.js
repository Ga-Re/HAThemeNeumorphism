/*
 * Neumorphism für Home Assistant: Farbwähler, Effektstärke und Formung
 *
 * - Zeigt im Profil unter "Design" Farbwähler für Primär- und Akzentfarbe, einen
 *   Regler für die Effektstärke und die Schalter für eigene Karten und Add-ons,
 *   sobald das Theme "Neumorphism" gewählt ist.
 * - Stellt die Karte "custom:neumorphism-color-card" bereit (gleiche Einstellungen).
 * - Wendet die Einstellungen auf das aktive Theme an.
 * - Formt die Bausteine von Home Assistant (Schalter, Schieber, Knöpfe, Reiter,
 *   Eingabefelder, Tabellen ...) erhaben oder eingelassen, damit alles aus einem Guss wirkt.
 * - Alles, was nicht von Home Assistant stammt (eigene Karten, Seiten und Dialoge von
 *   Integrationen, HACS, Oberflächen von Add-ons), wird automatisch erkannt und nach Farbe
 *   und Form eingeordnet, ohne Regeln für einzelne Integrationen oder Add-ons.
 *
 * Gespeichert wird in den Theme-Einstellungen des Benutzers (primaryColor,
 * accentColor, neumorphismStrength, neumorphismCards, neumorphismApps,
 * neumorphismAppsOff), dort wo Home Assistant auch die Farben des Standard-Themes ablegt.
 *
 * Wird von der Integration "Neumorphism" automatisch in das Frontend geladen.
 */

const VERSION = "6.1.1";
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
// Farben lesen, speichern, anwenden
// ---------------------------------------------------------------------------

// Jeder Schritt für sich: Ein Fehler in einem Teil soll die anderen nicht aufhalten.
function safely(fn) {
  try {
    return fn();
  } catch (err) {
    console.warn("Neumorphism:", err);
    return undefined;
  }
}

const normalize = (value) => (typeof value === "string" && HEX_RE.test(value.trim()) ? value.trim().toLowerCase() : "");
const getRoot = () => document.querySelector("home-assistant");
const getHass = () => getRoot()?.hass;

const clampStrength = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(STRENGTH_MAX, Math.max(-STRENGTH_MAX, number)) : null;
};

function storedSettings(hass = getHass()) {
  const theme = hass?.selectedTheme || {};
  return {
    primary: normalize(theme.primaryColor),
    accent: normalize(theme.accentColor),
    strength: theme.neumorphismStrength == null ? null : clampStrength(theme.neumorphismStrength),
    cards: ["full", "frame", "off"].includes(theme.neumorphismCards) ? theme.neumorphismCards : "full",
    cardsStored: theme.neumorphismCards != null,
    apps: theme.neumorphismApps === "off" ? "off" : "full",
    appsOff: Array.isArray(theme.neumorphismAppsOff) ? theme.neumorphismAppsOff.filter((v) => typeof v === "string") : [],
    appsStored: theme.neumorphismApps != null || theme.neumorphismAppsOff != null,
  };
}

/** Speichert wie das Profil von Home Assistant: pro Benutzer in den Theme-Einstellungen. */
function saveSettings(patch) {
  getRoot()?.dispatchEvent(new CustomEvent("settheme", { detail: patch, bubbles: true, composed: true }));
}

// Vorschau beim Ziehen, bevor der Wert gespeichert ist.
const preview = { primary: "", accent: "", strength: null };
let applied = null;
let colorCss = ""; // eigene Farben und Effektstärke, auch für eingebettete Seiten

function neumorphismActive() {
  return getComputedStyle(document.documentElement).getPropertyValue(MARKER_VAR).trim() !== "";
}

function applyColors() {
  const active = neumorphismActive();
  setControlsActive(active);
  const stored = storedSettings();
  const primary = preview.primary || stored.primary;
  const accent = preview.accent || stored.accent;
  const strength = preview.strength ?? stored.strength;
  const key = active ? `${primary}|${accent}|${strength}` : "";
  if (key === applied) return;
  applied = key;

  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  // !important schlägt die Inline-Variablen, die Home Assistant für das Theme auf <html> setzt.
  const vars = active ? colorVars(primary, accent) : {};
  // Alle Schatten des Themes sind mit dieser Variable multipliziert.
  if (active && strength !== null) vars["neumorphism-strength"] = String(strength);
  const body = Object.entries(vars)
    .map(([name, value]) => `--${name}: ${value} !important;`)
    .join(" ");
  colorCss = body;
  style.textContent = body ? `html { ${body} }` : "";
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
const SURFACE = "var(--card-background-color)";
const PILL = "var(--ha-border-radius-pill, 999px)";
const STRENGTH = "var(--neumorphism-strength, 1)";
// Knopfgruppen liegen über ihrer Tropfenform (siehe updateDroplets).
const GROUP = "position: relative; z-index: 1;";
// Statt einer Kante läuft der Inhalt unter der Titelleiste weich aus.
const HEADER_BG = "var(--app-header-background-color, var(--primary-background-color))";
const HEADER_FADE = `content: ""; position: absolute; left: 0; right: 0; top: 100%; height: 32px;
  pointer-events: none;
  background: linear-gradient(to bottom, ${HEADER_BG}, color-mix(in srgb, ${HEADER_BG} 65%, transparent) 35%, transparent);`;

// Pro Element (Tag) zusätzliche Regeln für dessen Shadow DOM.
const CONTROL_STYLES = {
  // Knöpfe in Kacheln und Detailansichten (z. B. +/–, Modus, Szenen)
  "ha-control-button": `
    .button { background: ${SURFACE}; box-shadow: ${RAISED}; }
    .button::before { opacity: max(0, calc((var(--control-button-background-opacity) - 0.2) * 1.25)) !important; }
    .button:not(:disabled):active { box-shadow: ${INSET_S}; }
  `,
  // Ein/Aus-Schalter in Kacheln: eingelassene Spur, erhabener Griff
  "ha-control-switch": `
    .switch { box-shadow: ${INSET}; }
    .switch .background { opacity: 0 !important; }
    .switch[checked] .background { opacity: 0.12 !important; }
    .switch .button { background-color: ${SURFACE} !important; color: var(--secondary-text-color); box-shadow: ${RAISED}; }
    .switch[checked] .button { background-color: var(--control-switch-on-color) !important; color: white; }
  `,
  // Auswahlknöpfe (Modus, Stufen): eingelassene Leiste, gewählte Option erhaben
  "ha-control-select": `
    .container { box-shadow: ${INSET}; border-radius: var(--control-select-border-radius); }
    .container::before { opacity: 0 !important; }
    .option.selected { box-shadow: ${RAISED}; }
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
    .icon-button { background: ${SURFACE}; box-shadow: ${RAISED_L}; }
    .icon-button:active { box-shadow: ${INSET_S}; }
  `,
  // Symbol links in Kacheln
  "ha-tile-icon": `
    .container { box-shadow: ${RAISED}; }
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
  "ha-panel-app": "",
  "ha-panel-iframe": "",
  "hui-iframe-card": "",
  // Symbol-Knöpfe sind flach, erhaben werden sie erst als Gruppe in der Titelleiste
  // Buttons, die mit Nachbarn eine gemeinsame Form haben (siehe updateButtonGroups)
  "ha-button": `
    :host([appearance="outlined"]) .button { border-color: transparent !important; background-color: ${SURFACE}; }
    :host([slot="fab"]) .button { box-shadow: ${RAISED_L} !important; }
    :host([neumorphism-merged]) { position: relative; z-index: 1; }
    :host([neumorphism-merged]) .button { box-shadow: none !important; }
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
    .action-items, .toolbar > ha-menu-button, .toolbar > ha-icon-button-arrow-prev { ${GROUP} }
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
      border-radius: ${PILL}; background: ${SURFACE}; box-shadow: ${RAISED_S}; }
    :host([narrow][active]) div::after { inset: 7px 4px; border-radius: 18px; }
  `,
  "ha-tab-group": `
    :host { --track-color: transparent !important; --indicator-color: transparent !important; }
    .indicator { display: none !important; }
  `,
  // Die Pille liegt in der Reiterfläche, ohne sie zu vergrößern: sonst wird die Reiterleiste
  // höher als die Titelleiste, lässt sich verschieben und schneidet den Schatten ab.
  "ha-tab-group-tab": `
    .tab { position: relative; isolation: isolate; }
    :host([active]) .tab::before { content: ""; position: absolute; inset: 9px 2px; z-index: -1;
      border-radius: ${PILL}; background: ${SURFACE}; box-shadow: ${RAISED_S}; }
  `,
  // Filter- und Auswahl-Chips: erhaben statt umrandet
  "ha-assist-chip": `
    :host([appearance="outlined"]) .button { border-color: transparent !important; background-color: ${SURFACE}; box-shadow: ${RAISED}; }
    /* ältere Fassung (z. B. in HACS) */
    .container:has(> .outline) { background: ${SURFACE}; box-shadow: ${RAISED}; }
    .outline { border-color: transparent !important; }
  `,
  // Aufklappbare Abschnitte mit Rahmen: erhaben statt umrandet
  "ha-expansion-panel": `
    :host([outlined]) { border-color: transparent !important; background: ${SURFACE}; box-shadow: ${RAISED}; }
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
    sheet.replaceSync(controlsActive ? CONTROL_STYLES[tag] : "");
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

/** Ein gemeinsames Stylesheet pro Element: leeren genügt, um alles abzuschalten. */
function setControlsActive(active) {
  if (active === controlsActive) return;
  controlsActive = active;
  for (const [doc, sheets] of sheetSets) {
    if (doc !== document && !doc.defaultView) {
      sheetSets.delete(doc); // Fenster geschlossen
      continue;
    }
    for (const [tag, sheet] of sheets) sheet.replaceSync(active ? CONTROL_STYLES[tag] : "");
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

/** Merkt sich Elemente, die später noch bearbeitet werden (Tropfen, Karten, eingebettete Seiten). */
function trackHost(el, tag) {
  if (DROPLET_GROUPS[tag]) dropletHosts.set(el, tag);
  if (tag === "ha-button") buttonHosts.add(el);
  if (tag === "hui-card") cardHosts.add(el);
  if (FRAME_HOSTS.includes(tag)) frameHosts.add(el);
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
  for (const tag of Object.keys(CONTROL_STYLES)) {
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
      for (const el of findAllDeep(tag, win.document)) {
        adoptControlStyle(el.shadowRoot, tag);
        trackHost(el, tag);
      }
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
    (root) => !root.querySelector(".edit-mode") && childGroup(root.querySelector(".toolbar .action-items")),
    (root) => !root.querySelector(".edit-mode") && singleGroup(root.querySelector(".toolbar")?.querySelector(NAV_BUTTON)),
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

/** Farben und Stärke aus dem Theme, aufgelöst über ein unsichtbares Element. */
function dropletPaint() {
  if (!dropletProbe) {
    dropletProbe = document.createElement("div");
    dropletProbe.style.cssText =
      "position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;" +
      "color:var(--neumorphism-shadow-dark);background-color:var(--neumorphism-shadow-light);" +
      "border:0 solid var(--card-background-color);";
    document.body.appendChild(dropletProbe);
  }
  const css = getComputedStyle(dropletProbe);
  const strength = clampStrength(getComputedStyle(document.documentElement).getPropertyValue("--neumorphism-strength").trim() || 1) ?? 1;
  return { dark: css.color, light: css.backgroundColor, fill: css.borderTopColor, strength };
}

const fmt = (n) => (Math.round(n * 100) / 100).toString();

/** Kreis oder Pille als Pfad im Uhrzeigersinn (für eine gemeinsame Füllung ohne Nähte). */
function capsulePath(left, right, cy, r) {
  const a = left + r;
  const b = Math.max(a, right - r);
  return (
    `M${fmt(a)} ${fmt(cy - r)}H${fmt(b)}A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(b)} ${fmt(cy + r)}` +
    `H${fmt(a)}A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(a)} ${fmt(cy - r)}Z`
  );
}

/** Eingeschnürte Brücke zwischen zwei Kreisen: Hohlkehlen tangential an beide Kreise. */
function bridgePath(x1, x2, cy, r) {
  const a = (x2 - x1) / 2;
  const h = DROPLET_NECK * r;
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

/** Form mit Schatten: erhaben, bei negativer Effektstärke eingelassen (Schatten innen). */
function dropletSvg(width, height, shapes, paint) {
  const s = Math.abs(paint.strength);
  const [dark, darkA] = rgbaParts(paint.dark);
  const [light, lightA] = rgbaParts(paint.light);
  const d = shapes.join("");
  const shade = (source, dx, color, alpha, result) =>
    `<feOffset in="${source}" dx="${fmt(dx * s)}" dy="${fmt(dx * s)}" result="${result}o"/>` +
    `<feFlood flood-color="${color}" flood-opacity="${alpha}"/><feComposite in2="${result}o" operator="in" result="${result}"/>`;
  const filter =
    paint.strength >= 0
      ? `<feGaussianBlur in="SourceAlpha" stdDeviation="${fmt(4.5 * s)}" result="b"/>` +
        shade("b", 4, dark, darkA, "d") +
        shade("b", -4, light, lightA, "l") +
        `<feMerge><feMergeNode in="d"/><feMergeNode in="l"/><feMergeNode in="SourceGraphic"/></feMerge>`
      : // Innenschatten: Umgebung der Form weichzeichnen, versetzen und auf die Form beschneiden
        `<feComponentTransfer in="SourceAlpha" result="inv"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>` +
        `<feGaussianBlur in="inv" stdDeviation="${fmt(4.5 * s)}" result="b"/>` +
        shade("b", 4, dark, darkA, "d0") +
        `<feComposite in="d0" in2="SourceAlpha" operator="in" result="d"/>` +
        shade("b", -4, light, lightA, "l0") +
        `<feComposite in="l0" in2="SourceAlpha" operator="in" result="l"/>` +
        `<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="d"/><feMergeNode in="l"/></feMerge>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><filter id="s" x="-50%" y="-50%" width="200%" height="200%">${filter}</filter></defs>` +
    `<path filter="url(#s)" fill="${paint.fill}" d="${d}"/></svg>`
  );
}

/** Zeichnet hinter jeder Knopfgruppe eine Form: Kreise, verbunden wie zwei Tropfen. */
function updateDroplets() {
  // Home Assistant hängt Seiten beim Zurückkehren wieder ein, deshalb nicht verworfen.
  if (dropletHosts.size > 50) for (const host of dropletHosts.keys()) if (!host.isConnected) dropletHosts.delete(host);
  for (const [host, tag] of dropletHosts) {
    const root = host.shadowRoot;
    if (!host.isConnected || !root) continue;
    DROPLET_GROUPS[tag].forEach((find, index) => {
      const existing = root.querySelector(`.neumorphism-droplet[data-group="${index}"]`);
      const group = (controlsActive && find(root)) || null;
      const items = group ? groupItems(group) : [];
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
function drawDroplet(existing, parent, anchor, items, group, inset) {
  const box = parent.getBoundingClientRect();
  const offsetX = box.left + parent.clientLeft - parent.scrollLeft;
  const offsetY = box.top + parent.clientTop - parent.scrollTop;
  const pills = items.map((rect) => {
    const r = Math.min(rect.width, rect.height) / 2 - inset;
    return { left: rect.left + inset - offsetX, right: rect.right - inset - offsetX, cy: rect.top + rect.height / 2 - offsetY, r };
  });
  const left = Math.min(...pills.map((p) => p.left)) - DROPLET_MARGIN;
  const top = Math.min(...pills.map((p) => p.cy - p.r)) - DROPLET_MARGIN;
  const width = Math.max(...pills.map((p) => p.right)) + DROPLET_MARGIN - left;
  const height = Math.max(...pills.map((p) => p.cy + p.r)) + DROPLET_MARGIN - top;
  const local = pills.map((p) => ({ ...p, left: p.left - left, right: p.right - left, cy: p.cy - top }));
  const shapes = local.map((p) => capsulePath(p.left, p.right, p.cy, p.r));
  for (let i = 1; i < local.length; i++) {
    const a = local[i - 1];
    const b = local[i];
    const r = Math.min(a.r, b.r);
    shapes.push(bridgePath(a.right - a.r, b.left + b.r, (a.cy + b.cy) / 2, r));
  }
  const paint = dropletPaint();
  // Am rechten Bildschirmrand enden: Was darüber hinausragt, macht die Leiste seitlich verschiebbar
  const viewRight = parent.ownerDocument.documentElement.clientWidth - offsetX;
  const shown = Math.max(0, Math.min(width, viewRight - left));
  const key = `${fmt(left)}|${fmt(top)}|${fmt(shown)}|${shapes.join("")}|${paint.dark}|${paint.light}|${paint.fill}|${paint.strength}`;

  let droplet = existing;
  if (!droplet) {
    droplet = parent.ownerDocument.createElement("div");
    droplet.className = "neumorphism-droplet";
    droplet.dataset.group = String(group);
    droplet.setAttribute("aria-hidden", "true");
    droplet.style.cssText = "position:absolute;pointer-events:none;z-index:0;background-repeat:no-repeat;background-position:0 0;";
  }
  if (droplet.parentElement !== parent || droplet.nextSibling !== anchor) parent.insertBefore(droplet, anchor);
  if (droplet.dataset.key === key) return droplet;
  droplet.dataset.key = key;
  Object.assign(droplet.style, {
    left: `${left}px`,
    top: `${top}px`,
    width: `${shown}px`,
    height: `${height}px`,
    backgroundSize: `${width}px ${height}px`,
    backgroundImage: `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(dropletSvg(width, height, shapes, paint))}")`,
  });
  return droplet;
}

/**
 * Buttons, die direkt nebeneinander liegen (z. B. „Profil bearbeiten“ und „Abmelden“),
 * bekommen statt eigener Schatten eine gemeinsame Tropfenform.
 */
const buttonDroplets = new Map(); // Elternelement -> gezeichnete Formen

function updateButtonGroups() {
  if (buttonHosts.size > 2000) for (const btn of buttonHosts) if (!btn.isConnected) buttonHosts.delete(btn);
  const byParent = new Map();
  if (controlsActive) {
    for (const btn of buttonHosts) {
      if (!btn.isConnected || !btn.parentElement) continue;
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
      drawn.push(drawDroplet(existing, parent, run[0].btn, run.map((e) => e.rect), `b${index}`, 0));
      for (const e of run) merged.add(e.btn);
    });
    if (drawn.length) used.set(parent, drawn);
  }

  // Aufräumen: nicht mehr benötigte Formen und Markierungen entfernen
  for (const [parent, droplets] of buttonDroplets) {
    const keep = used.get(parent) || [];
    for (const d of droplets) if (!keep.includes(d)) d.remove();
    if (!keep.length && parent.dataset.neumorphismPositioned !== undefined) {
      parent.style.position = "";
      delete parent.dataset.neumorphismPositioned;
    }
  }
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
  [nm-raised] { background: var(--card-background-color) !important; box-shadow: ${RAISED} !important; }
  [nm-accent] { box-shadow: ${RAISED} !important; }
  [nm-inset] { background: var(--card-background-color) !important; box-shadow: ${INSET_S} !important; }
`;
const CARD_MARKS = ["nm-card-shadow", "nm-frame-inner", "nm-raised", "nm-accent", "nm-inset"];
const ACCENT_DISTANCE = 90; // Abstand zur Kartenfarbe, ab dem eine Fläche als farbig gilt
const knownCards = new Set();
const framedCards = new WeakSet();
const cardPending = new Set();
const observedRoots = new WeakSet();
let cardsKey = "";

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
  if (knownCards.has(card) || card.localName.startsWith("hui-")) return;
  knownCards.add(card);
  scheduleCard(card);
}

function scheduleCard(card) {
  if (cardPending.has(card)) return;
  cardPending.add(card);
  requestAnimationFrame(() => {
    cardPending.delete(card);
    try {
      if (card.isConnected) scanCard(card);
    } catch (err) {
      console.warn("Neumorphism:", err);
    }
  });
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
  return storedSettings().cards;
}

function scanCard(card) {
  const root = card.shadowRoot;
  if (!root) return;
  const elements = [];
  collectCard(root, card, elements);
  for (const el of elements) for (const attr of CARD_MARKS) if (el.hasAttribute(attr)) el.removeAttribute(attr);
  framedCards.delete(card);
  const mode = cardsMode();
  if (!controlsActive || mode === "off") return;

  // Rahmen: die oberste ha-card oder ein innerer Rahmen, der die Karte ausfüllt
  const haCard = elements.find((el) => el.localName === "ha-card");
  const box = (haCard || card).getBoundingClientRect();
  if (!box.width || !box.height) return;
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
    frame.style.setProperty("--nm-frame-radius", getComputedStyle(inner || frame).borderTopLeftRadius);
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

/** Neue Karten aufnehmen; nach Theme-, Modus- oder Einstellungswechsel alle neu einordnen. */
function updateCards() {
  if (!supportsSheets) return;
  CONTROL_STYLES.__cards = CARD_STYLE;
  if (cardHosts.size > 2000) for (const host of cardHosts) if (!host.isConnected) cardHosts.delete(host);
  for (const host of cardHosts) {
    // Direkt im Dashboard ist jedes Kind von hui-card eine Karte, egal wie sie heißt
    const card = host.isConnected && host.firstElementChild;
    if (card && card.shadowRoot && typeof card.setConfig === "function") registerCard(card);
  }
  const key = `${controlsActive}|${dropletPaint().fill}|${cardsMode()}`;
  if (key === cardsKey) return;
  cardsKey = key;
  for (const card of knownCards) if (card.isConnected) scheduleCard(card);
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
  const style = document.documentElement.style;
  const vars = [];
  for (let i = 0; i < style.length; i++) {
    const name = style[i];
    if (!name.startsWith("--")) continue;
    if (colorsOnly && (!COLOR_VAR.test(name) || LAYOUT_VAR.test(name))) continue;
    vars.push(`${name}: ${style.getPropertyValue(name)};`);
  }
  return `:root { ${vars.join(" ")} }\n:root, body { ${colorCss} }`;
}

/** Schlüssel für Ausnahmen in den Einstellungen: Add-on oder Seite einer Integration. */
function hostKey(host) {
  if (host.localName === "ha-panel-app") return host._addon?.slug || host.panel?.config?.addon || "";
  if (host.localName === "ha-panel-custom") return host.panel?.url_path ? `panel:${host.panel.url_path}` : "";
  return "";
}

/** Ist die Formung fremder Oberflächen für diese Stelle eingeschaltet? */
function foreignEnabled(key) {
  const settings = storedSettings();
  return controlsActive && settings.apps === "full" && !(key && settings.appsOff.includes(key));
}

function updateFrames() {
  if (frameHosts.size > 50) for (const host of frameHosts) if (!host.isConnected) frameHosts.delete(host);
  const haCss = haFrameCss();
  for (const host of frameHosts) {
    if (!host.isConnected) continue;
    const iframes = [...host.querySelectorAll("iframe"), ...(host.shadowRoot?.querySelectorAll("iframe") || [])];
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
    const haPage = ["ha-svg-icon", "ha-icon-button", "ha-card"].some((tag) => registry?.get(tag));
    if (!haPage && doc.readyState !== "complete") return; // Bausteine werden noch geladen
    if (haPage) {
      if (scopes.has(doc)) resetScope(scopes.get(doc));
      const css = controlsActive && !storedSettings().appsOff.includes(key) ? haCss : "";
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
    border-color: transparent !important; box-shadow: var(--nm-raised) !important; }
  [nm-x="raised-l"] { box-shadow: var(--nm-card) !important; }
  [nm-x="accent"] { border-color: transparent !important; box-shadow: var(--nm-raised) !important; }
  [nm-x="sunken"], [nm-x="field"] { background-color: var(--nm-bg) !important;
    border-color: transparent !important; box-shadow: var(--nm-inset-s) !important; }
  [nm-x="field"]:focus, [nm-x="field"]:focus-within { outline: none !important;
    box-shadow: var(--nm-inset-s), 0 0 0 2px color-mix(in srgb, var(--nm-primary) 55%, transparent) !important; }
  [nm-x="field"]::placeholder { color: var(--nm-text2) !important; opacity: 0.8 !important; }
  [nm-x="code"] { border-color: transparent !important; box-shadow: var(--nm-inset) !important; }
  [nm-x="tab"] { border-color: transparent !important; box-shadow: none !important; }
  [nm-x="tab-on"] { background-color: var(--nm-surface) !important; border-color: transparent !important;
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
const haDark = () => !!getHass()?.themes?.darkMode;

/** Fremde Bausteine im Hauptfenster: Seiten, Dialoge und alles außerhalb von Dashboard-Karten. */
function updateForeignElements() {
  const enabled = controlsActive && storedSettings().apps === "full";
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
function toRgb(color) {
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
    sheets: [],
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

function observeForeignRoot(state, root) {
  if (state.roots.has(root)) return;
  state.roots.add(root);
  if (root instanceof state.view.ShadowRoot) {
    const sheet = new state.view.CSSStyleSheet();
    sheet.replaceSync(FOREIGN_MARK_STYLE);
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    state.sheets.push(sheet);
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
  for (const sheet of state.sheets) sheet.replaceSync("");
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

function texts(hass) {
  const de = (hass?.language || navigator.language || "").toLowerCase().startsWith("de");
  const loc = (key, fallback) => hass?.localize?.(key) || fallback;
  return {
    colors: de ? "Farben" : "Colors",
    primary: loc("ui.panel.profile.themes.primary_color", de ? "Primärfarbe" : "Primary color"),
    accent: loc("ui.panel.profile.themes.accent_color", de ? "Akzentfarbe" : "Accent color"),
    reset: de ? "Zurücksetzen" : "Reset",
    primaryHint: de ? "Buttons, Symbole, Auswahl" : "Buttons, icons, selection",
    accentHint: de ? "Schalter, Hervorhebungen" : "Switches, highlights",
    fromTheme: de ? "aus dem Theme" : "from theme",
    strength: de ? "Effektstärke" : "Effect strength",
    strengthHint: de
      ? "Positiv: erhaben wie gewohnt. 0: flach. Negativ: umgekehrt, Erhabenes wird eingelassen und Eingelassenes erhaben."
      : "Positive: raised as usual. 0: flat. Negative: inverted, raised becomes inset and inset becomes raised.",
    inverted: de ? "umgekehrt" : "inverted",
    flat: de ? "flach" : "flat",
    cards: de ? "Eigene Karten" : "Custom cards",
    cardsHint: de
      ? "Karten aus HACS oder selbst geschrieben. „Nur Rahmen“ oder „Aus“, falls eine Karte nicht richtig aussieht."
      : "Cards from HACS or self-written. Use “Frame only” or “Off” if a card does not look right.",
    cardsFull: de ? "Vollständig" : "Full",
    cardsFrame: de ? "Nur Rahmen" : "Frame only",
    cardsOff: de ? "Aus" : "Off",
    apps: de ? "Add-ons und Integrationen" : "Add-ons and integrations",
    appsHint: de
      ? "Oberflächen von Add-ons und Seiten von Integrationen im selben Design, automatisch für alle, auch künftige."
      : "Add-on interfaces and integration pages in the same design, automatically for all, including future ones.",
    appsFull: de ? "Angepasst" : "Adapted",
    appsOff: de ? "Aus" : "Off",
    appsExceptions: de ? "Abgewählte behalten ihr eigenes Aussehen." : "Unchecked ones keep their own look.",
    perUser: de ? "Gilt für deinen Benutzer." : "Applies to your user.",
    inactive: de
      ? "Wähle im Profil das Theme „Neumorphism“, dann wirken diese Einstellungen."
      : "Select the theme “Neumorphism” in your profile to use these settings.",
  };
}

const ROWS = [
  { key: "primary", setting: "primaryColor", cssVar: "--primary-color" },
  { key: "accent", setting: "accentColor", cssVar: "--accent-color" },
];

class NeumorphismColorPicker extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    this._render();
  }

  _render() {
    if (!this._hass || !this.isConnected) return;
    if (!this.shadowRoot) this._build();
    this._update();
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
        .info { color: var(--secondary-text-color); font-size: 0.85rem; line-height: 1.4; }
        .info.warning { color: var(--warning-color); padding-bottom: 8px; }
        .rows { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 8px 32px; }
        .row { display: flex; align-items: center; gap: 16px; padding: 12px 0 10px; }
        .text { flex: 1; min-width: 0; }
        .label { color: var(--primary-text-color); font-size: 1rem; }
        .hint { color: var(--secondary-text-color); font-size: 0.85rem; margin-top: 2px; }
        .value { color: var(--secondary-text-color); font-family: var(--ha-font-family-code, monospace);
          font-size: 0.8rem; margin-top: 4px; }
        .picker { width: 56px; height: 56px; flex: none; border-radius: 50%; padding: 7px; box-sizing: border-box;
          background: var(--card-background-color); box-shadow: var(--ha-box-shadow-m); }
        input[type="color"] { -webkit-appearance: none; appearance: none; display: block; width: 100%; height: 100%;
          border: none; padding: 0; border-radius: 50%; background: none; cursor: pointer; }
        input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
        input[type="color"]::-webkit-color-swatch { border: none; border-radius: 50%; }
        input[type="color"]::-moz-color-swatch { border: none; border-radius: 50%; }
        .presets { display: flex; flex-wrap: wrap; gap: 10px; padding: 2px 2px 8px; }
        .dot { width: 26px; height: 26px; border-radius: 50%; border: none; padding: 0; cursor: pointer;
          box-shadow: var(--ha-box-shadow-s); outline-offset: 3px; }
        .dot.selected { outline: 2px solid var(--primary-text-color); }
        .strength { padding: 16px 0 2px; }
        .strength-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
        input[type="range"] { -webkit-appearance: none; appearance: none; width: 100%; height: 32px; margin: 6px 0 0;
          background: transparent; cursor: pointer; --from: 50%; --to: 50%;
          --track: linear-gradient(to right, transparent calc(50% - 1px), var(--divider-color) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)),
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
        .cards-mode { padding: 16px 0 2px; }
        .segmented { display: flex; gap: 6px; padding: 5px; margin: 8px 0 6px; border-radius: 999px;
          box-shadow: var(--neumorphism-inset-shadow-s, none); }
        .segmented button { flex: 1; border: none; border-radius: 999px; padding: 8px 6px; cursor: pointer;
          background: transparent; color: var(--secondary-text-color); font: inherit; font-size: 0.85rem; }
        .segmented button[hidden] { display: none; }
        .segmented button.selected { background: var(--card-background-color); color: var(--primary-color);
          font-weight: var(--ha-font-weight-medium, 500); box-shadow: var(--neumorphism-raised-shadow, none); }
        .apps-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 2px 16px; margin: 8px 0 2px; }
        .apps-list[hidden] { display: none; }
        .apps-list label { display: flex; align-items: center; gap: 10px; padding: 6px 0; cursor: pointer;
          color: var(--primary-text-color); font-size: 0.9rem; }
        .apps-list input { -webkit-appearance: none; appearance: none; flex: none; width: 20px; height: 20px; margin: 0;
          border-radius: 6px; cursor: pointer; background: var(--card-background-color) center / 14px no-repeat;
          box-shadow: var(--neumorphism-inset-shadow-s, inset 0 0 0 1px var(--divider-color)); }
        .apps-list input:checked { background-color: var(--primary-color);
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='white' d='M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z'/%3E%3C/svg%3E");
          box-shadow: var(--neumorphism-raised-shadow, none); }
        .footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 8px; }
        button.reset { border: none; background: var(--card-background-color); color: var(--primary-color);
          border-radius: 999px; padding: 9px 18px; font: inherit; font-size: 0.9rem; cursor: pointer;
          box-shadow: var(--ha-box-shadow-s); }
        button.reset:active, .dot:active { box-shadow: var(--neumorphism-inset-shadow, none); }
        button.reset[hidden] { display: none; }
      </style>
      <div class="headline"></div>
      <div class="info warning" hidden></div>
      <div class="rows">
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
      <div class="strength">
        <div class="strength-head"><span class="label s-label"></span><span class="value s-value"></span></div>
        <input type="range" min="${-STRENGTH_MAX * STRENGTH_SCALE}" max="${STRENGTH_MAX * STRENGTH_SCALE}" step="5">
        <div class="hint s-hint"></div>
      </div>
      <div class="cards-mode">
        <div class="label c-label"></div>
        <div class="segmented cards">
          <button data-mode="full"></button><button data-mode="frame"></button><button data-mode="off"></button>
        </div>
        <div class="hint c-hint"></div>
      </div>
      <div class="cards-mode apps-mode">
        <div class="label a-label"></div>
        <div class="segmented apps">
          <button data-apps="full"></button><button data-apps="off"></button>
        </div>
        <div class="hint a-hint"></div>
        <div class="apps-list" hidden></div>
        <div class="hint a-exceptions" hidden></div>
      </div>
      <div class="footer">
        <span class="info per-user"></span>
        <button class="reset"></button>
      </div>`;

    for (const row of ROWS) {
      const block = root.querySelector(`.block[data-key="${row.key}"]`);
      const input = block.querySelector("input");
      // Während des Ziehens nur anzeigen, gespeichert wird beim Loslassen.
      input.addEventListener("input", () => {
        preview[row.key] = input.value;
        applyColors();
      });
      input.addEventListener("change", () => this._save({ [row.setting]: input.value }));
      for (const dot of block.querySelectorAll(".dot")) {
        dot.addEventListener("click", () => this._save({ [row.setting]: dot.dataset.color }));
      }
    }
    const range = root.querySelector('input[type="range"]');
    range.addEventListener("input", () => {
      preview.strength = Number(range.value) / STRENGTH_SCALE;
      applyColors();
      this._update();
    });
    range.addEventListener("change", () => this._save({ neumorphismStrength: Number(range.value) / STRENGTH_SCALE }));
    for (const button of root.querySelectorAll(".segmented.cards button")) {
      button.addEventListener("click", () => this._save({ neumorphismCards: button.dataset.mode }));
    }
    for (const button of root.querySelectorAll(".segmented.apps button")) {
      button.addEventListener("click", () => this._save({ neumorphismApps: button.dataset.apps }));
    }
    root.querySelector(".apps-list").addEventListener("change", (ev) => {
      const off = new Set(storedSettings(this._hass).appsOff);
      if (ev.target.checked) off.delete(ev.target.value);
      else off.add(ev.target.value);
      this._save({ neumorphismAppsOff: [...off] });
    });
    root.querySelector(".reset").addEventListener("click", () =>
      this._save({
        primaryColor: undefined,
        accentColor: undefined,
        neumorphismStrength: undefined,
        neumorphismCards: undefined,
        neumorphismApps: undefined,
        neumorphismAppsOff: undefined,
      })
    );
  }

  /** Add-ons: an/aus und Ausnahmen (Liste nur für Administratoren, aus dem Supervisor). */
  _updateApps(t, stored) {
    const root = this.shadowRoot;
    root.querySelector(".a-label").textContent = t.apps;
    root.querySelector(".a-hint").textContent = t.appsHint;
    for (const button of root.querySelectorAll(".segmented.apps button")) {
      button.textContent = t[button.dataset.apps === "full" ? "appsFull" : "appsOff"];
      button.classList.toggle("selected", stored.apps === button.dataset.apps);
    }
    if (this._apps === undefined) {
      this._apps = null;
      this._loadApps().then((apps) => {
        this._apps = apps;
        this._render();
      });
    }
    // Auch Ausnahmen für Add-ons zeigen, die gerade nicht in der Liste stehen (z. B. gestoppt)
    const apps = [...(this._apps || [])];
    for (const slug of stored.appsOff) if (!apps.some((app) => app.slug === slug)) apps.push({ slug, name: slug });
    const list = root.querySelector(".apps-list");
    const visible = stored.apps === "full" && apps.length > 0;
    list.hidden = !visible;
    root.querySelector(".a-exceptions").hidden = !visible;
    root.querySelector(".a-exceptions").textContent = t.appsExceptions;
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
    for (const input of list.querySelectorAll("input")) input.checked = !stored.appsOff.includes(input.value);
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

  _save(patch) {
    saveSettings(patch);
    preview.primary = "";
    preview.accent = "";
    preview.strength = null;
    applyColors();
    this._render();
  }

  _update() {
    const root = this.shadowRoot;
    const t = texts(this._hass);
    const active = neumorphismActive();
    const stored = storedSettings(this._hass);
    this.toggleAttribute("inactive", !active);

    root.querySelector(".headline").textContent = t.colors;
    const warning = root.querySelector(".warning");
    warning.hidden = active;
    warning.textContent = t.inactive;
    root.querySelector(".per-user").textContent = t.perUser;
    const reset = root.querySelector(".reset");
    reset.textContent = t.reset;
    reset.hidden = !stored.primary && !stored.accent && stored.strength === null && !stored.cardsStored && !stored.appsStored;
    root.querySelector(".c-label").textContent = t.cards;
    root.querySelector(".c-hint").textContent = t.cardsHint;
    for (const button of root.querySelectorAll(".segmented.cards button")) {
      const mode = button.dataset.mode;
      button.textContent = t[`cards${mode[0].toUpperCase()}${mode.slice(1)}`];
      button.classList.toggle("selected", stored.cards === mode);
    }
    this._updateApps(t, stored);

    const strength = preview.strength ?? stored.strength ?? 1;
    const range = root.querySelector('input[type="range"]');
    if (root.activeElement !== range) range.value = String(Math.round(strength * STRENGTH_SCALE));
    // Füllung von der Mitte (0, flach) bis zum Wert, nach links für umgekehrt
    const position = ((Number(range.value) / (STRENGTH_MAX * STRENGTH_SCALE)) * 50 + 50).toFixed(1);
    range.style.setProperty("--from", `${Math.min(50, position)}%`);
    range.style.setProperty("--to", `${Math.max(50, position)}%`);
    range.setAttribute("aria-label", t.strength);
    root.querySelector(".s-label").textContent = t.strength;
    root.querySelector(".s-hint").textContent = t.strengthHint;
    const shown = Math.round(strength * STRENGTH_SCALE);
    root.querySelector(".s-value").textContent =
      shown === 0 ? `0 (${t.flat})` : shown > 0 ? `+${shown}` : `−${-shown} (${t.inverted})`;

    const css = getComputedStyle(document.documentElement);
    for (const row of ROWS) {
      const block = root.querySelector(`.block[data-key="${row.key}"]`);
      const input = block.querySelector("input");
      const value = stored[row.key];
      const shown = preview[row.key] || value || normalize(css.getPropertyValue(row.cssVar)) || "#3d7bfd";
      if (root.activeElement !== input) input.value = shown;
      input.setAttribute("aria-label", t[row.key]);
      block.querySelector(".label").textContent = t[row.key];
      block.querySelector(".hint").textContent = t[`${row.key}Hint`];
      block.querySelector(".value").textContent = value || t.fromTheme;
      for (const dot of block.querySelectorAll(".dot")) {
        dot.classList.toggle("selected", dot.dataset.color === value);
      }
    }
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
    const title = this._config?.title || texts(this._hass).colors;
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

if (!customElements.get(PICKER_TAG)) {
  customElements.define(PICKER_TAG, NeumorphismColorPicker);
  customElements.define("neumorphism-color-card", NeumorphismColorCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "neumorphism-color-card",
    name: "Neumorphism Farben",
    description: "Primär- und Akzentfarbe und Effektstärke des Neumorphism-Themes einstellen.",
    preview: true,
  });

  hookDefine();
  patchControls();
  const tick = () => {
    safely(applyColors);
    safely(injectIntoProfile);
    safely(updateDroplets);
    safely(updateButtonGroups);
    safely(updateCards);
    safely(updateFrames);
    safely(updateForeignElements);
  };
  window.addEventListener("resize", () =>
    requestAnimationFrame(() => {
      safely(updateDroplets);
      safely(updateButtonGroups);
    })
  );
  // Theme- oder Moduswechsel: Home Assistant schreibt die Theme-Variablen in das style-Attribut von <html>.
  new MutationObserver(tick).observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
  window.addEventListener("location-changed", () => setTimeout(tick, 100));
  // Fängt Änderungen von anderen Geräten und späte Seitenaufbauten ab. Kostet praktisch nichts.
  setInterval(tick, 1000);
  tick();

  console.info(`%c NEUMORPHISM-COLORS %c ${VERSION} `, "background:#3d7bfd;color:#fff", "");
}
