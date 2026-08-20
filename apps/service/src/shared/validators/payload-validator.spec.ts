import { Logger } from "@nestjs/common"
import { z } from "zod"
import { PayloadValidator } from "./payload-validator"

/**
 * The log sink must never receive the dataroom.
 *
 * The agent's `complete-onepager` payload now carries the whole analysis —
 * hundreds of verbatim excerpts from a client's documents. The validator used
 * to log the payload itself whenever validation failed, which copied those
 * excerpts into Cloud Logging, where the liaison agent reads them back as an
 * ombudsman. A version bump or any shape drift was enough to trigger it.
 *
 * What a reader needs to diagnose a shape mismatch is the field names and the
 * Zod issue paths. Both survive. The values do not.
 */

const schema = z.object({ version: z.literal(1), quote: z.string() })

const SECRET = "Turnover for the year was £3.2M, restated from £3.9M"

function captureLogs(run: (logger: Logger) => void): string {
    const written: unknown[] = []
    const record = (...args: unknown[]) => void written.push(args)

    const targets = [
        jest.spyOn(Logger.prototype, "error").mockImplementation(record),
        jest.spyOn(Logger.prototype, "debug").mockImplementation(record),
        jest.spyOn(Logger.prototype, "warn").mockImplementation(record),
        jest.spyOn(Logger.prototype, "log").mockImplementation(record),
    ]

    try {
        run(new Logger("test"))
    } finally {
        targets.forEach((t) => t.mockRestore())
    }

    return JSON.stringify(written)
}

describe("PayloadValidator logging", () => {
    it("does not log document text when validation fails", () => {
        const logged = captureLogs(() => {
            expect(() =>
                PayloadValidator.validate(
                    { version: 2, quote: SECRET },
                    schema,
                    "CompleteOnePager",
                ),
            ).toThrow()
        })

        expect(logged).not.toContain(SECRET)
        expect(logged).not.toContain("£3.2M")
    })

    it("does not log document text through the error handler either", () => {
        const logged = captureLogs((logger) => {
            expect(() =>
                PayloadValidator.validateWithErrorHandling(
                    { version: 2, quote: SECRET },
                    schema,
                    "CompleteOnePager",
                    logger,
                ),
            ).toThrow()
        })

        expect(logged).not.toContain(SECRET)
    })

    it("does not log document text on success", () => {
        const logged = captureLogs(() => {
            PayloadValidator.validate(
                { version: 1, quote: SECRET },
                schema,
                "CompleteOnePager",
            )
        })

        expect(logged).not.toContain(SECRET)
    })

    it("still says enough to diagnose the mismatch", () => {
        const logged = captureLogs(() => {
            expect(() =>
                PayloadValidator.validate(
                    { version: 2, quote: SECRET },
                    schema,
                    "CompleteOnePager",
                ),
            ).toThrow()
        })

        // the field names are the diagnosis; the values are not
        expect(logged).toContain("version")
        expect(logged).toContain("quote")
        expect(logged).toContain("CompleteOnePager")
    })
})
