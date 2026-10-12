"""Einstellungen des Themes: prüfen und zwischen Optionen, Aktionen und Frontend umrechnen.

Optionen (Standard für alle Benutzer) und Aktionen (neumorphism.set_style) verwenden
dieselben Namen und Einheiten wie im Profil: Effektstärke -100 bis 100, Rundung 0 bis
200 Prozent. Das Frontend rechnet mit Faktoren (Effektstärke -2 bis 2, Rundung 0 bis 2)
und kurzen Schlüsseln, siehe www/neumorphism-colors.js.
"""

from __future__ import annotations

import re
from typing import Any

import voluptuous as vol

from homeassistant.helpers import config_validation as cv

TINTS = ["standard", "gray", "warm", "sand", "mint", "rose", "blue", "primary"]
LIGHTS = ["top_left", "top", "top_right", "sun"]
SURFACES = ["flat", "convex", "concave"]
CONTRASTS = ["normal", "high"]
FONTS = ["standard", "round", "modern", "legible"]
SECTIONS = ["open", "well", "raised"]
SWITCHES = ["on", "off"]
CARDS = ["full", "frame", "off"]
ADDONS = ["full", "off"]
GRAINS = ["off", "fine", "strong"]
DENSITIES = ["compact", "normal", "airy"]
CHARTS = ["theme", "standard"]
EVENING = ["warm", "flat", "dark"]

# Name in Optionen und Aktionen: (Schlüssel im Frontend, Art, Werte)
#   color:  Farbe als "#rrggbb" (Aktionen auch als [r, g, b])
#   scale:  Zahl (min, max, Teiler für den Faktor im Frontend)
#   choice: einer der Werte
#   switch: "on"/"off" (Aktionen auch true/false)
#   list:   Teilmenge der Werte (z. B. Abendmodus)
FIELDS: dict[str, tuple[str, str, Any]] = {
    "primary_color": ("primary", "color", None),
    "accent_color": ("accent", "color", None),
    "background": ("tint", "choice", TINTS),
    # Eigene Hintergrundfarbe; geht "background" vor (im Frontend derselbe Schlüssel)
    "background_color": ("tint", "color", None),
    "background_intensity": ("tintStrength", "scale", (0, 200, 100)),
    "strength": ("strength", "scale", (-100, 100, 50)),
    "light_direction": ("light", "choice", LIGHTS),
    "surface": ("surface", "choice", SURFACES),
    "contrast": ("contrast", "choice", CONTRASTS),
    "roundness": ("radius", "scale", (0, 200, 100)),
    "font": ("font", "choice", FONTS),
    "font_size": ("fontScale", "scale", (85, 130, 100)),
    "density": ("density", "choice", DENSITIES),
    "sections": ("sections", "choice", SECTIONS),
    "pressed": ("pressed", "switch", SWITCHES),
    "grain": ("grain", "choice", GRAINS),
    "charts": ("charts", "choice", CHARTS),
    "animations": ("motion", "switch", SWITCHES),
    "glow": ("glow", "switch", SWITCHES),
    "evening": ("evening", "list", EVENING),
    "custom_cards": ("cards", "choice", CARDS),
    "addons": ("apps", "choice", ADDONS),
}
# Ausnahmen für Add-ons und Seiten von Integrationen (nur aus dem Profil, nicht im Formular)
ADDONS_OFF = "addons_off"

HEX_RE = re.compile(r"^#?([0-9a-fA-F]{6})$")


def to_hex(value: Any) -> str:
    """Farbe als "#rrggbb" aus "#rrggbb", "rrggbb" oder [r, g, b]."""
    if isinstance(value, (list, tuple)) and len(value) == 3:
        r, g, b = (max(0, min(255, int(c))) for c in value)
        return f"#{r:02x}{g:02x}{b:02x}"
    if isinstance(value, str) and (match := HEX_RE.match(value.strip())):
        return f"#{match.group(1).lower()}"
    raise vol.Invalid("invalid_color")


def _switch(value: Any) -> str:
    if value in SWITCHES:
        return value
    return "on" if cv.boolean(value) else "off"


def _subset(values: list[str]) -> Any:
    def validate(value: Any) -> list[str]:
        items = cv.ensure_list(value)
        for item in items:
            if item not in values:
                raise vol.Invalid(f"unknown value {item}")
        return [item for item in values if item in items]

    return validate


def _field_validator(kind: str, values: Any) -> Any:
    if kind == "color":
        return to_hex
    if kind == "list":
        return _subset(values)
    if kind == "scale":
        low, high, _ = values
        return vol.All(vol.Coerce(float), vol.Range(min=low, max=high))
    if kind == "switch":
        return _switch
    return vol.In(values)


# Werte in Optionen und Aktionen
FIELD_VALIDATORS = {name: _field_validator(kind, values) for name, (_, kind, values) in FIELDS.items()}
STYLE_SCHEMA = vol.Schema({vol.Optional(name): validator for name, validator in FIELD_VALIDATORS.items()})


def clean(values: dict[str, Any]) -> dict[str, Any]:
    """Nur gültige, gesetzte Werte (leere Formularfelder bedeuten: Standard des Themes)."""
    out: dict[str, Any] = {}
    for name, validator in FIELD_VALIDATORS.items():
        value = values.get(name)
        if value is None or value == "" or (value == [] and FIELDS[name][1] != "list"):
            continue
        try:
            out[name] = validator(value)
        except vol.Invalid:
            continue
    off = values.get(ADDONS_OFF)
    if isinstance(off, list):
        out[ADDONS_OFF] = [item for item in off if isinstance(item, str)]
    return out


def to_frontend(values: dict[str, Any]) -> dict[str, Any]:
    """Optionen oder Vorgaben aus Aktionen in die Schlüssel und Einheiten des Frontends."""
    out: dict[str, Any] = {}
    for name, value in clean(values).items():
        if name == ADDONS_OFF:
            out["appsOff"] = value
            continue
        key, kind, extra = FIELDS[name]
        out[key] = value / extra[2] if kind == "scale" else value
    return out


def from_frontend(values: dict[str, Any]) -> dict[str, Any]:
    """Einstellungen aus dem Profil (Schlüssel und Einheiten des Frontends) als Optionen."""
    out: dict[str, Any] = {}
    for name, (key, kind, extra) in FIELDS.items():
        if key not in values or values[key] in (None, ""):
            continue
        value = values[key]
        if kind == "scale":
            try:
                value = round(float(value) * extra[2])
            except (TypeError, ValueError):
                continue
        out[name] = value
    if isinstance(values.get("appsOff"), list):
        out[ADDONS_OFF] = values["appsOff"]
    return clean(out)
