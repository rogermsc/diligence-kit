"use client"

import { useState } from "react"
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
import { Plus, Loader2 } from "lucide-react"
import { ApiError } from "@/lib/httpClient"

interface CreateCompanyModalProps {
  onCreateCompany: (name: string) => Promise<void>
}

export function CreateCompanyModal({ onCreateCompany }: CreateCompanyModalProps) {
  const [open, setOpen] = useState(false)
  const [companyName, setCompanyName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [hasNameConflict, setHasNameConflict] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!companyName.trim()) {
      setError("Company name is required")
      setHasNameConflict(false)
      return
    }

    setIsLoading(true)
    setError("")
    setHasNameConflict(false)

    try {
      await onCreateCompany(companyName.trim())
      setCompanyName("")
      setOpen(false)
    } catch (error) {
      if (error instanceof ApiError && error.type === "COMPANY_NAME_ALREADY_EXISTS") {
        setError("A company with this name already exists. Please choose a different name.")
        setHasNameConflict(true)
      } else {
        setError(error instanceof Error ? error.message : "An error occurred")
        setHasNameConflict(false)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setCompanyName("")
      setError("")
      setHasNameConflict(false)
    }
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCompanyName(e.target.value)
    // Clear the name conflict error when user starts typing
    if (hasNameConflict) {
      setHasNameConflict(false)
      setError("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Company
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Company</DialogTitle>
          <DialogDescription>
            Add a new company to the due diligence pipeline.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className={`grid gap-4 py-4 transition-all duration-300 ${hasNameConflict ? 'pb-20' : ''}`}>
            <div className="grid gap-2">
              <Label htmlFor="company-name">Company Name</Label>
              <div className="relative">
                <Input
                  id="company-name"
                  value={companyName}
                  onChange={handleNameChange}
                  placeholder="Enter company name"
                  disabled={isLoading}
                  aria-invalid={hasNameConflict}
                  className={hasNameConflict ? "border-red-500 focus-visible:ring-red-500 ring-red-500/20" : ""}
                />
                {error && hasNameConflict && (
                  <div className="absolute top-full left-0 mt-2 z-10 max-w-sm animate-in slide-in-from-top-2 fade-in duration-300">
                    <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg shadow-lg text-sm relative dark:bg-red-950/50 dark:border-red-800 dark:text-red-200 transform transition-all duration-200 hover:shadow-xl">
                      {/* Arrow pointing up to the input */}
                      <div className="absolute -top-1 left-4 w-2 h-2 bg-red-50 border-l border-t border-red-200 rotate-45 dark:bg-red-950/50 dark:border-red-800"></div>
                      <div className="flex items-start space-x-2">
                        <div className="flex-shrink-0 mt-0.5">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span>{error}</span>
                      </div>
                    </div>
                  </div>
                )}
                {error && !hasNameConflict && (
                  <p className="text-sm text-destructive mt-2 animate-in slide-in-from-top-1 fade-in duration-200">
                    {error}
                  </p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Company
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 