/**
 * Hand a blob to the browser as a download.
 *
 * These nine lines were copy-pasted into four download use cases, comments and
 * all. They are the same nine lines every time because there is only one way to
 * do it.
 */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.style.display = "none"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}
