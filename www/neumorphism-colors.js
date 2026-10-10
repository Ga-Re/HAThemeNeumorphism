/*
 * Neumorphism-Farben für Home Assistant
 *
 * 1. Überschreibt Primär- und Akzentfarbe des aktiven Neumorphism-Themes mit den
 *    Werten aus input_text.neumorphism_primaerfarbe / input_text.neumorphism_akzentfarbe.
 * 2. Stellt die Karte "custom:neumorphism-color-card" mit Farbwählern bereit.
 *
 * Einbinden (configuration.yaml):
 *   frontend:
 *     extra_module_url:
 *       - /local/neumorphism-colors.js?v=1
 */

const VERSION = "1.0.0";
const PRIMARY_ENTITY = "input_text.neumorphism_primaerfarbe";
const ACCENT_ENTITY = "input_text.neumorphism_akzentfarbe";
const STYLE_ID = "neumorphism-colors";
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

function oklchToHex(L, C, h) {
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return rgbToHex(
    [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ].map(fromLinear)
  );
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
// Farben anwenden
// ---------------------------------------------------------------------------

const normalize = (value) => (typeof value === "string" && HEX_RE.test(value.trim()) ? value.trim().toLowerCase() : "");
const getHass = () => document.querySelector("home-assistant")?.hass;

// Vorschau beim Ziehen im Farbwähler, bevor der Wert gespeichert ist.
const preview = { primary: "", accent: "" };
let applied = null;

function neumorphismActive() {
  return getComputedStyle(document.documentElement).getPropertyValue(MARKER_VAR).trim() !== "";
}

function applyColors() {
  const states = getHass()?.states || {};
  const primary = preview.primary || normalize(states[PRIMARY_ENTITY]?.state);
  const accent = preview.accent || normalize(states[ACCENT_ENTITY]?.state);
  const active = neumorphismActive();
  const key = active ? `${primary}|${accent}` : "";
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
  const body = Object.entries(vars)
    .map(([name, value]) => `--${name}: ${value} !important;`)
    .join(" ");
  style.textContent = body ? `html { ${body} }` : "";
}

// Theme-Wechsel: Home Assistant schreibt die Theme-Variablen in das style-Attribut von <html>.
new MutationObserver(() => applyColors()).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["style"],
});
// Zustandsänderungen der Helfer (auch von anderen Geräten). Ein Vergleich pro Sekunde kostet praktisch nichts.
setInterval(applyColors, 1000);
applyColors();

// ---------------------------------------------------------------------------
// Karte mit Farbwählern
// ---------------------------------------------------------------------------

const ROWS = [
  { key: "primary", entity: PRIMARY_ENTITY, label: "Primärfarbe", hint: "Buttons, Symbole, Auswahl", cssVar: "--primary-color" },
  { key: "accent", entity: ACCENT_ENTITY, label: "Akzentfarbe", hint: "Schalter, Hervorhebungen", cssVar: "--accent-color" },
];

class NeumorphismColorCard extends HTMLElement {
  static getStubConfig() {
    return {};
  }

  setConfig(config) {
    this._config = { title: "Farben", ...config };
    this._built = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) this._build();
    this._update();
  }

  getCardSize() {
    return 4;
  }

  getGridOptions() {
    return { columns: 6, min_columns: 6, rows: "auto" };
  }

  _build() {
    this._built = true;
    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        ha-card { padding: 16px 20px 20px; }
        h2 { margin: 0 0 12px; font-size: var(--ha-card-header-font-size, 1.25rem); font-weight: var(--ha-font-weight-normal, 400); color: var(--ha-card-header-color, var(--primary-text-color)); }
        .row { display: flex; align-items: center; gap: 16px; padding: 12px 0; }
        .block + .block { border-top: 1px solid var(--divider-color); margin-top: 8px; }
        .text { flex: 1; min-width: 0; }
        .label { color: var(--primary-text-color); font-size: 1rem; }
        .hint { color: var(--secondary-text-color); font-size: 0.85rem; margin-top: 2px; }
        .value { color: var(--secondary-text-color); font-family: var(--ha-font-family-code, monospace); font-size: 0.85rem; margin-top: 4px; }
        .picker { position: relative; width: 52px; height: 52px; flex: none; border-radius: 50%;
          box-shadow: var(--ha-box-shadow-m); padding: 6px; box-sizing: border-box; background: var(--card-background-color); }
        input[type="color"] { -webkit-appearance: none; appearance: none; width: 100%; height: 100%; border: none;
          padding: 0; border-radius: 50%; background: none; cursor: pointer; }
        input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
        input[type="color"]::-webkit-color-swatch { border: none; border-radius: 50%; }
        input[type="color"]::-moz-color-swatch { border: none; border-radius: 50%; }
        .presets { display: flex; flex-wrap: wrap; gap: 10px; padding: 0 0 4px; }
        .dot { width: 26px; height: 26px; border-radius: 50%; border: none; padding: 0; cursor: pointer;
          box-shadow: var(--ha-box-shadow-s); outline-offset: 3px; }
        .dot.selected { outline: 2px solid var(--primary-text-color); }
        button.reset { border: none; background: var(--card-background-color); color: var(--secondary-text-color);
          border-radius: 999px; padding: 8px 14px; font: inherit; font-size: 0.85rem; cursor: pointer;
          box-shadow: var(--ha-box-shadow-s); }
        button.reset:active, .dot:active { box-shadow: var(--neumorphism-inset-shadow, none); }
        button.reset[hidden] { display: none; }
        .warning { color: var(--warning-color); font-size: 0.9rem; line-height: 1.4; }
        code { font-size: 0.85rem; }
      </style>
      <ha-card>
        <h2></h2>
        <div class="warning" hidden></div>
        ${ROWS.map(
          (row) => `
          <div class="block" data-key="${row.key}">
            <div class="row">
              <div class="picker"><input type="color" aria-label="${row.label}"></div>
              <div class="text">
                <div class="label">${row.label}</div>
                <div class="hint">${row.hint}</div>
                <div class="value"></div>
              </div>
              <button class="reset" title="Farbe aus dem Theme verwenden">Standard</button>
            </div>
            <div class="presets">
              ${PRESETS.map(([name, hex]) => `<button class="dot" title="${name}" data-color="${hex}" style="background:${hex}"></button>`).join("")}
            </div>
          </div>`
        ).join("")}
      </ha-card>`;

    for (const row of ROWS) {
      const block = root.querySelector(`.block[data-key="${row.key}"]`);
      const input = block.querySelector("input");
      // Während des Ziehens nur lokal anzeigen, gespeichert wird beim Loslassen.
      input.addEventListener("input", () => {
        preview[row.key] = input.value;
        applyColors();
      });
      input.addEventListener("change", () => this._save(row, input.value));
      block.querySelector(".reset").addEventListener("click", () => this._save(row, ""));
      for (const dot of block.querySelectorAll(".dot")) {
        dot.addEventListener("click", () => this._save(row, dot.dataset.color));
      }
    }
  }

  async _save(row, value) {
    preview[row.key] = value;
    applyColors();
    try {
      await this._hass.callService("input_text", "set_value", { entity_id: row.entity, value });
    } finally {
      preview[row.key] = "";
      applyColors();
    }
  }

  _update() {
    const root = this.shadowRoot;
    root.querySelector("h2").textContent = this._config.title || "";
    root.querySelector("h2").hidden = !this._config.title;

    const missing = ROWS.filter((row) => !this._hass.states[row.entity]).map((row) => row.entity);
    const warning = root.querySelector(".warning");
    warning.hidden = missing.length === 0;
    warning.innerHTML = missing.length
      ? `Es fehlen die Helfer ${missing.map((e) => `<code>${e}</code>`).join(" und ")}. ` +
        "Lege sie als Text-Helfer an oder nutze das Package aus dem Repository."
      : "";
    const themeActive = neumorphismActive();

    for (const row of ROWS) {
      const block = root.querySelector(`.block[data-key="${row.key}"]`);
      const stored = normalize(this._hass.states[row.entity]?.state);
      const shown = preview[row.key] || stored || normalize(getComputedStyle(document.documentElement).getPropertyValue(row.cssVar).trim()) || "#3d7bfd";
      const input = block.querySelector("input");
      if (root.activeElement !== input) input.value = shown;
      input.disabled = !this._hass.states[row.entity];
      block.querySelector(".value").textContent = stored
        ? stored
        : themeActive
          ? "aus dem Theme"
          : "Neumorphism-Theme ist nicht aktiv";
      block.querySelector(".reset").hidden = !stored;
      for (const dot of block.querySelectorAll(".dot")) {
        dot.classList.toggle("selected", dot.dataset.color === stored);
      }
    }
  }
}

if (!customElements.get("neumorphism-color-card")) {
  customElements.define("neumorphism-color-card", NeumorphismColorCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "neumorphism-color-card",
    name: "Neumorphism Farben",
    description: "Primär- und Akzentfarbe des Neumorphism-Themes per Farbwähler einstellen.",
    preview: true,
  });
  console.info(`%c NEUMORPHISM-COLORS %c ${VERSION} `, "background:#3d7bfd;color:#fff", "");
}
