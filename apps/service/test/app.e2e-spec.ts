import { INestApplication } from "@nestjs/common"
import { Test, TestingModule } from "@nestjs/testing"
import * as request from "supertest"
import { App } from "supertest/types"

import { AppModule } from "./../src/app.module"

/**
 * The two things worth asserting over a real HTTP server.
 *
 * This file used to be the unmodified Nest scaffold, asserting that `GET /`
 * returns "Hello World!" — there has never been a root controller. It was
 * excluded from `pnpm test` by the jest config's rootDir, so nothing ever ran
 * it and nothing ever caught that it could not pass.
 */
describe("The service over HTTP", () => {
    let app: INestApplication<App>

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile()

        app = moduleFixture.createNestApplication()
        await app.init()
    })

    afterAll(async () => {
        await app?.close()
    })

    it("reports its health without touching auth", () => {
        return request(app.getHttpServer())
            .get("/health")
            .expect(200)
            .expect((response) => {
                const body = response.body as { status?: string }
                expect(body.status).toBe("ok")
            })
    })

    it("refuses an unauthenticated read of a company", () => {
        // 401 rather than 200-with-nothing. The whole tenancy model rests on
        // authenticated routes being unreachable without a token.
        return request(app.getHttpServer()).get("/company").expect(401)
    })
})
