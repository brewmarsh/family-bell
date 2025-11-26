"""Config flow for Family Bell."""
import voluptuous as vol
from homeassistant import config_entries
from .const import DOMAIN

class FamilyBellConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Family Bell."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Handle the initial step."""
        if user_input is not None:
            return self.async_create_entry(title="Family Bell", data=user_input)

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required("tts_provider"): str,
                vol.Optional("tts_voice"): str,
                vol.Optional("tts_language", default="en"): str,
            })
        )
