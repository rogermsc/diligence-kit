import { AgentType } from "@/features/onePager-agent/agent/domain/agent-type";

export enum ReportStatus {
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    UNTRACKED = 'UNTRACKED'
}

export class Report {
    private readonly id: string;
    private readonly automationId: string;
    private readonly companyId: string;
    private readonly domain: AgentType;
    private readonly status: ReportStatus;
    private readonly reportUrl: string;
    private readonly createdAt: Date;
    private readonly updatedAt: Date;

    constructor(
        id: string,
        automationId: string,
        companyId: string,
        domain: AgentType,
        status: ReportStatus,
        reportUrl: string,
        createdAt: Date = new Date(),
        updatedAt: Date = new Date()
    ) {
        this.id = id;
        this.automationId = automationId;
        this.companyId = companyId;
        this.domain = domain;
        this.status = status;
        this.reportUrl = reportUrl;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    // Getters
    getId(): string {
        return this.id;
    }

    getAutomationId(): string {
        return this.automationId;
    }

    getCompanyId(): string {
        return this.companyId;
    }

    getDomain(): AgentType {
        return this.domain;
    }

    getStatus(): ReportStatus {
        return this.status;
    }

    getReportUrl(): string {
        return this.reportUrl;
    }

    getCreatedAt(): Date {
        return this.createdAt;
    }

    getUpdatedAt(): Date {
        return this.updatedAt;
    }

    static create(
        automationId: string,
        companyId: string,
        domain: AgentType,
        reportUrl: string,
        status: ReportStatus = ReportStatus.COMPLETED
    ): Report {
        const id = crypto.randomUUID();
        return new Report(
            id,
            automationId,
            companyId,
            domain,
            status,
            reportUrl
        );
    }

    // Business methods
    markAsCompleted(): Report {
        return new Report(
            this.id,
            this.automationId,
            this.companyId,
            this.domain,
            ReportStatus.COMPLETED,
            this.reportUrl,
            this.createdAt,
            new Date()
        );
    }

    markAsFailed(): Report {
        return new Report(
            this.id,
            this.automationId,
            this.companyId,
            this.domain,
            ReportStatus.FAILED,
            this.reportUrl,
            this.createdAt,
            new Date()
        );
    }

    updateUrl(newUrl: string): Report {
        return new Report(
            this.id,
            this.automationId,
            this.companyId,
            this.domain,
            this.status,
            newUrl,
            this.createdAt,
            new Date()
        );
    }
}