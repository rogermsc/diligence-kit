"use client"

import { useState } from "react"
import { Loader2, PenLine } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createOverride } from "@/data/overrides/overrideRepositoryImpl"
import type { OverrideTargetType } from "@/domain/overrides/models/override"

/**
 * Disagree with the machine, on the record.
 *
 * The reason is required, and the form enforces it rather than letting the
 * server reject an empty one — the database has demanded it since the table was
 * created, on the argument that an override with no stated reason is exactly
 * the unsourced assertion this product exists to argue against.
 *
 * The original value is never overwritten. It stays in the analysis, and the
 * merged read marks the new one as coming from a person, with this reason
 * attached.
 */
export function OverrideDialog({
  automationId,
  targetType,
  targetKey,
  currentValue,
  label,
  onSaved,
}: {
  automationId: string
  targetType: OverrideTargetType
  targetKey: string
  currentValue: string
  label: string
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(currentValue)
  const [rationale, setRationale] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!rationale.trim()) return
    setSaving(true)
    try {
      await createOverride(automationId, {
        targetType,
        targetKey,
        value,
        rationale: rationale.trim(),
      })
      toast.success(`${label} recorded as your judgement`)
      setOpen(false)
      setRationale("")
      onSaved()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "The change could not be saved",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-muted-foreground hover:text-foreground"
          aria-label={`Change ${label}`}
        >
          <PenLine className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Change {label}</DialogTitle>
            <DialogDescription>
              The analysis keeps what the pipeline produced. Your value is
              recorded beside it, attributed to you, and every screen that shows
              it will say it came from a person.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                What the pipeline produced
              </Label>
              <p className="font-mono text-sm" data-numeric>
                {currentValue || "—"}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="override-value">Your value</Label>
              <Input
                id="override-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="override-rationale">
                Why <span className="text-conflict">*</span>
              </Label>
              <Input
                id="override-rationale"
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="The Q3 board pack supersedes this"
                required
              />
              <p className="text-xs text-muted-foreground">
                Required. It travels with the value onto every report.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !rationale.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Record it
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
