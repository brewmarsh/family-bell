import logging
import datetime
import voluptuous as vol

from homeassistant.core import HomeAssistant, callback
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.storage import Store
from homeassistant.components import websocket_api
from homeassistant.helpers.event import async_track_point_in_utc_time
from homeassistant.util import dt as dt_util

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

STORAGE_KEY = "family_bell_data"
STORAGE_VERSION = 1
PANEL_URL = "/family_bell_panel.js"

# Schema for a single bell
BELL_SCHEMA = vol.Schema({
    "id": str,
    "name": str,
    "time": str, 
    "days": [str], 
    "message": str,
    "enabled": bool,
    "speakers": [str]
})

async def async_setup(hass: HomeAssistant, config: dict):
    """Set up the Family Bell component (YAML fallback)."""
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Set up Family Bell from a config entry (UI Setup)."""
    
    # 1. Setup Storage
    store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    data = await store.async_load() or {"bells": [], "vacation": {"start": None, "end": None, "enabled": False}}
    
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN] = {
        "store": store,
        "data": data,
        "listeners": [],
        "entry_id": entry.entry_id 
    }

    # 2. Register Static Path for Frontend
    path = hass.config.path("custom_components/family_bell/frontend/family_bell_panel.js")
    hass.http.register_static_path(PANEL_URL, path)

    # 3. Register Sidebar Panel
    await hass.components.frontend.async_register_panel(
        "family_bell",
        "Family Bell",
        "mdi:school-bell",
        "family_bell",
        url_path="family-bell",
        module_url=PANEL_URL,
        embed_iframe=False,
        require_admin=True
    )

    # 4. Register Websocket Commands
    try:
        hass.components.websocket_api.async_register_command(hass, ws_get_data)
        hass.components.websocket_api.async_register_command(hass, ws_update_bell)
        hass.components.websocket_api.async_register_command(hass, ws_delete_bell)
        hass.components.websocket_api.async_register_command(hass, ws_update_vacation)
    except:
        pass # Already registered

    # 5. Start Scheduler
    await schedule_bells(hass, entry)

    # 6. Listen for options updates
    entry.async_on_unload(entry.add_update_listener(update_listener))

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Unload a config entry."""
    for remove_listener in hass.data[DOMAIN]["listeners"]:
        remove_listener()
    
    hass.components.frontend.async_remove_panel("family_bell")
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
    
    entry_id = hass.data[DOMAIN]["entry_id"]
    entry = hass.config_entries.async_get_entry(entry_id)
    await schedule_bells(hass, entry)

# --- Scheduler Logic ---

async def schedule_bells(hass, entry):
    """Cancel old listeners and schedule next bells using Options for TTS."""
    for remove_listener in hass.data[DOMAIN]["listeners"]:
        remove_listener()
    hass.data[DOMAIN]["listeners"] = []

    data = hass.data[DOMAIN]["data"]
    
    # Retrieve TTS Settings
    tts_provider = entry.options.get("tts_provider", entry.data.get("tts_provider"))
    tts_voice = entry.options.get("tts_voice", None)
    tts_lang = entry.options.get("tts_language", "en")

    # Check Vacation Mode
    if data["vacation"]["enabled"]:
        now_date = dt_util.now().date()
        start = datetime.datetime.strptime(data["vacation"]["start"], "%Y-%m-%d").date() if data["vacation"]["start"] else None
        end = datetime.datetime.strptime(data["vacation"]["end"], "%Y-%m-%d").date() if data["vacation"]["end"] else None
        
        if start and end and start <= now_date <= end:
            return

    now = dt_util.now()
    for bell in data["bells"]:
        if not bell["enabled"]:
            continue

        b_hour, b_minute = map(int, bell["time"].split(":"))
        next_run = now.replace(hour=b_hour, minute=b_minute, second=0, microsecond=0)
        if next_run <= now:
            next_run += datetime.timedelta(days=1)
        
        def create_callback(bell_data):
            async def fire_bell(now_time):
                current_day = now_time.strftime("%a").lower()
                if current_day in bell_data["days"]:
                    service_data = {
                        "entity_id": tts_provider,
                        "message": bell_data["message"],
                        "language": tts_lang,
                        "media_player_entity_id": bell_data["speakers"]
                    }
                    if tts_voice:
                        service_data["options"] = {"voice": tts_voice}

                    await hass.services.async_call("tts", "speak", service_data)

                await schedule_bells(hass, entry)
            return fire_bell

        listener = async_track_point_in_utc_time(hass, create_callback(bell), next_run)
        hass.data[DOMAIN]["listeners"].append(listener)

# --- WebSocket Handlers ---

@websocket_api.websocket_command({vol.Required("type"): "family_bell/get_data"})
@websocket_api.async_response
async def ws_get_data(hass, connection, msg):
    connection.send_result(msg["id"], hass.data[DOMAIN]["data"])

@websocket_api.websocket_command({
    vol.Required("type"): "family_bell/update_bell",
    vol.Required("bell"): BELL_SCHEMA
})
@websocket_api.async_response
async def ws_update_bell(hass, connection, msg):
    bells = hass.data[DOMAIN]["data"]["bells"]
    new_bell = msg["bell"]
    
    existing = next((i for i, b in enumerate(bells) if b["id"] == new_bell["id"]), None)
    if existing is not None:
        bells[existing] = new_bell
    else:
        bells.append(new_bell)
        
    await save_data(hass)
    connection.send_result(msg["id"], {"success": True})

@websocket_api.websocket_command({
    vol.Required("type"): "family_bell/delete_bell",
    vol.Required("bell_id"): str
})
@websocket_api.async_response
async def ws_delete_bell(hass, connection, msg):
    bells = hass.data[DOMAIN]["data"]["bells"]
    hass.data[DOMAIN]["data"]["bells"] = [b for b in bells if b["id"] != msg["bell_id"]]
    await save_data(hass)
    connection.send_result(msg["id"], {"success": True})

@websocket_api.websocket_command({
    vol.Required("type"): "family_bell/vacation",
    vol.Required("vacation"): dict
})
@websocket_api.async_response
async def ws_update_vacation(hass, connection, msg):
    hass.data[DOMAIN]["data"]["vacation"] = msg["vacation"]
    await save_data(hass)
    connection.send_result(msg["id"], {"success": True})