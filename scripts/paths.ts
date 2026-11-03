import path from "node:path"

/** Filesystem paths stay native; emitted ESM specifiers always use forward slashes. */
export function relativeSpecifier(from: string, to: string, paths = path): string {
  const value = paths.relative(paths.dirname(from), to).split(paths.sep).join("/")
  return value.startsWith(".") ? value : `./${value}`
}
