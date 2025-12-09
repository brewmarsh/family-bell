import os
import sys
import time
import threading
import http.server
import socketserver
from playwright.sync_api import sync_playwright

PORT = 8000
DIRECTORY = "."


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)


def start_server():
    # Allow reuse address to avoid port conflict if ran quickly again
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving at port {PORT}")
        httpd.serve_forever()


def take_screenshot():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        # Set viewport to something reasonable for a desktop screenshot
        page = browser.new_page(viewport={"width": 1000, "height": 800})

        url = f"http://localhost:{PORT}/tests/screenshot_harness.html"
        print(f"Navigating to {url}")
        page.goto(url)

        try:
            # Wait for the header to appear (inside shadow DOM)
            page.wait_for_selector("family-bell >> h1", timeout=10000)

            # Wait for bells to populate. We look for the bell-grid.
            page.wait_for_selector(
                "family-bell >> .bell-grid bell-card", timeout=5000
            )

            # Additional small sleep to ensure fonts/icons load or layout settles
            time.sleep(0.5)

            # Select the container or the host element.
            # If we screenshot the host, we get the background color of body if not set on host.
            # The host styles in family_bell_panel.js set background-color and min-height.
            element = page.locator("family-bell")

            os.makedirs("images", exist_ok=True)
            element.screenshot(path="images/screenshot.png")
            print("Screenshot saved to images/screenshot.png")

        except Exception as e:
            print(f"Error taking screenshot: {e}")
            # Dump html for debugging if needed
            # print(page.content())
            sys.exit(1)
        finally:
            browser.close()


if __name__ == "__main__":
    # Start server in background thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # Give server a moment to start
    time.sleep(2)

    try:
        take_screenshot()
    except Exception as e:
        print(e)
        sys.exit(1)
