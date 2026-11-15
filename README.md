# @nyssance/reui

ReUI's public MIT primitives for **Base UI + Vega**, packaged as individual ESM modules with TypeScript declarations. Unofficial packaging; component implementation remains upstream ReUI.

Install only this package: it brings `@nyssance/shadcn` as a dependency for the foundation components. This is an extension of shadcn, not a second copy of the foundation library.

```sh
bun add @nyssance/reui
```

Use direct imports (official directory layout):

```tsx
import { DataGrid } from "@nyssance/reui/vega/components/reui/data-grid/data-grid"
import { Button } from "@nyssance/shadcn/vega/components/ui/button"
```

Or use official examples' `@/` imports through the shared Vite resolver:

```ts
// vite.config.ts
import { defineConfig } from "vite"
import { reui } from "@nyssance/reui/vite"

export default defineConfig({ plugins: [reui()] })
```

The resolver checks your `src` first, then ReUI, then shadcn. Replace a broad `@` Vite alias with this plugin; do not register both `shadcn()` and `reui()`. Existing local files override package components. TypeScript also needs fallback paths:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": [
        "./src/*",
        "./node_modules/@nyssance/reui/dist/vega/*",
        "./node_modules/@nyssance/shadcn/dist/vega/*"
      ]
    }
  }
}
```

Use your existing shadcn theme and Tailwind 4 setup. Add package sources to your application CSS so Tailwind emits the component utilities (paths are relative to your CSS file):

```css
@source "../node_modules/@nyssance/reui/dist";
@source "../node_modules/@nyssance/shadcn/dist";
```

The package deliberately does not install a competing theme. Copy any component-specific CSS from the official docs when documented there.

## Scope and licensing

The allowlist is `registry-items.json`: 82 public registry entries including submodules, not 82 distinct top-level widgets. Includes data grid, filters, kanban, tree, date selector, event calendar, gantt, code block and other primitives. Does not include the example catalog, Pro blocks, icons or templates. Only Base UI Vega is currently generated.

Packaging: MIT, copyright nyssance. ReUI sources: MIT, copyright Keenthemes Inc; see `REUI-LICENSE` and `THIRD_PARTY_NOTICES.md`. `registry.json` records file hashes and source registry; installed sources are retained for review. This project is not affiliated with Keenthemes.

## Versioning

The package version follows the current upstream ReUI `package.json` version (2.8.1 for this registry snapshot), not the older Git tags or the shadcn CLI version. This remains an unofficial Base UI Vega registry package.

## Development

Requires Bun 1.4 and Node-compatible tooling, React 19, Vite 8 for the optional plugin.

```sh
bun install
bun run sync
bun run build
bun test
bun run verify:package
cd packages/reui
bun pm pack
```

`sync` uses the official shadcn CLI and an explicit public-component allowlist. It fails on errors; it does not retry or access paid registries. Review source and dependency changes before release. Building never downloads component source.

Windows paths use native filesystem operations and forward slashes only for ESM module specifiers. The Vite resolver reuses `@nyssance/shadcn` >=4.23.4's fix for duplicate module identity on Windows and preserves `?url`, `?react` and `?worker`. No shell globbing, POSIX copy commands or raw filesystem paths in dynamic imports are required by the build.

CI verifies every push. Releases: bump `packages/reui/package.json`, push tag `v<version>`; CI publishes with npm trusted publishing (workflow `publish.yml`, environment `npm`).

### Validation status

Local macOS validation: all 82 source modules import successfully; declarations compile; Vite builds an isolated tarball consumer; SSR and registry alias resolution pass. Windows drive-letter, UNC, Unicode and space-containing paths are covered by path regression tests. A native Windows build has not yet been run. Releases are published locally; no CI is required.
