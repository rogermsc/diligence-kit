import { ApplicationError } from '@/shared/errors/errors'

export type ReportAgentErrorType =
  | 'AUTOMATION_NOT_FOUND'
  | 'INVALID_AUTOMATION_STAGE'
  | 'AUTOMATION_CANNOT_START_DILIGENCE'
  | 'DOCUMENTS_NOT_FOUND'
  | 'DILIGENCE_CREATION_FAILED'
  | 'DILIGENCE_AUTOMATIONS_ALREADY_EXIST'

export class AutomationNotFoundError extends ApplicationError<ReportAgentErrorType> {
  constructor() {
    super({ message: 'Automation not found', code: 404, type: 'AUTOMATION_NOT_FOUND' })
  }
}

export class InvalidAutomationStageError extends ApplicationError<ReportAgentErrorType> {
  constructor() {
    super({ message: 'Automation stage must be TRIAGE', code: 409, type: 'INVALID_AUTOMATION_STAGE' })
  }
}

export class AutomationCanStartDiligenceError extends ApplicationError<ReportAgentErrorType> {
  constructor() {
    super({ message: 'Triage not completed', code: 409, type: 'AUTOMATION_CANNOT_START_DILIGENCE' })
  }
}

export class DocumentsNotFoundError extends ApplicationError<ReportAgentErrorType> {
  constructor() {
    super({ message: 'No documents found to dispatch', code: 409, type: 'DOCUMENTS_NOT_FOUND' })
  }
}

export class DiligenceCreationFailedError extends ApplicationError<ReportAgentErrorType> {
  constructor() {
    super({ message: 'Failed to create diligence automations', code: 500, type: 'DILIGENCE_CREATION_FAILED' })
  }
}

export class DiligenceAutomationsAlreadyExistError extends ApplicationError<ReportAgentErrorType> {
  constructor() {
    super({ message: 'Diligence automations already exist for this triage automation', code: 409, type: 'DILIGENCE_AUTOMATIONS_ALREADY_EXIST' })
  }
}

