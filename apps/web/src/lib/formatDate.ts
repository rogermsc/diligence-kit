/**
 * One date format, in one place.
 *
 * `en-US` is pinned rather than left to the browser locale on purpose: this
 * renders on the server too, and a locale-dependent string is a hydration
 * mismatch waiting to happen.
 */
export function formatDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
