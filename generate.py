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

# Grundflächen und Schatten pro Modus. Alles ist aus einem Material: Karten und
# Bedienelemente haben die Farbe des Hintergrunds und wirken nur über Licht und
# Schatten erhaben (heller Schein oben links, Schatten unten rechts) oder
# eingelassen (umgekehrt, nach innen).
MODES = {
    "light": {
        "background": "#e4e8ef",
        "inset": "#dce1e9",
        "shadow_dark": ("163, 174, 194", 0.65),
        "shadow_light": ("255, 255, 255", 0.95),
        "sheen": 0.6,
        "shade": 0.4,
        "text": "#3d4657",
        "text_secondary": "#7a8496",
        "text_disabled": "#a8b0be",
        "rgb_ink": "61, 70, 87",
        "track": "#d5dbe4",
        "thumb": "#f2f4f8",
        "scrim": "rgba(228, 232, 239, 0.55)",
    },
    "dark": {
        "background": "#292d35",
        "inset": "#25292f",
        "shadow_dark": ("12, 13, 16", 0.75),
        "shadow_light": ("70, 77, 91", 0.65),
        "sheen": 0.35,
        "shade": 0.35,
        "text": "#e3e6ec",
        "text_secondary": "#9aa2b1",
        "text_disabled": "#5f6674",
        "rgb_ink": "227, 230, 236",
        "track": "#22252b",
        "thumb": "#343943",
        "scrim": "rgba(14, 16, 19, 0.55)",
    },
}

# Effektstärke: Alle Schatten werden mit dieser Variable multipliziert (Abstand,
# Weichheit und Deckkraft). Den Wert setzt der Regler im Profil, Standard ist 1,
# erlaubt sind -2 bis 2. Negative Werte kehren den Effekt um: Erhabenes wird
# eingelassen und Eingelassenes erhaben. Dafür hat jeder Schatten beide Formen,
# die jeweils unpassende ist auf null skaliert.
STRENGTH = "var(--neumorphism-strength, 1)"
POSITIVE = f"max(0, {STRENGTH})"
NEGATIVE = f"max(0, -1 * {STRENGTH})"
MAGNITUDE = f"max({STRENGTH}, -1 * {STRENGTH})"

# Weitere Einstellungen aus dem Profil, ebenfalls als Variablen (Standardwerte in Klammern):
# Lichtrichtung als Versatz der Schatten (oben links: 1, 1), Kontrast (0 normal, 1 hoch:
# kräftigere Schatten und eine feine Kante), Rundung als Faktor für alle Radien.
LIGHT_X = "var(--neumorphism-light-x, 1)"
LIGHT_Y = "var(--neumorphism-light-y, 1)"
LIGHT_ANGLE = "var(--neumorphism-light-angle, 135deg)"
CONTRAST = "var(--neumorphism-contrast, 0)"
RADIUS = "var(--neumorphism-radius, 1)"

CARD_RADIUS = 28
DIALOG_RADIUS = 32
# Radien von Home Assistant (--ha-border-radius-...), skaliert mit der Rundung
HA_RADII = {"sm": 4, "md": 8, "lg": 12, "xl": 16, "2xl": 20, "3xl": 24, "4xl": 28, "5xl": 32, "6xl": 36}


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


def _oklch_to_linear(L: float, C: float, h: float) -> tuple[float, float, float]:
    a, b = C * math.cos(h), C * math.sin(h)
    l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s_ = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    return (
        4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
        -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
        -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_,
    )


def oklch_to_hex(L: float, C: float, h: float) -> str:
    """Wie im HA-Frontend, aber außerhalb von sRGB wird die Sättigung verringert statt
    abgeschnitten. So kippt der Farbton bei sehr dunklen oder hellen Stufen nicht."""
    in_gamut = lambda rgb: all(-1e-4 <= c <= 1 + 1e-4 for c in rgb)  # noqa: E731
    rgb = _oklch_to_linear(L, C, h)
    if not in_gamut(rgb):
        low, high = 0.0, C
        for _ in range(20):
            mid = (low + high) / 2
            if in_gamut(_oklch_to_linear(L, mid, h)):
                low = mid
            else:
                high = mid
        rgb = _oklch_to_linear(L, low, h)
    return rgb_to_hex(_from_linear(c) for c in rgb)


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
    def color(kind: str, k: str) -> str:
        """Schattenfarbe; Farbton und Deckkraft sind Variablen (Hintergrund-Farbton, Kontrast)."""
        return f"rgba(var(--neumorphism-shadow-{kind}-rgb), calc(var(--neumorphism-shadow-{kind}-alpha) * {k} * (1 + 0.5 * {CONTRAST})))"

    def layer(d: float, b: float, k: str, inset: bool) -> str:
        """Schatten zur Lichtrichtung hin und heller Schein auf der Gegenseite."""
        pre = "inset " if inset else ""
        x = lambda sign: f"calc({sign * d}px * {k} * {LIGHT_X})"  # noqa: E731
        y = lambda sign: f"calc({sign * d}px * {k} * {LIGHT_Y})"  # noqa: E731
        blur = f"calc({b}px * {k})"
        return (
            f"{pre}{x(1)} {y(1)} {blur} {color('dark', k)}, "
            f"{pre}{x(-1)} {y(-1)} {blur} {color('light', k)}"
        )

    def edge(inset: bool) -> str:
        """Feine Kante, nur im Kontrastmodus sichtbar."""
        pre = "inset " if inset else ""
        return f"{pre}0 0 0 calc(1px * {CONTRAST}) rgba(var(--rgb-primary-text-color), 0.16)"

    def shadow(d: float, b: float, inset: bool = False) -> str:
        """Erhaben (oder eingelassen), bei negativer Effektstärke umgekehrt."""
        return f"{layer(d, b, POSITIVE, inset)}, {layer(d, b, NEGATIVE, not inset)}, {edge(inset)}"

    def floating(d: float, b: float) -> str:
        """Dialoge schweben immer über der Seite."""
        return f"{layer(d, b, MAGNITUDE, False)}, {edge(False)}"

    def surface(first: str, second: str) -> str:
        """Gewölbte oder gemuldete Oberfläche: Verlauf von der Licht- zur Schattenseite.
        Bei negativer Effektstärke ist der Verlauf umgekehrt."""
        mix = lambda c, k: f"color-mix(in srgb, {c} calc(100% * min(1, {k})), transparent)"  # noqa: E731
        return (
            f"linear-gradient({LIGHT_ANGLE}, {mix(first, POSITIVE)}, {mix(second, POSITIVE)}), "
            f"linear-gradient({LIGHT_ANGLE}, {mix(second, NEGATIVE)}, {mix(first, NEGATIVE)})"
        )

    dark, light = color("dark", MAGNITUDE), color("light", MAGNITUDE)
    radius = lambda px: f"calc({px}px * {RADIUS})"  # noqa: E731
    sheen, shade = "var(--neumorphism-sheen)", "var(--neumorphism-shade)"

    return [
        ("# Grundwerte (der Hintergrund-Farbton im Profil ersetzt sie)", None),
        ("neumorphism-shadow-dark-rgb", m["shadow_dark"][0]),
        ("neumorphism-shadow-dark-alpha", str(m["shadow_dark"][1])),
        ("neumorphism-shadow-light-rgb", m["shadow_light"][0]),
        ("neumorphism-shadow-light-alpha", str(m["shadow_light"][1])),
        ("neumorphism-track", m["track"]),
        ("neumorphism-thumb", m["thumb"]),
        ("neumorphism-sheen", f"rgba(var(--neumorphism-shadow-light-rgb), {m['sheen']})"),
        ("neumorphism-shade", f"rgba(var(--neumorphism-shadow-dark-rgb), {m['shade']})"),
        ("# Flächen", None),
        ("primary-background-color", m["background"]),
        ("secondary-background-color", m["inset"]),
        ("clear-background-color", "var(--primary-background-color)"),
        ("card-background-color", m["background"]),
        ("ha-card-background", "var(--card-background-color)"),
        ("ha-color-surface-default", "var(--card-background-color)"),
        ("ha-color-surface-low", "var(--card-background-color)"),
        ("ha-color-surface-lower", "var(--secondary-background-color)"),
        ("# Schrift", None),
        ("primary-text-color", m["text"]),
        ("secondary-text-color", m["text_secondary"]),
        ("disabled-text-color", m["text_disabled"]),
        ("rgb-primary-text-color", m["rgb_ink"]),
        ("ha-card-header-color", "var(--primary-text-color)"),
        ("# Karten: weicher Schatten unten rechts, heller Schein oben links", None),
        ("ha-card-box-shadow", shadow(9, 22)),
        ("neumorphism-card-shadow", shadow(9, 22)),
        ("ha-card-border-width", "0px"),
        ("ha-card-border-color", "transparent"),
        ("ha-card-border-radius", radius(CARD_RADIUS)),
        ("ha-box-shadow-s", shadow(4, 10)),
        ("ha-box-shadow-m", shadow(8, 20)),
        ("ha-box-shadow-l", shadow(14, 36)),
        ("bar-box-shadow", shadow(6, 16)),
        ("shadow-color", dark),
        ("# Bausteine für erhabene und eingelassene Elemente (auch für eigene Karten)", None),
        ("neumorphism-shadow-dark", dark),
        ("neumorphism-shadow-light", light),
        ("neumorphism-raised-shadow", shadow(4, 9)),
        ("neumorphism-raised-shadow-l", shadow(7, 16)),
        ("neumorphism-raised-shadow-s", shadow(3, 6)),
        ("neumorphism-inset-shadow", shadow(4, 9, inset=True)),
        ("neumorphism-inset-shadow-s", shadow(2, 5, inset=True)),
        ("neumorphism-inset-shadow-l", shadow(7, 16, inset=True)),
        ("# Oberfläche gewölbt oder gemuldet (das Profil wählt eine davon für --neumorphism-surface-image)", None),
        ("neumorphism-convex", surface(sheen, shade)),
        ("neumorphism-concave", surface(shade, sheen)),
        ("ha-button-box-shadow", shadow(3, 7)),
        ("divider-color", f"rgba({m['rgb_ink']}, 0.08)"),
        ("outline-color", f"rgba({m['rgb_ink']}, 0.08)"),
        ("outline-hover-color", f"rgba({m['rgb_ink']}, 0.16)"),
        ("# Kopfzeile und Seitenleiste verschmelzen mit dem Hintergrund", None),
        ("app-header-background-color", "var(--primary-background-color)"),
        ("app-header-text-color", "var(--primary-text-color)"),
        ("app-header-border-bottom", "none"),
        ("app-header-edit-background-color", "var(--secondary-background-color)"),
        ("app-header-edit-text-color", "var(--primary-text-color)"),
        ("sidebar-background-color", "var(--primary-background-color)"),
        ("sidebar-text-color", "var(--primary-text-color)"),
        ("sidebar-icon-color", "var(--secondary-text-color)"),
        ("sidebar-selected-text-color", "var(--primary-color)"),
        ("sidebar-selected-icon-color", "var(--primary-color)"),
        ("# Dialoge", None),
        ("ha-dialog-surface-background", "var(--card-background-color)"),
        ("ha-dialog-border-radius", radius(DIALOG_RADIUS)),
        ("dialog-box-shadow", floating(18, 48)),
        ("mdc-dialog-scrim-color", m["scrim"]),
        ("ha-dialog-scrim-backdrop-filter", "blur(6px)"),
        ("# Eingabefelder wirken eingelassen", None),
        ("ha-color-form-background", "var(--card-background-color)"),
        ("ha-color-form-background-hover", "var(--card-background-color)"),
        ("ha-color-form-background-disabled", "var(--card-background-color)"),
        ("ha-color-border-neutral-loud", f"rgba({m['rgb_ink']}, 0.18)"),
        ("ha-color-border-neutral-normal", f"rgba({m['rgb_ink']}, 0.14)"),
        ("ha-color-border-neutral-quiet", f"rgba({m['rgb_ink']}, 0.08)"),
        ("input-fill-color", "var(--card-background-color)"),
        ("input-disabled-fill-color", "var(--card-background-color)"),
        ("input-ink-color", "var(--primary-text-color)"),
        ("input-label-ink-color", "var(--secondary-text-color)"),
        ("input-idle-line-color", "transparent"),
        ("input-hover-line-color", f"rgba({m['rgb_ink']}, 0.2)"),
        ("input-outlined-idle-border-color", f"rgba({m['rgb_ink']}, 0.12)"),
        ("input-outlined-hover-border-color", f"rgba({m['rgb_ink']}, 0.3)"),
        ("input-dropdown-icon-color", "var(--secondary-text-color)"),
        ("# Schalter und Regler", None),
        ("ha-switch-background-color", "var(--neumorphism-track)"),
        ("ha-switch-thumb-background-color", "var(--neumorphism-thumb)"),
        ("ha-switch-checked-background-color", "var(--accent-color)"),
        ("ha-switch-checked-thumb-background-color", "var(--neumorphism-thumb)"),
        ("ha-switch-thumb-box-shadow", shadow(2, 5)),
        ("switch-unchecked-track-color", "var(--neumorphism-track)"),
        ("switch-unchecked-button-color", "var(--neumorphism-thumb)"),
        ("slider-track-color", "var(--neumorphism-track)"),
        ("scrollbar-thumb-color", "var(--neumorphism-track)"),
        ("# Tabellen, Code, Badges", None),
        ("table-header-background-color", "var(--card-background-color)"),
        ("table-row-background-color", "var(--card-background-color)"),
        ("table-row-alternative-background-color", "var(--card-background-color)"),
        ("data-table-background-color", "var(--card-background-color)"),
        ("markdown-code-background-color", "var(--secondary-background-color)"),
        ("code-editor-background-color", "var(--secondary-background-color)"),
        ("label-badge-background-color", "var(--card-background-color)"),
        ("ha-assist-chip-filled-container-color", "var(--secondary-background-color)"),
        ("chip-background-color", "var(--secondary-background-color)"),
        ("# Rundung", None),
        *[(f"ha-border-radius-{name}", radius(px)) for name, px in HA_RADII.items()],
        ("ha-border-radius-pill", f"calc(9999px * min(1, {RADIUS} * 1000))"),
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
