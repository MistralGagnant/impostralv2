"""Security headers are attached to every HTTP response.

These also guard a real regression: the 3D arena imports Three.js from a CDN, so
the CSP must keep allowing those module origins or the arena silently falls back
to 2D.
"""
from __future__ import annotations

import unittest

from starlette.testclient import TestClient

from app.main import app


class SecurityHeadersTest(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_core_headers_present_on_html_and_json(self) -> None:
        for path in ("/", "/config"):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200)
            self.assertIn("content-security-policy", response.headers)
            self.assertEqual(
                response.headers.get("x-content-type-options"), "nosniff"
            )
            self.assertEqual(response.headers.get("x-frame-options"), "SAMEORIGIN")
            self.assertIn("referrer-policy", response.headers)
            self.assertIn("permissions-policy", response.headers)

    def test_csp_locks_down_framing_and_objects(self) -> None:
        csp = self.client.get("/").headers["content-security-policy"]
        self.assertIn("frame-ancestors 'self'", csp)
        self.assertIn("object-src 'none'", csp)
        self.assertIn("base-uri 'self'", csp)

    def test_csp_allows_turnstile_and_three_js_cdn(self) -> None:
        csp = self.client.get("/").headers["content-security-policy"]
        # Cloudflare Turnstile widget and iframe.
        self.assertIn("https://challenges.cloudflare.com", csp)
        # Pinned Three.js module sources used by web/arena3d.js.
        self.assertIn("https://cdn.jsdelivr.net", csp)
        self.assertIn("https://unpkg.com", csp)
        script_src = next(
            part for part in csp.split(";") if part.strip().startswith("script-src")
        )
        self.assertIn("https://cdn.jsdelivr.net", script_src)
        self.assertIn("https://unpkg.com", script_src)


if __name__ == "__main__":
    unittest.main()
