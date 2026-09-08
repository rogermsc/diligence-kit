import { RunProvider } from "@/presentation/run/runContext"
import { RunHeader } from "@/presentation/run/runHeader"

/**
 * Everything about one run shares a header, a fetch and an address.
 *
 * Before this each screen fetched its own copy and offered a hand-rolled "back"
 * link — three of them, with three different names for the same destination.
 */
export default async function RunLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <RunProvider companyId={id}>
      <div className="mx-auto max-w-5xl">
        <RunHeader />
        {children}
      </div>
    </RunProvider>
  )
}
