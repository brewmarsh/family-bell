import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class VacationCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      vacation: { type: Object },
    };
  }

  render() {
    return html`
      <link rel="stylesheet" href="/local/family_bell/src/styles/vacation-card.css" />
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
    `;
  }

  updateVacation(field, value) {
    const newVacation = { ...this.vacation, [field]: value };
    this.hass.callWS({ type: "family_bell/vacation", vacation: newVacation });
  }

}

customElements.define("vacation-card", VacationCard);