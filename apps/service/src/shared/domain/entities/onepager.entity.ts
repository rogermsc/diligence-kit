export class OnePager {
    constructor(
        public readonly id: string,
        public readonly automationId: string,
        public readonly companyId: string,
        public readonly url: string,
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
    ) {}

    static create(props: {
        id?: string
        automationId: string
        companyId: string
        url: string
        createdAt?: Date
        updatedAt?: Date
    }): OnePager {
        return new OnePager(
            props.id || "",
            props.automationId,
            props.companyId,
            props.url,
            props.createdAt || new Date(),
            props.updatedAt || new Date(),
        )
    }

    toJSON() {
        return {
            id: this.id,
            automationId: this.automationId,
            companyId: this.companyId,
            url: this.url,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        }
    }
}
