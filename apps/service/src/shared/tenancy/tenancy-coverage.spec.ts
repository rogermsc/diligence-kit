import { PATH_METADATA, METHOD_METADATA } from "@nestjs/common/constants"
import { RequestMethod } from "@nestjs/common"
import { AuthGuard } from "@/features/auth/guards/auth.guard"
import { TENANCY_KEY } from "./tenancy.decorator"

import { AutomationController } from "@/features/automation/start-automation/presentation/automation.controller"
import { CompanyController } from "@/features/company/presentation/company.controller"
import { LiaisonController } from "@/features/liaison/presentation/liaison.controller"
import { TriggerSecondStageController } from "@/features/report-agents/presentation/trigger-second-stage.controller"
import { AuthController } from "@/features/auth/presentation/auth.controller"
import { CompleteOnePagerController } from "@/features/automation/complete-onePager-automation/presentation/complete-onepager.controller"
import { CompleteReportController } from "@/features/onePager-agent/report/presentation/complete-report.controller"
import { OverridesController } from "@/features/overrides/presentation/overrides.controller"
import { HealthController } from "@/shared/infra/health/health.controller"

/**
 * Every controller in the application. A new one must be added here, which is
 * the point: the check below is only as complete as this list, so the list is
 * the one thing a reviewer has to notice.
 */
const CONTROLLERS = [
    AutomationController,
    CompanyController,
    LiaisonController,
    TriggerSecondStageController,
    AuthController,
    CompleteOnePagerController,
    CompleteReportController,
    HealthController,
    OverridesController,
]

interface Route {
    controller: string
    handler: string
    verb: string
    path: string
    authenticated: boolean
    rule: Record<string, unknown> | undefined
}

function guardsOf(target: object): unknown[] {
    return (Reflect.getMetadata("__guards__", target) as unknown[]) ?? []
}

function routesOf(controller: new (...args: never[]) => object): Route[] {
    const prototype = controller.prototype as object
    const base =
        (Reflect.getMetadata(PATH_METADATA, controller) as string) ?? ""
    const classAuthenticated = guardsOf(controller).includes(AuthGuard)

    return Object.getOwnPropertyNames(prototype)
        .filter((name) => name !== "constructor")
        .map((name) => {
            const handler = (prototype as Record<string, unknown>)[name]
            if (typeof handler !== "function") return null

            const path = Reflect.getMetadata(PATH_METADATA, handler) as string
            if (path === undefined) return null

            const method = Reflect.getMetadata(
                METHOD_METADATA,
                handler,
            ) as number
            const rule = (Reflect.getMetadata(TENANCY_KEY, handler) ??
                Reflect.getMetadata(TENANCY_KEY, controller)) as
                | Record<string, unknown>
                | undefined

            return {
                controller: controller.name,
                handler: name,
                verb: RequestMethod[method],
                path: `/${base}/${path}`
                    .replace(/\/+/g, "/")
                    .replace(/\/$/, ""),
                authenticated:
                    classAuthenticated || guardsOf(handler).includes(AuthGuard),
                rule,
            }
        })
        .filter((route): route is Route => route !== null)
}

const ROUTES = CONTROLLERS.flatMap(routesOf)

function controllerOf(route: Route): object {
    return CONTROLLERS.find((c) => c.name === route.controller)!
}

describe("tenancy coverage", () => {
    it("finds the routes to check", () => {
        // A refactor that silently stopped discovering routes would make every
        // assertion below vacuously true.
        expect(ROUTES.length).toBeGreaterThan(15)
        expect(ROUTES.filter((r) => r.authenticated).length).toBeGreaterThan(10)
    })

    // The reason authorization is a guard rather than twelve remembered calls:
    // adding a route and forgetting the call used to compile, lint, return 200
    // and serve another tenant's data. Now it fails here.
    it("has every authenticated route declare a tenancy rule", () => {
        const undeclared = ROUTES.filter(
            (r) => r.authenticated && r.rule === undefined,
        ).map((r) => `${r.verb} ${r.path} (${r.controller}.${r.handler})`)

        expect(undeclared).toEqual([])
    })

    it("leaves unauthenticated routes alone, and they are the expected ones", () => {
        // Agent webhooks, login and health authenticate by signature, API key or
        // not at all. They have no user, so there is no tenant to scope to. The
        // list is pinned because a new route appearing here is a route nothing
        // in this file is checking.
        const open = ROUTES.filter((r) => !r.authenticated)

        expect(open.map((r) => `${r.verb} ${r.path}`).sort()).toEqual([
            "GET /health",
            "POST /auth/login",
            "POST /auth/refresh-token",
            "POST /automation/complete-onepager",
            "POST /automation/complete-onepager-error",
            "POST /automation/complete-report",
            "POST /automation/complete-report-error",
            "POST /automation/heartbeat",
        ])
    })

    it("guards every callback that carries no user", () => {
        // Without this the test above would merely be documenting an open
        // surface rather than constraining it. Only login, refresh and health
        // are reachable with no credential of any kind.
        const unguarded = ROUTES.filter(
            (r) => !r.authenticated && guardsOf(controllerOf(r)).length === 0,
        ).map((r) => `${r.verb} ${r.path}`)

        expect(unguarded.sort()).toEqual([
            "GET /health",
            "POST /auth/login",
            "POST /auth/refresh-token",
        ])
    })

    it("routes an id-bearing path through an ownership check", () => {
        // A path with an id in it that declared @NoTenancy would pass the check
        // above while checking nothing.
        const idBearing = ROUTES.filter(
            (r) => r.authenticated && /:\w*[Ii]d\b/.test(r.path),
        )
        const notChecked = idBearing
            .filter((r) => typeof r.rule?.none === "string")
            .map((r) => `${r.verb} ${r.path}`)

        // The liaison session id is the agent's, not a record in this database.
        expect(notChecked).toEqual(["GET /liaison/messages/:sessionId"])
    })
})
