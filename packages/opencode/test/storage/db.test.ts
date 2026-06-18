import { describe, expect, test } from "bun:test"
import path from "path"
import { Global } from "../../src/global"
import { InstallationChannel } from "../../src/installation/version"
import { Flag } from "../../src/flag/flag"
import { Database } from "../../src/storage"

describe("Database.Path", () => {
  test("returns database path for the current channel", () => {
    const expected =
      ["latest", "beta", "prod"].includes(InstallationChannel) || Flag.OPENFABLE_DISABLE_CHANNEL_DB
        ? path.join(Global.Path.data, "openfable.db")
        : path.join(Global.Path.data, `openfable-${InstallationChannel.replace(/[^a-zA-Z0-9._-]/g, "-")}.db`)
    expect(Database.getChannelPath()).toBe(expected)
  })
})
