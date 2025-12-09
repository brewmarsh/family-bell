from playwright.sync_api import sync_playwright

def verify_family_bell():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the test harness
        page.goto("http://localhost:8000/test_harness.html")

        # Wait for the family-bell component
        # Note: test_harness.html usually needs some setup or mock data injection.
        # But let's see if it renders the empty state or loading state.

        # Since I don't have a real HASS connection in the static server,
        # the component will likely show "Loading Home Assistant connection..."
        # or similar if I didn't mock it in the harness.

        # Let's inspect test_harness.html content first to see how it works.
        # But I'll take a screenshot anyway.

        page.wait_for_timeout(2000) # Give it a moment to load modules

        page.screenshot(path="verification_initial.png")
        browser.close()

if __name__ == "__main__":
    verify_family_bell()
