import { completeOnePagerSchema } from "./complete-onepager.schema"

/**
 * The agent-to-service seam, which had no test at all.
 *
 * Two services in different languages agree on this payload by convention. The
 * controller types it inline and validated three of its five fields, so
 * `automationId` and `fileIds` crossed the boundary unchecked — and the payload
 * has just grown to carry the entire analysis.
 *
 * The fixture below is the shape apps/agent/src/presentation/analyze/routes.py
 * actually posts. If the two drift, this fails here rather than in production
 * as a null column.
 */

const analysis = {
    version: 1,
    facts: {
        annual_revenue_fy2024: [
            {
                field: "annual_revenue_fy2024",
                value: "£3.2M",
                source: "04_audited_accounts.pdf",
                page: "1",
                quote: "Turnover £3.2M",
                source_type: "actual",
                document_version: "",
                document_date: "2024-12-31",
                grounding: "quoted",
                quote_verified: true,
            },
        ],
    },
    coverage: { quality_of_earnings: ["04_audited_accounts.pdf"] },
    missing: ["insurance", "policies"],
    conflicts: [
        {
            field: "annual_revenue_fy2024",
            values: ["£4.1M (01_pitch_deck.pdf 1 type=pro_forma)"],
            preferred_value: "£3.2M",
            preferred_source: "04_audited_accounts.pdf",
            resolution_basis: "source_type",
            rationale: "actual beats pro_forma",
            confidence: 1.0,
            magnitude: "28% spread, £3.2M to £4.1M",
        },
    ],
    one_pager: {
        executive_summary: "…",
        scorecard: [],
        overall_score: "3.0/5.0",
    },
}

const payload = {
    onePagerUrl: "gs://local-bucket/one-pagers/abc.pdf",
    coverage: ["quality_of_earnings"],
    missing: ["insurance"],
    analysis,
}

describe("complete-onepager callback contract", () => {
    it("accepts what the agent posts", () => {
        const parsed = completeOnePagerSchema.parse(payload)
        expect(parsed.analysis).toBeDefined()
    })

    it("still accepts a callback from an agent deployed before the analysis existed", () => {
        const older = { ...payload }
        delete (older as { analysis?: unknown }).analysis
        expect(() => completeOnePagerSchema.parse(older)).not.toThrow()
    })

    it("rejects a version the service was not built for", () => {
        // The whole point of pinning it. An agent that changes the shape without
        // a coordinated deploy fails here, loudly, instead of writing something
        // the frontend cannot read.
        expect(() =>
            completeOnePagerSchema.parse({
                ...payload,
                analysis: { ...analysis, version: 2 },
            }),
        ).toThrow()
    })

    it("rejects an analysis missing a top-level section", () => {
        const incomplete = { ...analysis }
        delete (incomplete as { conflicts?: unknown }).conflicts
        expect(() =>
            completeOnePagerSchema.parse({ ...payload, analysis: incomplete }),
        ).toThrow()
    })

    it("keeps fields the schema does not name, rather than stripping them", () => {
        // Validation here is structural: the service stores the blob and serves
        // it back without reading inside it, so a field the agent adds must
        // survive to the frontend instead of being silently dropped.
        const parsed = completeOnePagerSchema.parse({
            ...payload,
            analysis: { ...analysis, future_section: { a: 1 } },
        })
        expect(parsed.analysis).toHaveProperty("future_section")
    })

    it("still refuses a one-pager URL pointing at an internal address", () => {
        expect(() =>
            completeOnePagerSchema.parse({
                ...payload,
                onePagerUrl: "http://169.254.169.254/latest/meta-data/",
            }),
        ).toThrow()
    })
})
