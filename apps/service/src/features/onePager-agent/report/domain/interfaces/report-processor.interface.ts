import { ReportPayload } from "./report-payload.interface"
import { Automation } from "@/shared/domain/entities/automation.entity"

export interface ReportProcessor {
    execute(payload: ReportPayload, automation: Automation): Promise<void>
}
