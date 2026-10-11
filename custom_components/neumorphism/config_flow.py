"""Einrichtung der Neumorphism-Integration über die Oberfläche.

Die Optionen sind der Standard für alle Benutzer: Was ein Benutzer im Profil nicht selbst
einstellt, kommt von hier. Leere Felder bedeuten den Standard des Themes.
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
    TextSelector,
)

from .const import DOMAIN
from .settings import ADDONS_OFF, FIELDS, clean, to_hex


class NeumorphismConfigFlow(ConfigFlow, domain=DOMAIN):
    """Ein Schritt ohne Eingaben: Theme und Farbwähler aktivieren."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(title="Neumorphism", data={})
        return self.async_show_form(step_id="user")

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return NeumorphismOptionsFlow()


def _selector(name: str, kind: str, values: Any) -> Any:
    if kind == "color":
        return TextSelector()
    if kind == "scale":
        low, high, _ = values
        config = NumberSelectorConfig(min=low, max=high, step=5 if name == "strength" else 10, mode=NumberSelectorMode.SLIDER)
        if name == "roundness":
            config["unit_of_measurement"] = "%"
        return NumberSelector(config)
    return SelectSelector(
        SelectSelectorConfig(options=list(values), translation_key=name, mode=SelectSelectorMode.DROPDOWN)
    )


OPTIONS_SCHEMA = vol.Schema(
    {vol.Optional(name): _selector(name, kind, values) for name, (_, kind, values) in FIELDS.items()}
)


class NeumorphismOptionsFlow(OptionsFlow):
    """Standard für alle Benutzer."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            for name in ("primary_color", "accent_color"):
                value = (user_input.get(name) or "").strip()
                if not value:
                    continue
                try:
                    user_input[name] = to_hex(value)
                except vol.Invalid:
                    errors[name] = "invalid_color"
            if not errors:
                options = clean(user_input)
                # Ausnahmen für Add-ons kommen nur aus dem Profil ("Als Standard für alle")
                if ADDONS_OFF in self.config_entry.options:
                    options[ADDONS_OFF] = self.config_entry.options[ADDONS_OFF]
                return self.async_create_entry(data=options)

        suggested = user_input if user_input is not None else dict(self.config_entry.options)
        return self.async_show_form(
            step_id="init",
            data_schema=self.add_suggested_values_to_schema(OPTIONS_SCHEMA, suggested),
            errors=errors,
        )
