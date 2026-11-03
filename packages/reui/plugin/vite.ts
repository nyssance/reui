import { shadcn, type ShadcnOptions } from "@nyssance/shadcn/vite"

export type ReuiOptions = Omit<ShadcnOptions, "style"> & { style?: "vega" }

/** Local overrides first, ReUI second, shadcn third. Uses the shared Windows-safe resolver. */
export function reui(options: ReuiOptions = {}) {
  return shadcn({ ...options, style: options.style ?? "vega",
    packages: options.packages ?? ["@nyssance/reui", "@nyssance/shadcn"] })
}
