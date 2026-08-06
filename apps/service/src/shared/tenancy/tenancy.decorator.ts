import { SetMetadata } from "@nestjs/common"

export const TENANCY_KEY = "tenancy"

/**
 * Where a record id comes from: `param:<name>` or `body:<dotted.path>`.
 *
 * A list means "first truthy value wins", which is deliberately falsy-aware
 * rather than nullish-aware — see the liaison route, where the Python agent
 * downstream resolves the same field with `or`, so an empty-string id there
 * falls through to the next candidate and must fall through here too.
 */
export type IdSource = string

export interface TenancyLookup {
    from: IdSource | IdSource[]
    /** The id may legitimately be absent; when it is, there is nothing to check. */
    optional?: boolean
}

export interface TenancyRule {
    company?: IdSource | IdSource[] | TenancyLookup
    automation?: IdSource | IdSource[] | TenancyLookup
    document?: IdSource | IdSource[] | TenancyLookup
}

/**
 * Declares which records a route reaches by caller-supplied id, so TenancyGuard
 * can prove the caller owns them before the handler runs.
 */
export const Tenancy = (rule: TenancyRule) => SetMetadata(TENANCY_KEY, rule)

/**
 * Declares that a route reaches no record by caller-supplied id — it creates
 * one, or it lists records already scoped to the caller in the repository.
 *
 * The reason is required. An authenticated route with neither this nor @Tenancy
 * is refused at runtime, so the only way past the guard is to say which case
 * applies and why.
 */
export const NoTenancy = (reason: string) =>
    SetMetadata(TENANCY_KEY, { none: reason })

export interface NoTenancyRule {
    none: string
}

export function isNoTenancy(
    rule: TenancyRule | NoTenancyRule,
): rule is NoTenancyRule {
    return typeof (rule as NoTenancyRule).none === "string"
}
