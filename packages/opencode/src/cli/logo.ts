// Claude Clawd character (from claude-code)
const CLAWD = [
  " ▐▛███▜▌ ",
  "▝▜█████▛▘",
  " ▘▘ ▝▝ ",
]

const OPENFABLE = [
  "",
  "░█▀▀▀█ ░█▀▀█ ░█▀▀▀ ░█▄  █ ░█▀▀▀ ░█▀▀█ ░█▀▀█ ░█    ░█▀▀▀ ",
  "░█   █ ░█▄▄█ ░█▀▀▀ ░█ █ █ ░█▀▀▀ ░█▄▄█ ░█▀▀▄ ░█    ░█▀▀▀ ",
  "░█▄▄▄█ ░█    ░█▄▄▄ ░█  ▀█ ░█    ░█  █ ░█▄▄█ ░█▄▄▄ ░█▄▄▄",
]

export const logo = {
  left: CLAWD,
  right: OPENFABLE,
}

export const logoThin = {
  left: Array(3).fill(""),
  right: OPENFABLE,
}

export const logos = {
  thin: logoThin,
  classic: logo,
} as const

export type LogoKey = keyof typeof logos

export const go = {
  left: Array(4).fill(""),
  right: ["█▀▀█", "█  █", "▀▀▀▀", ""],
}

export const marks = "_^~,"

export { OPENFABLE as openfable }