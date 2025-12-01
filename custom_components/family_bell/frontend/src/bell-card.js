import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class BellCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      bell: { type: Object },
    };
  }

  render() {
    return html`
      <link rel="stylesheet" href="/local/family_bell/src/styles/bell-card.css" />
      <div class="card bell-card ${this.bell.enabled ? "" : "disabled"}">
        <div class="bell-info">
          <div class="bell-time">${this.bell.time}</div>
          <div class="bell-msg">${this.bell.message}</div>
          <div class="bell-days">
            ${this.bell.days.map(d => d.toUpperCase().slice(0,3)).join(" · ")}
          </div>
          <div class="bell-speakers">
            📢 ${this.bell.speakers.length} Speaker(s)
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
    if (!confirm("Delete this bell?")) return;
    this.hass.callWS({ type: "family_bell/delete_bell", bell_id: this.bell.id });
  }

}

customElements.define("bell-card", BellCard);