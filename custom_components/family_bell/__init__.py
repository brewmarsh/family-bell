import logging
import datetime
import voluptuous as vol
import inspect
import json

from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.storage import Store
from homeassistant.components import websocket_api

try:
    from homeassistant.components.websocket_api import async_register_command
except ImportError:
    async_register_command = None

try:
    from homeassistant.components.http import StaticPathConfig
except ImportError:
    StaticPathConfig = None

try:
    from homeassistant.components.frontend import (
        async_register_built_in_panel,
        async_remove_panel,
    )
except ImportError:
    async_register_built_in_panel = None
    async_remove_panel = None
from homeassistant.helpers.event import async_track_point_in_utc_time
from homeassistant.util import dt as dt_util

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

STORAGE_KEY = "family_bell_data"
STORAGE_VERSION = 1
PANEL_URL = "/family_bell/family_bell_panel.js"

# Schema for a single bell
BELL_SCHEMA = vol.Schema(
    {
        "id": str,
        "name": str,
        "time": str,
        "days": [str],
        "message": str,
        "enabled": bool,
        "speakers": [str],
        vol.Optional("tts_provider"): vol.Any(str, None),
        vol.Optional("tts_voice"): vol.Any(str, None),
        vol.Optional("tts_language"): vol.Any(str, None),
    }
)


async def async_setup(hass: HomeAssistant, config: dict):
    """Set up the Family Bell component (YAML fallback)."""
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Set up Family Bell from a config entry (UI Setup)."""
    # Read version from manifest.json
    try:
        manifest_path = hass.config.path("custom_components/family_bell/manifest.json")
        with open(manifest_path, "r") as f:
            manifest = json.load(f)
        version = manifest.get("version", "unknown")
    except Exception as e:
        version = "unknown"
        _LOGGER.warning("Could not read version from manifest: %s", e)

    _LOGGER.debug("Setting up Family Bell config entry: %s (Version: %s)", entry.entry_id, version)

    # 1. Setup Storage
    store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    data = await store.async_load() or {
        "bells": [],
        "vacation": {"start": None, "end": None, "enabled": False},
    }

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN] = {
        "store": store,
        "data": data,
        "listeners": [],
        "entry_id": entry.entry_id,
        "version": version,
    }

    # 2. Register Static Paths for Frontend
    path = hass.config.path(
        "custom_components/family_bell/frontend/family_bell_panel.js"
    )
    path_selector = hass.config.path(
        "custom_components/family_bell/frontend/bell-tts-selector.js"
    )
    path_lit = hass.config.path(
        "custom_components/family_bell/frontend/lit-element.js"
    )

    _LOGGER.debug("Registering static path: %s -> %s", PANEL_URL, path)

    paths_to_register = []

    if StaticPathConfig:
        paths_to_register.append(StaticPathConfig(PANEL_URL, path, False))
        paths_to_register.append(
            StaticPathConfig(
                "/family_bell/bell-tts-selector.js", path_selector, False
            )
        )
        paths_to_register.append(
            StaticPathConfig("/family_bell/lit-element.js", path_lit, False)
        )
    else:
        paths_to_register.append(
            {"url_path": PANEL_URL, "path": path, "cache_headers": False}
        )
        paths_to_register.append(
            {
                "url_path": "/family_bell/bell-tts-selector.js",
                "path": path_selector,
                "cache_headers": False,
            }
        )
        paths_to_register.append(
            {
                "url_path": "/family_bell/lit-element.js",
                "path": path_lit,
                "cache_headers": False,
            }
        )

    try:
        await hass.http.async_register_static_paths(paths_to_register)
    except RuntimeError:
        _LOGGER.debug("Static paths already registered")

    # 3. Register Sidebar Panel
    _LOGGER.debug("Registering sidebar panel")
    # Explicitly remove existing panel to avoid overwrite error, which
    # can happen during reloads even with update=True in some cases.
    if async_remove_panel:
        # Try removing both hyphen and underscore versions to be safe,
        # as logs indicated potential confusion.
        frontend_panels = hass.data.get("frontend_panels", {})
        for panel_id in ["family-bell", "family_bell"]:
            if panel_id in frontend_panels:
                try:
                    res = async_remove_panel(hass, panel_id)
                    if inspect.isawaitable(res):
                        await res
                except Exception as ex:
                    _LOGGER.debug("Error removing panel %s: %s", panel_id, ex)

    try:
        if async_register_built_in_panel:
            async_register_built_in_panel(
                hass,
                component_name="family-bell",
                sidebar_title="Family Bell",
                sidebar_icon="mdi:bell",
                frontend_url_path="family-bell",
                config={"module_url": PANEL_URL, "embed_iframe": False},
                require_admin=True,
                update=True,
            )
            _LOGGER.debug("Registered built-in panel")
        else:
            # Fallback for older HA
            if hasattr(hass.components.frontend, "async_remove_panel"):
                res = hass.components.frontend.async_remove_panel(
                    "family-bell"
                )
                if inspect.isawaitable(res):
                    await res

            await hass.components.frontend.async_register_panel(
                "family_bell",
                "Family Bell",
                "mdi:bell",
                "family_bell",
                url_path="family-bell",
                module_url=PANEL_URL,
                embed_iframe=False,
                require_admin=True,
            )
            _LOGGER.debug("Registered legacy panel")
    except ValueError as err:
        # If it still fails, we log it but don't crash setup
        _LOGGER.warning(
            "Failed to register panel (possible overwrite): %s. "
            "This is usually harmless during reloads.",
            err,
        )
    except Exception as err:
        _LOGGER.error("Unexpected error registering panel: %s", err)

    # 4. Register Websocket Commands
    _LOGGER.debug("Registering websocket commands")
    try:
        if async_register_command:
            async_register_command(hass, ws_get_data)
            async_register_command(hass, ws_update_bell)
            async_register_command(hass, ws_delete_bell)
            async_register_command(hass, ws_update_vacation)
        else:
            hass.components.websocket_api.async_register_command(
                hass, ws_get_data
            )
            hass.components.websocket_api.async_register_command(
                hass, ws_update_bell
            )
            hass.components.websocket_api.async_register_command(
                hass, ws_delete_bell
            )
            hass.components.websocket_api.async_register_command(
                hass, ws_update_vacation
            )
    except Exception:
        _LOGGER.debug("Websocket commands already registered")

    # 5. Start Scheduler
    _LOGGER.debug("Starting scheduler")
    await schedule_bells(hass, entry)

    # 6. Listen for options updates
    entry.async_on_unload(entry.add_update_listener(update_listener))

    _LOGGER.debug("Async setup entry complete")
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Unload a config entry."""
    for remove_listener in hass.data[DOMAIN]["listeners"]:
        remove_listener()

    if async_remove_panel:
        res = async_remove_panel(hass, "family-bell")
        if inspect.isawaitable(res):
            await res
    elif hasattr(hass.components.frontend, "async_remove_panel"):
        res = hass.components.frontend.async_remove_panel("family-bell")
        if inspect.isawaitable(res):
            await res

    hass.data.pop(DOMAIN)
    return True


async def update_listener(hass, entry):
    """Handle options update."""
    await schedule_bells(hass, entry)


async def save_data(hass):
    """Save data to storage."""
    store = hass.data[DOMAIN]["store"]
    data = hass.data[DOMAIN]["data"]
    await store.async_save(data)
    hass.bus.async_fire("family_bell_update")

    entry_id = hass.data[DOMAIN]["entry_id"]
    entry = hass.config_entries.async_get_entry(entry_id)
    await schedule_bells(hass, entry)


# --- Scheduler Logic ---


async def schedule_bells(hass, entry):
    """Cancel old listeners and schedule next bells using Options for TTS."""
    _LOGGER.debug("Scheduling bells")
    for remove_listener in hass.data[DOMAIN]["listeners"]:
        remove_listener()
    hass.data[DOMAIN]["listeners"] = []

    data = hass.data[DOMAIN]["data"]

    # Retrieve TTS Settings
    tts_provider = entry.options.get(
        "tts_provider", entry.data.get("tts_provider")
    )
    tts_voice = entry.options.get("tts_voice", None)
    tts_lang = entry.options.get("tts_language", "en")

    # Check Vacation Mode
    if data["vacation"]["enabled"]:
        now_date = dt_util.now().date()
        start = (
            datetime.datetime.strptime(
                data["vacation"]["start"], "%Y-%m-%d"
            ).date()
            if data["vacation"]["start"]
            else None
        )
        end = (
            datetime.datetime.strptime(
                data["vacation"]["end"], "%Y-%m-%d"
            ).date()
            if data["vacation"]["end"]
            else None
        )

        if start and end and start <= now_date <= end:
            _LOGGER.debug("Vacation mode enabled and active")
            return

    now = dt_util.now()
    for bell in data["bells"]:
        if not bell["enabled"]:
            continue

        b_hour, b_minute = map(int, bell["time"].split(":"))
        next_run = now.replace(
            hour=b_hour, minute=b_minute, second=0, microsecond=0
        )
        if next_run <= now:
            next_run += datetime.timedelta(days=1)

        def create_callback(bell_data):
            async def fire_bell(now_time):
                current_day = now_time.strftime("%a").lower()
                if current_day in bell_data["days"]:
                    # Use bell specific TTS if set, else global
                    provider = bell_data.get("tts_provider") or tts_provider
                    voice = bell_data.get("tts_voice") or tts_voice
                    lang = bell_data.get("tts_language") or tts_lang

                    service_data = {
                        "entity_id": provider,
                        "message": bell_data["message"],
                        "language": lang,
                        "media_player_entity_id": bell_data["speakers"],
                    }
                    if voice:
                        service_data["options"] = {"voice": voice}

                    await hass.services.async_call(
                        "tts", "speak", service_data
                    )

                await schedule_bells(hass, entry)

            return fire_bell

        listener = async_track_point_in_utc_time(
            hass, create_callback(bell), next_run
        )
        hass.data[DOMAIN]["listeners"].append(listener)


# --- WebSocket Handlers ---


@websocket_api.websocket_command(
    {vol.Required("type"): "family_bell/get_data"}
)
@websocket_api.async_response
async def ws_get_data(hass, connection, msg):
    data = hass.data[DOMAIN]["data"]

    # Inject global TTS settings for frontend default
    entry_id = hass.data[DOMAIN]["entry_id"]
    entry = hass.config_entries.async_get_entry(entry_id)
    if entry:
        data["global_tts"] = {
            "provider": entry.options.get(
                "tts_provider", entry.data.get("tts_provider")
            ),
            "voice": entry.options.get("tts_voice"),
            "language": entry.options.get("tts_language", "en"),
        }

    # Inject version
    data["version"] = hass.data[DOMAIN].get("version", "unknown")

    connection.send_result(msg["id"], data)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "family_bell/update_bell",
        vol.Required("bell"): BELL_SCHEMA,
    }
)
@websocket_api.async_response
async def ws_update_bell(hass, connection, msg):
    bells = hass.data[DOMAIN]["data"]["bells"]
    new_bell = msg["bell"]

    existing = next(
        (i for i, b in enumerate(bells) if b["id"] == new_bell["id"]), None
    )
    if existing is not None:
        bells[existing] = new_bell
    else:
        bells.append(new_bell)

    await save_data(hass)
    connection.send_result(msg["id"], {"success": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "family_bell/delete_bell",
        vol.Required("bell_id"): str,
    }
)
@websocket_api.async_response
async def ws_delete_bell(hass, connection, msg):
    bells = hass.data[DOMAIN]["data"]["bells"]
    hass.data[DOMAIN]["data"]["bells"] = [
        b for b in bells if b["id"] != msg["bell_id"]
    ]
    await save_data(hass)
    connection.send_result(msg["id"], {"success": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "family_bell/vacation",
        vol.Required("vacation"): dict,
    }
)
@websocket_api.async_response
async def ws_update_vacation(hass, connection, msg):
    hass.data[DOMAIN]["data"]["vacation"] = msg["vacation"]
    await save_data(hass)
    connection.send_result(msg["id"], {"success": True})
