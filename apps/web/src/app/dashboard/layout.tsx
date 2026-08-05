import { ThemeToggle } from "@/components/theme-toggle"
import { LogoutButton } from "@/components/logout-button"
import { ChatWidget } from "@/components/chat/chat-widget"
import { CompanyContextProvider } from "@/components/chat/chat-company-context"
import Link from "next/link"
import Image from "next/image"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <CompanyContextProvider>
      <div className="min-h-screen bg-background">
        <div className="border-b">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <Link href="/dashboard" className="flex items-center space-x-3 hover:opacity-80 transition-opacity cursor-pointer">
                <div className="w-10 h-10 flex items-center justify-center">
                  <Image
                    src="/diligence-kit-logo.svg"
                    alt="Diligence Kit Logo"
                    width={40}
                    height={40}
                    className="object-contain"
                  />
                </div>
                <h1 className="text-2xl font-bold">Diligence Kit</h1>
              </Link>
              <div className="flex items-center gap-3">
                <LogoutButton />
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>

        <main className="container mx-auto px-4 py-8">
          {children}
        </main>
        <ChatWidget />
      </div>
    </CompanyContextProvider>
  )
} 