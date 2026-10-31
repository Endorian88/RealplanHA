"""Config flow for RealPlan 3D Integration (Geräte & Dienste -> Integration hinzufügen)."""
from __future__ import annotations

from typing import Any
import voluptuous as vol

from homeassistant import config_entries
try:
    from homeassistant.config_entries import ConfigFlowResult as FlowResult
except ImportError:
    from homeassistant.data_entry_flow import FlowResult

DOMAIN = "realplan3d"


class RealPlan3DConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for RealPlan 3D."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle the initial step when user adds RealPlan 3D via Integrations UI."""
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        if user_input is not None:
            return self.async_create_entry(
                title=user_input.get("sidebar_title", "RealPlan 3D"),
                data=user_input,
            )

        schema = vol.Schema(
            {
                vol.Optional("sidebar_title", default="RealPlan 3D"): str,
                vol.Optional("sidebar_icon", default="mdi:floor-plan"): str,
                vol.Optional("default_floor", default="0"): vol.In(
                    {
                        "-1": "Keller (KG)",
                        "0": "Erdgeschoss (EG)",
                        "1": "1. OG",
                        "2": "Dachgeschoss (DG)",
                        "all_stacked": "Alle Etagen (3D-Stapel)",
                    }
                ),
            }
        )

        return self.async_show_form(step_id="user", data_schema=schema)
