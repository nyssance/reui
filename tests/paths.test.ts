import { expect, test } from "bun:test"
import { win32, posix } from "node:path"
import { relativeSpecifier } from "../scripts/paths"

test("Windows drive letters, spaces and Unicode produce portable imports", () => {
  expect(relativeSpecifier("C:\\项目 空格\\src\\grid\\table.tsx", "C:\\项目 空格\\src\\badge.tsx", win32)).toBe("../badge.tsx")
})
test("Windows UNC paths produce portable sibling imports", () => {
  expect(relativeSpecifier("\\\\server\\share\\src\\table.tsx", "\\\\server\\share\\src\\context.tsx", win32)).toBe("./context.tsx")
})
test("POSIX paths keep the same module identity", () => {
  expect(relativeSpecifier("/项目 空格/src/grid.tsx", "/项目 空格/src/context.tsx", posix)).toBe("./context.tsx")
})
