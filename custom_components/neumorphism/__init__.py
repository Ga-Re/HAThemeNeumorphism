"""Neumorphism-Theme mit Farbwählern und Effektstärke für Home Assistant.

Die Integration
- registriert das Theme aus theme/neumorphism.yaml direkt im Frontend
  (kein Eintrag `frontend: themes:` in der configuration.yaml nötig),
- liefert www/neumorphism-colors.js aus und lädt es auf jeder Seite
  (kein `extra_module_url` nötig),
- hält den Standard für alle Benutzer (Optionen der Integration), den Stil einzelner
  Dashboards und Vorgaben aus Automationen (Aktionen neumorphism.set_style und
  neumorphism.reset_style) bereit; das Frontend erhält alles über die WebSocket-Schnittstelle
  neumorphism/subscribe,
- sammelt kurze Berichte der Geräte für die Diagnose (diagnostics.py).
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.components.frontend import add_extra_js_url, remove_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_THEMES_UPDATED
from homeassistant.core import Event, HomeAssistant, ServiceCall, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.dispatcher import async_dispatcher_connect, async_dispatcher_send
from homeassistant.helpers.storage import Store
from homeassistant.helpers.typing import ConfigType
from homeassistant.util.yaml import load_yaml_dict

from .const import DOMAIN, JS_FILE, STATIC_URL, THEMES_DIR, THEMES_FILE, VERSION
from .settings import FIELDS, STYLE_SCHEMA, clean, from_frontend, to_frontend

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

# Einstellungen geändert (Standard für alle oder Vorgabe einer Automation)
SIGNAL_SETTINGS = f"{DOMAIN}_settings_updated"
STORAGE_VERSION = 1
SERVICE_SET_STYLE = "set_style"
SERVICE_RESET_STYLE = "reset_style"
RESET_SCHEMA = vol.Schema({vol.Optional("settings"): vol.All(cv.ensure_list, [vol.In(list(FIELDS))])})

# Schlüssel, unter denen das Frontend Themes und Standard-Themes ablegt.
DATA_THEMES = "frontend_themes"
DATA_THEMES_STORE = "frontend_themes_store"
DATA_DEFAULT_THEME = "frontend_default_theme"
DATA_DEFAULT_DARK_THEME = "frontend_default_dark_theme"

BASE_DIR = Path(__file__).parent
JS_URL = f"{STATIC_URL}/{JS_FILE}?v={VERSION}"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Schnittstelle zum Frontend und Aktionen, unabhängig vom Eintrag."""
    data = hass.data.setdefault(DOMAIN, {})
    store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, f"{DOMAIN}.style")
    stored = await store.async_load() or {}
    dashboards = {url: clean(values) for url, values in (stored.get("dashboards") or {}).items() if isinstance(values, dict)}
    data.update(store=store, style=clean(stored.get("style") or {}), dashboards=dashboards, defaults={}, reports={})

    websocket_api.async_register_command(hass, ws_subscribe)
    websocket_api.async_register_command(hass, ws_set_defaults)
    websocket_api.async_register_command(hass, ws_set_dashboard)
    websocket_api.async_register_command(hass, ws_report)

    async def set_style(call: ServiceCall) -> None:
        """Vorgaben für alle Benutzer und Geräte, bis sie aufgehoben werden."""
        data["style"] = clean({**data["style"], **call.data})
        await _async_style_changed(hass)

    async def reset_style(call: ServiceCall) -> None:
        """Vorgaben ganz oder für einzelne Einstellungen aufheben."""
        names = call.data.get("settings")
        data["style"] = {key: value for key, value in data["style"].items() if names and key not in names}
        await _async_style_changed(hass)

    hass.services.async_register(DOMAIN, SERVICE_SET_STYLE, set_style, schema=STYLE_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_RESET_STYLE, reset_style, schema=RESET_SCHEMA)
    return True


async def _async_style_changed(hass: HomeAssistant) -> None:
    data = hass.data[DOMAIN]
    await data["store"].async_save({"style": data["style"], "dashboards": data["dashboards"]})
    async_dispatcher_send(hass, SIGNAL_SETTINGS)


def _frontend_settings(hass: HomeAssistant) -> dict[str, Any]:
    data = hass.data.get(DOMAIN, {})
    return {
        "defaults": to_frontend(data.get("defaults", {})),
        "style": to_frontend(data.get("style", {})),
        "dashboards": {url: to_frontend(values) for url, values in data.get("dashboards", {}).items()},
    }


@websocket_api.websocket_command({vol.Required("type"): "neumorphism/subscribe"})
@callback
def ws_subscribe(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Standard für alle Benutzer und Vorgaben aus Automationen, bei jeder Änderung erneut."""

    @callback
    def send() -> None:
        connection.send_message(websocket_api.event_message(msg["id"], _frontend_settings(hass)))

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(hass, SIGNAL_SETTINGS, send)
    connection.send_result(msg["id"])
    send()


@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): "neumorphism/set_defaults", vol.Required("defaults"): dict}
)
@callback
def ws_set_defaults(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Einstellungen aus dem Profil als Standard für alle Benutzer übernehmen."""
    entry = next(iter(hass.config_entries.async_entries(DOMAIN)), None)
    if entry is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Neumorphism is not set up")
        return
    hass.config_entries.async_update_entry(entry, options=from_frontend(msg["defaults"]))
    connection.send_result(msg["id"])


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): "neumorphism/set_dashboard",
        vol.Required("url_path"): cv.string,
        vol.Required("settings"): dict,
    }
)
@websocket_api.async_response
async def ws_set_dashboard(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Eigener Stil für ein Dashboard (gilt für alle Benutzer auf diesem Dashboard)."""
    data = hass.data[DOMAIN]
    settings = from_frontend(msg["settings"])
    dashboards = {url: values for url, values in data["dashboards"].items() if url != msg["url_path"]}
    if settings:
        dashboards[msg["url_path"]] = settings
    data["dashboards"] = dashboards
    await _async_style_changed(hass)
    connection.send_result(msg["id"])


REPORTS_MAX = 10


@websocket_api.websocket_command(
    {vol.Required("type"): "neumorphism/report", vol.Required("device"): cv.string, vol.Required("report"): dict}
)
@callback
def ws_report(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Kurzer Bericht eines Geräts (Version, Einstellungen, erkannte Karten und Add-ons) für die Diagnose."""
    reports: dict[str, Any] = hass.data[DOMAIN]["reports"]
    reports.pop(msg["device"], None)
    reports[msg["device"]] = {"user_is_admin": connection.user.is_admin, **msg["report"]}
    while len(reports) > REPORTS_MAX:
        reports.pop(next(iter(reports)))
    connection.send_result(msg["id"])


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

    # Standard für alle Benutzer aus den Optionen; Änderungen gelten sofort, ohne Neuladen
    data["defaults"] = clean(dict(entry.options))
    async_dispatcher_send(hass, SIGNAL_SETTINGS)
    entry.async_on_unload(entry.add_update_listener(_async_options_updated))
    return True


async def _async_options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    hass.data[DOMAIN]["defaults"] = clean(dict(entry.options))
    async_dispatcher_send(hass, SIGNAL_SETTINGS)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Themes und Skript wieder entfernen."""
    data = hass.data.get(DOMAIN, {})
    if unsub := data.pop("unsub", None):
        unsub()
    remove_extra_js_url(hass, JS_URL)
    data["defaults"] = {}

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
