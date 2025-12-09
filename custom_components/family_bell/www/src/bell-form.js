import {
  LitElement,
  html,
  css,
} from "../lit-element.js";
import { localize } from "./localize.js";
import "../bell-tts-selector.js";

class BellForm extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      bell: { type: Object }, // If passed, we are in edit mode
      globalTTS: { type: Object },
      lastDefaults: { type: Object },

      _days: { type: Array },
      _speakers: { type: Array },
      _tts: { type: Object },
      _sound: { type: Object },
      _soundEnabled: { type: Boolean },
      _speakerFilter: { type: String },
      _time: { type: String },
      _message: { type: String },
    };
  }

  static get styles() {
    return css`
      .card {
        background: var(--card-background-color);
        padding: 20px;
        border-radius: 12px;
        box-shadow: var(--ha-card-box-shadow, 0 2px 2px 0 rgba(0,0,0,0.14));
        border: 1px solid var(--divider-color);
      }
      h2 { margin-top: 0; margin-bottom: 20px; text-align: center; }

      .row { display: flex; gap: 10px; margin-bottom: 20px; align-items: center;}

      input[type="text"], input[type="time"] {
        padding: 12px;
        border-radius: 8px;
        border: 1px solid var(--divider-color);
        background: var(--secondary-background-color);
        color: var(--primary-text-color);
        font-size: 16px;
        box-sizing: border-box;
      }
      .time-input { width: 110px; }
      .msg-input { flex: 1; }
      .search-input { width: 100%; box-sizing: border-box; margin-bottom: 10px; padding: 10px; border-radius: 8px; border: 1px solid var(--divider-color); background: var(--secondary-background-color); color: var(--primary-text-color);}

      .section-label { font-weight: bold; margin-bottom: 10px; font-size: 0.9em; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: 0.5px;}

      .day-selector { display: flex; gap: 8px; margin-bottom: 20px; justify-content: center; flex-wrap: wrap; }
      .day-bubble {
        width: 38px; height: 38px;
        border-radius: 50%;
        background: var(--secondary-background-color);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.2s;
        border: 1px solid var(--divider-color);
        user-select: none;
      }
      .day-bubble.selected {
        background: var(--primary-color);
        color: var(--text-primary-color, white);
        border-color: var(--primary-color);
        transform: scale(1.1);
      }

      .speaker-list {
        max-height: 200px;
        overflow-y: auto;
        background: var(--secondary-background-color);
        border-radius: 8px;
        padding: 10px;
        margin-bottom: 20px;
        border: 1px solid var(--divider-color);
      }
      .checkbox-container { display: flex; align-items: center; padding: 8px; cursor: pointer; border-bottom: 1px solid var(--divider-color); }
      .checkbox-container:last-child { border-bottom: none; }
      .checkbox-container input { margin-right: 10px; transform: scale(1.2); }

      .checkbox-label { display: flex; align-items: center; cursor: pointer; user-select: none; }
      .checkbox-label input { margin-right: 8px; }

      .action-buttons { display: flex; gap: 10px; margin-top: 20px; }
      .btn {
        padding: 12px;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        cursor: pointer;
        font-weight: bold;
        flex: 1;
        transition: opacity 0.2s;
      }
      .btn:hover { opacity: 0.9; }
      .save-btn { background: var(--primary-color); color: var(--text-primary-color, white); flex: 2; }
      .test-btn { background: var(--info-color, #2196F3); color: white; }
      .cancel-btn { background: var(--secondary-background-color); color: var(--primary-text-color); border: 1px solid var(--divider-color); }

      /* Sound section style */
      .sound-section { background: var(--secondary-background-color); padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    `;
  }

  constructor() {
    super();
    this._days = [];
    this._speakers = [];
    this._tts = { provider: "", voice: "", language: "" };
    this._sound = "";
    this._soundEnabled = false;
    this._speakerFilter = "";
    this._time = "";
    this._message = "";
  }

  updated(changedProperties) {
    if (changedProperties.has("bell")) {
      if (this.bell) {
        this._loadBell(this.bell);
      } else {
        this._resetForm();
      }
    } else if (changedProperties.has("lastDefaults") && !this.bell && !this._message) {
       // Load defaults only if we are creating new and haven't started typing
       this._loadDefaults();
    }
  }

  _loadBell(bell) {
      this._time = bell.time;
      this._message = bell.message;
      this._days = [...bell.days];
      this._speakers = [...bell.speakers];
      this._tts = {
          provider: bell.tts_provider || (this.globalTTS || {}).provider,
          voice: bell.tts_voice || (this.globalTTS || {}).voice,
          language: bell.tts_language || (this.globalTTS || {}).language,
      };

      // Handle sound
      let sound = bell.sound;
      if (typeof sound === 'string' && sound.length > 0) {
           sound = {
               media_content_id: sound,
               media_content_type: 'music',
               metadata: { title: sound }
           };
           // Auto-associate entity_id if not present, for selector
           if (this._speakers.length > 0) {
               sound.entity_id = this._speakers[0];
           }
      }
      this._sound = sound || "";
      this._soundEnabled = !!bell.sound;
  }

  _resetForm() {
      this._time = "";
      this._message = "";
      this._days = [];
      this._speakers = [];
      this._loadDefaults();
      this._sound = "";
      this._soundEnabled = false;
  }

  _loadDefaults() {
      const defaults = this.lastDefaults || this.globalTTS;
      this._tts = defaults ? { ...defaults } : { provider: "", voice: "", language: "" };
  }

  getMediaPlayers() {
    if (!this.hass || !this.hass.states) return [];
    let players = Object.keys(this.hass.states)
      .filter((eid) => eid.startsWith("media_player."))
      .map((eid) => {
        return {
          id: eid,
          name: this.hass.states[eid].attributes.friendly_name || eid,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    if (this._speakerFilter) {
      const filter = this._speakerFilter.toLowerCase();
      players = players.filter(p => p.name.toLowerCase().includes(filter) || p.id.toLowerCase().includes(filter));
    }
    return players;
  }

  render() {
    return html`
      <div class="card">
        <h2>${this.bell ? "✏️ Edit Bell" : "➕ Add New Bell"}</h2>

        <div class="row">
          <input
            type="time"
            class="time-input"
            .value=${this._time}
            @input=${(e) => this._time = e.target.value}
          />
          <input
            type="text"
            placeholder="${localize("what_to_say", this.hass)}"
            class="msg-input"
            .value=${this._message}
            @input=${(e) => this._message = e.target.value}
          />
        </div>

        <div class="section-label">${localize("days_to_repeat", this.hass)}</div>
        <div class="day-selector">
          ${["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map(
            (day) => html`
              <span
                class="day-bubble ${this._days.includes(day) ? "selected" : ""}"
                @click=${() => this.toggleDay(day)}
              >
                ${localize(`days_short.${day}`, this.hass)}
              </span>
            `
          )}
        </div>

        <div class="sound-section">
           <label class="checkbox-label" style="margin-bottom: 10px;">
               <input
                 type="checkbox"
                 .checked=${this._soundEnabled}
                 @change=${(e) => this.toggleSoundEnabled(e.target.checked)}
               >
               <strong>Pre-announcement Sound</strong>
           </label>

           ${this._soundEnabled ? html`
             ${customElements.get("ha-selector") ? html`
                  <ha-selector
                      .hass=${this.hass}
                      .selector=${{ media: {} }}
                      .value=${this._sound || undefined}
                      .label=${"Sound"}
                      @value-changed=${(e) => this._sound = e.detail.value}
                   ></ha-selector>
             ` : html`
                  <input
                      type="text"
                      placeholder="Sound URL or media_content_id"
                      style="width: 100%"
                      .value=${this._sound}
                      @input=${(e) => this._sound = e.target.value}
                   />
             `}
           ` : ""}
        </div>

        <div class="section-label">TTS Settings</div>
        <bell-tts-selector
            .hass=${this.hass}
            .provider=${this._tts.provider}
            .voice=${this._tts.voice}
            .language=${this._tts.language}
            @change=${(e) => this._tts = { ...this._tts, ...e.detail }}
        ></bell-tts-selector>

        <div class="section-label" style="margin-top: 20px;">${localize("select_speakers", this.hass)}</div>
        <input
            type="text"
            class="search-input"
            placeholder="Search speakers..."
            .value=${this._speakerFilter}
            @input=${(e) => this._speakerFilter = e.target.value}
        />
        <div class="speaker-list">
          ${this.getMediaPlayers().map(
            (player) => html`
              <label class="checkbox-container">
                <input
                  type="checkbox"
                  value="${player.id}"
                  .checked=${this._speakers.includes(player.id)}
                  @change=${(e) => this.toggleSpeaker(player.id, e.target.checked)}
                >
                ${player.name}
              </label>
            `
          )}
        </div>

        <div class="action-buttons">
            <button class="btn save-btn" @click=${this.saveBell}>
                ${this.bell ? localize("update_bell", this.hass) || "Update" : localize("save_bell", this.hass)}
            </button>
            <button class="btn test-btn" @click=${this.testBell}>Test</button>
            <button class="btn cancel-btn" @click=${this.cancel}>Cancel</button>
        </div>
      </div>
    `;
  }

  toggleDay(day) {
    if (this._days.includes(day)) {
      this._days = this._days.filter((d) => d !== day);
    } else {
      this._days = [...this._days, day];
    }
    this.requestUpdate();
  }

  toggleSpeaker(id, isChecked) {
    if (isChecked) {
      this._speakers.push(id);
    } else {
      this._speakers = this._speakers.filter(s => s !== id);
    }
    this.requestUpdate();
  }

  toggleSoundEnabled(enabled) {
    this._soundEnabled = enabled;
    if (enabled && !this._sound) {
         // Try to find a valid entity ID for the selector
         let entityId = null;
         if (this._speakers.length > 0) {
             entityId = this._speakers[0];
         } else {
             const players = this.getMediaPlayers();
             if (players.length > 0) entityId = players[0].id;
         }

         if (entityId) {
             this._sound = { entity_id: entityId, media_content_id: "", media_content_type: "" };
         }
    }
    this.requestUpdate();
  }

  getBellData() {
    const soundEntityId =
      this._soundEnabled &&
      this._sound &&
      typeof this._sound === "object"
        ? this._sound.entity_id
        : null;

    let finalSpeakers = [...this._speakers];
    // Ensure the sound speaker is included if set
    if (soundEntityId && !finalSpeakers.includes(soundEntityId)) {
      finalSpeakers.push(soundEntityId);
    }

    return {
        id: this.bell ? this.bell.id : Date.now().toString(),
        name: "Bell " + this._time,
        time: this._time,
        message: this._message,
        days: this._days,
        speakers: finalSpeakers,
        enabled: true,
        tts_provider: this._tts.provider,
        tts_voice: this._tts.voice,
        tts_language: this._tts.language,
        sound: this._soundEnabled ? this._sound : null,
    };
  }

  saveBell() {
    if (!this._time || !this._message || this._days.length === 0 || this._speakers.length === 0) {
      alert(localize("missing_fields", this.hass));
      return;
    }
    const bellData = this.getBellData();

    this.hass.callWS({ type: "family_bell/update_bell", bell: bellData }).then(() => {
        // Dispatch event so parent can close/reset
        this.dispatchEvent(new CustomEvent('bell-saved', {
            detail: { bell: bellData },
            bubbles: true,
            composed: true
        }));
        if (!this.bell) this._resetForm();
    });
  }

  testBell() {
      if (!this._message || this._speakers.length === 0) {
          alert("Please enter a message and select speakers to test.");
          return;
      }
      const bellData = this.getBellData();
      // Test bell ID doesn't matter
      bellData.id = "test";
      this.hass.callWS({ type: "family_bell/test_bell", bell: bellData });
  }

  cancel() {
      this.dispatchEvent(new CustomEvent('cancel-edit', { bubbles: true, composed: true }));
      this._resetForm();
  }

}

customElements.define("bell-form", BellForm);
