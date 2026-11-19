/** The lowest version a range admits: `^1.66` is `1.66.0`. */
export function lowest(range: string): string {
  const parts = range.replace(/^[~^>=<\s]+/, "").split(".")
  while (parts.length < 3) parts.push("0")
  return parts.join(".")
}

/**
 * The ranges a sync writes: what the registry declares, except where the manifest already asks for
 * more. A dependency refresh raises ranges in the manifest, and a sync never lowers one back.
 */
export function keepHigher(
  declared: Record<string, string>,
  current: Record<string, string> = {}
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(declared).map(([name, range]) => {
      const held = current[name]
      return [name, held !== undefined && Bun.semver.order(lowest(held), lowest(range)) > 0 ? held : range]
    })
  )
}
