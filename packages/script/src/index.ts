import { $ } from "bun"
import semver from "semver"
import path from "path"

const rootPkgPath = path.resolve(import.meta.dir, "../../../package.json")
const rootPkg = await Bun.file(rootPkgPath).json()
const expectedBunVersion = rootPkg.packageManager?.split("@")[1]

if (!expectedBunVersion) {
  throw new Error("packageManager field not found in root package.json")
}

// relax version requirement
const expectedBunVersionRange = `^${expectedBunVersion}`

if (!semver.satisfies(process.versions.bun, expectedBunVersionRange)) {
  throw new Error(`This script requires bun@${expectedBunVersionRange}, but you are using bun@${process.versions.bun}`)
}

const env = {
  OPENFABLE_CHANNEL: process.env["OPENFABLE_CHANNEL"],
  OPENFABLE_BUMP: process.env["OPENFABLE_BUMP"],
  OPENFABLE_VERSION: process.env["OPENFABLE_VERSION"],
  OPENFABLE_RELEASE: process.env["OPENFABLE_RELEASE"],
}
const CHANNEL = await (async () => {
  if (env.OPENFABLE_CHANNEL) return env.OPENFABLE_CHANNEL
  if (env.OPENFABLE_BUMP) return "latest"
  if (env.OPENFABLE_VERSION && !env.OPENFABLE_VERSION.startsWith("0.0.0-")) return "latest"
  return await $`git branch --show-current`.text().then((x) => x.trim()) || "latest"
})()
const IS_PREVIEW = CHANNEL !== "latest"

const VERSION = await (async () => {
  if (env.OPENFABLE_VERSION) return env.OPENFABLE_VERSION
  if (IS_PREVIEW) return `0.0.0-${CHANNEL}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`
  const version = await Bun.file(path.resolve(import.meta.dir, "../../opencode/package.json"))
    .json()
    .then((data: any) => data.version)
  const t = env.OPENFABLE_BUMP?.toLowerCase()
  if (!t) return version
  const [major, minor, patch] = version.split(".").map((x: string) => Number(x) || 0)
  if (t === "major") return `${major + 1}.0.0`
  if (t === "minor") return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
})()

export const Script = {
  get channel() {
    return CHANNEL
  },
  get version() {
    return VERSION
  },
  get preview() {
    return IS_PREVIEW
  },
  get release(): boolean {
    return !!env.OPENFABLE_RELEASE
  },
}
console.log(`openfable script`, JSON.stringify(Script, null, 2))
