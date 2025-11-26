"""Test the Family Bell config flow."""
from unittest.mock import patch
from homeassistant import config_entries, data_entry_flow
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
                "tts_language": "en"
            },
        )
        await hass.async_block_till_done()

    assert result2["type"] == "create_entry"
    assert result2["title"] == "Family Bell"
    assert result2["data"] == {
        "tts_provider": "tts.google_en_com",
        "tts_voice": "",
        "tts_language": "en"
    }
    assert len(mock_setup_entry.mock_calls) == 1