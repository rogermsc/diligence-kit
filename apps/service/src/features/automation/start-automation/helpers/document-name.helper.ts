/**
 * The name a document is stored and displayed under.
 *
 * Documents are keyed `(automationId, name)`, and the name used to be the
 * basename of the uploaded file. A dataroom laid out by year — the normal way
 * they arrive — therefore collapsed: `2023/financials.pdf` and
 * `2024/financials.pdf` both became `financials.pdf`, the second upserted over
 * the first, and the run analysed one document where two were uploaded. Nothing
 * reported it.
 *
 * Storage keys are `<company>/<automationId>/<path inside the dataroom>` in
 * every upload path, so the portion after the automation id is both unique
 * within the automation and the most useful thing to show a reader.
 */
export function documentNameFrom(
    bucketPath: string,
    automationId: string,
    fallback: string,
): string {
    const marker = `/${automationId}/`
    const at = bucketPath.indexOf(marker)

    if (at === -1) return fallback

    const relative = bucketPath.slice(at + marker.length)
    return relative || fallback
}
