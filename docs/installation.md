# Installation

There are two ways to install the Family Bell integration for Home Assistant: via the Home Assistant Community Store (HACS) or manually.

## HACS (Recommended)

1.  **Ensure HACS is installed:** If you haven't already, install the [Home Assistant Community Store (HACS)](https://hacs.xyz/).
2.  **Add Custom Repository:**
    *   In HACS, go to "Integrations".
    *   Click the three dots in the top right and select "Custom repositories".
    *   In the "Repository" field, enter the URL of this custom integration's GitHub repository: `https://github.com/brewmarsh/family-bell`.
    *   For "Category", select "Integration".
    *   Click "Add".
3.  **Install Integration:**
    *   Search for "Family Bell" in HACS.
    *   Click "Install" and follow the prompts.
4.  **Restart Home Assistant:** After installation, restart your Home Assistant instance to load the integration.

## Manual Installation

1.  **Download:** Download the latest release from the [releases page](https://github.com/brewmarsh/family-bell/releases).
2.  **Copy Files:** Unzip the downloaded file and copy the `custom_components/family_bell` folder into your Home Assistant's `config/custom_components/` directory.
3.  **Restart Home Assistant:** Restart your Home Assistant instance to load the integration.
