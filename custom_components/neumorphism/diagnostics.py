"""Diagnose für Fehlerberichte: Einstellungen der Integration und Berichte der Geräte."""

from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import __version__ as HA_VERSION
from homeassistant.core import HomeAssistant

from .const import DOMAIN, VERSION


async def async_get_config_entry_diagnostics(hass: HomeAssistant, entry: ConfigEntry) -> dict[str, Any]:
    """Version, Standard für alle, Stil der Dashboards, Vorgaben aus Automationen und die
    letzten Berichte der Geräte (Browser, Einstellungen, erkannte Karten und Add-ons)."""
    data = hass.data.get(DOMAIN, {})
    return {
        "version": VERSION,
        "home_assistant": HA_VERSION,
        "defaults": dict(entry.options),
        "dashboards": data.get("dashboards", {}),
        "automation_style": data.get("style", {}),
        "devices": list(data.get("reports", {}).values()),
    }
