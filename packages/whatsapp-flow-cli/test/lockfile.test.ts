import { describe, expect, it } from "vitest";
import type { FlowsAppConfig } from "whatsapp-flow-tsx";
import { isLegacyLock, type LegacyLockfile, migrateLockV1ToV2 } from "../src/lockfile.ts";

const legacy: LegacyLockfile = {
  version: 1,
  wabas: {
    "2142644013223594": {
      woolworths_connect: { id: "4436671666579089", rev: 3, hash: "a", kind: "flow" },
    },
    "26870122239247230": {
      woolworths_connect: { id: "2084824509097488", rev: 2, hash: "b", kind: "flow" },
    },
    "99999999999999999": {
      orphan_flow: { id: "1", rev: 1, hash: "c", kind: "flow" },
    },
  },
};

const app: FlowsAppConfig = {
  wabas: {
    dev: { id: "2142644013223594" },
    prod: { id: "26870122239247230" },
  },
  defaultEnv: "dev",
};

describe("isLegacyLock", () => {
  it("recognizes v1 by version", () => {
    expect(isLegacyLock({ version: 1, wabas: {} })).toBe(true);
  });
  it("recognizes v1 by shape (wabas, no envs)", () => {
    expect(isLegacyLock({ wabas: {} })).toBe(true);
  });
  it("rejects v2", () => {
    expect(isLegacyLock({ version: 2, envs: {} })).toBe(false);
  });
});

describe("migrateLockV1ToV2", () => {
  it("rekeys WABA ids to env names from the config", () => {
    const { lock } = migrateLockV1ToV2(legacy, app);
    expect(lock.version).toBe(2);
    expect(Object.keys(lock.envs).sort()).toEqual(["dev", "prod"]);
    expect(lock.envs.dev!.wabaId).toBe("2142644013223594");
    expect(lock.envs.dev!.assets.woolworths_connect!.id).toBe("4436671666579089");
    expect(lock.envs.prod!.assets.woolworths_connect!.id).toBe("2084824509097488");
  });

  it("drops WABAs not present in the config and reports them", () => {
    const { lock, dropped } = migrateLockV1ToV2(legacy, app);
    expect(dropped).toEqual(["99999999999999999"]);
    expect(lock.envs).not.toHaveProperty("99999999999999999");
  });
});
