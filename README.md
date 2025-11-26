# 🔔 Family Bell for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=brewmarsh&repository=family-bell&category=integration)
[![GitHub Release](https://img.shields.io/github/release/brewmarsh/family-bell.svg)](https://github.com/brewmarsh/family-bell/releases)
[![License](https://img.shields.io/github/license/brewmarsh/family-bell.svg)](LICENSE)

**Family Bell** is a custom integration that brings the functionality of Google's "Family Bell" directly into Home Assistant. It allows you to schedule recurring announcements on your smart speakers without relying on cloud schedules or specific hardware ecosystems.

For full documentation, please visit [our documentation site](https://brewmarsh.github.io/family-bell/).

![Family Bell Panel](images/screenshot.png)

## Table of Contents

*   [Key Features](#key-features-)
*   [Installation](#installation-️)
*   [Configuration](#configuration-⚙️)
*   [Web UI](#web-ui-)
*   [Services & Controls](#services--controls-)
*   [Automation Examples](#automation-examples-)
*   [How to Contribute](#how-to-contribute-)

## Key Features ✨

*   **📅 Custom Schedules:** Create recurring bells (e.g., "School Starts", "Lunch Time") on specific days of the week.
*   **📢 Multi-Speaker Support:** targeted announcements to specific media players (Sonos, Google Cast, Alexa via Nabu Casa, etc.).
*   **🌴 Vacation Mode:** Easily pause all bells during specific date ranges (Spring Break, Holidays) without deleting them.
*   **🗣️ Flexible TTS:** Works with **any** Text-to-Speech engine configured in Home Assistant (Google Translate, Nabu Casa Cloud, Piper, MaryTTS).
*   **💻 Native UI Panel:** Includes a dedicated sidebar panel for easy management—no YAML editing required!

## Installation 🛠️

For detailed installation instructions, please see the [Installation page](docs/installation.md) in our documentation.

1.  **HACS (Recommended):** Install via HACS and restart Home Assistant.
2.  **Manual:** Copy `custom_components/family_bell` to your `custom_components` directory and restart.

## Configuration ⚙️

Configuration is done via the UI. For a complete guide, please see the [Configuration page](docs/configuration.md) in our documentation.

1.  Go to **Settings > Devices & Services**.
2.  Click **+ Add Integration** and search for "Family Bell".
3.  Follow the on-screen prompts to select your TTS provider.

## Web UI 🖼️

This integration provides a custom panel to manage your bells. The panel is automatically added to your Home Assistant sidebar when you install the integration.

The Web UI provides a comprehensive overview of your bells, including:
*   A list of all your bells.
*   The ability to add, edit, and delete bells.
*   A vacation mode to temporarily disable all bells.

## Services & Controls 🎛️

The following services are available:

*   `family_bell.add_bell`: Add a new bell.
*   `family_bell.delete_bell`: Delete a bell.
*   `family_bell.set_vacation_mode`: Enable or disable vacation mode.

## Automation Examples 🚀

### Enable vacation mode when away

```yaml
automation:
  - alias: "Enable vacation mode when away"
    trigger:
      - platform: state
        entity_id: group.all_people
        to: "not_home"
    action:
      - service: family_bell.set_vacation_mode
        data:
          enabled: true
```

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md) for more details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
