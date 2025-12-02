"""Test family_bell setup process."""

from unittest.mock import patch, MagicMock, AsyncMock
from homeassistant.core import HomeAssistant
from custom_components.family_bell import async_setup_entry, DOMAIN, PANEL_URL
from pytest_homeassistant_custom_component.common import MockConfigEntry


async def test_setup_entry_panel_removal_await(hass: HomeAssistant):
    """Test setup entry awaits panel removal if async."""

    # Mock config entry
    entry = MockConfigEntry(
        domain=DOMAIN,
        data={
            "bells": [],
            "vacation": {"start": None, "end": None, "enabled": False},
            "tts_provider": "tts.google_en_com",
        },
        options={},
    )
    entry.add_to_hass(hass)

    # Mock async_remove_panel to be an AsyncMock (awaitable)
    # The trick is that `side_effect` is used to make the CALL return a coroutine
    # But we want to inspect the `mock_remove_panel` object's await_count?
    # No, `mock_remove_panel` is the wrapper.
    # If side_effect is an AsyncMock object, calling mock_remove_panel() returns an awaitable.

    mock_remove = AsyncMock()

    with patch(
        "custom_components.family_bell.async_remove_panel", side_effect=mock_remove
    ) as mock_remove_panel, patch(
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

        # Verify async_remove_panel was called
        assert mock_remove_panel.call_count >= 1

        # Verify that the mocked function (mock_remove) was awaited.
        # Since mock_remove_panel uses side_effect=mock_remove, calls to mock_remove_panel
        # invoke mock_remove. So we check mock_remove.await_count.
        assert mock_remove.await_count >= 1

        calls = [c[0][1] for c in mock_remove_panel.call_args_list]
        assert "family-bell" in calls
        assert "family_bell" in calls

        mock_register.assert_called_once()
