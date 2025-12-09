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
        border-radius: 12px;
        box-shadow: var(--ha-card-box-shadow, 0 2px 2px 0 rgba(0,0,0,0.14));
        border: 1px solid var(--divider-color);
        height: 100%;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .bell-card { }
      .disabled { opacity: 0.6; }
      .bell-info { flex: 1; }
      .bell-time { font-size: 1.4em; font-weight: bold; color: var(--primary-text-color); }
      .bell-msg { font-size: 1.1em; margin: 4px 0; color: var(--primary-text-color); }
      .bell-days { color: var(--secondary-text-color); font-size: 0.9em; margin-top: 6px; font-style: italic;}
      .bell-meta {
          display: flex;
          gap: 10px;
          margin-top: 8px;
          font-size: 0.85em;
          color: var(--secondary-text-color);
          align-items: center;
      }
      .bell-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          margin-top: 12px;
          gap: 8px;
          border-top: 1px solid var(--divider-color);
          padding-top: 12px;
      }
      .icon-btn { background: none; border: none; cursor: pointer; font-size: 18px; padding: 6px; border-radius: 50%; transition: background 0.2s; }
      .icon-btn:hover { background: rgba(127,127,127, 0.2); }

      .switch { position: relative; display: inline-block; width: 42px; height: 24px; margin-right: auto;}
      .switch input { opacity: 0; width: 0; height: 0; }
      .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--ha-color-fill-neutral-normal-resting, #ccc); transition: .4s; border-radius: 34px; }
      .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 4px; bottom: 4px; background-color: var(--ha-color-text-primary, white); transition: .4s; border-radius: 50%; }
      input:checked + .slider { background-color: var(--primary-color); }
      input:checked + .slider:before { transform: translateX(18px); }
    `;
  }

  render() {
    // Localization helper safe check
    const t = (k) => localize(k, this.hass) || k;
    const days = this.bell.days.map(d => t(`days_short.${d}`)).join(" · ");

    return html`
      <div class="card bell-card ${this.bell.enabled ? "" : "disabled"}">
        <div class="bell-info">
          <div class="bell-time">${this.bell.time}</div>
          <div class="bell-msg">"${this.bell.message}"</div>
          <div class="bell-days">${days}</div>

          <div class="bell-meta">
             <span title="Speakers">📢 ${this.bell.speakers.length}</span>
             ${this.bell.sound ? html`<span title="Sound Enabled">🎵</span>` : ""}
             ${this.bell.tts_voice ? html`<span title="Custom Voice">🗣️</span>` : ""}
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

            <button class="icon-btn edit-btn" title="Edit" @click=${this.editBell}>✏️</button>
            <button class="icon-btn delete-btn" title="Delete" @click=${this.deleteBell}>🗑️</button>
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

  editBell() {
      this.dispatchEvent(new CustomEvent('edit-bell', {
          detail: { bell: this.bell },
          bubbles: true,
          composed: true
      }));
  }

}

customElements.define("bell-card", BellCard);
