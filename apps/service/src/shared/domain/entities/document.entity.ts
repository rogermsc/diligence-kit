export class Document {
    constructor(
        public readonly id: string,
        public readonly automationId: string,
        public readonly name: string,
        public readonly bucketPath: string,
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
        public readonly openaiFileId?: string,
    ) {}
}
