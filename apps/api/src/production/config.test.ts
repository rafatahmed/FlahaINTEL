/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Production Config Tests
 * Introduction: Fail-closed production configuration validation.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

import { describe, expect, it, afterEach } from "vitest";
import { loadProductionConfig, ProductionConfigError, resetProductionConfigCache } from "./config.js";

afterEach(() => {
  resetProductionConfigCache();
});

describe("production config", () => {
  it("allows development defaults", () => {
    const cfg = loadProductionConfig({
      NODE_ENV: "development",
      AUTH_MODE: "development",
      API_HOST: "127.0.0.1",
    });
    expect(cfg.isProduction).toBe(false);
    expect(cfg.host).toBe("127.0.0.1");
  });

  it("rejects public API bind", () => {
    expect(() =>
      loadProductionConfig({
        NODE_ENV: "production",
        AUTH_MODE: "production",
        API_HOST: "0.0.0.0",
        DATABASE_URL: "postgresql://u:p@localhost:5432/db",
        FLAHA_SESSION_SECRET: "abcdefghijklmnopqrstuvwxyz0123456789",
        ARTIFACT_STORE_ROOT: "C:\\tmp\\artifacts",
        WEB_ORIGIN: "https://intel.example.com",
      }),
    ).toThrow(ProductionConfigError);
  });

  it("rejects default session secret in production", () => {
    expect(() =>
      loadProductionConfig({
        NODE_ENV: "production",
        AUTH_MODE: "production",
        API_HOST: "127.0.0.1",
        DATABASE_URL: "postgresql://u:p@localhost:5432/db",
        FLAHA_SESSION_SECRET: "flaha-intel-dev-session-secret-change-me",
        ARTIFACT_STORE_ROOT: "C:\\tmp\\artifacts",
        WEB_ORIGIN: "https://intel.example.com",
      }),
    ).toThrow(/FLAHA_SESSION_SECRET|default or weak/i);
  });

  it("rejects mismatched artifact roots", () => {
    expect(() =>
      loadProductionConfig({
        NODE_ENV: "development",
        ARTIFACT_STORE_ROOT: "C:\\a",
        FLAHA_ARTIFACT_ROOT: "C:\\b",
      }),
    ).toThrow(/same path/i);
  });

  it("accepts strict production config", () => {
    const cfg = loadProductionConfig({
      NODE_ENV: "production",
      AUTH_MODE: "production",
      API_HOST: "127.0.0.1",
      DATABASE_URL: "postgresql://u:p@localhost:5432/db",
      FLAHA_SESSION_SECRET: "abcdefghijklmnopqrstuvwxyz0123456789!@#",
      ARTIFACT_STORE_ROOT: "C:\\tmp\\artifacts",
      FLAHA_ARTIFACT_ROOT: "C:\\tmp\\artifacts",
      WEB_ORIGIN: "https://intel.example.com",
      CORS_ORIGINS: "https://intel.example.com",
    });
    expect(cfg.isProduction).toBe(true);
    expect(cfg.sessionTtlSeconds).toBeGreaterThan(0);
  });
});
