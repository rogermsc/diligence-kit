import { CompanyDetailView } from "@/presentation/companyDetail/companyDetailView"

interface CompanyPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function CompanyPage({ params }: CompanyPageProps) {
  const { id } = await params
  return <CompanyDetailView id={id} />
} 