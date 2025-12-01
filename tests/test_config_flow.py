"""Test the Family Bell config flow."""

from unittest.mock import patch
from homeassistant import config_entries
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.family_bell.const import DOMAIN


async def test_form(hass):
    """Test we get the form."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    assert result["type"] == "form"
    assert result["errors"] is None

    # Simulate User Input (Selecting Google TTS)
    with patch(
        "custom_components.family_bell.async_setup_entry",
        return_value=True,
    ) as mock_setup_entry:
        result2 = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            {
                "tts_provider": "tts.google_en_com",
                "tts_voice": "",
                "tts_language": "en",
            },
        )
        await hass.async_block_till_done()

    assert result2["type"] == "create_entry"
    assert result2["title"] == "Family Bell"
    assert result2["data"] == {
        "tts_provider": "tts.google_en_com",
        "tts_voice": "",
        "tts_language": "en",
    }
    assert len(mock_setup_entry.mock_calls) == 1


async def test_options_flow(hass):
    """Test options flow."""
    # Create a mock config entry
    config_entry = MockConfigEntry(
        domain=DOMAIN,
        data={
            "tts_provider": "tts.google_en_com",
            "tts_voice": "",
            "tts_language": "en",
        },
    )
    config_entry.add_to_hass(hass)

    # Initialize options flow
    result = await hass.config_entries.options.async_init(
        config_entry.entry_id
    )

    assert result["type"] == "form"
    assert result["step_id"] == "init"

    # Submit the form
    with patch(
        "custom_components.family_bell.async_setup_entry",
        return_value=True,
    ):
        result2 = await hass.config_entries.options.async_configure(
            result["flow_id"],
            user_input={
                "tts_provider": "tts.new_provider",
                "tts_voice": "en-US-Wavenet-A",
                "tts_language": "en-US",
            },
        )
        await hass.async_block_till_done()

    assert result2["type"] == "create_entry"
    assert result2["data"] == {
        "tts_provider": "tts.new_provider",
        "tts_voice": "en-US-Wavenet-A",
        "tts_language": "en-US",
    }
