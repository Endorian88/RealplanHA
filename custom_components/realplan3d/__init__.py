"""RealPlan 3D — Home Assistant Custom Integration, Server Storage & Sidebar Panel."""
from __future__ import annotations

import os
from typing import Any
import voluptuous as vol

from homeassistant.components import frontend, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

DOMAIN = "realplan3d"
PANEL_VERSION = "4.5.0"
PANEL_URL = f"/realplan3d_static/realplan3d-panel.js?v={PANEL_VERSION}"
STORAGE_VERSION = 1
STORAGE_KEY = "realplan3d.floorplan_project"


def _deduplicate_project_items(project_data: dict[str, Any] | None) -> dict[str, Any] | None:
    """Ensure zones, openings, assets, and customWalls have unique IDs in Home Assistant storage."""
    if not isinstance(project_data, dict):
        return project_data

    cleaned = dict(project_data)
    for key in ("zones", "openings", "assets", "customWalls"):
        items = cleaned.get(key)
        if isinstance(items, list):
            seen_ids: set[str] = set()
            unique_items = []
            for item in items:
                if not isinstance(item, dict):
                    continue
                item_id = item.get("id")
                if not item_id or item_id in seen_ids:
                    continue
                seen_ids.add(item_id)
                unique_items.append(item)
            cleaned[key] = unique_items
    return cleaned


@websocket_api.websocket_command(
    {
        vol.Required("type"): "realplan3d/get_project",
    }
)
@websocket_api.async_response
async def ws_get_project(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the saved RealPlan 3D floorplan project from Home Assistant .storage."""
    store: Store | None = hass.data.get(DOMAIN, {}).get("store")
    saved_project = await store.async_load() if store else None
    cleaned_project = _deduplicate_project_items(saved_project)
    connection.send_result(msg["id"], {"project": cleaned_project})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "realplan3d/save_project",
        vol.Required("project"): dict,
    }
)
@websocket_api.async_response
async def ws_save_project(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Persist the RealPlan 3D floorplan project to Home Assistant .storage and notify all devices."""
    store: Store | None = hass.data.get(DOMAIN, {}).get("store")
    project_data = _deduplicate_project_items(msg["project"]) or {}

    if store is not None:
        existing = await store.async_load()
        existing_zones = existing.get("zones") if isinstance(existing, dict) else None
        new_zones = project_data.get("zones")
        # Prevent accidental overwrite of an existing floorplan with an empty boot state
        if existing_zones and isinstance(new_zones, list) and len(new_zones) == 0:
            connection.send_result(msg["id"], {"saved": False, "reason": "ignored_empty_boot_state"})
            return
        await store.async_save(project_data)

    hass.bus.async_fire("realplan3d_project_updated", {"project": project_data})
    connection.send_result(msg["id"], {"saved": True})


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the RealPlan 3D component and persistent .storage store."""
    hass.data.setdefault(DOMAIN, {})
    if "store" not in hass.data[DOMAIN]:
        hass.data[DOMAIN]["store"] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        websocket_api.async_register_command(hass, ws_get_project)
        websocket_api.async_register_command(hass, ws_save_project)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up RealPlan 3D from a config entry and register Sidebar Panel + Lovelace Card."""
    hass.data.setdefault(DOMAIN, {})
    if "store" not in hass.data[DOMAIN]:
        hass.data[DOMAIN]["store"] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        websocket_api.async_register_command(hass, ws_get_project)
        websocket_api.async_register_command(hass, ws_save_project)

    static_dir = os.path.join(os.path.dirname(__file__), "frontend")

    if not hass.data[DOMAIN].get("static_registered"):
        try:
            await hass.http.async_register_static_paths(
                [StaticPathConfig("/realplan3d_static", static_dir, cache_headers=False)]
            )
            hass.data[DOMAIN]["static_registered"] = True
        except Exception:
            pass

    try:
        frontend.add_extra_js_url(hass, PANEL_URL)
    except Exception:
        pass

    sidebar_title = entry.options.get(
        "sidebar_title", entry.data.get("sidebar_title", "RealPlan 3D")
    )
    sidebar_icon = entry.options.get(
        "sidebar_icon", entry.data.get("sidebar_icon", "mdi:floor-plan")
    )

    frontend.async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title=sidebar_title,
        sidebar_icon=sidebar_icon,
        frontend_url_path="realplan3d",
        config={
            "_panel_custom": {
                "name": "realplan3d-panel",
                "module_url": PANEL_URL,
                "embed_iframe": False,
            }
        },
        require_admin=False,
        update=True,
    )

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload RealPlan 3D config entry and remove sidebar panel."""
    frontend.async_remove_panel(hass, "realplan3d")
    return True


