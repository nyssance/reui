import { expect, test } from "bun:test"

import { keepHigher, lowest } from "../scripts/ranges"

test("a range's lowest version fills in the parts it leaves out", () => {
  expect(lowest("^1.66")).toBe("1.66.0")
  expect(lowest("~3.14.26")).toBe("3.14.26")
  expect(lowest(">=2")).toBe("2.0.0")
  expect(lowest("1.9.0")).toBe("1.9.0")
})

test("a sync keeps a range the manifest already raised and takes the registry's otherwise", () => {
  expect(
    keepHigher(
      { "lucide-react": "^1.66", "date-fns": "^4.4.0", cn: "^0.5.2", "react-day-picker": "^10.0.2" },
      { "lucide-react": "^1.75.0", "date-fns": "^4.1.0", "react-day-picker": "^10.0.2" }
    )
  ).toEqual({
    // raised by a dependency refresh: kept
    "lucide-react": "^1.75.0",
    // the registry asks for more: taken
    "date-fns": "^4.4.0",
    // new to the manifest: taken
    cn: "^0.5.2",
    // the same: unchanged
    "react-day-picker": "^10.0.2"
  })
})
