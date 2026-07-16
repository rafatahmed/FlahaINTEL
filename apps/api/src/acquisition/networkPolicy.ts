/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Acquisition Network Policy
 * Introduction:
 * Enforces exact-origin acquisition routing and public-address or fixture-only destination controls.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { GovernedLocator } from "./contracts.js";

export class AcquisitionPolicyError extends Error { constructor(public readonly code: string, message: string) { super(message); this.name = "AcquisitionPolicyError"; } }
const forbiddenV4 = (value: string) => { const p = value.split(".").map(Number); return p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || value === "169.254.169.254"; };
const forbiddenV6 = (value: string) => { const v = value.toLowerCase().split("%")[0]; return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || /^fe[89ab]/.test(v) || v.startsWith("ff") || v.startsWith("2001:db8:"); };
export function assertAddress(address: string, fixture: boolean): void { const family = isIP(address); if (!family) throw new AcquisitionPolicyError("DNS_ADDRESS_INVALID", "DNS returned an invalid address."); if (fixture) { if (address !== "127.0.0.1" && address !== "::1") throw new AcquisitionPolicyError("FIXTURE_ADDRESS_REJECTED", "Fixture mode permits only loopback."); return; } if ((family === 4 && forbiddenV4(address)) || (family === 6 && forbiddenV6(address))) throw new AcquisitionPolicyError("DESTINATION_NOT_PUBLIC", "Destination address is not public."); }
export function locatorUrl(locator: GovernedLocator): URL { if (!Number.isInteger(locator.port) || locator.port < 1 || locator.port > 65535 || !locator.relativeRoute.startsWith("/") || locator.relativeRoute.startsWith("//")) throw new AcquisitionPolicyError("LOCATOR_INVALID", "Governed locator is invalid."); const url = new URL(`${locator.scheme}://${locator.host}:${locator.port}${locator.relativeRoute}`); if (url.username || url.password || !["http:", "https:"].includes(url.protocol) || url.hash) throw new AcquisitionPolicyError("LOCATOR_INVALID", "Governed locator contains prohibited authority."); return url; }
export async function validateLocator(locator: GovernedLocator): Promise<URL> { const url = locatorUrl(locator); const records = await lookup(url.hostname, { all: true, verbatim: true }); if (!records.length) throw new AcquisitionPolicyError("DNS_EMPTY", "Destination resolved to no addresses."); for (const record of records) assertAddress(record.address, locator.mode === "FIXTURE"); return url; }
export async function validateTarget(target: string, locator: GovernedLocator): Promise<URL> { const approved = locatorUrl(locator); const value = new URL(target, approved); if (value.username || value.password || value.protocol !== approved.protocol || value.hostname.toLowerCase() !== approved.hostname.toLowerCase() || Number(value.port || (value.protocol === "https:" ? 443 : 80)) !== locator.port) throw new AcquisitionPolicyError("ORIGIN_ESCAPE", "Target left the approved origin."); await validateLocator({ ...locator, relativeRoute: `${value.pathname}${value.search}` }); return value; }
export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> { const prohibited = /^(authorization|proxy-authorization|cookie|set-cookie)$/i; return Object.fromEntries(Object.entries(headers).filter(([key]) => !prohibited.test(key)).map(([key, value]) => [key.toLowerCase(), value.slice(0, 4096)])); }
