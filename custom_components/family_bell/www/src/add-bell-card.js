import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class AddBellCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      _newDays: { type: Array },
      _newSpeakers: { type: Array },
    };
  }

  static get styles() {
    return css`
      .card {
        background: var(--card-background-color);
        padding: 16px;
        margin-bottom: 16px;
        border-radius: 12px;
        box-shadow: var(--ha-card-box-shadow, 0 2px 2px 0 rgba(0,0,0,0.14));
        border: 1px solid var(--divider-color);
      }
      .row { display: flex; gap: 10px; margin-bottom: 15px; }
      input[type="text"], input[type="time"] {
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
      .section-label { font-weight: bold; margin-bottom: 8px; font-size: 0.9em; color: var(--secondary-text-color); }
    `;
  }

  constructor() {
    super();
    this._newDays = [];
    this._newSpeakers = [];
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
      <div class="card add-card">
        <h2>➕ Add New Bell</h2>

        <div class="row">
          <input id="newTime" type="time" class="time-input" />
          <input id="newMsg" type="text" placeholder="What should I say?" class="msg-input" />
        </div>

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
      this.shadowRoot.getElementById("newMsg").value = "";
      this._newDays = [];
      this._newSpeakers = [];
      this.shadowRoot.querySelectorAll('.speaker-list input').forEach(el => el.checked = false);
      this.requestUpdate();
    });
  }

}

customElements.define("add-bell-card", AddBellCard);
