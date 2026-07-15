"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Crawler and Browser Benchmark Network Policy
Introduction: Enforces the closed local acquisition boundary used by Phase 3E-J.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
"""

from __future__ import annotations

from dataclasses import dataclass
from ipaddress import ip_address
from urllib.parse import urljoin, urlsplit, urlunsplit


class PolicyRejection(ValueError):
    """A stable policy rejection safe to expose in benchmark evidence."""


@dataclass(frozen=True)
class FixturePolicy:
    port: int
    max_redirects: int = 3

    @property
    def base_url(self) -> str:
        return f"http://127.0.0.1:{self.port}"

    def governed_url(self, route: str) -> str:
        if not isinstance(route, str) or not route.startswith("/") or route.startswith("//"):
            raise PolicyRejection("route_not_safe_relative")
        return self.validate(urljoin(self.base_url, route))

    def validate(self, value: str) -> str:
        parsed = urlsplit(value)
        if parsed.scheme != "http":
            raise PolicyRejection("scheme_not_allowed")
        if parsed.username is not None or parsed.password is not None:
            raise PolicyRejection("credentials_not_allowed")
        if parsed.hostname != "127.0.0.1":
            raise PolicyRejection("host_not_allowed")
        try:
            address = ip_address(parsed.hostname)
        except ValueError as exc:
            raise PolicyRejection("dns_names_not_allowed") from exc
        if address.version != 4 or not address.is_loopback:
            raise PolicyRejection("address_not_allowed")
        if parsed.port != self.port:
            raise PolicyRejection("port_not_allowed")
        if parsed.fragment:
            parsed = parsed._replace(fragment="")
        return urlunsplit(parsed)

    def classify(self, value: str) -> str:
        try:
            self.validate(value)
        except (PolicyRejection, ValueError):
            return "blocked"
        return "allowed"
