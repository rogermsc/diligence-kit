export enum AutomationStatus {
    PENDING = "PENDING",
    PROCESSING = "PROCESSING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
}

export enum AutomationStageDomain {
    TRIAGE = "TRIAGE",
    DILLIGENCE_OPERATIONAL = "DILLIGENCE_OPERATIONAL",
    DILLIGENCE_COMMERCIAL = "DILLIGENCE_COMMERCIAL",
    DILLIGENCE_FINANCIAL = "DILLIGENCE_FINANCIAL",
    DILLIGENCE_CAP_TABLE_AND_LEGAL_REVIEW = "DILLIGENCE_CAP_TABLE_AND_LEGAL_REVIEW",
}

export class Automation {
    constructor(
        public readonly id: string,
        public readonly companyId: string,
        public readonly status: AutomationStatus,
        public readonly stage: AutomationStageDomain,
        public readonly results: any[],
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
        public readonly parentAutomationId?: string,
    ) {}

    static create(props: {
        id?: string
        companyId: string
        status?: AutomationStatus
        stage?: AutomationStageDomain
        results?: any[]
        createdAt?: Date
        updatedAt?: Date
        parentAutomationId?: string
    }): Automation {
        return new Automation(
            props.id || "",
            props.companyId,
            props.status || AutomationStatus.PENDING,
            props.stage || AutomationStageDomain.TRIAGE,
            props.results || [],
            props.createdAt || new Date(),
            props.updatedAt || new Date(),
            props.parentAutomationId,
        )
    }

    updateStatus(status: AutomationStatus): Automation {
        return new Automation(
            this.id,
            this.companyId,
            status,
            this.stage,
            this.results,
            this.createdAt,
            new Date(),
            this.parentAutomationId,
        )
    }

    toJSON() {
        return {
            id: this.id,
            companyId: this.companyId,
            status: this.status,
            stage: this.stage,
            results: this.results,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            parentAutomationId: this.parentAutomationId,
        }
    }
}
