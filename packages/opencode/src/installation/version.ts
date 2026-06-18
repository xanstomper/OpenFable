declare global {
  const OPENFABLE_VERSION: string
  const OPENFABLE_CHANNEL: string
}

export const InstallationVersion = typeof OPENFABLE_VERSION === "string" ? OPENFABLE_VERSION : "local"
export const InstallationChannel = typeof OPENFABLE_CHANNEL === "string" ? OPENFABLE_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
