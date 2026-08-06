import {
    BadRequestException,
    CallHandler,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    Logger,
    NestInterceptor,
} from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { Observable } from "rxjs"
import { OwnershipService } from "@/shared/services/ownership.service"
import {
    IdSource,
    NoTenancyRule,
    TENANCY_KEY,
    TenancyLookup,
    TenancyRule,
    isNoTenancy,
} from "./tenancy.decorator"

/**
 * Enforces record ownership for every authenticated route.
 *
 * Authorization used to be opt-in: twelve hand-written `assertXOwned` calls
 * scattered through the controllers. Forgetting one compiled, linted, returned
 * 200 and served another tenant's data — and two whole controllers were in fact
 * missed the first time round. Coverage that depends on remembering is not
 * coverage.
 *
 * So this runs globally and denies by default. A route that has authenticated a
 * user and declares neither @Tenancy nor @NoTenancy is refused, which turns the
 * omission into an immediate, obvious failure instead of a silent leak. The
 * companion spec walks every registered route and fails the build if any lacks a
 * declaration, so the omission never reaches runtime either.
 *
 * An interceptor rather than a guard, which is not a stylistic choice. Nest runs
 * every global guard *before* any controller-scoped one, and AuthGuard — which
 * puts the user on the request — is controller-scoped. As a global guard this
 * therefore ran with `request.user` still unset, concluded it was on an
 * unauthenticated route, and allowed everything: verified against a live server,
 * a second tenant got 200 on four routes that should have been 404. Interceptors
 * run after all guards and before the handler, which is the ordering this needs.
 *
 * Checks resolve to NotFound rather than Forbidden: a 403 would confirm that an
 * id exists, which is what an id-guessing attacker is trying to learn.
 *
 * One constraint follows from the ordering. Interceptors run before any
 * method-scoped interceptor, and multipart bodies are parsed by one of those
 * (multer, via FileInterceptor). A `body:` source on a multipart route therefore
 * reads undefined and rejects every upload, so those routes take the id from the
 * path or the query string instead — both are available from the moment the
 * request is routed.
 */
@Injectable()
export class TenancyInterceptor implements NestInterceptor {
    private readonly logger = new Logger(TenancyInterceptor.name)

    constructor(
        private readonly reflector: Reflector,
        private readonly ownership: OwnershipService,
    ) {}

    async intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Promise<Observable<unknown>> {
        if (context.getType() !== "http") return next.handle()

        const request = context
            .switchToHttp()
            .getRequest<{ user?: { id?: string } }>()
        const userId = request.user?.id

        // No authenticated user means this is not a tenant route: agent
        // webhooks, health, login. Those carry their own guards and have no
        // tenant to scope to.
        if (!userId) return next.handle()

        const rule = this.reflector.getAllAndOverride<
            TenancyRule | NoTenancyRule | undefined
        >(TENANCY_KEY, [context.getHandler(), context.getClass()])

        if (!rule) {
            const handler = `${context.getClass().name}.${context.getHandler().name}`
            this.logger.error(
                `${handler} authenticates a user but declares no tenancy rule. ` +
                    `Add @Tenancy({...}) naming the records it reaches by id, or ` +
                    `@NoTenancy("reason") if it reaches none.`,
            )
            throw new ForbiddenException("Route is not authorized for tenancy")
        }

        if (isNoTenancy(rule)) return next.handle()

        await Promise.all([
            this.check(rule.company, request, (id) =>
                this.ownership.assertCompanyOwned(id, userId),
            ),
            this.check(rule.automation, request, (id) =>
                this.ownership.assertAutomationOwned(id, userId),
            ),
            this.check(rule.document, request, (id) =>
                this.ownership.assertDocumentOwned(id, userId),
            ),
        ])

        return next.handle()
    }

    private async check(
        lookup: IdSource | IdSource[] | TenancyLookup | undefined,
        request: unknown,
        assert: (id: string) => Promise<void>,
    ): Promise<void> {
        if (!lookup) return

        const { from, optional } = normalize(lookup)
        const id = resolve(from, request)

        if (!id) {
            if (optional) return
            throw new BadRequestException(
                `Missing required identifier (${from.join(" or ")})`,
            )
        }

        await assert(id)
    }
}

function normalize(lookup: IdSource | IdSource[] | TenancyLookup): {
    from: string[]
    optional: boolean
} {
    if (typeof lookup === "string") return { from: [lookup], optional: false }
    if (Array.isArray(lookup)) return { from: lookup, optional: false }
    return {
        from: Array.isArray(lookup.from) ? lookup.from : [lookup.from],
        optional: Boolean(lookup.optional),
    }
}

const CONTAINERS: Record<string, string> = {
    param: "params",
    query: "query",
    body: "body",
}

/** First source yielding a truthy value wins. Falsy-aware on purpose. */
function resolve(sources: string[], request: unknown): string | undefined {
    for (const source of sources) {
        const [where, ...rest] = source.split(":")
        const path = rest.join(":")
        const container = CONTAINERS[where]

        // Anything unrecognised used to fall through to the body, so a typo
        // ("params:id") or an unsupported prefix silently read undefined — and
        // combined with `optional` that skipped the ownership check entirely
        // while the route still served the record. Refuse instead.
        if (!container) {
            throw new Error(
                `Unknown tenancy source "${source}". Expected one of ` +
                    `${Object.keys(CONTAINERS).join(", ")}.`,
            )
        }

        const root = (request as Record<string, unknown>)[container]
        const value = path
            .split(".")
            .reduce<unknown>(
                (acc, key) =>
                    acc && typeof acc === "object"
                        ? (acc as Record<string, unknown>)[key]
                        : undefined,
                root,
            )
        if (typeof value === "string" && value) return value
    }
    return undefined
}
