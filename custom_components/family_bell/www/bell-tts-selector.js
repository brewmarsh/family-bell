import {
  LitElement,
  html,
  css,
} from "./lit-element.js";

export class BellTTSSelector extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      provider: { type: String },
      voice: { type: String },
      language: { type: String },
      _providers: { type: Array },
      _voices: { type: Array },
      _languages: { type: Array },
    };
  }

  constructor() {
    super();
    this.provider = "";
    this.voice = "";
    this.language = "";
    this._providers = [];
    this._voices = [];
    this._languages = [];
  }

  firstUpdated() {
    this._fetchProviders();
  }

  willUpdate(changedProperties) {
    if (changedProperties.has("hass") && this.hass) {
        // If hass changes, and we don't have providers, fetch them.
        if (this._providers.length === 0) {
            this._fetchProviders();
        }
    }
    if (changedProperties.has("provider")) {
      // If provider changed, fetch languages and voices
      // Check if it actually changed to avoid loop if strict equality
      // provider property update triggers this.
      this._updateLanguages(this.provider);
      this._fetchVoices(this.provider);
    }
  }

  _fetchProviders() {
    if (!this.hass || !this.hass.states) return;
    this._providers = Object.keys(this.hass.states)
      .filter((eid) => eid.startsWith("tts."))
      .map((eid) => ({
        id: eid,
        name: this.hass.states[eid].attributes.friendly_name || eid,
        languages: this.hass.states[eid].attributes.supported_languages || [],
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  _updateLanguages(providerId) {
    const provider = this._providers.find((p) => p.id === providerId);
    this._languages = provider ? provider.languages : [];

    // Reset language if current is not supported, or default to first
    if (this._languages.length > 0 && !this._languages.includes(this.language)) {
      this.language = this._languages[0];
      this._dispatchChange();
    }
  }

  async _fetchVoices(providerId) {
    this._voices = [];
    if (!providerId || !this.hass) return;

    let fetched = false;

    // Try WebSocket command 'tts/voices'
    try {
        const result = await this.hass.callWS({
            type: "tts/voices",
            engine_id: providerId,
        });
        if (result && result.voices) {
            this._voices = result.voices.map(v => ({
                id: v.voice_id,
                name: v.name || v.voice_id
            }));
            fetched = true;
        }
    } catch (err) {
        // Ignore WS error, likely not supported by HA version or integration
    }

    // Fallback to state attributes
    if (!fetched && this.hass.states && this.hass.states[providerId]) {
         const state = this.hass.states[providerId];
         if (state.attributes.voices) {
             this._voices = state.attributes.voices.map(v => ({
                 id: v,
                 name: v
             }));
         }
    }

    // Explicitly request update as _voices mutation might not trigger it if array ref is same (but we reassigned it)
    this.requestUpdate();
  }

  _handleProviderChange(e) {
    this.provider = e.target.value;
    this.voice = ""; // Reset voice on provider change
    this._dispatchChange();
  }

  _handleVoiceChange(e) {
    this.voice = e.target.value;
    this._dispatchChange();
  }

  _handleLanguageChange(e) {
    this.language = e.target.value;
    this._fetchVoices(this.provider); // Re-fetch voices as they might depend on language
    this._dispatchChange();
  }

  _dispatchChange() {
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: {
          provider: this.provider,
          voice: this.voice,
          language: this.language,
        },
      })
    );
  }

  render() {
    return html`
      <div class="row">
        <div class="input-group">
          <label>TTS Provider</label>
          <select
            .value=${this.provider}
            @change=${this._handleProviderChange}
          >
            <option value="">Default (Global)</option>
            ${this._providers.map(
              (p) => html`<option value="${p.id}">${p.name}</option>`
            )}
          </select>
        </div>
      </div>

      <div class="row">
        ${this._languages.length > 0
          ? html`
              <div class="input-group">
                <label>Language</label>
                <select
                  .value=${this.language}
                  @change=${this._handleLanguageChange}
                >
                   <option value="">Default</option>
                  ${this._languages.map(
                    (l) => html`<option value="${l}">${l}</option>`
                  )}
                </select>
              </div>
            `
          : html`
             <div class="input-group">
                <label>Language</label>
                <input
                    type="text"
                    .value=${this.language}
                    list="languages"
                    @change=${this._handleLanguageChange}
                    placeholder="en"
                />
                 <datalist id="languages">
                     <option value="en">English</option>
                 </datalist>
             </div>
          `}

        <div class="input-group">
          <label>Voice</label>
          <input
            type="text"
            .value=${this.voice}
            list="voices"
            @change=${this._handleVoiceChange}
            placeholder="Optional"
          />
          <datalist id="voices">
            ${this._voices.map(
              (v) => html`<option value="${v.id}">${v.name}</option>`
            )}
          </datalist>
        </div>
      </div>
    `;
  }

  static get styles() {
    return css`
      .row {
        display: flex;
        gap: 10px;
        margin-bottom: 10px;
        flex-wrap: wrap;
      }
      .input-group {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 120px;
      }
      label {
        font-size: 0.8em;
        margin-bottom: 4px;
        font-weight: bold;
        color: var(--secondary-text-color);
      }
      select,
      input {
        padding: 8px;
        border-radius: 4px;
        border: 1px solid var(--divider-color);
        background: var(--secondary-background-color);
        color: var(--primary-text-color);
        width: 100%;
        box-sizing: border-box;
      }
    `;
  }
}

if (!customElements.get("bell-tts-selector")) {
  customElements.define("bell-tts-selector", BellTTSSelector);
}
