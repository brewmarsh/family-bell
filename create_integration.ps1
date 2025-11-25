# create_integration.ps1 (Fixed Syntax)

Write-Host "Setting up Family Bell integration files..." -ForegroundColor Cyan

# 1. Create Directory Structure
$basePath = "custom_components\family_bell"
$frontendPath = "$basePath\frontend"

Write-Host "Creating directories..."
New-Item -Path $frontendPath -ItemType Directory -Force | Out-Null

# 2. Create const.py
Write-Host "Writing const.py..."
$constContent = '@
DOMAIN = "family_bell"
'@
$constContent | Out-File -FilePath "$basePath\const.py" -Encoding utf8

# 3. Create manifest.json
Write-Host "Writing manifest.json..."
$manifestContent = '@
{
  "domain": "family_bell",
  "name": "Family Bell",
  "version": "1.1.0",
  "documentation": "https://github.com/yourname/family_bell",
  "requirements": [],
  "dependencies": [],
  "codeowners": [],
  "iot_class": "local_push",
  "config_flow": true
}
'@
$manifestContent | Out-File -FilePath "$basePath\manifest.json" -Encoding utf8

# 4. Create config_flow.py
Write-Host "Writing config_flow.py..."
$configFlowContent = '@
import logging
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    EntitySelector,
    EntitySelectorConfig,
    TextSelector,
)

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

TTS_SCHEMA = vol.Schema({
    vol.Required("tts_provider", default="tts.google_en_com"): EntitySelector(
        EntitySelectorConfig(domain="tts")
    ),
    vol.Optional("tts_voice", default=""): TextSelector(),
    vol.Optional("tts_language", default="en"): TextSelector(),
})

class FamilyBellConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Family Bell."""
    VERSION = 1

    async def async_step_user(self, user_input=None):
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        if user_input is not None:
            return self.async_create_entry(title="Family Bell", data=user_input)

        return self.async_show_form(step_id="user", data_schema=TTS_SCHEMA)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return FamilyBellOptionsFlowHandler(config_entry)

class FamilyBellOptionsFlowHandler(config_entries.OptionsFlow):
    def __init__(self, config_entry):
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        current_provider = self.config_entry.options.get("tts_provider", 
                           self.config_entry.data.get("tts_provider", "tts.google_en_com"))
        current_voice = self.config_entry.options.get("tts_voice", "")
        current_lang = self.config_entry.options.get("tts_language", "en")

        options_schema = vol.Schema({
            vol.Required("tts_provider", default=current_provider): EntitySelector(
                EntitySelectorConfig(domain="tts")
            ),
            vol.Optional("tts_voice", default=current_voice): str,
            vol.Optional("tts_language", default=current_lang): str,
        })

        return self.async_show_form(step_id="init", data_schema=options_schema)
'@
$configFlowContent | Out-File -FilePath "$basePath\config_flow.py" -Encoding utf8

# 5. Create __init__.py
Write-Host "Writing __init__.py..."
$initContent = '@
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
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    data = await store.async_load() or {"bells": [], "vacation": {"start": None, "end": None, "enabled": False}}
    
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN] = {
        "store": store,
        "data": data,
        "listeners": [],
        "entry_id": entry.entry_id 
    }

    path = hass.config.path("custom_components/family_bell/frontend/family_bell_panel.js")
    hass.http.register_static_path(PANEL_URL, path)

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

    try:
        hass.components.websocket_api.async_register_command(hass, ws_get_data)
        hass.components.websocket_api.async_register_command(hass, ws_update_bell)
        hass.components.websocket_api.async_register_command(hass, ws_delete_bell)
        hass.components.websocket_api.async_register_command(hass, ws_update_vacation)
    except:
        pass 

    await schedule_bells(hass, entry)
    entry.async_on_unload(entry.add_update_listener(update_listener))

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry):
    for remove_listener in hass.data[DOMAIN]["listeners"]:
        remove_listener()
    hass.components.frontend.async_remove_panel("family_bell")
    hass.data.pop(DOMAIN)
    return True

async def update_listener(hass, entry):
    await schedule_bells(hass, entry)

async def save_data(hass):
    store = hass.data[DOMAIN]["store"]
    data = hass.data[DOMAIN]["data"]
    await store.async_save(data)
    entry_id = hass.data[DOMAIN]["entry_id"]
    entry = hass.config_entries.async_get_entry(entry_id)
    await schedule_bells(hass, entry)

async def schedule_bells(hass, entry):
    for remove_listener in hass.data[DOMAIN]["listeners"]:
        remove_listener()
    hass.data[DOMAIN]["listeners"] = []

    data = hass.data[DOMAIN]["data"]
    tts_provider = entry.options.get("tts_provider", entry.data.get("tts_provider"))
    tts_voice = entry.options.get("tts_voice", None)
    tts_lang = entry.options.get("tts_language", "en")

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

@websocket_api.websocket_command({vol.Required("type"): "family_bell/get_data"})
@websocket_api.async_response
async def ws_get_data(hass, connection, msg):
    connection.send_result(msg["id"], hass.data[DOMAIN]["data"])

@websocket_api.websocket_command({vol.Required("type"): "family_bell/update_bell", vol.Required("bell"): BELL_SCHEMA})
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

@websocket_api.websocket_command({vol.Required("type"): "family_bell/delete_bell", vol.Required("bell_id"): str})
@websocket_api.async_response
async def ws_delete_bell(hass, connection, msg):
    bells = hass.data[DOMAIN]["data"]["bells"]
    hass.data[DOMAIN]["data"]["bells"] = [b for b in bells if b["id"] != msg["bell_id"]]
    await save_data(hass)
    connection.send_result(msg["id"], {"success": True})

@websocket_api.websocket_command({vol.Required("type"): "family_bell/vacation", vol.Required("vacation"): dict})
@websocket_api.async_response
async def ws_update_vacation(hass, connection, msg):
    hass.data[DOMAIN]["data"]["vacation"] = msg["vacation"]
    await save_data(hass)
    connection.send_result(msg["id"], {"success": True})
'@
$initContent | Out-File -FilePath "$basePath\__init__.py" -Encoding utf8

# 6. Create frontend/family_bell_panel.js
Write-Host "Writing frontend/family_bell_panel.js..."
$jsContent = '@
import { LitElement, html, css } from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class FamilyBellPanel extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      bells: { type: Array },
      vacation: { type: Object },
      _newDays: { type: Array },
      _newSpeakers: { type: Array },
    };
  }

  constructor() {
    super();
    this.bells = [];
    this.vacation = { enabled: false, start: "", end: "" };
    this._newDays = [];
    this._newSpeakers = [];
  }

  firstUpdated() {
    this.fetchData();
  }

  fetchData() {
    this.hass.callWS({ type: "family_bell/get_data" }).then((data) => {
      this.bells = data.bells;
      this.vacation = data.vacation;
      this.requestUpdate();
    });
  }

  getMediaPlayers() {
    return Object.keys(this.hass.states)
      .filter((eid) => eid.startsWith("media_player."))
      .map((eid) => {
        return {
          id: eid,
          name: this.hass.states[eid].attributes.friendly_name || eid,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  render() {
    return html`
      <div class="container">
        <div class="header"><h1>Family Bell</h1></div>

        <div class="card">
          <div class="card-header">
            <h2>Vacation Mode</h2>
            <div class="toggle-container">
              <label class="switch">
                <input type="checkbox" .checked=${this.vacation.enabled} @change=${(e) => this.updateVacation("enabled", e.target.checked)} />
                <span class="slider round"></span>
              </label>
            </div>
          </div>
          <div class="row inputs">
            <div class="input-group">
              <label>Start Date</label>
              <input type="date" .value=${this.vacation.start || ""} ?disabled=${!this.vacation.enabled} @change=${(e) => this.updateVacation("start", e.target.value)} />
            </div>
            <div class="input-group">
              <label>End Date</label>
              <input type="date" .value=${this.vacation.end || ""} ?disabled=${!this.vacation.enabled} @change=${(e) => this.updateVacation("end", e.target.value)} />
            </div>
          </div>
        </div>

        <h3>Scheduled Bells</h3>
        ${this.bells.length === 0 ? html`<p class="empty-state">No bells scheduled yet.</p>` : ""}
        ${this.bells.map((bell) => this.renderBellCard(bell))}

        <div class="card add-card">
          <h2>Add New Bell</h2>
          <div class="row">
            <input id="newTime" type="time" class="time-input" />
            <input id="newMsg" type="text" placeholder="What should I say?" class="msg-input" />
          </div>
          <div class="section-label">Days to Repeat:</div>
          <div class="day-selector">
            ${["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map(
              (day) => html`
                <span class="day-bubble ${this._newDays.includes(day) ? "selected" : ""}" @click=${() => this.toggleNewDay(day)}>
                  ${day.charAt(0).toUpperCase()}
                </span>
              `
            )}
          </div>
          <div class="section-label">Select Speakers:</div>
          <div class="speaker-list">
            ${this.getMediaPlayers().map(
              (player) => html`
                <label class="checkbox-container">
                  <input type="checkbox" value="${player.id}" @change=${(e) => this.toggleNewSpeaker(player.id, e.target.checked)}>
                  ${player.name}
                </label>
              `
            )}
          </div>
          <button class="save-btn" @click=${this.addBell}>Save Bell</button>
        </div>
      </div>
    `;
  }

  renderBellCard(bell) {
    return html`
      <div class="card bell-card ${bell.enabled ? "" : "disabled"}">
        <div class="bell-info">
          <div class="bell-time">${bell.time}</div>
          <div class="bell-msg">${bell.message}</div>
          <div class="bell-days">${bell.days.map(d => d.toUpperCase().slice(0,3)).join(" · ")}</div>
          <div class="bell-speakers">Speaker(s): ${bell.speakers.length}</div>
        </div>
        <div class="bell-actions">
           <label class="switch">
              <input type="checkbox" .checked=${bell.enabled} @change=${(e) => this.toggleBellEnabled(bell, e.target.checked)} />
              <span class="slider round"></span>
            </label>
            <button class="icon-btn delete-btn" @click=${() => this.deleteBell(bell.id)}>Delete</button>
        </div>
      </div>
    `;
  }

  toggleNewDay(day) {
    if (this._newDays.includes(day)) {
      this._newDays = this._newDays.filter((d) => d !== day);
    } else {
      this._newDays = [...this._newDays, day];
    }
    this.requestUpdate();
  }

  toggleNewSpeaker(id, isChecked) {
    if (isChecked) { this._newSpeakers.push(id); } else { this._newSpeakers = this._newSpeakers.filter(s => s !== id); }
  }

  toggleBellEnabled(bell, enabled) {
    const updatedBell = { ...bell, enabled: enabled };
    this.hass.callWS({ type: "family_bell/update_bell", bell: updatedBell }).then(() => this.fetchData());
  }

  updateVacation(field, value) {
    this.vacation = { ...this.vacation, [field]: value };
    this.hass.callWS({ type: "family_bell/vacation", vacation: this.vacation });
  }

  addBell() {
    const time = this.shadowRoot.getElementById("newTime").value;
    const msg = this.shadowRoot.getElementById("newMsg").value;
    if (!time || !msg || this._newDays.length === 0 || this._newSpeakers.length === 0) {
      alert("Please fill in time, message, select at least one day and one speaker.");
      return;
    }
    const newBell = {
      id: Date.now().toString(),
      name: "Bell " + time,
      time: time,
      message: msg,
      days: this._newDays,
      speakers: this._newSpeakers,
      enabled: true,
    };
    this.hass.callWS({ type: "family_bell/update_bell", bell: newBell }).then(() => {
      this.fetchData();
      this.shadowRoot.getElementById("newMsg").value = "";
      this._newDays = [];
      this._newSpeakers = [];
      this.shadowRoot.querySelectorAll('.speaker-list input').forEach(el => el.checked = false);
      this.requestUpdate();
    });
  }

  deleteBell(id) {
    if (!confirm("Delete this bell?")) return;
    this.hass.callWS({ type: "family_bell/delete_bell", bell_id: id }).then(() => this.fetchData());
  }

  static get styles() {
    return css`
      :host { display: block; padding: 20px; background-color: var(--primary-background-color); color: var(--primary-text-color); font-family: var(--paper-font-body1_-_font-family); min-height: 100vh; }
      .container { max-width: 600px; margin: 0 auto; padding-bottom: 50px;}
      h1, h2, h3 { margin-top: 0; font-weight: normal; }
      .card { background: var(--card-background-color); padding: 16px; margin-bottom: 16px; border-radius: 12px; box-shadow: var(--ha-card-box-shadow, 0 2px 2px 0 rgba(0,0,0,0.14)); border: 1px solid var(--divider-color); }
      .bell-card { display: flex; align-items: center; justify-content: space-between; }
      .disabled { opacity: 0.6; }
      .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
      .row { display: flex; gap: 10px; margin-bottom: 15px; }
      .inputs { justify-content: space-between; }
      .input-group { display: flex; flex-direction: column; flex: 1; }
      input[type="text"], input[type="date"], input[type="time"] { padding: 10px; border-radius: 8px; border: 1px solid var(--divider-color); background: var(--secondary-background-color); color: var(--primary-text-color); font-size: 16px; }
      .time-input { flex: 0 0 100px; }
      .msg-input { flex: 1; }
      .day-selector { display: flex; gap: 8px; margin-bottom: 15px; justify-content: center; }
      .day-bubble { width: 36px; height: 36px; border-radius: 50%; background: var(--secondary-background-color); display: flex; align-items: center; justify-content: center; cursor: pointer; font-weight: bold; transition: all 0.2s; border: 1px solid var(--divider-color); }
      .day-bubble.selected { background: var(--primary-color); color: var(--text-primary-color, white); border-color: var(--primary-color); }
      .speaker-list { max-height: 150px; overflow-y: auto; background: var(--secondary-background-color); border-radius: 8px; padding: 10px; margin-bottom: 15px; }
      .checkbox-container { display: block; padding: 5px 0; cursor: pointer; }
      .save-btn { width: 100%; padding: 12px; background: var(--primary-color); color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: bold; }
      .delete-btn { background: none; border: none; cursor: pointer; color: var(--error-color, red); }
      .switch { position: relative; display: inline-block; width: 50px; height: 24px; }
      .switch input { opacity: 0; width: 0; height: 0; }
      .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px; }
      .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; }
      input:checked + .slider { background-color: var(--primary-color); }
      input:checked + .slider:before { transform: translateX(26px); }
      .bell-info { flex: 1; }
      .bell-time { font-size: 1.2em; font-weight: bold; }
      .bell-days { color: var(--secondary-text-color); font-size: 0.9em; margin-top: 4px;}
      .bell-speakers { font-size: 0.8em; color: var(--secondary-text-color); margin-top: 2px; }
      .empty-state { text-align: center; color: var(--secondary-text-color); margin-top: 20px;}
      .section-label { font-weight: bold; margin-bottom: 8px; font-size: 0.9em; color: var(--secondary-text-color); }
    `;
  }
}

customElements.define("family-bell-panel", FamilyBellPanel);
'@
$jsContent | Out-File -FilePath "$frontendPath\family_bell_panel.js" -Encoding utf8

Write-Host "Success! Integration files created in $basePath" -ForegroundColor Green