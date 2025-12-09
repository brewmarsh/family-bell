import logging
import datetime
import voluptuous as vol
import inspect
import json
import os

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
        add_extra_js_url,
        async_register_built_in_panel,
        async_remove_panel,
    )
except ImportError:
    add_extra_js_url = None
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
        vol.Optional("sound"): vol.Any(str, dict, None),
    }
)


async def async_setup(hass: HomeAssistant, config: dict):
    """Set up the Family Bell component (YAML fallback)."""
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Set up Family Bell from a config entry (UI Setup)."""

    def read_version():
        try:
            manifest_path = hass.config.path(
                "custom_components/family_bell/manifest.json"
            )
            with open(manifest_path, "r") as f:
                manifest = json.load(f)
            return manifest.get("version", "unknown")
        except Exception as e:
            _LOGGER.warning("Could not read version from manifest: %s", e)
            return "unknown"

    version = await hass.async_add_executor_job(read_version)

    _LOGGER.debug(
        "Setting up Family Bell config entry: %s (Version: %s)",
        entry.entry_id,
        version,
    )

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
    # Use 'www' convention
    frontend_dir = hass.config.path("custom_components/family_bell/www")

    # Check if directory exists
    if not os.path.isdir(frontend_dir):
        _LOGGER.error("Frontend directory not found at path: %s", frontend_dir)
        return False
    else:
        _LOGGER.debug("Frontend directory confirmed at: %s", frontend_dir)

    # Verify the panel file exists
    panel_file = os.path.join(frontend_dir, "family_bell_panel.js")
    if not os.path.isfile(panel_file):
        _LOGGER.error("Panel file not found at path: %s", panel_file)
        return False

    _LOGGER.debug("Registering static path: /family_bell -> %s", frontend_dir)

    if hasattr(hass.http, "async_register_static_paths") and StaticPathConfig:
        paths_to_register = [
            StaticPathConfig("/family_bell", frontend_dir, False),
        ]
        try:
            await hass.http.async_register_static_paths(paths_to_register)
            _LOGGER.debug("Registered static paths (async)")
        except RuntimeError:
            _LOGGER.debug("Static paths already registered")
        except Exception as e:
            _LOGGER.error("Error registering static paths: %s", e)
    else:
        # Fallback for legacy HA or if StaticPathConfig is missing
        _LOGGER.debug("Using legacy static path registration")
        try:
            hass.http.register_static_path("/family_bell", frontend_dir, False)
        except AttributeError:
            _LOGGER.error(
                "Could not register static paths: neither async nor sync method available"
            )
        except Exception as e:
            _LOGGER.error("Error registering static paths (legacy): %s", e)

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
                    _LOGGER.debug("Removed existing panel: %s", panel_id)
                except Exception as ex:
                    _LOGGER.debug("Error removing panel %s: %s", panel_id, ex)

    try:
        if async_register_built_in_panel:
            # Construct versioned URL for cache busting
            panel_url = f"{PANEL_URL}?v={version}"

            # NOTE: We do NOT need to call add_extra_js_url here because the 'custom'
            # panel component handles loading the module_url automatically.
            # Using component_name="custom" is the key.

            _LOGGER.debug(
                "Calling async_register_built_in_panel with: component_name='custom', "
                "sidebar_title='Family Bell', sidebar_icon='mdi:bell', frontend_url_path='family-bell'"
            )

            async_register_built_in_panel(
                hass,
                component_name="custom",
                sidebar_title="Family Bell",
                sidebar_icon="mdi:bell",
                frontend_url_path="family-bell",
                config={
                    "_panel_custom": {
                        "name": "family-bell",
                        "module_url": panel_url,
                        "embed_iframe": False,
                        "trust_external_script": True,
                    }
                },
                require_admin=True,
                update=True,
            )
            _LOGGER.debug("Registered built-in panel (custom)")

            # Verify registration
            panels = hass.data.get("frontend_panels", {})
            if "family-bell" in panels:
                _LOGGER.debug(
                    "Panel 'family-bell' confirmed in frontend_panels. Config: %s",
                    panels["family-bell"],
                )
            else:
                _LOGGER.error(
                    "Panel 'family-bell' NOT found in frontend_panels after registration!"
                )
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
            async_register_command(hass, ws_test_bell)
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
                hass, ws_test_bell
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
    tts_lang = entry.options.get("tts_language")

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

                    sound = bell_data.get("sound")
                    if sound:
                        media_id = None
                        media_type = "music"
                        if isinstance(sound, dict):
                            media_id = sound.get("media_content_id")
                            media_type = sound.get(
                                "media_content_type", "music"
                            )
                        elif isinstance(sound, str):
                            media_id = sound

                        if media_id:
                            try:
                                res = hass.services.async_call(
                                    "media_player",
                                    "play_media",
                                    {
                                        "entity_id": bell_data["speakers"],
                                        "media_content_id": media_id,
                                        "media_content_type": media_type,
                                        "announce": True,
                                    },
                                )
                                if inspect.isawaitable(res):
                                    await res
                            except Exception as e:
                                _LOGGER.warning(
                                    "Failed to play pre-announcement sound: %s",
                                    e,
                                )

                    service_data = {
                        "entity_id": provider,
                        "message": bell_data["message"],
                        "media_player_entity_id": bell_data["speakers"],
                    }
                    if lang:
                        # Piper fails if language is set to 'en'
                        if lang == "en":
                            lang = None
                        else:
                            service_data["language"] = lang
                    if voice:
                        service_data["options"] = {"voice": voice}

                    res = hass.services.async_call(
                        "tts", "speak", service_data
                    )
                    if inspect.isawaitable(res):
                        await res

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
            "language": entry.options.get("tts_language"),
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

    # Update last defaults
    hass.data[DOMAIN]["data"]["last_defaults"] = {
        "provider": new_bell.get("tts_provider"),
        "voice": new_bell.get("tts_voice"),
        "language": new_bell.get("tts_language"),
    }

    await save_data(hass)
    connection.send_result(msg["id"], {"success": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "family_bell/test_bell",
        vol.Required("bell"): BELL_SCHEMA,
    }
)
@websocket_api.async_response
async def ws_test_bell(hass, connection, msg):
    """Test a bell by playing it immediately."""
    bell_data = msg["bell"]
    entry_id = hass.data[DOMAIN]["entry_id"]
    entry = hass.config_entries.async_get_entry(entry_id)

    # Retrieve global TTS Settings
    tts_provider = entry.options.get(
        "tts_provider", entry.data.get("tts_provider")
    )
    tts_voice = entry.options.get("tts_voice", None)
    tts_lang = entry.options.get("tts_language")

    # Use bell specific TTS if set, else global
    provider = bell_data.get("tts_provider") or tts_provider
    voice = bell_data.get("tts_voice") or tts_voice
    lang = bell_data.get("tts_language") or tts_lang

    if not provider:
        connection.send_result(
            msg["id"],
            {
                "success": False,
                "error": {
                    "code": "no_provider",
                    "message": "No TTS provider configured.",
                },
            },
        )
        return

    sound = bell_data.get("sound")
    if sound:
        media_id = None
        media_type = "music"
        if isinstance(sound, dict):
            media_id = sound.get("media_content_id")
            media_type = sound.get("media_content_type", "music")
        elif isinstance(sound, str):
            media_id = sound

        if media_id:
            try:
                res = hass.services.async_call(
                    "media_player",
                    "play_media",
                    {
                        "entity_id": bell_data["speakers"],
                        "media_content_id": media_id,
                        "media_content_type": media_type,
                        "announce": True,
                    },
                )
                if inspect.isawaitable(res):
                    await res
            except Exception as e:
                _LOGGER.warning("Failed to play pre-announcement sound: %s", e)

    service_data = {
        "entity_id": provider,
        "message": bell_data["message"],
        "media_player_entity_id": bell_data["speakers"],
    }
    if lang:
        # Piper fails if language is set to 'en'
        if lang == "en":
            lang = None
        else:
            service_data["language"] = lang
    if voice:
        service_data["options"] = {"voice": voice}

    try:
        res = hass.services.async_call("tts", "speak", service_data)
        if inspect.isawaitable(res):
            await res
        connection.send_result(msg["id"], {"success": True})
    except Exception as e:
        connection.send_result(
            msg["id"],
            {
                "success": False,
                "error": {"code": "service_call_failed", "message": str(e)},
            },
        )


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
