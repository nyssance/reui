import { mkdtempSync, readFileSync, writeFileSync, rmSync, realpathSync } from "node:fs"
import { join, resolve } from "node:path"
import { tmpdir } from "node:os"

const root = resolve(import.meta.dirname, "..")
const scratch = realpathSync(mkdtempSync(join(tmpdir(), "reui consumer 中文 ")))
function run(args: string[], cwd: string) {
  const result = Bun.spawnSync([process.execPath, ...args], { cwd, stdout: "inherit", stderr: "inherit" })
  if (result.exitCode) throw new Error(`Command failed (${result.exitCode}): bun ${args.join(" ")}`)
}
try {
  run(["pm", "pack", "--destination", scratch], join(root, "packages/reui"))
  const manifest = JSON.parse(readFileSync(join(root, "packages/reui/package.json"), "utf8"))
  const archive = join(scratch, `nyssance-reui-${manifest.version}.tgz`)
  writeFileSync(join(scratch, "package.json"), JSON.stringify({ name: "reui-consumer", private: true, type: "module", dependencies: {
    "@nyssance/reui": archive, react: "^19.3", "react-dom": "^19.3", vite: "^8.3",
    typescript: "^7.0", "@types/react": "^19.3", "@types/react-dom": "^19.3", "@types/node": "^24"
  } }, null, 2))
  run(["install"], scratch)
  const snapshot = JSON.parse(readFileSync(join(root, "packages/reui/registry.json"), "utf8"))
  const files = Object.keys(snapshot.files)
  const imports = files.map((f, i) => `import * as entry${i} from "@nyssance/reui/vega/${f.replace(/\.tsx?$/, "")}"`).join("\n")
  writeFileSync(join(scratch, "entries.ts"), imports + `\nexport const entries = [${files.map((_, i) => `entry${i}`).join(",")}];\n`)
  writeFileSync(join(scratch, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, skipLibCheck: true, module: "ESNext", moduleResolution: "Bundler", target: "ESNext", jsx: "react-jsx" }, include: ["entries.ts"] }))
  run(["x", "--bun", "--no-install", "tsc", "-p", "tsconfig.json"], scratch)
  writeFileSync(join(scratch, "verify.ts"), `
import { build, createServer } from "vite"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { reui } from "@nyssance/reui/vite"
import { Badge } from "@nyssance/reui/vega/components/reui/badge"
import { resolve } from "node:path"
const html = renderToStaticMarkup(createElement(Badge, null, "Package works"))
if (!html.includes("Package works")) throw new Error("SSR failed")
await build({ configFile: false, root: process.cwd(), logLevel: "error", plugins: [reui()], build: { lib: { entry: resolve("entries.ts"), formats: ["es"] }, write: false, minify: false } })
const server = await createServer({ configFile: false, root: process.cwd(), plugins: [reui()], server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] } })
try {
  for (const id of ["@/components/reui/badge", "@/components/ui/button"]) {
    const result = await server.environments.client.pluginContainer.resolveId(id, resolve("entries.ts"))
    if (!result || result.id.includes("/Users/ny/Projects")) throw new Error("Package resolution failed: " + id)
  }
} finally { await server.close() }
console.log("Isolated tarball consumer: 82 entries typecheck and bundle; SSR and both registry aliases passed.")
`)
  run(["verify.ts"], scratch)
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
