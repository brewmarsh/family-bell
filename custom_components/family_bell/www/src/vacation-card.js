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
      _newStart: { type: String },
      _newEnd: { type: String },
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
      .row { display: flex; gap: 10px; margin-bottom: 15px; align-items: flex-end; }
      .range-list { margin-top: 10px; }
      .range-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px;
        background: var(--secondary-background-color);
        margin-bottom: 5px;
        border-radius: 6px;
      }
      .range-text { font-size: 0.9em; }
      .delete-btn { background: none; border: none; cursor: pointer; opacity: 0.7; font-size: 1.1em; }
      .delete-btn:hover { opacity: 1; }

      .input-group { display: flex; flex-direction: column; flex: 1; }
      input[type="date"] {
        padding: 10px;
        border-radius: 8px;
        border: 1px solid var(--divider-color);
        background: var(--secondary-background-color);
        color: var(--primary-text-color);
        font-size: 14px;
        width: 100%;
        box-sizing: border-box;
      }
      label { margin-bottom: 4px; font-size: 0.85em; color: var(--secondary-text-color); }

      .add-btn {
        padding: 10px 16px;
        background: var(--primary-color);
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        height: 40px;
      }
      .add-btn:disabled { background: var(--disabled-text-color); cursor: not-allowed; }

      .switch { position: relative; display: inline-block; width: 50px; height: 24px; }
      .switch input { opacity: 0; width: 0; height: 0; }
      .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--ha-color-fill-neutral-normal-resting, #ccc); transition: .4s; border-radius: 34px; }
      .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 4px; bottom: 4px; background-color: var(--ha-color-text-primary, white); transition: .4s; border-radius: 50%; }
      input:checked + .slider { background-color: var(--primary-color); }
      input:checked + .slider:before { transform: translateX(26px); }
    `;
  }

  constructor() {
    super();
    this._newStart = "";
    this._newEnd = "";
  }

  render() {
    const ranges = this.vacation && this.vacation.ranges ? this.vacation.ranges : [];

    return html`
      <div class="card">
        <div class="card-header">
          <h2>🌴 ${localize("vacation_mode", this.hass)}</h2>
          <div class="toggle-container">
            <label class="switch">
              <input
                type="checkbox"
                .checked=${this.vacation.enabled}
                @change=${(e) => this.toggleEnabled(e.target.checked)}
              />
              <span class="slider round"></span>
            </label>
          </div>
        </div>

        <p style="color: var(--secondary-text-color); font-size: 0.9em; margin-bottom: 15px;">
           ${ranges.length === 0 ? "No active vacation periods." : "Bells are paused during these periods:"}
        </p>

        <div class="range-list">
           ${ranges.map((range, index) => html`
             <div class="range-item">
               <span class="range-text">${range.start} &rarr; ${range.end}</span>
               <button class="delete-btn" @click=${() => this.deleteRange(index)}>🗑️</button>
             </div>
           `)}
        </div>

        ${this.vacation.enabled ? html`
          <div style="margin-top: 15px; border-top: 1px solid var(--divider-color); padding-top: 15px;">
            <div class="row">
              <div class="input-group">
                <label>${localize("start_date", this.hass)}</label>
                <input
                  type="date"
                  .value=${this._newStart}
                  @change=${(e) => this._newStart = e.target.value}
                />
              </div>
              <div class="input-group">
                <label>${localize("end_date", this.hass)}</label>
                <input
                  type="date"
                  .value=${this._newEnd}
                  @change=${(e) => this._newEnd = e.target.value}
                />
              </div>
              <button
                class="add-btn"
                ?disabled=${!this._newStart || !this._newEnd}
                @click=${this.addRange}
              >Add</button>
            </div>
          </div>
        ` : ""}
      </div>
    `;
  }

  toggleEnabled(enabled) {
    const newVacation = { ...this.vacation, enabled: enabled };
    if (!newVacation.ranges) newVacation.ranges = [];
    this._updateBackend(newVacation);
  }

  addRange() {
    if (!this._newStart || !this._newEnd) return;

    // Sort logic to keep ranges ordered could be nice, but simple append is fine for now
    const ranges = [...(this.vacation.ranges || [])];
    ranges.push({ start: this._newStart, end: this._newEnd });

    // Simple sort by start date
    ranges.sort((a, b) => a.start.localeCompare(b.start));

    const newVacation = { ...this.vacation, ranges };
    this._updateBackend(newVacation);

    this._newStart = "";
    this._newEnd = "";
    this.requestUpdate();
  }

  deleteRange(index) {
     const ranges = [...(this.vacation.ranges || [])];
     ranges.splice(index, 1);
     const newVacation = { ...this.vacation, ranges };
     this._updateBackend(newVacation);
  }

  _updateBackend(vacation) {
    this.hass.callWS({ type: "family_bell/vacation", vacation: vacation });
  }

}

customElements.define("vacation-card", VacationCard);
