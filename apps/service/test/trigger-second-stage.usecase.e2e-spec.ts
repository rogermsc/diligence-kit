import { Automation, AutomationStage, AutomationStatus } from '@/shared/domain/entities/automation.entity'
import { TriggerSecondStageUseCase } from '../src/features/report-agents/use-cases/trigger-second-stage.usecase'
import {
  AutomationNotFoundError,
  InvalidAutomationStageError,
  AutomationCanStartDiligenceError,
  DiligenceCreationFailedError,
} from '@/features/report-agents/domain/errors/report-agent.errors'
import { prisma } from '@/shared/infra/prisma'
import { AgentType } from '@/features/onePager/agent/domain/agent-type'

describe('TriggerSecondStageUseCase', () => {
  const makeAutomation = (overrides?: Partial<Automation>) =>
    new Automation(
      overrides?.id ?? 'auto-triage-1',
      overrides?.companyId ?? 'company-1',
      overrides?.status ?? AutomationStatus.COMPLETED,
      overrides?.results ?? [],
      overrides?.createdAt ?? new Date(),
      overrides?.updatedAt ?? new Date(),
      overrides?.stage ?? AutomationStage.TRIAGE,
      overrides?.domain ?? undefined,
    )

  const setup = () => {
    const automationRepository = {
      findById: jest.fn(),
      createMany: jest.fn(),
    }

    const resultRepository = {
      findLatestWithDocuments: jest.fn(),
    }

    const documentRepository = {
      createMany: jest.fn(),
    }

    const eventBus = {
      emit: jest.fn(),
    }

    const usecase = new TriggerSecondStageUseCase(
      // tokens are injected via strings in app, but direct constructor is fine in tests
      automationRepository as any,
      resultRepository as any,
      documentRepository as any,
      eventBus as any,
    )

    // Default: Prisma transaction simply runs the callback
    jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb({}))

    return { usecase, automationRepository, resultRepository, documentRepository, eventBus }
  }

  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('should throw AutomationNotFoundError when automation does not exist', async () => {
    const { usecase, automationRepository } = setup()
    automationRepository.findById.mockResolvedValueOnce(null)

    await expect(usecase.execute({ automationId: 'unknown' })).rejects.toBeInstanceOf(AutomationNotFoundError)
  })

  it('should throw InvalidAutomationStageError when stage is not TRIAGE', async () => {
    const { usecase, automationRepository } = setup()
    automationRepository.findById.mockResolvedValueOnce(
      makeAutomation({ stage: AutomationStage.DILIGENCE_COMMERCIAL }),
    )

    await expect(usecase.execute({ automationId: 'a1' })).rejects.toBeInstanceOf(InvalidAutomationStageError)
  })

  it('should throw AutomationCanStartDiligenceError when triage is not completed', async () => {
    const { usecase, automationRepository } = setup()
    automationRepository.findById.mockResolvedValueOnce(
      makeAutomation({ status: AutomationStatus.PROCESSING }),
    )

    await expect(usecase.execute({ automationId: 'a1' })).rejects.toBeInstanceOf(AutomationCanStartDiligenceError)
  })

  it('should create four automations, duplicate documents, emit events, and return IDs', async () => {
    const { usecase, automationRepository, resultRepository, documentRepository, eventBus } = setup()

    automationRepository.findById.mockResolvedValueOnce(makeAutomation())

    resultRepository.findLatestWithDocuments.mockResolvedValueOnce({
      result: { id: 'r1', automationId: 'auto-triage-1', status: 'OK', onePagerSummary: null },
      outputDocuments: [
        { id: 'od1', name: 'f1', status: 'OK', sector: 'FINANCIAL', documentId: 'd1', document: { id: 'd1', name: 'fin.pdf', bucketPath: 'gs://b/fin.pdf' } },
        { id: 'od2', name: 'l1', status: 'OK', sector: 'LEGAL', documentId: 'd2', document: { id: 'd2', name: 'legal.pdf', bucketPath: 'gs://b/legal.pdf' } },
        { id: 'od3', name: 'c1', status: 'OK', sector: 'CORPORATE', documentId: 'd3', document: { id: 'd3', name: 'corp.pdf', bucketPath: 'gs://b/corp.pdf' } },
        { id: 'od4', name: 'cl1', status: 'OK', sector: 'CLIENTS', documentId: 'd4', document: { id: 'd4', name: 'clients.pdf', bucketPath: 'gs://b/clients.pdf' } },
        { id: 'od5', name: 'i1', status: 'OK', sector: 'INVESTMENT', documentId: 'd5', document: { id: 'd5', name: 'inv.pdf', bucketPath: 'gs://b/inv.pdf' } },
        { id: 'od6', name: 'cs1', status: 'OK', sector: 'COMPANY_SUMMARY', documentId: 'd6', document: { id: 'd6', name: 'summary.pdf', bucketPath: 'gs://b/summary.pdf' } },
        { id: 'od7', name: 't1', status: 'OK', sector: 'TEAM', documentId: 'd7', document: { id: 'd7', name: 'team.pdf', bucketPath: 'gs://b/team.pdf' } },
      ],
    })

    automationRepository.createMany.mockResolvedValueOnce([
      new Automation('op-1', 'company-1', AutomationStatus.PENDING, [], new Date(), new Date()),
      new Automation('cm-1', 'company-1', AutomationStatus.PENDING, [], new Date(), new Date()),
      new Automation('fi-1', 'company-1', AutomationStatus.PENDING, [], new Date(), new Date()),
      new Automation('lg-1', 'company-1', AutomationStatus.PENDING, [], new Date(), new Date()),
    ])

    const output = await usecase.execute({ automationId: 'auto-triage-1' })

    // Returns IDs in the expected positions
    expect(output).toEqual({
      operationalId: 'op-1',
      commercialId: 'cm-1',
      financialId: 'fi-1',
      capTableAndLegalReviewId: 'lg-1',
    })

    // Creates four automations
    expect(automationRepository.createMany).toHaveBeenCalledTimes(1)
    const createdData = automationRepository.createMany.mock.calls[0][0]
    expect(createdData).toHaveLength(4)
    expect(createdData.map((d: any) => d.status)).toEqual([
      AutomationStatus.PENDING,
      AutomationStatus.PENDING,
      AutomationStatus.PENDING,
      AutomationStatus.PENDING,
    ])

    // Duplicates documents
    expect(documentRepository.createMany).toHaveBeenCalledTimes(1)
    const docs = documentRepository.createMany.mock.calls[0][0]
    // One or more per domain
    expect(docs.some((x: any) => x.automationId === 'fi-1' && x.name === 'fin.pdf')).toBe(true)
    expect(docs.some((x: any) => x.automationId === 'lg-1' && (x.name === 'legal.pdf' || x.name === 'corp.pdf'))).toBe(true)
    expect(docs.some((x: any) => x.automationId === 'cm-1' && (x.name === 'clients.pdf' || x.name === 'inv.pdf'))).toBe(true)
    expect(docs.some((x: any) => x.automationId === 'op-1' && (x.name === 'summary.pdf' || x.name === 'team.pdf'))).toBe(true)

    // Emits events for all four automations
    expect(eventBus.emit).toHaveBeenCalledTimes(4)
    const calls = eventBus.emit.mock.calls
    expect(calls.map((c: any) => c[0])).toEqual([
      'agent.reports.start',
      'agent.reports.start',
      'agent.reports.start',
      'agent.reports.start',
    ])
    const payloads = calls.map((c: any) => c[1])
    expect(payloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ automationId: 'op-1', domain: AgentType.OPERATIONAL }),
        expect.objectContaining({ automationId: 'cm-1', domain: AgentType.COMMERCIAL }),
        expect.objectContaining({ automationId: 'fi-1', domain: AgentType.FINANCIAL }),
        expect.objectContaining({ automationId: 'lg-1', domain: AgentType.CAP_TABLE_AND_LEGAL_REVIEW }),
      ]),
    )
  })

  it('should rollback and throw DiligenceCreationFailedError when transaction fails', async () => {
    const { usecase, automationRepository, resultRepository } = setup()
    automationRepository.findById.mockResolvedValueOnce(makeAutomation())
    resultRepository.findLatestWithDocuments.mockResolvedValueOnce({
      result: { id: 'r1', automationId: 'auto-triage-1', status: 'OK', onePagerSummary: null },
      outputDocuments: [
        { id: 'od1', name: 'f1', status: 'OK', sector: 'FINANCIAL', documentId: 'd1', document: { id: 'd1', name: 'fin.pdf', bucketPath: 'gs://b/fin.pdf' } },
      ],
    })

    jest
      .spyOn(prisma, '$transaction')
      .mockImplementationOnce(async () => {
        throw new Error('tx failed')
      })

    await expect(usecase.execute({ automationId: 'auto-triage-1' })).rejects.toBeInstanceOf(
      DiligenceCreationFailedError,
    )
  })
})

