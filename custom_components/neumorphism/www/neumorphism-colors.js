/*
 * Neumorphism für Home Assistant: Farbwähler und Effektstärke
 *
 * - Zeigt im Profil unter "Design" Farbwähler für Primär- und Akzentfarbe und
 *   einen Regler für die Effektstärke, sobald das Theme "Neumorphism" gewählt ist.
 * - Stellt die Karte "custom:neumorphism-color-card" bereit (gleiche Einstellungen).
 * - Wendet die Einstellungen auf das aktive Theme an.
 * - Formt die Bedienelemente von Home Assistant (Schalter, Schieber, Knöpfe,
 *   Eingabefelder ...) erhaben oder eingelassen, damit alles aus einem Guss wirkt.
 *
 * Gespeichert wird in den Theme-Einstellungen des Benutzers (primaryColor,
 * accentColor, neumorphismStrength), dort wo Home Assistant auch die Farben
 * des Standard-Themes ablegt.
 *
 * Wird von der Integration "Neumorphism" automatisch in das Frontend geladen.
 */

const VERSION = "3.6.0";
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
const STRENGTH_MAX = 2;

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

const normalize = (value) => (typeof value === "string" && HEX_RE.test(value.trim()) ? value.trim().toLowerCase() : "");
const getRoot = () => document.querySelector("home-assistant");
const getHass = () => getRoot()?.hass;

const clampStrength = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(STRENGTH_MAX, Math.max(0, number)) : null;
};

function storedSettings(hass = getHass()) {
  const theme = hass?.selectedTheme || {};
  return {
    primary: normalize(theme.primaryColor),
    accent: normalize(theme.accentColor),
    strength: theme.neumorphismStrength == null ? null : clampStrength(theme.neumorphismStrength),
  };
}

/** Speichert wie das Profil von Home Assistant: pro Benutzer in den Theme-Einstellungen. */
function saveSettings(patch) {
  getRoot()?.dispatchEvent(new CustomEvent("settheme", { detail: patch, bubbles: true, composed: true }));
}

// Vorschau beim Ziehen, bevor der Wert gespeichert ist.
const preview = { primary: "", accent: "", strength: null };
let applied = null;

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
  style.textContent = body ? `html { ${body} }` : "";
}

// ---------------------------------------------------------------------------
// Bedienelemente erhaben oder eingelassen formen
// ---------------------------------------------------------------------------

// Bausteine aus dem Theme, skalieren mit der Effektstärke.
const RAISED = "var(--neumorphism-raised-shadow)";
const RAISED_L = "var(--neumorphism-raised-shadow-l)";
const INSET = "var(--neumorphism-inset-shadow)";
const INSET_S = "var(--neumorphism-inset-shadow-s)";
const SURFACE = "var(--card-background-color)";
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
  // Symbol-Knöpfe sind flach, erhaben werden sie erst als Gruppe in der Titelleiste
  // Buttons, die mit Nachbarn eine gemeinsame Form haben (siehe updateButtonGroups)
  "ha-button": `
    :host([neumorphism-merged]) { position: relative; z-index: 1; }
    :host([neumorphism-merged]) .button { box-shadow: none !important; }
  `,
  "ha-icon-button": `
    ha-button { --ha-button-box-shadow: none; }
  `,
  // Titelleisten: keine Linie, kein Schatten, Knöpfe rechts als gemeinsame Pille
  "hui-root": `
    .header { box-shadow: none !important; }
    .header::after { ${HEADER_FADE} }
    .edit-mode .header::after { background: linear-gradient(to bottom, var(--app-header-edit-background-color), transparent); }
    .toolbar { border-bottom: none !important; position: relative; }
    .action-items, .toolbar > ha-menu-button, .toolbar > ha-icon-button-arrow-prev { ${GROUP} }
  `,
  "ha-top-app-bar-fixed": `
    .row, .sub-row { border-bottom: none !important; }
    .top-app-bar, .top-app-bar.scrolled:not(.pane-header) { box-shadow: none !important; }
    .top-app-bar::after { ${HEADER_FADE} }
    #actions, #navigation { position: relative; }
    #actions slot[name="actionItems"], slot[name="navigationIcon"] { display: flex; align-items: center; ${GROUP} }
  `,
  "hass-subpage": `
    .toolbar { position: relative; z-index: 2; }
    .toolbar::after { ${HEADER_FADE} }
    .toolbar-content { border-bottom: none !important; position: relative; }
    slot[name="toolbar-icon"] { display: flex; align-items: center; ${GROUP} }
    .toolbar-content > ha-menu-button, .toolbar-content > ha-icon-button-arrow-prev { ${GROUP} }
  `,
  "hass-tabs-subpage": `
    .toolbar { border-bottom: none !important; position: relative; z-index: 2; }
    .toolbar::after { ${HEADER_FADE} }
    .toolbar-content, #toolbar-icon { position: relative; }
    #toolbar-icon slot[name="toolbar-icon"] { display: flex; align-items: center; ${GROUP} }
    .toolbar-content > ha-menu-button, .toolbar-content > ha-icon-button-arrow-prev { ${GROUP} }
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
const controlSheets = new Map();
let controlsActive = false;

function controlSheet(tag) {
  let sheet = controlSheets.get(tag);
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(controlsActive ? CONTROL_STYLES[tag] : "");
    controlSheets.set(tag, sheet);
  }
  return sheet;
}

function adoptControlStyle(root, tag) {
  if (!root || !root.adoptedStyleSheets) return;
  const sheet = controlSheet(tag);
  if (!root.adoptedStyleSheets.includes(sheet)) {
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  }
}

/** Ein gemeinsames Stylesheet pro Element: leeren genügt, um alles abzuschalten. */
function setControlsActive(active) {
  if (active === controlsActive) return;
  controlsActive = active;
  for (const [tag, sheet] of controlSheets) sheet.replaceSync(active ? CONTROL_STYLES[tag] : "");
}

function findAllDeep(selector) {
  const found = [];
  const stack = [document];
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
 * Hängt das Stylesheet an alle vorhandenen und künftigen Exemplare eines Elements.
 * Lifecycle-Callbacks liest der Browser nur bei der Registrierung, deshalb wird
 * createRenderRoot erweitert: Lit ruft es für jedes neue Exemplar auf.
 */
function patchControls() {
  if (!supportsSheets) return;
  for (const tag of Object.keys(CONTROL_STYLES)) {
    customElements.whenDefined(tag).then(() => {
      const proto = customElements.get(tag).prototype;
      const original = proto.createRenderRoot;
      if (typeof original === "function" && !Object.prototype.hasOwnProperty.call(proto, "__neumorphismPatched")) {
        proto.createRenderRoot = function () {
          const root = original.call(this);
          adoptControlStyle(root, tag);
          if (DROPLET_GROUPS[tag]) dropletHosts.add(this);
          if (tag === "ha-button") buttonHosts.add(this);
          if (tag === "hui-card") cardHosts.add(this);
          return root;
        };
        proto.__neumorphismPatched = true;
      }
      for (const el of findAllDeep(tag)) {
        adoptControlStyle(el.shadowRoot, tag);
        if (DROPLET_GROUPS[tag]) dropletHosts.add(el);
        if (tag === "ha-button") buttonHosts.add(el);
        if (tag === "hui-card") cardHosts.add(el);
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
const dropletHosts = new Set();
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

function dropletSvg(width, height, shapes, paint) {
  const s = paint.strength;
  const [dark, darkA] = rgbaParts(paint.dark);
  const [light, lightA] = rgbaParts(paint.light);
  const d = shapes.join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><filter id="s" x="-50%" y="-50%" width="200%" height="200%">` +
    `<feGaussianBlur in="SourceAlpha" stdDeviation="${fmt(4.5 * s)}" result="b"/>` +
    `<feOffset in="b" dx="${fmt(4 * s)}" dy="${fmt(4 * s)}" result="o1"/>` +
    `<feFlood flood-color="${dark}" flood-opacity="${darkA}"/><feComposite in2="o1" operator="in" result="d"/>` +
    `<feOffset in="b" dx="${fmt(-4 * s)}" dy="${fmt(-4 * s)}" result="o2"/>` +
    `<feFlood flood-color="${light}" flood-opacity="${lightA}"/><feComposite in2="o2" operator="in" result="l"/>` +
    `<feMerge><feMergeNode in="d"/><feMergeNode in="l"/><feMergeNode in="SourceGraphic"/></feMerge>` +
    `</filter></defs><path filter="url(#s)" fill="${paint.fill}" d="${d}"/></svg>`
  );
}

/** Zeichnet hinter jeder Knopfgruppe eine Form: Kreise, verbunden wie zwei Tropfen. */
function updateDroplets() {
  // Home Assistant hängt Seiten beim Zurückkehren wieder ein, deshalb nicht verworfen.
  if (dropletHosts.size > 50) for (const host of dropletHosts) if (!host.isConnected) dropletHosts.delete(host);
  for (const host of dropletHosts) {
    const root = host.shadowRoot;
    if (!host.isConnected || !root) continue;
    DROPLET_GROUPS[host.localName].forEach((find, index) => {
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
  const key = `${fmt(left)}|${fmt(top)}|${shapes.join("")}|${paint.dark}|${paint.light}|${paint.fill}|${paint.strength}`;

  let droplet = existing;
  if (!droplet) {
    droplet = document.createElement("div");
    droplet.className = "neumorphism-droplet";
    droplet.dataset.group = String(group);
    droplet.setAttribute("aria-hidden", "true");
    droplet.style.cssText = "position:absolute;pointer-events:none;z-index:0;background-repeat:no-repeat;background-size:100% 100%;";
  }
  if (droplet.parentElement !== parent || droplet.nextSibling !== anchor) parent.insertBefore(droplet, anchor);
  if (droplet.dataset.key === key) return droplet;
  droplet.dataset.key = key;
  Object.assign(droplet.style, {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
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
// Eigene Karten (HACS, selbst geschrieben): äußere Karte angleichen
// ---------------------------------------------------------------------------

// Viele eigene Karten setzen Rand und Schatten selbst. Ihre oberste Karte wird
// erhaben wie die übrigen; durchsichtige Karten (z. B. reine Überschriften) bleiben unverändert.
const CUSTOM_CARD_STYLE = `
  :host > ha-card { box-shadow: var(--neumorphism-card-shadow) !important; border-width: 0 !important; }
`;
let customCardSheet = null;
const customCardChecked = new WeakSet();

function isOpaque(el) {
  const css = getComputedStyle(el);
  if (css.backgroundImage && css.backgroundImage !== "none") return true;
  const m = css.backgroundColor.match(/rgba?\(([^)]+)\)/);
  if (!m) return false;
  const alpha = m[1].split(",")[3];
  return alpha === undefined || Number(alpha) > 0.5;
}

function updateCustomCards() {
  if (!supportsSheets) return;
  if (!customCardSheet) {
    customCardSheet = new CSSStyleSheet();
    controlSheets.set("__custom-card", customCardSheet);
    CONTROL_STYLES["__custom-card"] = CUSTOM_CARD_STYLE;
    customCardSheet.replaceSync(controlsActive ? CUSTOM_CARD_STYLE : "");
  }
  if (cardHosts.size > 2000) for (const host of cardHosts) if (!host.isConnected) cardHosts.delete(host);
  for (const host of cardHosts) {
    if (!host.isConnected) continue;
    const card = host.firstElementChild;
    if (!card || card.localName.startsWith("hui-") || !card.shadowRoot || customCardChecked.has(card)) continue;
    const haCard = [...card.shadowRoot.children].find((el) => el.localName === "ha-card");
    if (!haCard) continue; // noch nicht gerendert, später erneut prüfen
    customCardChecked.add(card);
    if (isOpaque(haCard)) adoptControlStyle(card.shadowRoot, "__custom-card");
  }
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
    strengthHint: de ? "Tiefe der Schatten, von flach bis kräftig" : "Depth of the shadows, from flat to strong",
    flat: de ? "flach" : "flat",
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
          background: transparent; cursor: pointer; --fill: 50%; }
        input[type="range"]::-webkit-slider-runnable-track { height: 10px; border-radius: 5px;
          background: linear-gradient(to right, var(--primary-color) var(--fill), var(--secondary-background-color) var(--fill));
          box-shadow: var(--neumorphism-inset-shadow, none); }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 28px; height: 28px;
          margin-top: -9px; border: none; border-radius: 50%; box-shadow: var(--ha-box-shadow-s);
          background: radial-gradient(circle, var(--primary-color) 0 5px, var(--card-background-color) 6px); }
        input[type="range"]::-moz-range-track { height: 10px; border-radius: 5px; background: var(--secondary-background-color);
          box-shadow: var(--neumorphism-inset-shadow, none); }
        input[type="range"]::-moz-range-progress { height: 10px; border-radius: 5px; background: var(--primary-color); }
        input[type="range"]::-moz-range-thumb { width: 28px; height: 28px; border: none; border-radius: 50%;
          box-shadow: var(--ha-box-shadow-s);
          background: radial-gradient(circle, var(--primary-color) 0 5px, var(--card-background-color) 6px); }
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
        <input type="range" min="0" max="${STRENGTH_MAX * 100}" step="5">
        <div class="hint s-hint"></div>
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
      preview.strength = Number(range.value) / 100;
      applyColors();
      this._update();
    });
    range.addEventListener("change", () => this._save({ neumorphismStrength: Number(range.value) / 100 }));
    root.querySelector(".reset").addEventListener("click", () =>
      this._save({ primaryColor: undefined, accentColor: undefined, neumorphismStrength: undefined })
    );
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
    reset.hidden = !stored.primary && !stored.accent && stored.strength === null;

    const strength = preview.strength ?? stored.strength ?? 1;
    const range = root.querySelector('input[type="range"]');
    if (root.activeElement !== range) range.value = String(Math.round(strength * 100));
    range.style.setProperty("--fill", `${(Number(range.value) / (STRENGTH_MAX * 100)) * 100}%`);
    range.setAttribute("aria-label", t.strength);
    root.querySelector(".s-label").textContent = t.strength;
    root.querySelector(".s-hint").textContent = t.strengthHint;
    root.querySelector(".s-value").textContent =
      strength === 0 ? `0 % (${t.flat})` : `${Math.round(strength * 100)} %`;

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

  patchControls();
  // Jeder Schritt für sich: Ein Fehler in einem Teil soll die anderen nicht aufhalten.
  const safely = (fn) => {
    try {
      fn();
    } catch (err) {
      console.warn("Neumorphism:", err);
    }
  };
  const tick = () => {
    safely(applyColors);
    safely(injectIntoProfile);
    safely(updateDroplets);
    safely(updateButtonGroups);
    safely(updateCustomCards);
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
