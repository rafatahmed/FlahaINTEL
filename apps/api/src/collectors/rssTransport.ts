import { lookup as dnsLookup } from "node:dns/promises";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { Readable, Transform } from "node:stream";

export interface RssTransportOptions {
  timeoutMs: number;
  maxResponseBytes: number;
  maxRedirects: number;
  userAgent?: string;
}

export type AddressResolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

export interface RssHttpResponse {
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: Readable;
}

export type RssRequester = (
  url: URL,
  destination: { address: string; family: number },
  signal: AbortSignal,
  headers: Record<string, string>,
) => Promise<RssHttpResponse>;

export function createPinnedLookup(destination: { address: string; family: number }): LookupFunction {
  return ((_hostname: string, options: unknown, callback: (...args: unknown[]) => void) => {
    if (typeof options === "object" && options !== null && "all" in options && options.all === true) {
      callback(null, [destination]);
      return;
    }
    callback(null, destination.address, destination.family);
  }) as LookupFunction;
}

export class UnsafeRssUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeRssUrlError";
  }
}

function parseIpv4(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  return octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? octets : null;
}

function isPublicIpv4(address: string): boolean {
  const octets = parseIpv4(address);
  if (!octets) return false;
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 0 || b === 168)) return false;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
  if (a === 203 && b === 0) return false;
  return true;
}

function expandIpv6(address: string): number[] | null {
  const withoutZone = address.toLowerCase().split("%")[0];
  const halves = withoutZone.split("::");
  if (halves.length > 2) return null;

  const parseHalf = (half: string): number[] | null => {
    if (!half) return [];
    const groups = half.split(":");
    const result: number[] = [];
    for (const group of groups) {
      if (group.includes(".")) {
        const ipv4 = parseIpv4(group);
        if (!ipv4) return null;
        result.push((ipv4[0] << 8) | ipv4[1], (ipv4[2] << 8) | ipv4[3]);
      } else {
        if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
        result.push(Number.parseInt(group, 16));
      }
    }
    return result;
  };

  const left = parseHalf(halves[0]);
  const right = parseHalf(halves[1] ?? "");
  if (!left || !right) return null;
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  return [...left, ...Array.from({ length: missing }, () => 0), ...right];
}

function isPublicIpv6(address: string): boolean {
  const groups = expandIpv6(address);
  if (!groups || groups.length !== 8) return false;
  if (groups.every((group) => group === 0)) return false;
  if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) return false;
  if ((groups[0] & 0xfe00) === 0xfc00) return false;
  if ((groups[0] & 0xffc0) === 0xfe80) return false;
  if ((groups[0] & 0xff00) === 0xff00) return false;
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return false;
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    const mapped = `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
    return isPublicIpv4(mapped);
  }
  return true;
}

export function isPublicIpAddress(address: string): boolean {
  const normalized = address.startsWith("[") && address.endsWith("]") ? address.slice(1, -1) : address;
  const family = isIP(normalized);
  if (family === 4) return isPublicIpv4(normalized);
  if (family === 6) return isPublicIpv6(normalized);
  return false;
}

const defaultResolver: AddressResolver = async (hostname) => dnsLookup(hostname, { all: true, verbatim: true });

export function parseRssUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UnsafeRssUrlError("RSS URL must be a valid absolute URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeRssUrlError("RSS URL must use HTTP or HTTPS.");
  }
  if (url.username || url.password) {
    throw new UnsafeRssUrlError("RSS URL must not contain credentials.");
  }
  return url;
}

export async function resolvePublicDestination(
  url: URL,
  resolver: AddressResolver = defaultResolver,
  signal?: AbortSignal,
): Promise<{ address: string; family: number }> {
  const hostname = url.hostname.startsWith("[") ? url.hostname.slice(1, -1) : url.hostname;
  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await (signal ? resolveWithAbort(resolver(hostname), signal) : resolver(hostname)).catch(() => []);
  if (signal?.aborted) throw new UnsafeRssUrlError("RSS hostname validation timed out.");
  if (addresses.length === 0) throw new UnsafeRssUrlError("RSS hostname could not be resolved.");
  if (addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw new UnsafeRssUrlError("RSS URL resolves to a non-public network address.");
  }
  return addresses[0];
}

export async function validateRssDestination(
  value: string,
  resolver?: AddressResolver,
  timeoutMs?: number,
): Promise<URL> {
  const url = parseRssUrl(value);
  const controller = timeoutMs ? new AbortController() : undefined;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
  timer?.unref();
  try {
    await resolvePublicDestination(url, resolver, controller?.signal);
    return url;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function resolveWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Error("RSS request timed out."));
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new Error("RSS request timed out."));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

function decompressor(contentEncoding: string | undefined): Transform | null {
  const encoding = contentEncoding?.toLowerCase().trim();
  if (!encoding || encoding === "identity") return null;
  if (encoding === "gzip" || encoding === "x-gzip") return createGunzip();
  if (encoding === "deflate") return createInflate();
  if (encoding === "br") return createBrotliDecompress();
  throw new Error("RSS response uses an unsupported content encoding.");
}

export async function readBoundedBody(
  input: Readable,
  maxBytes: number,
  contentEncoding?: string,
): Promise<string> {
  let rawBytes = 0;
  const rawLimiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      rawBytes += chunk.length;
      callback(rawBytes > maxBytes ? new Error("RSS response exceeds the configured size limit.") : null, chunk);
    },
  });
  const decoder = decompressor(contentEncoding);
  const stream = decoder ? input.pipe(rawLimiter).pipe(decoder) : input.pipe(rawLimiter);
  const chunks: Buffer[] = [];
  let decodedBytes = 0;
  try {
    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      decodedBytes += buffer.length;
      if (decodedBytes > maxBytes) throw new Error("RSS response exceeds the configured size limit.");
      chunks.push(buffer);
    }
  } catch (error) {
    input.destroy();
    stream.destroy();
    throw error;
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function fetchRedirect(
  url: URL,
  options: RssTransportOptions,
  resolver: AddressResolver,
  signal: AbortSignal,
  redirects: number,
  requester: RssRequester,
): Promise<string> {
  const destination = await resolvePublicDestination(url, resolver, signal);
  const response = await resolveWithAbort(requester(url, destination, signal, {
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.1",
    "Accept-Encoding": "gzip, deflate, br",
    "User-Agent": options.userAgent ?? "FlahaINTEL/0.1 RSS collector",
  }), signal);
  const status = response.statusCode;
  if ([301, 302, 303, 307, 308].includes(status)) {
    response.body.resume();
    if (redirects >= options.maxRedirects) throw new Error("RSS request exceeded the redirect limit.");
    const location = response.headers.location;
    if (!location) throw new Error("RSS redirect did not include a destination.");
    const nextUrl = parseRssUrl(new URL(location, url).toString());
    return fetchRedirect(nextUrl, options, resolver, signal, redirects + 1, requester);
  }
  if (status < 200 || status >= 300) {
    response.body.resume();
    throw new Error(`RSS request failed with status ${status}.`);
  }
  const contentLength = Number.parseInt(response.headers["content-length"] ?? "", 10);
  if (Number.isFinite(contentLength) && contentLength > options.maxResponseBytes) {
    response.body.destroy();
    throw new Error("RSS response exceeds the configured size limit.");
  }
  return readBoundedBody(response.body, options.maxResponseBytes, response.headers["content-encoding"]);
}

const defaultRequester: RssRequester = async (url, destination, signal, headers) => {
  const pinnedLookup = createPinnedLookup(destination);
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise<RssHttpResponse>((resolve, reject) => {
    const req = request(url, {
      method: "GET",
      headers,
      lookup: pinnedLookup,
      signal,
    }, (response) => {
      resolve({ statusCode: response.statusCode ?? 0, headers: response.headers, body: response });
    });
    req.on("error", (error) => {
      reject(signal.aborted ? new Error("RSS request timed out.") : error);
    });
    req.end();
  });
};

export async function fetchRssText(
  value: string,
  options: RssTransportOptions,
  resolver: AddressResolver = defaultResolver,
  requester: RssRequester = defaultRequester,
): Promise<string> {
  const url = parseRssUrl(value);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  timer.unref();
  try {
    return await fetchRedirect(url, options, resolver, controller.signal, 0, requester);
  } finally {
    clearTimeout(timer);
  }
}
