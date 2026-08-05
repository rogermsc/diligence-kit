"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building2, RefreshCw, AlertCircle } from "lucide-react"
import { useCompaniesViewModel } from "./companiesViewModel"
import { CreateCompanyModal } from "@/components/create-company-modal"
import { useRouter } from "next/navigation"
import { CompanyStatus } from "@/domain/companies/models/company"

/**
 * Get status indicator color based on company status
 */
const getStatusColor = (status: CompanyStatus): string => {
  switch (status) {
    case CompanyStatus.PENDING:
      return 'bg-yellow-500'
    case CompanyStatus.PROCESSING:
      return 'bg-blue-500'
    case CompanyStatus.COMPLETED:
      return 'bg-green-500'
    case CompanyStatus.FAILED:
      return 'bg-red-500'
    default:
      return 'bg-gray-500'
  }
}

/**
 * Get human-readable status label
 */
const getStatusLabel = (status: CompanyStatus): string => {
  switch (status) {
    case CompanyStatus.PENDING:
      return 'Pending'
    case CompanyStatus.PROCESSING:
      return 'Processing'
    case CompanyStatus.COMPLETED:
      return 'Completed'
    case CompanyStatus.FAILED:
      return 'Failed'
    default:
      return status
  }
}

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
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(company.status)}`}></div>
                  <span>{getStatusLabel(company.status)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="text-sm text-muted-foreground">Total companies: {companies.length}</div>
    </div>
  )
}
