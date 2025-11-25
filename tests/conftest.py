"""Global fixtures for family_bell integration tests."""
import pytest
from unittest.mock import patch

@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    """Enable custom integrations defined in the test dir."""
    yield