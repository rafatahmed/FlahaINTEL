"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Acquisition origin helpers
Introduction:
Treats default HTTP/HTTPS ports as the same origin so robots.txt and redirects
are not IgnoreRequest'd on a normal public page.

Created by: Rafat Al Khashan
Created date: 2026-08-21
Last modified: 2026-08-21
"""
from urllib.parse import urlsplit


def effective_port(parts) -> int | None:
    if parts.port is not None:
        return parts.port
    if parts.scheme == "https":
        return 443
    if parts.scheme == "http":
        return 80
    return None


def public_url(scheme: str, host: str, port: int, route: str) -> str:
    if (scheme == "https" and port == 443) or (scheme == "http" and port == 80):
        return f"{scheme}://{host}{route}"
    return f"{scheme}://{host}:{port}{route}"


def same_origin(url: str, origin: str) -> bool:
    value, approved = urlsplit(url), urlsplit(origin)
    if value.username or value.password:
        return False
    if value.scheme != approved.scheme:
        return False
    if (value.hostname or "").lower() != (approved.hostname or "").lower():
        return False
    return effective_port(value) == effective_port(approved)
