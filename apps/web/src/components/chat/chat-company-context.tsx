"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface CompanyInfo {
  id: string;
  name: string;
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
