import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";
import { localize } from "./localize.js";

class BellCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      bell: { type: Object },
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
      .bell-card { display: flex; align-items: center; justify-content: space-between; }
      .disabled { opacity: 0.6; }
      .bell-info { flex: 1; }
      .bell-time { font-size: 1.2em; font-weight: bold; }
      .bell-days { color: var(--secondary-text-color); font-size: 0.9em; margin-top: 4px;}
      .bell-speakers { font-size: 0.8em; color: var(--secondary-text-color); margin-top: 2px; }
      .delete-btn { background: none; border: none; cursor: pointer; font-size: 20px; }
      .switch { position: relative; display: inline-block; width: 50px; height: 24px; }
      .switch input { opacity: 0; width: 0; height: 0; }
      .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px; }
      .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; }
      input:checked + .slider { background-color: var(--primary-color); }
      input:checked + .slider:before { transform: translateX(26px); }
    `;
  }

  render() {
    return html`
      <div class="card bell-card ${this.bell.enabled ? "" : "disabled"}">
        <div class="bell-info">
          <div class="bell-time">${this.bell.time}</div>
          <div class="bell-msg">${this.bell.message}</div>
          <div class="bell-days">
            ${this.bell.days.map(d => localize(`days.${d}`, this.hass)).join(" · ")}
          </div>
          <div class="bell-speakers">
            📢 ${this.bell.speakers.length} ${localize("speakers", this.hass)}
          </div>
        </div>
        <div class="bell-actions">
           <label class="switch">
              <input
                type="checkbox"
                .checked=${this.bell.enabled}
                @change=${(e) => this.toggleBellEnabled(e.target.checked)}
              />
              <span class="slider round"></span>
            </label>
            <button class="icon-btn delete-btn" @click=${() => this.deleteBell()}>🗑️</button>
        </div>
      </div>
    `;
  }

  toggleBellEnabled(enabled) {
    const updatedBell = { ...this.bell, enabled: enabled };
    this.hass.callWS({ type: "family_bell/update_bell", bell: updatedBell });
  }

  deleteBell() {
    if (!confirm(localize("delete_confirm", this.hass))) return;
    this.hass.callWS({ type: "family_bell/delete_bell", bell_id: this.bell.id });
  }

}

customElements.define("bell-card", BellCard);
