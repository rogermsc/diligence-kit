import { describe, expect, it } from "vitest"

import { expiresAt } from "./auth-server"

/**
 * Reading the expiry out of an access token is what decides whether a session
 * is renewed or dropped. Get it wrong in the lenient direction and every
 * request 401s; get it wrong in the strict direction and every request burns a
 * refresh, rotating the token and racing itself.
 *
 * This is not verification — the backend checks the signature. These tokens are
 * unsigned on purpose, to make that impossible to confuse.
 */
function token(payload: object): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
  return `${encode({ alg: "HS256" })}.${encode(payload)}.signature`
}

describe("expiresAt", () => {
  it("reads the expiry from a well-formed token", () => {
    expect(expiresAt(token({ sub: "u1", exp: 1893456000 }))).toBe(1893456000)
  })

  it("survives base64url payloads containing - and _", () => {
    // A payload whose base64 lands on the URL-safe alphabet decodes to nothing
    // under plain base64, which would read as "no expiry" and refresh forever.
    const exp = 1893456000
    for (let i = 0; i < 200; i++) {
      const jwt = token({ exp, sub: `user-${i}`, scope: `a~b?c/d+e${i}` })
      expect(expiresAt(jwt)).toBe(exp)
    }
  })

  it("returns null for a token with no expiry claim", () => {
    expect(expiresAt(token({ sub: "u1" }))).toBeNull()
  })

  it("returns null rather than throwing on junk", () => {
    // A malformed cookie must not take down every API route.
    for (const junk of ["", "not-a-jwt", "a.b", "a.!!!.c", "..", "a..c"]) {
      expect(expiresAt(junk)).toBeNull()
    }
  })

  it("ignores a non-numeric exp", () => {
    expect(expiresAt(token({ exp: "soon" }))).toBeNull()
  })
})
