// Reproducible public registry snapshot. No credentials, paid registry or retries.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve, relative, sep, basename } from "node:path"
import { createHash } from "node:crypto"

const root = resolve(import.meta.dirname, "..")
const pkg = join(root, "packages/reui")
const supplied = process.argv.indexOf("--from")
const scratch = supplied >= 0 ? resolve(process.argv[supplied + 1]) : mkdtempSync(join(tmpdir(), "reui-sync-"))
const names: string[] = JSON.parse(readFileSync(join(root, "registry-items.json"), "utf8"))
function run(args: string[]) {
  const result = Bun.spawnSync([process.execPath, ...args], { cwd: scratch, stdout: "inherit", stderr: "inherit" })
  if (result.exitCode) throw new Error(`Command failed (${result.exitCode}): bun ${args.join(" ")}`)
}
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])
}
try {
  if (supplied < 0) {
    mkdirSync(join(scratch, "src"))
    writeFileSync(join(scratch, "package.json"), JSON.stringify({ name: "reui-sync", private: true, type: "module", packageManager: "bun@1.4.4", overrides: { "@tanstack/react-virtual": ">=3.14.25 <3.14.26" } }))
    cpSync(join(root, "registry-config.json"), join(scratch, "components.json"))
    writeFileSync(join(scratch, "tsconfig.json"), JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }))
    writeFileSync(join(scratch, "src/index.css"), '@import "tailwindcss";\n')
    run(["add", "react", "react-dom"])
    run(["x", "--bun", "shadcn@4.23.0", "add", ...names.map(n => `@reui/${n}`), "--yes", "--overwrite"])
  }
  const source = join(scratch, "src/components/reui")
  const files = walk(source)
  for (const name of names) {
    if (!files.some(f => basename(f).replace(/\.tsx?$/, "") === name)) throw new Error(`Missing registry entry: ${name}`)
  }
  const versions = JSON.parse(readFileSync(join(scratch, "package.json"), "utf8")).dependencies
  const manifest = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8"))
  const dependencies: Record<string, string> = { "@nyssance/shadcn": "^4.23.4" }
  // Keep all registry-declared dependencies, including type-only imports.
  for (const [name, raw] of Object.entries(versions)) {
    if (["react", "react-dom"].includes(name)) continue
    const version = String(raw)
    dependencies[name] = /^[~^><*]/.test(version) ? version : `^${version}`
  }
  dependencies["lucide-react"] = "^1.66"
  const output = join(pkg, "src/vega/components/reui")
  rmSync(join(pkg, "src"), { recursive: true, force: true })
  mkdirSync(output, { recursive: true })
  cpSync(source, output, { recursive: true })
  // 3.14.26 currently requests unpublished virtual-core 3.19.11.
  if (dependencies["@tanstack/react-virtual"]) dependencies["@tanstack/react-virtual"] = ">=3.14.25 <3.14.26"
  manifest.dependencies = Object.fromEntries(Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(join(pkg, "package.json"), JSON.stringify(manifest, null, 2) + "\n")
  writeFileSync(join(pkg, "registry.json"), JSON.stringify({ upstreamVersion: manifest.version, versionSource: "https://github.com/keenthemes/reui/blob/main/package.json", registry: "https://reui.io/r/{style}/{name}.json", style: "base-vega", cli: "shadcn@4.23.0", items: names, files: Object.fromEntries(files.map(f => [relative(join(scratch, "src"), f).split(sep).join("/"), createHash("sha256").update(readFileSync(f)).digest("hex")])) }, null, 2) + "\n")
  console.log(`Synced ${names.length} registry entries, ${files.length} source files.`)
} finally {
  if (supplied < 0) rmSync(scratch, { recursive: true, force: true })
}
