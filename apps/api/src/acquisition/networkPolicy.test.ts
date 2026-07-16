/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Acquisition Network Policy Tests
 * Introduction: Verifies exact origins, schemes, credentials, public addresses, fixture loopback, headers, and routing boundaries.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import { describe,expect,it } from "vitest"; import { assertAddress,locatorUrl,sanitizeHeaders,validateTarget } from "./networkPolicy.js";
describe("acquisition network policy",()=>{it.each(["127.0.0.1","10.0.0.1","169.254.169.254","224.0.0.1","::1","fc00::1","fe80::1","ff02::1"])("rejects non-public address %s",address=>expect(()=>assertAddress(address,false)).toThrow(/public/));it("permits only exact fixture loopback",()=>{expect(()=>assertAddress("127.0.0.1",true)).not.toThrow();expect(()=>assertAddress("8.8.8.8",true)).toThrow(/Fixture/)});it("rejects credential and unsafe route authority",()=>{expect(()=>locatorUrl({mode:"PUBLIC",scheme:"https",host:"user:pass@example.com",port:443,relativeRoute:"/"})).toThrow();expect(()=>locatorUrl({mode:"PUBLIC",scheme:"https",host:"example.com",port:443,relativeRoute:"//evil.test"})).toThrow()});it("rejects redirect origin escape before network use",async()=>{await expect(validateTarget("https://evil.test/",{mode:"PUBLIC",scheme:"https",host:"example.com",port:443,relativeRoute:"/"})).rejects.toThrow(/origin/)});it("removes credentials and cookies from persisted headers",()=>expect(sanitizeHeaders({Authorization:"secret",Cookie:"x", "Set-Cookie":"y","Content-Type":"text/html"})).toEqual({"content-type":"text/html"}))});
