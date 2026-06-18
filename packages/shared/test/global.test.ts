import { describe, expect, test } from "bun:test"
import path from "path"
import { resolveMimocodeHome } from "@openfable/shared/global"

describe("resolveMimocodeHome", () => {
  test("with OPENFABLE_HOME set, resolves 4 subdirs under root", () => {
    const result = resolveMimocodeHome({
      OPENFABLE_HOME: "/tmp/profile-a",
    })
    expect(result.mode).toBe("mimocode_home")
    expect(result.root).toBe("/tmp/profile-a")
    expect(result.config).toBe(path.join("/tmp/profile-a", "config"))
    expect(result.data).toBe(path.join("/tmp/profile-a", "data"))
    expect(result.state).toBe(path.join("/tmp/profile-a", "state"))
    expect(result.cache).toBe(path.join("/tmp/profile-a", "cache"))
  })

  test("without OPENFABLE_HOME, falls through to xdg mode", () => {
    const result = resolveMimocodeHome({})
    expect(result.mode).toBe("xdg")
    expect(result.root).toBeUndefined()
    // xdg paths end with "/openfable"
    expect(result.config.endsWith(path.join("", "openfable"))).toBe(true)
    expect(result.data.endsWith(path.join("", "openfable"))).toBe(true)
    expect(result.state.endsWith(path.join("", "openfable"))).toBe(true)
    expect(result.cache.endsWith(path.join("", "openfable"))).toBe(true)
  })

  test("empty OPENFABLE_HOME string is treated as unset (xdg mode)", () => {
    const result = resolveMimocodeHome({ OPENFABLE_HOME: "" })
    expect(result.mode).toBe("xdg")
  })

  test("relative OPENFABLE_HOME path throws with clear error", () => {
    expect(() => resolveMimocodeHome({ OPENFABLE_HOME: "./foo" })).toThrow(
      /OPENFABLE_HOME must be an absolute path/,
    )
    expect(() => resolveMimocodeHome({ OPENFABLE_HOME: "foo/bar" })).toThrow(
      /OPENFABLE_HOME must be an absolute path/,
    )
  })

  test("tilde-prefixed OPENFABLE_HOME throws (not treated as absolute)", () => {
    expect(() => resolveMimocodeHome({ OPENFABLE_HOME: "~/profiles/a" })).toThrow(
      /OPENFABLE_HOME must be an absolute path/,
    )
  })

  test("error message includes the offending value", () => {
    expect(() => resolveMimocodeHome({ OPENFABLE_HOME: "./relative" })).toThrow(
      /\.\/relative/,
    )
  })
})
