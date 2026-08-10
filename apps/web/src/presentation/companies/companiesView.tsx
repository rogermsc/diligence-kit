"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building2, RefreshCw, AlertCircle } from "lucide-react"
import { useCompaniesViewModel } from "./companiesViewModel"
import { CreateCompanyModal } from "@/components/create-company-modal"
import { useRouter } from "next/navigation"
import { StatusChip } from "@/presentation/shared/statusChip"

/**
 * Company dashboard view component
 */
export function CompaniesView() {
  const { companies, loading, error, refetch, createCompany } = useCompaniesViewModel()
  const router = useRouter()

  const handleCompanyClick = (companyId: string) => {
    router.push(`/dashboard/company/${companyId}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading companies...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="flex items-center space-x-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
        <Button onClick={refetch} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Due Diligence Pipeline</h2>
          <p className="text-muted-foreground">Companies currently under investment evaluation</p>
        </div>
        <div className="flex items-center space-x-2">
          <CreateCompanyModal onCreateCompany={createCompany} />
          <Button onClick={refetch} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {companies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Companies Found</h3>
            <p className="text-muted-foreground text-center">
              There are currently no companies in the due diligence pipeline.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company, index) => (
            <Card 
              key={`${company.name}-${index}`} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleCompanyClick(company.id)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <span className="truncate">{company.name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StatusChip status={company.status} className="text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="text-sm text-muted-foreground">Total companies: {companies.length}</div>
    </div>
  )
}
