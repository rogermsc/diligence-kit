import { Result, OutputDocument } from '@prisma/client';
import { OutputDocumentCreateInput } from './output-document-repository.interface';

export interface ResultCreateInput {
    automationId: string;
    status: 'OK' | 'MISSING_DOCS';
}

export interface CreateResultWithDocumentsInput {
    resultData: ResultCreateInput;
    outputDocuments: OutputDocumentCreateInput[];
}

export interface CreateResultWithDocumentsOutput {
    result: Result;
    outputDocuments: OutputDocument[];
}

export interface IResultRepository {
    create(data: ResultCreateInput): Promise<Result>;
    createResultWithDocuments(data: CreateResultWithDocumentsInput): Promise<CreateResultWithDocumentsOutput>;
}
