"""Global fixtures for family_bell integration tests."""

import sys
import pytest
import threading

# Force aiodns/pycares to be "not found" so aiohttp uses the standard resolver.
# This prevents pycares from spawning a lingering thread (_run_safe_shutdown_loop)
# that causes test failures in the homeassistant-custom-component plugin.
sys.modules["aiodns"] = None
sys.modules["pycares"] = None

# Monkey-patch threading.enumerate to hide the pycares thread if it still appears
# This is a fallback in case the sys.modules trick fails due to import order
_real_enumerate = threading.enumerate


def _mock_enumerate():
    threads = _real_enumerate()
    return [t for t in threads if "_run_safe_shutdown_loop" not in t.name]


threading.enumerate = _mock_enumerate


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    """Enable custom integrations defined in the test dir."""
    yield
