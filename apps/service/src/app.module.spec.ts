/**
 * The whole container has to resolve.
 *
 * Nest reports a missing or misspelled provider at boot, not at compile time,
 * so `tsc` and the unit suite both stay green while the API fails to start.
 * That is the failure mode of every module edit — adding a use case and
 * forgetting its provider, deleting a provider something still injects — and
 * nothing else here catches it. tenancy-coverage.spec.ts reads decorator
 * metadata off the controller classes; it never builds the graph.
 *
 * This compiles AppModule for real. No database or Redis connection is made:
 * Prisma and ioredis both connect lazily, so instantiating them is enough.
 */
describe("AppModule", () => {
    it("resolves every provider in the dependency graph", async () => {
        // Set before the dynamic import below, because config is read while the
        // module decorators evaluate. Local storage rather than GCS for the same
        // reason `make demo` uses it: the factory constructs a bucket client
        // eagerly and throws without a real bucket name.
        Object.assign(process.env, {
            DATABASE_URL:
                process.env.DATABASE_URL ??
                "postgresql://user:pass@localhost:5432/diligence_kit",
            JWT_SECRET: process.env.JWT_SECRET ?? "test-secret",
            AGENT_SECRET: process.env.AGENT_SECRET ?? "test-secret",
            WEBHOOK_SECRET: process.env.WEBHOOK_SECRET ?? "test-secret",
            STORAGE_DRIVER: "local",
        })

        const { Test } = await import("@nestjs/testing")
        const { AppModule } = await import("./app.module")

        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        }).compile()

        expect(moduleRef).toBeDefined()
        await moduleRef.close()
    }, 30000)
})
