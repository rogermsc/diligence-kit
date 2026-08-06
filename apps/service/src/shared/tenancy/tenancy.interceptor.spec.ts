import {
    ExecutionContext,
    ForbiddenException,
    BadRequestException,
} from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { TenancyInterceptor } from "./tenancy.interceptor"
import {
    TENANCY_KEY,
    TenancyRule,
    NoTenancy,
    Tenancy,
} from "./tenancy.decorator"
import { OwnershipService } from "@/shared/services/ownership.service"

function contextFor(
    request: Record<string, unknown>,
    rule?: TenancyRule | { none: string },
): ExecutionContext {
    const handler = function handler() {}
    if (rule) Reflect.defineMetadata(TENANCY_KEY, rule, handler)

    return {
        getType: () => "http",
        switchToHttp: () => ({ getRequest: () => request }),
        getHandler: () => handler,
        getClass: () => class Controller {},
    } as unknown as ExecutionContext
}

function guardWith(ownership: Partial<OwnershipService>) {
    return new TenancyInterceptor(
        new Reflector(),
        ownership as OwnershipService,
    )
}

const NEXT = { handle: () => "handled" } as never

/** The interceptor allows by returning the downstream handler. */
const run = (i: TenancyInterceptor, ctx: ExecutionContext) =>
    i.intercept(ctx, NEXT)

const notFound = () => Promise.reject(new Error("not found"))
const owned = () => Promise.resolve()

describe("TenancyInterceptor", () => {
    describe("deny by default", () => {
        it("refuses an authenticated route that declares nothing", async () => {
            // The whole reason this is a guard: forgetting used to be silent.
            const guard = guardWith({})

            await expect(
                run(guard, contextFor({ user: { id: "alice" }, params: {} })),
            ).rejects.toBeInstanceOf(ForbiddenException)
        })

        it("allows a route with no authenticated user", async () => {
            // Agent webhooks and login carry their own guards and have no tenant.
            const guard = guardWith({})

            await expect(run(guard, contextFor({ params: {} }))).resolves.toBe(
                "handled",
            )
        })

        it("allows a route that declares it reaches no record", async () => {
            const guard = guardWith({})

            await expect(
                run(
                    guard,
                    contextFor(
                        { user: { id: "alice" }, params: {} },
                        { none: "listing" },
                    ),
                ),
            ).resolves.toBe("handled")
        })
    })

    describe("checking ownership", () => {
        it("passes the route param to the matching check", async () => {
            const assertCompanyOwned = jest.fn(owned)
            const guard = guardWith({ assertCompanyOwned })

            await run(
                guard,
                contextFor(
                    { user: { id: "alice" }, params: { companyId: "c-1" } },
                    { company: "param:companyId" },
                ),
            )

            expect(assertCompanyOwned).toHaveBeenCalledWith("c-1", "alice")
        })

        it("refuses when the record is not the caller's", async () => {
            const guard = guardWith({
                assertAutomationOwned: jest.fn(notFound),
            })

            await expect(
                run(
                    guard,
                    contextFor(
                        {
                            user: { id: "mallory" },
                            params: { automationId: "a-1" },
                        },
                        { automation: "param:automationId" },
                    ),
                ),
            ).rejects.toThrow("not found")
        })

        it("reads an id from the body where the record does not exist yet", async () => {
            // upload-document and confirm authorize against the company, because
            // the automation row is only written at confirm.
            const assertCompanyOwned = jest.fn(owned)
            const guard = guardWith({ assertCompanyOwned })

            await run(
                guard,
                contextFor(
                    {
                        user: { id: "alice" },
                        params: {},
                        body: { companyId: "c-1" },
                    },
                    { company: "body:companyId" },
                ),
            )

            expect(assertCompanyOwned).toHaveBeenCalledWith("c-1", "alice")
        })

        it("checks every declared record, not just the first", async () => {
            const assertCompanyOwned = jest.fn(owned)
            const assertAutomationOwned = jest.fn(owned)
            const guard = guardWith({
                assertCompanyOwned,
                assertAutomationOwned,
            })

            await run(
                guard,
                contextFor(
                    {
                        user: { id: "alice" },
                        params: { companyId: "c-1", automationId: "a-1" },
                    },
                    {
                        company: "param:companyId",
                        automation: "param:automationId",
                    },
                ),
            )

            expect(assertCompanyOwned).toHaveBeenCalled()
            expect(assertAutomationOwned).toHaveBeenCalled()
        })
    })

    describe("resolving an id from several candidates", () => {
        const rule: TenancyRule = {
            company: {
                from: [
                    "body:company_context.id",
                    "body:company_context.company_id",
                ],
                optional: true,
            },
        }

        it("falls through an empty string, matching Python's or", async () => {
            // The agent resolves this field with `or`, which is falsy-aware. A
            // nullish-coalescing version of this check read "" as present and
            // skipped the lookup entirely, letting company_id through unchecked.
            const assertCompanyOwned = jest.fn(owned)
            const guard = guardWith({ assertCompanyOwned })

            await run(
                guard,
                contextFor(
                    {
                        user: { id: "mallory" },
                        params: {},
                        body: {
                            company_context: { id: "", company_id: "victim" },
                        },
                    },
                    rule,
                ),
            )

            expect(assertCompanyOwned).toHaveBeenCalledWith("victim", "mallory")
        })

        it("prefers the first candidate when it has a value", async () => {
            const assertCompanyOwned = jest.fn(owned)
            const guard = guardWith({ assertCompanyOwned })

            await run(
                guard,
                contextFor(
                    {
                        user: { id: "alice" },
                        params: {},
                        body: {
                            company_context: { id: "c-1", company_id: "c-2" },
                        },
                    },
                    rule,
                ),
            )

            expect(assertCompanyOwned).toHaveBeenCalledWith("c-1", "alice")
        })

        it("skips an optional id that is absent", async () => {
            const assertCompanyOwned = jest.fn(owned)
            const guard = guardWith({ assertCompanyOwned })

            await run(
                guard,
                contextFor(
                    { user: { id: "alice" }, params: {}, body: {} },
                    rule,
                ),
            )

            expect(assertCompanyOwned).not.toHaveBeenCalled()
        })

        it("survives a body that is missing or not an object", async () => {
            const guard = guardWith({ assertCompanyOwned: jest.fn(owned) })

            for (const body of [undefined, null, "a string", 42]) {
                await expect(
                    run(
                        guard,
                        contextFor(
                            { user: { id: "alice" }, params: {}, body },
                            rule,
                        ),
                    ),
                ).resolves.toBe("handled")
            }
        })
    })

    it("rejects a required id that is absent rather than checking nothing", async () => {
        const assertCompanyOwned = jest.fn(owned)
        const guard = guardWith({ assertCompanyOwned })

        await expect(
            run(
                guard,
                contextFor(
                    { user: { id: "alice" }, params: {}, body: {} },
                    { company: "body:companyId" },
                ),
            ),
        ).rejects.toBeInstanceOf(BadRequestException)
        expect(assertCompanyOwned).not.toHaveBeenCalled()
    })

    describe("decorators", () => {
        it("record their rule where the guard reads it", () => {
            class Probe {
                @Tenancy({ company: "param:id" })
                scoped() {}

                @NoTenancy("creates the record")
                open() {}
            }

            /* eslint-disable @typescript-eslint/unbound-method --
               reading metadata off the function, never calling it */
            const scoped = Probe.prototype.scoped
            const open = Probe.prototype.open
            /* eslint-enable @typescript-eslint/unbound-method */

            expect(Reflect.getMetadata(TENANCY_KEY, scoped)).toEqual({
                company: "param:id",
            })
            expect(Reflect.getMetadata(TENANCY_KEY, open)).toEqual({
                none: "creates the record",
            })
        })
    })
})
