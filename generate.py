#!/usr/bin/env python3
"""Erzeugt die Theme-Datei der Neumorphism-Integration.

Schreibt custom_components/neumorphism/theme/neumorphism.yaml aus den Werten
weiter unten (MODES, Radien, Standardfarben). Nach einer Änderung hier:

  python3 generate.py

Kein Zusatzpaket nötig, es reicht Python 3.8+.
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_OUTPUT = HERE / "custom_components" / "neumorphism" / "theme" / "neumorphism.yaml"
THEME_NAME = "Neumorphism"

# Standardfarben, solange im Profil keine eigenen gewählt sind.
DEFAULT_PRIMARY = "#3d7bfd"
DEFAULT_ACCENT = "#ff8a3d"

# Grundflächen und Schatten pro Modus, angelehnt an klassisches Soft UI:
# Karten liegen eine Spur heller als der Hintergrund und heben sich über einen
# weichen, breiten Schatten unten rechts und einen hellen Schein oben links ab.
# Eingelassene Flächen (Eingabefelder, Auswahl) sind etwas dunkler.
MODES = {
    "light": {
        "background": "#d9e2f4",
        "surface": "#e6ecf9",
        "inset": "#d2dcf0",
        "shadow_dark": ("143, 160, 201", 0.50),
        "shadow_light": ("255, 255, 255", 0.85),
        "card_border": ("0px", "transparent"),
        "text": "#3f4a63",
        "text_secondary": "#7d88a3",
        "text_disabled": "#a9b3c9",
        "rgb_ink": "63, 74, 99",
        "track": "#cbd5ea",
        "thumb": "#f3f6fd",
        "scrim": "rgba(217, 226, 244, 0.55)",
    },
    "dark": {
        "background": "#20242c",
        "surface": "#282d37",
        "inset": "#22262e",
        "shadow_dark": ("0, 0, 0", 0.55),
        "shadow_light": ("150, 166, 204", 0.14),
        "card_border": ("1px", "rgba(255, 255, 255, 0.03)"),
        "text": "#e4e8f1",
        "text_secondary": "#9aa4b8",
        "text_disabled": "#5c6578",
        "rgb_ink": "228, 232, 241",
        "track": "#1a1d23",
        "thumb": "#3b4251",
        "scrim": "rgba(10, 12, 16, 0.55)",
    },
}

# Effektstärke: Alle Schatten werden mit dieser Variable multipliziert (Abstand,
# Weichheit und Deckkraft). Den Wert setzt der Regler im Profil, Standard ist 1.
STRENGTH = "var(--neumorphism-strength, 1)"

CARD_RADIUS = "28px"
DIALOG_RADIUS = "32px"


# --------------------------------------------------------------------------
# Farbrechnung (sRGB <-> OKLCH), nachgebaut wie im Home-Assistant-Frontend
# --------------------------------------------------------------------------

def hex_to_rgb(value: str) -> tuple[float, float, float]:
    value = value.lstrip("#")
    if len(value) == 3:
        value = "".join(c * 2 for c in value)
    return tuple(int(value[i:i + 2], 16) / 255 for i in (0, 2, 4))


def rgb_to_hex(rgb) -> str:
    return "#" + "".join(f"{round(min(1, max(0, c)) * 255):02x}" for c in rgb)


def _to_linear(c: float) -> float:
    return c / 12.92 if abs(c) <= 0.04045 else math.copysign(((abs(c) + 0.055) / 1.055) ** 2.4, c)


def _from_linear(c: float) -> float:
    return 12.92 * c if abs(c) <= 0.0031308 else math.copysign(1.055 * abs(c) ** (1 / 2.4) - 0.055, c)


def hex_to_oklch(value: str) -> tuple[float, float, float]:
    r, g, b = (_to_linear(c) for c in hex_to_rgb(value))
    l_ = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m_ = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s_ = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    return L, math.hypot(a, bb), math.atan2(bb, a)


def oklch_to_hex(L: float, C: float, h: float) -> str:
    a, b = C * math.cos(h), C * math.sin(h)
    l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s_ = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_
    g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_
    bl = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_
    return rgb_to_hex(_from_linear(c) for c in (r, g, bl))


def palette(base: str) -> dict[int, str]:
    """Stufen 05..95 wie generateColorPalette() im HA-Frontend (Basis = 50)."""
    L, C, h = hex_to_oklch(base)
    shades = {}
    for step in (5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95):
        if step == 50:
            shades[step] = oklch_to_hex(L, C, h)
        elif step < 50:
            f = step / 50
            shades[step] = oklch_to_hex(L * f, C * (0.9 + 0.1 * f), h)
        else:
            f = (step - 50) / 45
            shades[step] = oklch_to_hex(min(1, L + (1 - L) * f), C * max(0, 1 - f * 0.7), h)
    return shades


def _luminance(value: str) -> float:
    r, g, b = (_to_linear(c) for c in hex_to_rgb(value))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def text_on(value: str) -> str:
    """Textfarbe auf einer Farbfläche, gleiche Regel wie im HA-Frontend."""
    l1, l2 = _luminance(value), _luminance("#212121")
    contrast = (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)
    return "#ffffff" if contrast < 6 else "#212121"


# --------------------------------------------------------------------------
# Theme-Aufbau
# --------------------------------------------------------------------------

def mode_vars(m: dict) -> list[tuple[str, str]]:
    rgba = lambda c: f"rgba({c[0]}, calc({c[1]} * {STRENGTH}))"  # noqa: E731
    dark, light = rgba(m["shadow_dark"]), rgba(m["shadow_light"])
    px = lambda v: f"calc({v}px * {STRENGTH})"  # noqa: E731

    def shadow(d: float, b: float, inset: str = "") -> str:
        return (
            f"{inset}{px(d)} {px(d)} {px(b)} {dark}, "
            f"{inset}{px(-d)} {px(-d)} {px(b)} {light}"
        )

    return [
        ("# Flächen", None),
        ("primary-background-color", m["background"]),
        ("secondary-background-color", m["inset"]),
        ("clear-background-color", m["background"]),
        ("card-background-color", m["surface"]),
        ("ha-card-background", "var(--card-background-color)"),
        ("ha-color-surface-default", m["surface"]),
        ("ha-color-surface-low", m["background"]),
        ("ha-color-surface-lower", m["inset"]),
        ("# Schrift", None),
        ("primary-text-color", m["text"]),
        ("secondary-text-color", m["text_secondary"]),
        ("disabled-text-color", m["text_disabled"]),
        ("rgb-primary-text-color", m["rgb_ink"]),
        ("ha-card-header-color", "var(--primary-text-color)"),
        ("# Karten: weicher Schatten unten rechts, heller Schein oben links", None),
        ("ha-card-box-shadow", shadow(12, 32)),
        ("ha-card-border-width", m["card_border"][0]),
        ("ha-card-border-color", m["card_border"][1]),
        ("ha-card-border-radius", CARD_RADIUS),
        ("ha-box-shadow-s", shadow(4, 10)),
        ("ha-box-shadow-m", shadow(8, 20)),
        ("ha-box-shadow-l", shadow(14, 36)),
        ("bar-box-shadow", shadow(6, 16)),
        ("shadow-color", dark),
        ("neumorphism-inset-shadow", shadow(5, 12, "inset ")),
        ("divider-color", f"rgba({m['rgb_ink']}, 0.08)"),
        ("outline-color", f"rgba({m['rgb_ink']}, 0.08)"),
        ("outline-hover-color", f"rgba({m['rgb_ink']}, 0.16)"),
        ("# Kopfzeile und Seitenleiste verschmelzen mit dem Hintergrund", None),
        ("app-header-background-color", "var(--primary-background-color)"),
        ("app-header-text-color", "var(--primary-text-color)"),
        ("app-header-border-bottom", "none"),
        ("sidebar-background-color", "var(--primary-background-color)"),
        ("sidebar-text-color", "var(--primary-text-color)"),
        ("sidebar-icon-color", "var(--secondary-text-color)"),
        ("sidebar-selected-text-color", "var(--primary-color)"),
        ("sidebar-selected-icon-color", "var(--primary-color)"),
        ("# Dialoge", None),
        ("ha-dialog-surface-background", "var(--card-background-color)"),
        ("ha-dialog-border-radius", DIALOG_RADIUS),
        ("dialog-box-shadow", shadow(18, 48)),
        ("mdc-dialog-scrim-color", m["scrim"]),
        ("ha-dialog-scrim-backdrop-filter", "blur(6px)"),
        ("# Eingabefelder wirken eingelassen", None),
        ("ha-color-form-background", m["inset"]),
        ("ha-color-form-background-hover", m["inset"]),
        ("ha-color-form-background-disabled", m["background"]),
        ("ha-color-border-neutral-loud", f"rgba({m['rgb_ink']}, 0.18)"),
        ("ha-color-border-neutral-normal", f"rgba({m['rgb_ink']}, 0.14)"),
        ("ha-color-border-neutral-quiet", f"rgba({m['rgb_ink']}, 0.08)"),
        ("input-fill-color", m["inset"]),
        ("input-disabled-fill-color", m["background"]),
        ("input-ink-color", "var(--primary-text-color)"),
        ("input-label-ink-color", "var(--secondary-text-color)"),
        ("input-idle-line-color", "transparent"),
        ("input-hover-line-color", f"rgba({m['rgb_ink']}, 0.2)"),
        ("input-outlined-idle-border-color", f"rgba({m['rgb_ink']}, 0.12)"),
        ("input-outlined-hover-border-color", f"rgba({m['rgb_ink']}, 0.3)"),
        ("input-dropdown-icon-color", "var(--secondary-text-color)"),
        ("# Schalter und Regler", None),
        ("ha-switch-background-color", m["track"]),
        ("ha-switch-thumb-background-color", m["thumb"]),
        ("ha-switch-checked-background-color", "var(--accent-color)"),
        ("ha-switch-checked-thumb-background-color", m["thumb"]),
        ("ha-switch-thumb-box-shadow", shadow(2, 5)),
        ("switch-unchecked-track-color", m["track"]),
        ("switch-unchecked-button-color", m["thumb"]),
        ("slider-track-color", m["track"]),
        ("scrollbar-thumb-color", m["track"]),
        ("# Tabellen, Code, Badges", None),
        ("table-header-background-color", "var(--card-background-color)"),
        ("table-row-background-color", "var(--card-background-color)"),
        ("table-row-alternative-background-color", "var(--secondary-background-color)"),
        ("data-table-background-color", "var(--card-background-color)"),
        ("markdown-code-background-color", "var(--secondary-background-color)"),
        ("code-editor-background-color", "var(--secondary-background-color)"),
        ("label-badge-background-color", "var(--card-background-color)"),
        ("ha-assist-chip-filled-container-color", m["inset"]),
        ("chip-background-color", m["inset"]),
    ]


def color_vars(primary: str, accent: str) -> list[tuple[str, str]]:
    shades = palette(primary)
    out = [
        ("primary-color", primary),
        ("accent-color", accent),
        ("light-primary-color", shades[80]),
        ("dark-primary-color", shades[40]),
        ("darker-primary-color", shades[30]),
        ("text-primary-color", text_on(primary)),
        ("text-light-primary-color", text_on(shades[80])),
        ("text-accent-color", text_on(accent)),
        ("state-icon-color", "var(--primary-color)"),
        ("mdc-theme-secondary", "var(--accent-color)"),
        ("mdc-checkbox-checked-color", "var(--accent-color)"),
        ("switch-checked-color", "var(--accent-color)"),
        ("switch-checked-button-color", "var(--accent-color)"),
        ("switch-checked-track-color", "var(--accent-color)"),
        ("ha-color-on-primary-loud", text_on(shades[40])),
    ]
    out += [(f"ha-color-primary-{s:02d}", c) for s, c in shades.items()]
    return out


def emit_vars(lines: list[str], items, indent: int) -> None:
    pad = " " * indent
    for key, value in items:
        if value is None:
            lines.append(f"{pad}{key}")
        else:
            lines.append(f'{pad}{key}: "{value}"')


def build_file() -> str:
    lines = [
        "# Neumorphism-Theme für Home Assistant (Hell- und Dunkelmodus)",
        "# Erzeugt mit generate.py. Änderungen dort vornehmen und die Datei neu erzeugen.",
        "",
        f'"{THEME_NAME}":',
    ]
    emit_vars(lines, color_vars(DEFAULT_PRIMARY, DEFAULT_ACCENT), 2)
    lines.append("  modes:")
    for mode in ("light", "dark"):
        lines.append(f"    {mode}:")
        emit_vars(lines, mode_vars(MODES[mode]), 6)
    lines.append("")
    return "\n".join(lines)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Theme-Datei der Neumorphism-Integration erzeugen")
    parser.add_argument("-o", "--output", type=Path, default=DEFAULT_OUTPUT, help="Ziel-Datei")
    args = parser.parse_args(argv)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(build_file(), encoding="utf-8")
    print(f"Theme geschrieben: {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
