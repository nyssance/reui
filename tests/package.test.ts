import { expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, relative, resolve } from "node:path"

import { build, normalizePath } from "vite"

import { reui as shadcn } from "../packages/reui/dist/vite.js"

const pkg = resolve(import.meta.dirname, "../packages/reui")
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
  )
}

test("every ReUI source has built JS and declarations with resolved imports", async () => {
  for (const source of walk(join(pkg, "src/vega")).filter(f => /\.tsx?$/.test(f))) {
    const name = relative(join(pkg, "src/vega"), source).split(/[\\/]/).join("/").replace(/\.tsx?$/, "")
    const js = readFileSync(join(pkg, "dist/vega", name + ".js"), "utf8")
    const dts = readFileSync(join(pkg, "dist/vega", name + ".d.ts"), "utf8")
    expect(js).not.toMatch(/["']@\//)
    expect(dts).not.toMatch(/["']@\//)
    expect(js).not.toContain("react/jsx-dev-runtime")
    await import(`@nyssance/reui/vega/${name}`)
  }
})

test("the vite plugin prefers the application's own file, then the package", async () => {
  const app = mkdtempSync(join(tmpdir(), "shadcn-app-"))
  try {
    mkdirSync(join(app, "src/components/ui"), { recursive: true })
    writeFileSync(join(app, "src/components/ui/button.tsx"), "export const Button = 1\n")
    const plugin = shadcn({ style: "vega", src: join(app, "src") })
    const requests: string[] = []
    const context = {
      resolve: async (id: string) => {
        requests.push(id)
        return { id: `/resolved/${id}` }
      }
    }
    const resolveId = plugin.resolveId as (this: unknown, id: string, importer?: string, options?: object) => unknown
    expect(await resolveId.call(context, "@/components/ui/button", undefined, {})).toBe(
      normalizePath(join(app, "src/components/ui/button.tsx"))
    )
    expect(await resolveId.call(context, "@/components/reui/badge", undefined, {})).toEqual({
      id: "/resolved/@nyssance/reui/vega/components/reui/badge"
    })
    mkdirSync(join(app, "src/components/icons"), { recursive: true })
    writeFileSync(join(app, "src/components/icons/logo.svg"), "<svg/>\n")
    expect(await resolveId.call(context, "@/components/icons/logo.svg?react", undefined, {})).toBe(
      `${normalizePath(join(app, "src/components/icons/logo.svg"))}?react`
    )
    expect(await resolveId.call(context, "react", undefined, {})).toBeNull()
    expect(requests).toEqual(["@nyssance/reui/vega/components/reui/badge"])
  } finally {
    rmSync(app, { recursive: true, force: true })
  }
})

test("the dependency scan sees the package specifier the dev server resolves", async () => {
  const app = mkdtempSync(join(tmpdir(), "shadcn-app-"))
  try {
    mkdirSync(join(app, "src/components/ui"), { recursive: true })
    writeFileSync(join(app, "src/components/ui/button.tsx"), "export const Button = 1\n")
    mkdirSync(join(app, "node_modules/@nyssance"), { recursive: true })
    symlinkSync(pkg, join(app, "node_modules/@nyssance/reui"), "junction")
    const plugin = shadcn({ style: "vega", src: join(app, "src") })
    const config = (plugin.config as () => { optimizeDeps: { rolldownOptions: { plugins: { resolveId: Function }[] } } })()
    const [scan] = config.optimizeDeps.rolldownOptions.plugins
    const requests: string[] = []
    const context = {
      resolve: async (id: string) => {
        requests.push(id)
        return { id, external: true }
      }
    }
    expect(await scan.resolveId.call(context, "@/components/reui/badge", "/app/src/main.tsx", {})).toEqual({
      id: "@nyssance/reui/vega/components/reui/badge",
      external: true
    })
    // The application's own file and paths the package does not ship stay with the regular resolver.
    expect(await scan.resolveId.call(context, "@/components/ui/button", "/app/src/main.tsx", {})).toBeNull()
    expect(await scan.resolveId.call(context, "@/features/missing", "/app/src/main.tsx", {})).toBeNull()
    expect(await scan.resolveId.call(context, "react", "/app/src/main.tsx", {})).toBeNull()
    expect(requests).toEqual(["@nyssance/reui/vega/components/reui/badge"])
  } finally {
    rmSync(app, { recursive: true, force: true })
  }
})

test("alias and relative imports share the same store in a Vite build", async () => {
  const app = realpathSync(mkdtempSync(join(tmpdir(), "shadcn-store-")))
  try {
    const src = join(app, "src")
    mkdirSync(src)
    writeFileSync(join(src, "store.ts"), "export const state = { loading: true }\n")
    writeFileSync(join(src, "gate.ts"), 'import { state } from "./store"; export const loading = () => state.loading\n')
    writeFileSync(
      join(src, "main.ts"),
      'import { state } from "@/store"; import { loading } from "./gate"; state.loading = false; export const stuck = loading()\n'
    )
    const result = await build({
      configFile: false,
      root: app,
      logLevel: "silent",
      plugins: [shadcn({ style: "vega", src })],
      build: { lib: { entry: join(src, "main.ts"), formats: ["es"] }, write: false, minify: false }
    })
    const output = Array.isArray(result) ? result[0] : result
    if (!("output" in output)) throw new Error("Expected build output")
    const entry = output.output.find((output) => output.type === "chunk" && output.isEntry)
    if (!entry || entry.type !== "chunk") throw new Error("Missing entry chunk")
    expect(Object.keys(entry.modules).filter((id) => id.endsWith("store.ts"))).toHaveLength(1)
    const module = await import(`data:text/javascript;base64,${Buffer.from(entry.code).toString("base64")}`)
    expect(module.stuck).toBe(false)
  } finally {
    rmSync(app, { recursive: true, force: true })
  }
})

test("registry snapshot covers every allowlisted entry without shadcn copies", () => {
  const names: string[] = JSON.parse(readFileSync(resolve(pkg, "../../registry-items.json"), "utf8"))
  const sources = walk(join(pkg, "src/vega"))
  expect(sources).toHaveLength(names.length)
  for (const name of names) expect(sources.some(f => f.endsWith(`/` + name + ".tsx") || f.endsWith(`\\` + name + ".tsx"))).toBe(true)
  expect(sources.every(f => f.includes("reui"))).toBe(true)
})

test("grid submodules import their shared context instead of embedding a copy", () => {
  const table = readFileSync(join(pkg, "dist/vega/components/reui/data-grid/data-grid-table.js"), "utf8")
  expect(table).toContain('from "./data-grid.js"')
  expect(table).not.toContain("createContext(")
})
