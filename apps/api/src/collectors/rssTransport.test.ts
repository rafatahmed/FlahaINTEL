import { gzipSync } from "node:zlib";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  createPinnedLookup,
  fetchRssText,
  isPublicIpAddress,
  readBoundedBody,
  validateRssDestination,
  type AddressResolver,
  type RssRequester,
} from "./rssTransport.js";

const transportOptions = {
  timeoutMs: 100,
  maxResponseBytes: 1_024,
  maxRedirects: 2,
};

const publicResolver: AddressResolver = async () => [{ address: "93.184.216.34", family: 4 }];

describe("RSS destination protection", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.2",
    "169.254.169.254",
    "192.168.1.10",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("rejects non-public address %s", (address) => {
    expect(isPublicIpAddress(address)).toBe(false);
  });

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])("accepts public address %s", (address) => {
    expect(isPublicIpAddress(address)).toBe(true);
  });

  it("rejects credentials and private DNS results", async () => {
    await expect(validateRssDestination("https://user:pass@example.com/feed")).rejects.toThrow("credentials");
    const privateResolver: AddressResolver = async () => [{ address: "10.0.0.1", family: 4 }];
    await expect(validateRssDestination("https://example.com/feed", privateResolver)).rejects.toThrow("non-public");
  });

  it("accepts a controlled public DNS result", async () => {
    const resolver: AddressResolver = async () => [{ address: "93.184.216.34", family: 4 }];
    await expect(validateRssDestination("https://example.com/feed", resolver)).resolves.toBeInstanceOf(URL);
  });

  it("bounds controlled DNS validation", async () => {
    const neverResolves: AddressResolver = () => new Promise(() => undefined);
    await expect(validateRssDestination("https://example.com/feed", neverResolves, 5))
      .rejects.toThrow("timed out");
  });

  it("returns the pinned address in single and all-address lookup modes", async () => {
    const destination = { address: "93.184.216.34", family: 4 };
    const lookup = createPinnedLookup(destination) as unknown as (
      hostname: string,
      options: { all?: boolean },
      callback: (...args: unknown[]) => void,
    ) => void;
    await expect(new Promise((resolve, reject) => lookup("example.com", {}, (error, address, family) => {
      if (error) reject(error);
      else resolve({ address, family });
    }))).resolves.toEqual(destination);
    await expect(new Promise((resolve, reject) => lookup("example.com", { all: true }, (error, addresses) => {
      if (error) reject(error);
      else resolve(addresses);
    }))).resolves.toEqual([destination]);
  });
});

describe("bounded RSS response reading", () => {
  it("reads a bounded gzip response", async () => {
    const compressed = gzipSync("<rss><channel /></rss>");
    await expect(readBoundedBody(Readable.from(compressed), 1_024, "gzip"))
      .resolves.toBe("<rss><channel /></rss>");
  });

  it("rejects decoded content over the configured limit", async () => {
    const compressed = gzipSync("x".repeat(2_000));
    await expect(readBoundedBody(Readable.from(compressed), 1_024, "gzip"))
      .rejects.toThrow("size limit");
  });
});

describe("bounded RSS fetching", () => {
  it("reads a controlled response without live HTTP", async () => {
    const requester: RssRequester = async () => ({
      statusCode: 200,
      headers: {},
      body: Readable.from("<rss><channel /></rss>"),
    });
    await expect(fetchRssText(
      "https://example.com/feed",
      transportOptions,
      publicResolver,
      requester,
    )).resolves.toContain("<rss>");
  });

  it("revalidates and rejects a redirect to a private destination", async () => {
    const resolver: AddressResolver = async (hostname) => [{
      address: hostname === "internal.example" ? "10.0.0.5" : "93.184.216.34",
      family: 4,
    }];
    const requester = vi.fn<RssRequester>().mockResolvedValue({
      statusCode: 302,
      headers: { location: "http://internal.example/feed" },
      body: Readable.from([]),
    });
    await expect(fetchRssText(
      "https://example.com/feed",
      transportOptions,
      resolver,
      requester,
    )).rejects.toThrow("non-public");
    expect(requester).toHaveBeenCalledTimes(1);
  });

  it("enforces the total timeout with a controlled pending request", async () => {
    const requester: RssRequester = async () => new Promise(() => undefined);
    await expect(fetchRssText(
      "https://example.com/feed",
      { ...transportOptions, timeoutMs: 5 },
      publicResolver,
      requester,
    )).rejects.toThrow("timed out");
  });

  it("enforces the redirect limit", async () => {
    const requester: RssRequester = async () => ({
      statusCode: 302,
      headers: { location: "/next" },
      body: Readable.from([]),
    });
    await expect(fetchRssText(
      "https://example.com/feed",
      { ...transportOptions, maxRedirects: 1 },
      publicResolver,
      requester,
    )).rejects.toThrow("redirect limit");
  });
});
