"""Neumorphism-Theme mit Farbwählern und Effektstärke für Home Assistant.

Die Integration
- registriert das Theme aus theme/neumorphism.yaml direkt im Frontend
  (kein Eintrag `frontend: themes:` in der configuration.yaml nötig),
- liefert www/neumorphism-colors.js aus und lädt es auf jeder Seite
  (kein `extra_module_url` nötig).
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from homeassistant.components.frontend import add_extra_js_url, remove_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_THEMES_UPDATED
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.util.yaml import load_yaml_dict

from .const import DOMAIN, JS_FILE, STATIC_URL, THEMES_DIR, THEMES_FILE, VERSION

_LOGGER = logging.getLogger(__name__)

# Schlüssel, unter denen das Frontend Themes und Standard-Themes ablegt.
DATA_THEMES = "frontend_themes"
DATA_THEMES_STORE = "frontend_themes_store"
DATA_DEFAULT_THEME = "frontend_default_theme"
DATA_DEFAULT_DARK_THEME = "frontend_default_dark_theme"

BASE_DIR = Path(__file__).parent
JS_URL = f"{STATIC_URL}/{JS_FILE}?v={VERSION}"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Themes registrieren und Farbwähler-Skript laden."""
    themes: dict[str, Any] = await hass.async_add_executor_job(
        load_yaml_dict, str(BASE_DIR / THEMES_DIR / THEMES_FILE)
    )
    data = hass.data.setdefault(DOMAIN, {})

    # Statische Pfade lassen sich nicht wieder entfernen, also nur einmal registrieren.
    if not data.get("static_registered"):
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL, str(BASE_DIR / "www"), False)]
        )
        data["static_registered"] = True
    add_extra_js_url(hass, JS_URL)

    @callback
    def _inject_themes(_event: Event | None = None) -> None:
        """Eigene Themes ergänzen, auch nach `frontend.reload_themes`."""
        current = hass.data.get(DATA_THEMES, {})
        changed = {name: theme for name, theme in themes.items() if current.get(name) != theme}
        if not changed:
            return
        hass.data[DATA_THEMES] = {**current, **changed}
        hass.bus.async_fire(EVENT_THEMES_UPDATED)

    _inject_themes()
    await _async_restore_default_themes(hass, themes)
    data["themes"] = themes
    data["unsub"] = hass.bus.async_listen(EVENT_THEMES_UPDATED, _inject_themes)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Themes und Skript wieder entfernen."""
    data = hass.data.get(DOMAIN, {})
    if unsub := data.pop("unsub", None):
        unsub()
    remove_extra_js_url(hass, JS_URL)

    themes = data.pop("themes", {})
    hass.data[DATA_THEMES] = {
        name: theme for name, theme in hass.data.get(DATA_THEMES, {}).items() if name not in themes
    }
    if hass.data.get(DATA_DEFAULT_THEME) in themes:
        hass.data[DATA_DEFAULT_THEME] = "default"
    if hass.data.get(DATA_DEFAULT_DARK_THEME) in themes:
        hass.data[DATA_DEFAULT_DARK_THEME] = None
    hass.bus.async_fire(EVENT_THEMES_UPDATED)
    return True


async def _async_restore_default_themes(hass: HomeAssistant, themes: dict[str, Any]) -> None:
    """Ein per frontend.set_theme gesetztes Neumorphism-Theme wiederherstellen.

    Beim Start prüft das Frontend die gespeicherten Standard-Themes, bevor diese
    Integration ihre Themes registriert hat, und fällt dann auf "default" zurück.
    """
    store = hass.data.get(DATA_THEMES_STORE)
    if store is None:
        return
    try:
        stored = await store.async_load() or {}
    except Exception:  # noqa: BLE001 - reine Komfortfunktion, darf den Start nicht stören
        _LOGGER.debug("Gespeicherte Standard-Themes nicht lesbar", exc_info=True)
        return

    changed = False
    if stored.get(DATA_DEFAULT_THEME) in themes and hass.data.get(DATA_DEFAULT_THEME) == "default":
        hass.data[DATA_DEFAULT_THEME] = stored[DATA_DEFAULT_THEME]
        changed = True
    if stored.get(DATA_DEFAULT_DARK_THEME) in themes and not hass.data.get(DATA_DEFAULT_DARK_THEME):
        hass.data[DATA_DEFAULT_DARK_THEME] = stored[DATA_DEFAULT_DARK_THEME]
        changed = True
    if changed:
        hass.bus.async_fire(EVENT_THEMES_UPDATED)
