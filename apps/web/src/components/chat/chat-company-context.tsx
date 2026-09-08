"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface CompanyInfo {
  id: string;
  name: string;
  /** The triage run being viewed, so a question can be tied to one analysis. */
  automationId?: string;
  /**
   * What the pipeline decided and why, built by
   * domain/analysis/usecases/chatContext. Without it the assistant can only
   * discuss the platform, not the dataroom on screen.
   */
  analysisContext?: Record<string, unknown>;
}

interface CompanyContextValue {
  company: CompanyInfo | null;
  setCompany: (company: CompanyInfo | null) => void;
}

const CompanyContext = createContext<CompanyContextValue>({
  company: null,
  setCompany: () => {},
});

export function CompanyContextProvider({ children }: { children: ReactNode }) {
  const [company, setCompanyState] = useState<CompanyInfo | null>(null);

  const setCompany = useCallback((company: CompanyInfo | null) => {
    setCompanyState(company);
  }, []);

  return (
    <CompanyContext.Provider value={{ company, setCompany }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompanyContext() {
  return useContext(CompanyContext);
}
