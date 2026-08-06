import { documentNameFrom } from "./document-name.helper"

const AUTOMATION = "00000000-0000-4000-8000-000000000001"
const key = (relative: string) =>
    `gs://bucket/Northwind Robotics/${AUTOMATION}/${relative}`

describe("documentNameFrom", () => {
    it("keeps two same-named files in different folders apart", () => {
        // Documents are keyed (automationId, name). With the basename, a
        // dataroom laid out by year — the normal way they arrive — collapsed:
        // the second upserted over the first and the run analysed one document
        // where two were uploaded, silently.
        const a = documentNameFrom(
            key("2023/financials.pdf"),
            AUTOMATION,
            "financials.pdf",
        )
        const b = documentNameFrom(
            key("2024/financials.pdf"),
            AUTOMATION,
            "financials.pdf",
        )

        expect(a).toBe("2023/financials.pdf")
        expect(b).toBe("2024/financials.pdf")
        expect(a).not.toBe(b)
    })

    it("leaves a file at the dataroom root as its plain name", () => {
        expect(documentNameFrom(key("deck.pdf"), AUTOMATION, "deck.pdf")).toBe(
            "deck.pdf",
        )
    })

    it("keeps the whole path for deeply nested files", () => {
        expect(
            documentNameFrom(
                key("legal/contracts/2024/msa.pdf"),
                AUTOMATION,
                "msa.pdf",
            ),
        ).toBe("legal/contracts/2024/msa.pdf")
    })

    it("falls back when the path does not carry the automation id", () => {
        // Nothing should reach this, but guessing a name would be worse than
        // using the one the caller already has.
        expect(
            documentNameFrom(
                "gs://bucket/elsewhere/deck.pdf",
                AUTOMATION,
                "deck.pdf",
            ),
        ).toBe("deck.pdf")
    })

    it("falls back when nothing follows the automation id", () => {
        expect(
            documentNameFrom(
                `gs://bucket/Co/${AUTOMATION}/`,
                AUTOMATION,
                "deck.pdf",
            ),
        ).toBe("deck.pdf")
    })

    it("is not confused by a company name containing the automation id", () => {
        const path = `gs://bucket/${AUTOMATION}-archive/${AUTOMATION}/q1/deck.pdf`

        expect(documentNameFrom(path, AUTOMATION, "deck.pdf")).toBe(
            "q1/deck.pdf",
        )
    })
})
