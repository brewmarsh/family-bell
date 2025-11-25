import logging
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    EntitySelector,
    EntitySelectorConfig,
    TextSelector,
)

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

# Default Schema
TTS_SCHEMA = vol.Schema({
    vol.Required("tts_provider", default="tts.google_en_com"): EntitySelector(
        EntitySelectorConfig(domain="tts")
    ),
    vol.Optional("tts_voice", default=""): TextSelector(),
    vol.Optional("tts_language", default="en"): TextSelector(),
})

class FamilyBellConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Family Bell."""
    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Handle the initial step."""
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        if user_input is not None:
            return self.async_create_entry(title="Family Bell", data=user_input)

        return self.async_show_form(step_id="user", data_schema=TTS_SCHEMA)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return FamilyBellOptionsFlowHandler(config_entry)

class FamilyBellOptionsFlowHandler(config_entries.OptionsFlow):
    """Handle options flow for Family Bell (Settings > Configure)."""

    async def async_step_init(self, user_input=None):
        """Manage the options."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        # Fill form with existing options or defaults
        current_provider = self.config_entry.options.get("tts_provider", 
                           self.config_entry.data.get("tts_provider", "tts.google_en_com"))
        current_voice = self.config_entry.options.get("tts_voice", "")
        current_lang = self.config_entry.options.get("tts_language", "en")

        options_schema = vol.Schema({
            vol.Required("tts_provider", default=current_provider): EntitySelector(
                EntitySelectorConfig(domain="tts")
            ),
            vol.Optional("tts_voice", default=current_voice): str,
            vol.Optional("tts_language", default=current_lang): str,
        })

        return self.async_show_form(step_id="init", data_schema=options_schema)