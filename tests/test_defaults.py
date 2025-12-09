import pytest
from unittest.mock import patch, MagicMock
from homeassistant.const import CONF_PLATFORM
from homeassistant.setup import async_setup_component
from homeassistant.components import websocket_api
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service

from custom_components.family_bell.const import DOMAIN

@pytest.fixture
def mock_storage():
    """Mock storage."""
    with patch("custom_components.family_bell.Store") as mock_store:
        store_instance = mock_store.return_value

        async def async_load():
            return {
                "bells": [],
                "vacation": {"start": None, "end": None, "enabled": False},
            }
        store_instance.async_load.side_effect = async_load

        async def async_save(data):
            return None
        store_instance.async_save.side_effect = async_save

        yield store_instance

async def test_last_defaults_persistence(hass, hass_ws_client, mock_storage):
    """Test that TTS settings are saved to last_defaults."""
    entry = MockConfigEntry(
        domain=DOMAIN,
        data={"tts_provider": "tts.global"},
        options={},
    )
    entry.add_to_hass(hass)

    # Mock static path registration
    with patch("custom_components.family_bell.os.path.isdir", return_value=True), \
         patch("custom_components.family_bell.os.path.isfile", return_value=True), \
         patch("custom_components.family_bell.async_register_built_in_panel"), \
         patch("custom_components.family_bell.add_extra_js_url"), \
         patch("homeassistant.helpers.event.async_track_point_in_utc_time"), \
         patch.object(hass.config, "path", return_value="/mock/path"):

        assert await async_setup_component(hass, DOMAIN, {})
        await hass.async_block_till_done()

    client = await hass_ws_client(hass)

    # 1. Update bell with specific TTS settings
    bell_data = {
        "id": "bell1",
        "name": "Test Bell",
        "time": "08:00",
        "days": ["mon"],
        "message": "Wake up",
        "enabled": True,
        "speakers": ["media_player.kitchen"],
        "tts_provider": "tts.piper",
        "tts_voice": "en_voice_1",
        "tts_language": "en",
    }

    await client.send_json({
        "id": 1,
        "type": "family_bell/update_bell",
        "bell": bell_data
    })
    response = await client.receive_json()
    assert response["success"]

    # Verify data in memory
    data = hass.data[DOMAIN]["data"]
    assert "last_defaults" in data
    assert data["last_defaults"]["provider"] == "tts.piper"
    assert data["last_defaults"]["voice"] == "en_voice_1"
    assert data["last_defaults"]["language"] == "en"

    # 2. Verify ws_get_data returns last_defaults
    await client.send_json({
        "id": 2,
        "type": "family_bell/get_data",
    })
    response = await client.receive_json()
    assert response["success"]
    assert "last_defaults" in response["result"]
    assert response["result"]["last_defaults"]["provider"] == "tts.piper"

    # 3. Update bell with different TTS settings
    bell_data_2 = {
        "id": "bell2",
        "name": "Test Bell 2",
        "time": "09:00",
        "days": ["tue"],
        "message": "Work time",
        "enabled": True,
        "speakers": ["media_player.office"],
        "tts_provider": "tts.google",
        "tts_voice": None,
        "tts_language": "es",
    }

    await client.send_json({
        "id": 3,
        "type": "family_bell/update_bell",
        "bell": bell_data_2
    })
    await client.receive_json()

    # Verify updated defaults
    data = hass.data[DOMAIN]["data"]
    assert data["last_defaults"]["provider"] == "tts.google"
    assert data["last_defaults"]["voice"] is None
    assert data["last_defaults"]["language"] == "es"
