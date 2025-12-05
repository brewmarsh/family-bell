import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";
import { localize } from "./localize.js";

class VacationCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      vacation: { type: Object },
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
      .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
      .row { display: flex; gap: 10px; margin-bottom: 15px; }
      .inputs { justify-content: space-between; }
      .input-group { display: flex; flex-direction: column; flex: 1; }
      input[type="date"] {
        padding: 10px;
        border-radius: 8px;
        border: 1px solid var(--divider-color);
        background: var(--secondary-background-color);
        color: var(--primary-text-color);
        font-size: 16px;
      }
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
      <div class="card">
        <div class="card-header">
          <h2>🌴 ${localize("vacation_mode", this.hass)}</h2>
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
            <label>${localize("start_date", this.hass)}</label>
            <input
              type="date"
              .value=${this.vacation.start || ""}
              ?disabled=${!this.vacation.enabled}
              @change=${(e) => this.updateVacation("start", e.target.value)}
            />
          </div>
          <div class="input-group">
            <label>${localize("end_date", this.hass)}</label>
            <input
              type="date"
              .value=${this.vacation.end || ""}
              ?disabled=${!this.vacation.enabled}
              @change=${(e) => this.updateVacation("end", e.target.value)}
            />
          </div>
        </div>
      </div>
    `;
  }

  updateVacation(field, value) {
    const newVacation = { ...this.vacation, [field]: value };
    this.hass.callWS({ type: "family_bell/vacation", vacation: newVacation });
  }

}

customElements.define("vacation-card", VacationCard);
