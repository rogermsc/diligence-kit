export class Company {
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
    ) {}

    static create(props: {
        id?: string
        name: string
        createdAt?: Date
        updatedAt?: Date
    }): Company {
        return new Company(
            props.id || "",
            props.name,
            props.createdAt || new Date(),
            props.updatedAt || new Date(),
        )
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        }
    }
}
