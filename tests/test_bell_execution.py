import pytest
from unittest.mock import patch, MagicMock
from homeassistant.core import HomeAssistant
from custom_components.family_bell import DOMAIN
from pytest_homeassistant_custom_component.common import MockConfigEntry

@pytest.fixture(autouse=True)
def mock_nabucasa():
    """Mock hass_nabucasa to avoid import errors in CI due to acme/josepy version mismatch."""
    with patch.dict("sys.modules", {"hass_nabucasa": MagicMock()}):
        yield

@pytest.mark.asyncio
async def test_ws_test_bell_with_sound(hass: HomeAssistant, hass_ws_client):
    """Test ws_test_bell plays sound and tts."""

    entry = MockConfigEntry(
        domain=DOMAIN,
        entry_id="test_entry",
        data={"tts_provider": "tts.google"},
        options={}
    )
    entry.add_to_hass(hass)

    # Register mock services
    play_media_calls = []
    async def mock_play_media(call):
        play_media_calls.append(call)

    hass.services.async_register("media_player", "play_media", mock_play_media)

    speak_calls = []
    async def mock_speak(call):
        speak_calls.append(call)

    hass.services.async_register("tts", "speak", mock_speak)

    # Mock setup dependencies
    with patch("custom_components.family_bell.async_register_built_in_panel"), \
         patch("custom_components.family_bell.add_extra_js_url"), \
         patch("custom_components.family_bell.async_remove_panel"), \
         patch("os.path.isdir", return_value=True), \
         patch("os.path.isfile", return_value=True):

        await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()

        client = await hass_ws_client(hass)

        # Message with sound
        msg = {
            "id": 1,
            "type": "family_bell/test_bell",
            "bell": {
                "id": "1",
                "name": "Test",
                "time": "12:00",
                "days": ["mon"],
                "message": "Hello",
                "enabled": True,
                "speakers": ["media_player.kitchen"],
                "sound": "http://example.com/sound.mp3"
            }
        }

        await client.send_json(msg)
        response = await client.receive_json()

        assert response["success"] is True

        # Verify
        assert len(play_media_calls) == 1
        assert play_media_calls[0].data["media_content_id"] == "http://example.com/sound.mp3"
        assert play_media_calls[0].data["entity_id"] == ["media_player.kitchen"]

        assert len(speak_calls) == 1
        assert speak_calls[0].data["message"] == "Hello"

        await hass.async_block_till_done()
        await client.close()

@pytest.mark.asyncio
async def test_ws_test_bell_no_sound(hass: HomeAssistant, hass_ws_client):
    """Test ws_test_bell without sound."""

    entry = MockConfigEntry(
        domain=DOMAIN,
        entry_id="test_entry",
        data={"tts_provider": "tts.google"},
        options={}
    )
    entry.add_to_hass(hass)

    # Register mock services
    play_media_calls = []
    async def mock_play_media(call):
        play_media_calls.append(call)

    hass.services.async_register("media_player", "play_media", mock_play_media)

    speak_calls = []
    async def mock_speak(call):
        speak_calls.append(call)

    hass.services.async_register("tts", "speak", mock_speak)

    # Mock setup dependencies
    with patch("custom_components.family_bell.async_register_built_in_panel"), \
         patch("custom_components.family_bell.add_extra_js_url"), \
         patch("custom_components.family_bell.async_remove_panel"), \
         patch("os.path.isdir", return_value=True), \
         patch("os.path.isfile", return_value=True):

        await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()

        client = await hass_ws_client(hass)

        # Message without sound
        msg = {
            "id": 1,
            "type": "family_bell/test_bell",
            "bell": {
                "id": "1",
                "name": "Test",
                "time": "12:00",
                "days": ["mon"],
                "message": "Hello",
                "enabled": True,
                "speakers": ["media_player.kitchen"],
                # No sound field
            }
        }

        await client.send_json(msg)
        response = await client.receive_json()

        assert response["success"] is True

        # Verify
        assert len(play_media_calls) == 0
        assert len(speak_calls) == 1

        await hass.async_block_till_done()
        await client.close()
