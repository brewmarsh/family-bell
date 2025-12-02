"""Test family_bell setup process."""
from unittest.mock import patch, MagicMock, AsyncMock
from homeassistant.core import HomeAssistant
from custom_components.family_bell import async_setup_entry, DOMAIN, PANEL_URL
from pytest_homeassistant_custom_component.common import MockConfigEntry

async def test_setup_entry_panel_conflict(hass: HomeAssistant):
    """Test setup entry handles panel conflict gracefully."""

    # Mock config entry
    entry = MockConfigEntry(
        domain=DOMAIN,
        data={
            "bells": [],
            "vacation": {"start": None, "end": None, "enabled": False},
             "tts_provider": "tts.google_en_com"
        },
        options={}
    )
    entry.add_to_hass(hass)

    # Mock async_register_built_in_panel
    with patch(
        "custom_components.family_bell.async_register_built_in_panel",
    ) as mock_register:

        # Mock hass.http.async_register_static_paths as it is awaited
        hass.http = MagicMock()
        hass.http.async_register_static_paths = AsyncMock()

        # Mock schedule_bells to simplify test and avoid side effects
        with patch("custom_components.family_bell.schedule_bells"):

             # Call setup
             result = await async_setup_entry(hass, entry)

        # Assertions
        assert result is True
        mock_register.assert_called_once_with(
            hass,
            "family_bell",
            "Family Bell 🔔",
            "mdi:school-bell",
            "family-bell",
            config={"module_url": PANEL_URL, "embed_iframe": False},
            require_admin=True,
            update=True,
        )
