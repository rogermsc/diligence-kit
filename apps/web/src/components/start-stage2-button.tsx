"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Loader2 } from "lucide-react"

interface StartStage2ButtonProps {
  companyId: string
  automationId: string
  onStart: (companyId: string, automationId: string) => Promise<void>
  disabled?: boolean
}

export function StartStage2Button({ companyId, automationId, onStart, disabled = false }: StartStage2ButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    if (isLoading) return
    
    try {
      setIsLoading(true)
      await onStart(companyId, automationId)
    } catch (error) {
      console.error('Error starting stage 2:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button 
      onClick={handleClick} 
      disabled={disabled || isLoading} 
      className="w-40" 
      data-testid="start-stage2-button"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Plus className="h-4 w-4 mr-2" />
      )}
      Start Stage 2
    </Button>
  )
}
