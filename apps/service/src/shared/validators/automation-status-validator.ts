type StageLike =
    | "TRIAGE"
    | "DILLIGENCE_OPERATIONAL"
    | "DILLIGENCE_COMMERCIAL"
    | "DILLIGENCE_FINANCIAL"
    | "DILLIGENCE_CAP_TABLE_AND_LEGAL_REVIEW"

type StatusLike =
    | "NOT_STARTED"
    | "PENDING"
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED"

type AutomationLike = {
    stage: StageLike
    status: StatusLike
}

export class AutomationStatusValidator {
    // Classification helpers
    static isTriage(automation: AutomationLike): boolean {
        return automation.stage === "TRIAGE"
    }

    static isDilligence(automation: AutomationLike): boolean {
        return automation.stage.startsWith("DILLIGENCE_")
    }

    static isStartableStatus(status: StatusLike): boolean {
        return status === "NOT_STARTED" || status === "PENDING"
    }

    static canStartTriage(automation: AutomationLike): boolean {
        return (
            this.isTriage(automation) &&
            this.isStartableStatus(automation.status)
        )
    }

    static canCompleteTriage(automation: AutomationLike): boolean {
        return this.isTriage(automation) && automation.status === "PROCESSING"
    }

    // Mapping helpers: if precisar mapear a partir de strings externas
    static stageFromLabel(
        label:
            | "TRIAGE"
            | "OPERATIONAL"
            | "COMMERCIAL"
            | "FINANCIAL"
            | "CAP_TABLE_AND_LEGAL_REVIEW",
    ): StageLike {
        if (label === "OPERATIONAL") return "DILLIGENCE_OPERATIONAL"
        if (label === "COMMERCIAL") return "DILLIGENCE_COMMERCIAL"
        if (label === "FINANCIAL") return "DILLIGENCE_FINANCIAL"
        if (label === "CAP_TABLE_AND_LEGAL_REVIEW")
            return "DILLIGENCE_CAP_TABLE_AND_LEGAL_REVIEW"
        return "TRIAGE"
    }
}
