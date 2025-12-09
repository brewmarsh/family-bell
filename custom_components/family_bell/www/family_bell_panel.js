import {
  LitElement,
  html,
  css,
} from "./lit-element.js";
import "./src/bell-card.js";
import "./src/vacation-card.js";
import "./src/bell-form.js";
import "./bell-tts-selector.js";

console.info(
  `%c 🔔 Family Bell 🔔 %c ${new URL(import.meta.url).searchParams.get("v") || "unknown"}`,
  "color: white; background: #e0ab0a; font-weight: 700; padding: 2px 4px; border-radius: 4px;",
  "color: #e0ab0a; font-weight: 700;"
);

export class FamilyBellPanel extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      bells: { type: Array },
      vacation: { type: Object },
      _globalTTS: { type: Object },
      _lastDefaults: { type: Object },
      _version: { type: String },

      _editingBell: { type: Object },
      _showAddForm: { type: Boolean },
      _filterText: { type: String },
    };
  }

  constructor() {
    super();
    this.bells = [];
    this.vacation = { enabled: false, ranges: [] };
    this._globalTTS = {};
    this._lastDefaults = null;
    this._version = "unknown";

    this._editingBell = null;
    this._showAddForm = false;
    this._filterText = "";
  }

  firstUpdated() {
    this.fetchData();
    this.addEventListener('edit-bell', this._handleEditBell);
    this.addEventListener('cancel-edit', this._handleCancelEdit);
    this.addEventListener('bell-saved', this._handleBellSaved);
  }

  updated(changedProperties) {
    if (changedProperties.has("hass") && this.hass && !this.bells.length) {
      if (!this._dataFetched) {
         this.fetchData();
      }
    }
  }

  fetchData() {
    if (!this.hass) return;
    this.hass.callWS({ type: "family_bell/get_data" }).then((data) => {
      this.bells = data.bells.sort((a, b) => a.time.localeCompare(b.time));
      this.vacation = data.vacation;
      this._dataFetched = true;
      if (data.version) this._version = data.version;
      if (data.global_tts) this._globalTTS = data.global_tts;
      if (data.last_defaults) this._lastDefaults = data.last_defaults;
      this.requestUpdate();
    }).catch(err => console.error("Family Bell: Error fetching data", err));
  }

  _handleEditBell(e) {
      this._editingBell = e.detail.bell;
      this._showAddForm = true;
      // Scroll to top
      const top = this.shadowRoot.getElementById('top-anchor');
      if (top) top.scrollIntoView({ behavior: 'smooth' });
  }

  _handleCancelEdit() {
      this._editingBell = null;
      this._showAddForm = false;
  }

  _handleBellSaved(e) {
      this._editingBell = null;
      this._showAddForm = false;

      // Optimistic update of defaults
      const bell = e.detail.bell;
      this._lastDefaults = {
          provider: bell.tts_provider,
          voice: bell.tts_voice,
          language: bell.tts_language
      };

      this.fetchData();
  }

  render() {
    if (!this.hass) {
        return html`<div class="container"><p>Loading...</p></div>`;
    }

    // Filter bells
    let filteredBells = this.bells;
    if (this._filterText) {
        const txt = this._filterText.toLowerCase();
        filteredBells = this.bells.filter(b =>
            b.message.toLowerCase().includes(txt) ||
            b.time.includes(txt)
        );
    }

    return html`
      <div class="container" id="top-anchor">
        <div class="header">
           <div class="header-title">
             <h1>🔔 Family Bell</h1>
           </div>

           <div class="header-actions">
              ${!this._showAddForm ? html`
                <button class="add-btn" @click=${() => this._showAddForm = true}>
                   ➕ Add Bell
                </button>
              ` : ""}
           </div>
        </div>

        ${this._showAddForm ? html`
           <bell-form
              .hass=${this.hass}
              .bell=${this._editingBell}
              .globalTTS=${this._globalTTS}
              .lastDefaults=${this._lastDefaults}
           ></bell-form>
        ` : ""}
        
        <vacation-card
            .hass=${this.hass}
            .vacation=${this.vacation}
        ></vacation-card>

        <div class="search-bar">
             <input
                type="text"
                placeholder="Search bells..."
                .value=${this._filterText}
                @input=${(e) => this._filterText = e.target.value}
             />
        </div>

        <h3>Scheduled Bells (${filteredBells.length})</h3>
        ${filteredBells.length === 0 ? html`<p class="empty-state">No bells found.</p>` : ""}

        <div class="bell-grid">
           ${filteredBells.map((bell) => html`
              <bell-card .hass=${this.hass} .bell=${bell}></bell-card>
           `)}
        </div>

        <div class="footer">
          Family Bell v${this._version}
        </div>
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
        box-sizing: border-box;
      }
      .container { max-width: 1024px; margin: 0 auto; padding-bottom: 50px;}
      
      .header {
         display: flex;
         justify-content: space-between;
         align-items: center;
         margin-bottom: 20px;
      }
      h1, h2, h3 { margin: 0; font-weight: normal; }
      h1 { font-size: 2em; }
      
      .add-btn {
         background: var(--primary-color);
         color: var(--text-primary-color, white);
         border: none;
         padding: 10px 20px;
         border-radius: 20px;
         font-size: 16px;
         cursor: pointer;
         font-weight: bold;
         box-shadow: 0 2px 5px rgba(0,0,0,0.2);
         transition: all 0.2s;
      }
      .add-btn:hover { transform: scale(1.05); }

      .search-bar { margin: 20px 0; }
      .search-bar input {
          width: 100%;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid var(--divider-color);
          background: var(--secondary-background-color);
          color: var(--primary-text-color);
          font-size: 16px;
          box-sizing: border-box;
      }

      /* Grid Layout */
      .bell-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
      }
      
      /* Desktop Grid */
      @media (min-width: 600px) {
         .bell-grid {
             grid-template-columns: repeat(2, 1fr);
         }
      }
      @media (min-width: 900px) {
         .bell-grid {
             grid-template-columns: repeat(3, 1fr);
         }
      }

      .empty-state { text-align: center; color: var(--secondary-text-color); margin-top: 40px; font-style: italic;}
      .footer { text-align: center; margin-top: 40px; color: var(--secondary-text-color); font-size: 0.8em; }
    `;
  }
}

if (!customElements.get("family-bell")) {
  customElements.define("family-bell", FamilyBellPanel);
}
