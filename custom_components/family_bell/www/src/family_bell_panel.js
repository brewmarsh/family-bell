import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

import "./vacation-card.js";
import "./bell-card.js";
import "./add-bell-card.js";
import { localize } from "./localize.js";

class FamilyBellPanel extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      bells: { type: Array },
      vacation: { type: Object },
    };
  }

  constructor() {
    super();
    console.log("Family Bell: Panel Initialized");
    this.bells = [];
    this.vacation = { enabled: false, start: "", end: "" };
  }

  firstUpdated() {
    console.log("Family Bell: First Updated");
    this.fetchData();
    this.hass.connection.subscribeMessage(() => this.fetchData(), {
      type: "family_bell_update",
    });
  }

  fetchData() {
    console.log("Family Bell: Fetching Data");
    this.hass.callWS({ type: "family_bell/get_data" }).then((data) => {
      this.bells = data.bells;
      this.vacation = data.vacation;
    });
  }

  render() {
    console.log("Family Bell: Rendering");
    return html`
      <div class="container">
        <div class="header">
          <h1>🔔 ${localize("header", this.hass)}</h1>
        </div>

        <vacation-card .hass=${this.hass} .vacation=${this.vacation}></vacation-card>

        <h3>${localize("scheduled_bells", this.hass)}</h3>
        ${this.bells.length === 0 ? html`<p class="empty-state">${localize("no_bells", this.hass)}</p>` : ""}

        ${this.bells.map((bell) => html`<bell-card .hass=${this.hass} .bell=${bell}></bell-card>`)}

        <add-bell-card .hass=${this.hass}></add-bell-card>
      </div>
    `;
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
      h1, h3 { margin-top: 0; font-weight: normal; }
      .empty-state { text-align: center; color: var(--secondary-text-color); margin-top: 20px;}
    `;
  }
}

customElements.define("family-bell", FamilyBellPanel);
