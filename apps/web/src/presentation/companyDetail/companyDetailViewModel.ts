"use client";

import {useState, useEffect, useCallback, useMemo} from "react";
import {toast} from "sonner";
import type {Company} from "@/domain/companies/models/company";
import {GetCompanyByIdUseCase} from "@/domain/companies/usecases/getCompanyById";
import {DeleteCompanyUseCase} from "@/domain/companies/usecases/deleteCompany";
import {CompanyRepositoryImpl} from "@/data/companies/companyRepositoryImpl";
import {DownloadOnePagerSummaryUseCase} from "@/domain/automations/usecases/downloadOnePagerSummary";
import {DownloadOnePagerUseCase} from "@/domain/automations/usecases/downloadOnePager";
import {DownloadReportUseCase} from "@/domain/automations/usecases/downloadReport";
import {AutomationRepositoryImpl} from "@/data/automations/automationRepositoryImpl";
import {GetDocumentsByAutomationIdUseCase} from "@/domain/documents/usecases/getDocumentsByAutomationId";
import {DownloadDocumentUseCase} from "@/domain/documents/usecases/downloadDocument";
import {DocumentRepositoryImpl} from "@/data/documents/documentRepositoryImpl";
import type {Document} from "@/domain/documents/models/document";
import {GetOnePagerMarkdownUseCase} from "@/domain/automations/usecases/getOnePagerMarkdown";
import {AutomationStatus} from "@/domain/automations/models/automation";
import {StartAutomationStage2UseCase} from "@/domain/automations/usecases/startAutomationStage2";

interface StartAutomationResponse {
    automationId: string;
    status: string;
}

export function useCompanyDetailViewModel(id: string) {
    const [company, setCompany] = useState<Company | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [documentsLoading, setDocumentsLoading] = useState<boolean>(false);
    const [documentsError, setDocumentsError] = useState<string | null>(null);
    const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
    const [downloadingOnePager, setDownloadingOnePager] = useState<boolean>(false);
    const [downloadingReport, setDownloadingReport] = useState<boolean>(false);

    const fetchCompanyData = useCallback(async () => {
        if (!id) return;
        const repository = new CompanyRepositoryImpl();
        const getCompanyByIdUseCase = new GetCompanyByIdUseCase(repository);
        try {
            const fetchedCompany = await getCompanyByIdUseCase.execute(id);
            setCompany(fetchedCompany);
            return fetchedCompany;
        } catch (err) {
            throw err;
        }
    }, [id]);

    const loadCompany = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            await fetchCompanyData();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    }, [fetchCompanyData]);

    useEffect(() => {
        loadCompany();
    }, [loadCompany]);

    const refetch = useCallback(async () => {
        try {
            await fetchCompanyData();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred while refetching.");
            toast.error("Failed to refresh company data.");
        }
    }, [fetchCompanyData]);

    const startStage2 = useCallback(async (companyId: string, automationId: string) => {
        const automationRepository = new AutomationRepositoryImpl();
        const startStage2UseCase = new StartAutomationStage2UseCase(automationRepository);

        try {
            console.log("Starting stage 2 with:", {companyId, automationId});
            const response = await startStage2UseCase.execute(companyId, automationId);
            console.log("Stage 2 response:", response);

            // Check if response is valid and has success property
            if (response && typeof response === 'object' && 'success' in response) {
                if (response.success) {
                    toast.success("Due diligence automations created successfully");

                    // Add a small delay to ensure backend has processed the creation
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // Refresh to get the new automations
                    await refetch();

                    toast.success("Company data refreshed with new automations");
                } else {
                    console.error("Stage 2 failed:", response);
                    throw new Error(response.message || "Failed to start stage 2");
                }
            } else {
                // If response doesn't have expected format, treat as success and refresh anyway
                console.warn("Unexpected response format:", response);
                toast.success("Stage 2 initiated - refreshing data");

                // Add a small delay to ensure backend has processed the creation
                await new Promise(resolve => setTimeout(resolve, 1500));

                // Refresh to get the new automations
                await refetch();

                toast.success("Company data refreshed");
            }
        } catch (err) {
            console.error("Stage 2 error:", err);
            toast.error(err instanceof Error ? err.message : "An unexpected server error occurred");
            throw err;
        }
    }, [refetch]);

    const activeAutomationForPolling = useMemo(() =>
            company?.automations.find((a) =>
                [AutomationStatus.PENDING, AutomationStatus.PROCESSING, AutomationStatus.STAGE2_PROCESSING].includes(a.status)
            ),
        [company?.automations]
    );

    const isPollingActive = !!activeAutomationForPolling;

    // Poll by silently re-fetching the company (same source the detail screen
    // uses), so automation statuses reflect the real DB state. When no
    // automation is active anymore, isPollingActive becomes false and the
    // long-polling hook stops on its own. Errors are swallowed to avoid
    // toasting every interval.
    const pollCompanyData = useCallback(async () => {
        try {
            await fetchCompanyData();
        } catch (err) {
            console.error("Failed to poll company data:", err);
        }
    }, [fetchCompanyData]);

    const handleAutomationSuccess = async (response: StartAutomationResponse) => {
        console.log("Automation started successfully:", response);
        await refetch();
    };

    const fetchDocuments = async (automationId: string) => {
        try {
            setDocumentsLoading(true);
            setDocumentsError(null);
            const repository = new DocumentRepositoryImpl();
            const getDocumentsUseCase = new GetDocumentsByAutomationIdUseCase(repository);
            const response = await getDocumentsUseCase.execute(automationId);
            setDocuments(response.documents);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
            setDocumentsError(errorMessage);
        } finally {
            setDocumentsLoading(false);
        }
    };

    const downloadDocument = async (document: Document): Promise<void> => {
        try {
            setDownloadingIds((prev) => new Set(prev).add(document.id));
            const repository = new DocumentRepositoryImpl();
            const downloadDocumentUseCase = new DownloadDocumentUseCase(repository);
            await downloadDocumentUseCase.execute(document.id, document.name);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to download document";
            throw new Error(errorMessage);
        } finally {
            setDownloadingIds((prev) => {
                const newSet = new Set(prev);
                newSet.delete(document.id);
                return newSet;
            });
        }
    };

    const downloadOnePagerSummary = async (automationId: string): Promise<void> => {
        try {
            setDownloadingOnePager(true);
            const repository = new AutomationRepositoryImpl();
            const downloadOnePagerUseCase = new DownloadOnePagerSummaryUseCase(repository);
            const automation = company?.automations.find((a) => a.id === automationId);
            let fileName = "one_pager_summary.docx";

            if (automation?.result?.one_pager_summary) {
                const pathParts = automation.result.one_pager_summary.split("/");
                fileName = pathParts[pathParts.length - 1] || fileName;
            }
            await downloadOnePagerUseCase.execute(automationId, fileName);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to download one pager summary";
            throw new Error(errorMessage);
        } finally {
            setDownloadingOnePager(false);
        }
    };

    const downloadOnePager = async (triageAutomationId: string): Promise<void> => {
        try {
            setDownloadingOnePager(true);
            const repository = new AutomationRepositoryImpl();
            const downloadOnePagerUseCase = new DownloadOnePagerUseCase(repository);

            // Generate filename based on company name and automation ID
            let fileName = `one_pager_${company?.name || 'company'}_${triageAutomationId}.pdf`;

            // Clean filename (remove special characters)
            fileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

            console.log("ViewModel: Downloading one-pager with filename:", fileName);
            await downloadOnePagerUseCase.execute(triageAutomationId, fileName);

            toast.success("One Pager downloaded successfully");
        } catch (err) {
            console.error("ViewModel: One-pager download error:", err);
            const errorMessage = err instanceof Error ? err.message : "Failed to download one pager";
            toast.error(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setDownloadingOnePager(false);
        }
    };

    const downloadReport = async (automationId: string, domain: string): Promise<void> => {
        try {
            setDownloadingReport(true);
            const repository = new AutomationRepositoryImpl();
            const downloadReportUseCase = new DownloadReportUseCase(repository);

            // Generate filename based on company name, domain and automation ID
            let fileName = `report_${domain.toLowerCase()}_${company?.name || 'company'}_${automationId}.pdf`;

            // Clean filename (remove special characters)
            fileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

            console.log("ViewModel: Downloading report with filename:", fileName);
            await downloadReportUseCase.execute(automationId, fileName);

            toast.success(`${domain} Report downloaded successfully`);
        } catch (err) {
            console.error("ViewModel: Report download error:", err);
            const errorMessage = err instanceof Error ? err.message : "Failed to download report";
            toast.error(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setDownloadingReport(false);
        }
    };

    const onePagerMarkdown = useMemo(() => {
        if (!company || !company.automations || company.automations.length === 0) {
            return null;
        }
        const getOnePagerMarkdownUseCase = new GetOnePagerMarkdownUseCase();
        const automation = company.automations.find(
            (a) => a.result && a.status === AutomationStatus.COMPLETED
        );
        if (!automation || !automation.result) {
            return null;
        }
        return getOnePagerMarkdownUseCase.execute(automation.result);
    }, [company]);

    const retryAutomation = useCallback(async (automationId: string) => {
        const automationRepository = new AutomationRepositoryImpl();
        try {
            await automationRepository.retryAutomation(automationId);
            toast.success("Automation retry started");
            await refetch();
        } catch (err) {
            console.error("Retry automation error:", err);
            toast.error(err instanceof Error ? err.message : "Failed to retry automation");
            throw err;
        }
    }, [refetch]);

    const deleteCompany = useCallback(async (companyId: string): Promise<void> => {
        const repository = new CompanyRepositoryImpl();
        const deleteCompanyUseCase = new DeleteCompanyUseCase(repository);

        try {
            const response = await deleteCompanyUseCase.execute(companyId);
            if (response.success) {
                toast.success(response.message);
            } else {
                throw new Error(response.message || "Failed to delete company");
            }
        } catch (err) {
            console.error("Delete company error:", err);
            const errorMessage = err instanceof Error ? err.message : "Failed to delete company";
            toast.error(errorMessage);
            throw err;
        }
    }, []);

    return {
        company,
        loading,
        error,
        refetch,
        handleAutomationSuccess,
        documents,
        documentsLoading,
        documentsError,
        downloadingIds,
        fetchDocuments,
        downloadDocument,
        downloadingOnePager,
        downloadOnePagerSummary,
        downloadOnePager,
        downloadingReport,
        downloadReport,
        onePagerMarkdown,
        startStage2,
        isPollingActive,
        pollCompanyData,
        deleteCompany,
        retryAutomation,
    };
}