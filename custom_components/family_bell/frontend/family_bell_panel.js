import {
  LitElement,
  html,
  css,
} from "./lit-element.js";
import "./bell-tts-selector.js";

console.log("Family Bell: Loaded family_bell_panel.js");

class FamilyBellPanel extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      bells: { type: Array },
      vacation: { type: Object },
      _newDays: { type: Array },
      _newSpeakers: { type: Array },
      _newTTS: { type: Object },
      _globalTTS: { type: Object },
    };
  }

  constructor() {
    super();
    console.log("Family Bell: Constructor called");
    this.bells = [];
    this.vacation = { enabled: false, start: "", end: "" };
    this._newDays = [];
    this._newSpeakers = [];
    this._newTTS = { provider: "", voice: "", language: "" };
    this._globalTTS = {};
  }

  firstUpdated() {
    console.log("Family Bell: firstUpdated called");
    this.fetchData();
  }

  fetchData() {
    console.log("Family Bell: Fetching data");
    this.hass.callWS({ type: "family_bell/get_data" }).then((data) => {
      this.bells = data.bells;
      this.vacation = data.vacation;
      if (data.global_tts) {
        this._globalTTS = data.global_tts;
        // Set default for new bell if not set
        if (!this._newTTS.provider) {
           this._newTTS = { ...data.global_tts };
        }
      }
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
    console.log("Family Bell: Render called");
    return html`
      <div class="container">
        <div class="header">
          <h1>🔔 Family Bell</h1>
        </div>

        <div class="card">
          <div class="card-header">
            <h2>🌴 Vacation Mode</h2>
            <div class="toggle-container">
              <label class="switch">
                <input
                  type="checkbox"
                  .checked=${this.vacation.enabled}
                  @change=${(e) => this.updateVacation("enabled", e.target.checked)}
                />
                <span class="slider round"></span>
              </label>
            </div>
          </div>
          <div class="row inputs">
            <div class="input-group">
              <label>Start Date</label>
              <input
                type="date"
                .value=${this.vacation.start || ""}
                ?disabled=${!this.vacation.enabled}
                @change=${(e) => this.updateVacation("start", e.target.value)}
              />
            </div>
            <div class="input-group">
              <label>End Date</label>
              <input
                type="date"
                .value=${this.vacation.end || ""}
                ?disabled=${!this.vacation.enabled}
                @change=${(e) => this.updateVacation("end", e.target.value)}
              />
            </div>
          </div>
        </div>

        <h3>Scheduled Bells</h3>
        ${this.bells.length === 0 ? html`<p class="empty-state">No bells scheduled yet.</p>` : ""}
        
        ${this.bells.map((bell) => this.renderBellCard(bell))}

        <div class="card add-card">
          <h2>➕ Add New Bell</h2>
          
          <div class="row">
            <input id="newTime" type="time" class="time-input" />
            <input id="newMsg" type="text" placeholder="What should I say?" class="msg-input" />
          </div>

          <div class="section-label">TTS Settings:</div>
          <bell-tts-selector
            .hass=${this.hass}
            .provider=${this._newTTS.provider}
            .voice=${this._newTTS.voice}
            .language=${this._newTTS.language}
            @change=${this._handleTTSChange}
          ></bell-tts-selector>

          <div class="section-label">Days to Repeat:</div>
          <div class="day-selector">
            ${["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map(
              (day) => html`
                <span
                  class="day-bubble ${this._newDays.includes(day) ? "selected" : ""}"
                  @click=${() => this.toggleNewDay(day)}
                >
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
                  <input 
                    type="checkbox" 
                    value="${player.id}"
                    @change=${(e) => this.toggleNewSpeaker(player.id, e.target.checked)}
                  >
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
          <div class="bell-days">
            ${bell.days.map(d => d.toUpperCase().slice(0,3)).join(" · ")}
          </div>
          <div class="bell-speakers">
            📢 ${bell.speakers.length} Speaker(s)
          </div>
        </div>
        <div class="bell-actions">
           <label class="switch">
              <input
                type="checkbox"
                .checked=${bell.enabled}
                @change=${(e) => this.toggleBellEnabled(bell, e.target.checked)}
              />
              <span class="slider round"></span>
            </label>
            <button class="icon-btn delete-btn" @click=${() => this.deleteBell(bell.id)}>🗑️</button>
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
    if (isChecked) {
      this._newSpeakers.push(id);
    } else {
      this._newSpeakers = this._newSpeakers.filter(s => s !== id);
    }
  }

  toggleBellEnabled(bell, enabled) {
    const updatedBell = { ...bell, enabled: enabled };
    this.hass.callWS({ type: "family_bell/update_bell", bell: updatedBell })
      .then(() => this.fetchData());
  }

  updateVacation(field, value) {
    this.vacation = { ...this.vacation, [field]: value };
    this.hass.callWS({ type: "family_bell/vacation", vacation: this.vacation });
  }

  _handleTTSChange(e) {
    this._newTTS = { ...this._newTTS, ...e.detail };
    this.requestUpdate();
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
      tts_provider: this._newTTS.provider,
      tts_voice: this._newTTS.voice,
      tts_language: this._newTTS.language,
    };

    this.hass.callWS({ type: "family_bell/update_bell", bell: newBell }).then(() => {
      this.fetchData();
      this.shadowRoot.getElementById("newMsg").value = "";
      this._newDays = [];
      this._newSpeakers = [];
      // Reset TTS to global default
      this._newTTS = { ...this._globalTTS };
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
      :host {
        display: block;
        padding: 20px;
        background-color: var(--primary-background-color);
        color: var(--primary-text-color);
        font-family: var(--paper-font-body1_-_font-family);
        min-height: 100vh;
      }
      .container { max-width: 600px; margin: 0 auto; padding-bottom: 50px;}
      h1, h2, h3 { margin-top: 0; font-weight: normal; }
      
      .card {
        background: var(--card-background-color);
        padding: 16px;
        margin-bottom: 16px;
        border-radius: 12px;
        box-shadow: var(--ha-card-box-shadow, 0 2px 2px 0 rgba(0,0,0,0.14));
        border: 1px solid var(--divider-color);
      }
      
      .bell-card { display: flex; align-items: center; justify-content: space-between; }
      .disabled { opacity: 0.6; }

      .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
      
      .row { display: flex; gap: 10px; margin-bottom: 15px; }
      .inputs { justify-content: space-between; }
      .input-group { display: flex; flex-direction: column; flex: 1; }
      input[type="text"], input[type="date"], input[type="time"] {
        padding: 10px;
        border-radius: 8px;
        border: 1px solid var(--divider-color);
        background: var(--secondary-background-color);
        color: var(--primary-text-color);
        font-size: 16px;
      }
      .time-input { flex: 0 0 100px; }
      .msg-input { flex: 1; }

      .day-selector { display: flex; gap: 8px; margin-bottom: 15px; justify-content: center; }
      .day-bubble {
        width: 36px; height: 36px;
        border-radius: 50%;
        background: var(--secondary-background-color);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.2s;
        border: 1px solid var(--divider-color);
      }
      .day-bubble.selected {
        background: var(--primary-color);
        color: var(--text-primary-color, white);
        border-color: var(--primary-color);
      }

      .speaker-list {
        max-height: 150px;
        overflow-y: auto;
        background: var(--secondary-background-color);
        border-radius: 8px;
        padding: 10px;
        margin-bottom: 15px;
      }
      .checkbox-container { display: block; padding: 5px 0; cursor: pointer; }
      
      .save-btn {
        width: 100%;
        padding: 12px;
        background: var(--primary-color);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        cursor: pointer;
        font-weight: bold;
      }
      .delete-btn { background: none; border: none; cursor: pointer; font-size: 20px; }

      .switch { position: relative; display: inline-block; width: 50px; height: 24px; }
      .switch input { opacity: 0; width: 0; height: 0; }
      .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--ha-color-fill-neutral-normal-resting); transition: .4s; border-radius: 34px; }
      .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 4px; bottom: 4px; background-color: var(--ha-color-text-primary); transition: .4s; border-radius: 50%; }
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

if (!customElements.get("family-bell")) {
  customElements.define("family-bell", FamilyBellPanel);
}
