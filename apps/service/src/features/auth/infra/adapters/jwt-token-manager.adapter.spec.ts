import * as jwt from "jsonwebtoken"
import { JwtTokenManagerAdapter } from "./jwt-token-manager.adapter"
import { User } from "@/shared/domain/entities/user.entity"

const SECRET = "test-secret-at-least-32-characters-long"

const user = {
    id: "user-1",
    email: "you@example.com",
    name: "Alice",
} as User

function manager(env: Record<string, string> = {}) {
    process.env.JWT_SECRET = SECRET
    process.env.JWT_EXPIRES_IN = env.JWT_EXPIRES_IN ?? "24h"
    process.env.JWT_REFRESH_EXPIRES_IN = env.JWT_REFRESH_EXPIRES_IN ?? "7d"
    return new JwtTokenManagerAdapter()
}

describe("JwtTokenManagerAdapter", () => {
    describe("round trip", () => {
        it("accepts an access token it issued", async () => {
            const m = manager()

            expect(await m.verifyAccessToken(await m.generate(user))).toEqual({
                id: "user-1",
                email: "you@example.com",
                name: "Alice",
            })
        })

        it("accepts a refresh token it issued", async () => {
            const m = manager()

            expect(
                await m.verifyRefreshToken(
                    await m.generateRefreshToken("rt-1"),
                ),
            ).toEqual({ refreshTokenId: "rt-1" })
        })
    })

    // Both token kinds are signed with the same secret and the same algorithm.
    // The `typ` claim is the only thing separating them, so these are the tests
    // that keep them apart.
    describe("token type confusion", () => {
        it("refuses a refresh token presented as a bearer credential", async () => {
            const m = manager()
            const refresh = await m.generateRefreshToken("rt-1")

            // It verifies cryptographically — that is exactly the danger.
            expect(jwt.verify(refresh, SECRET)).toBeTruthy()
            expect(await m.verifyAccessToken(refresh)).toBeNull()
        })

        it("refuses an access token presented for refresh", async () => {
            const m = manager()

            expect(
                await m.verifyRefreshToken(await m.generate(user)),
            ).toBeNull()
        })

        it("refuses a validly signed token carrying no type at all", async () => {
            const m = manager()
            const legacy = jwt.sign(
                { sub: "user-1", email: "you@example.com" },
                SECRET,
                {
                    algorithm: "HS256",
                },
            )

            expect(await m.verifyAccessToken(legacy)).toBeNull()
        })
    })

    describe("payloads that would authenticate nobody", () => {
        it("refuses an access token with no subject", async () => {
            const m = manager()
            // Downstream reads `undefined` as "no tenant filter", so a subjectless
            // token must never become a session.
            const noSub = jwt.sign(
                { typ: "access", email: "x@example.com" },
                SECRET,
                {
                    algorithm: "HS256",
                },
            )

            expect(await m.verifyAccessToken(noSub)).toBeNull()
        })

        it("refuses an access token whose subject is empty", async () => {
            const m = manager()
            const emptySub = jwt.sign({ typ: "access", sub: "" }, SECRET, {
                algorithm: "HS256",
            })

            expect(await m.verifyAccessToken(emptySub)).toBeNull()
        })

        it("refuses a refresh token with no token id", async () => {
            const m = manager()
            const noId = jwt.sign({ typ: "refresh" }, SECRET, {
                algorithm: "HS256",
            })

            expect(await m.verifyRefreshToken(noId)).toBeNull()
        })
    })

    describe("signature and algorithm", () => {
        it("refuses a token signed with another secret", async () => {
            const m = manager()
            const forged = jwt.sign(
                { sub: "user-1", typ: "access" },
                "a-different-secret",
                {
                    algorithm: "HS256",
                },
            )

            expect(await m.verifyAccessToken(forged)).toBeNull()
        })

        it("refuses an unsigned token claiming alg none", async () => {
            const m = manager()
            const unsigned = jwt.sign({ sub: "user-1", typ: "access" }, "", {
                algorithm: "none",
            })

            expect(await m.verifyAccessToken(unsigned)).toBeNull()
        })

        it("refuses a tampered payload", async () => {
            const m = manager()
            const [header, , signature] = (await m.generate(user)).split(".")
            const forgedPayload = Buffer.from(
                JSON.stringify({ sub: "someone-else", typ: "access" }),
            ).toString("base64url")

            expect(
                await m.verifyAccessToken(
                    `${header}.${forgedPayload}.${signature}`,
                ),
            ).toBeNull()
        })

        it("refuses malformed input rather than throwing", async () => {
            const m = manager()

            for (const bad of ["", "not-a-token", "a.b.c"]) {
                expect(await m.verifyAccessToken(bad)).toBeNull()
            }
        })
    })

    describe("expiry", () => {
        it("refuses an expired access token", async () => {
            const m = manager()

            expect(
                await m.verifyAccessToken(await m.generate(user, "-1s")),
            ).toBeNull()
        })

        it("refuses an expired refresh token", async () => {
            const m = manager()

            expect(
                await m.verifyRefreshToken(
                    await m.generateRefreshToken("rt-1", "-1s"),
                ),
            ).toBeNull()
        })

        it("gives refresh tokens their own lifetime, not the access default", async () => {
            // Sharing the 24h access default would expire the JWT six days before
            // the refresh_tokens row it belongs to.
            const m = manager({
                JWT_EXPIRES_IN: "1h",
                JWT_REFRESH_EXPIRES_IN: "7d",
            })

            const access = jwt.decode(await m.generate(user)) as jwt.JwtPayload
            const refresh = jwt.decode(
                await m.generateRefreshToken("rt-1"),
            ) as jwt.JwtPayload

            expect(access.exp! - access.iat!).toBe(60 * 60)
            expect(refresh.exp! - refresh.iat!).toBe(7 * 24 * 60 * 60)
        })
    })
})
