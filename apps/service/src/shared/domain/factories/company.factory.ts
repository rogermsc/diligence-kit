import { Company } from "@/shared/domain/entities/company.entity"

export interface CompanyFactoryProps {
    id?: string
    name: string
    email?: string
    createdAt?: Date
    updatedAt?: Date
}

export class CompanyFactory {
    static create(props: {
        id?: string
        name: string
        createdAt?: Date
        updatedAt?: Date
    }) {
        return Company.create({
            id: props.id,
            name: props.name,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
        })
    }

    static createFromPrisma(props: {
        id: string
        name: string
        createdAt: Date
        updatedAt: Date
    }) {
        return new Company(
            props.id,
            props.name,
            props.createdAt,
            props.updatedAt,
        )
    }
}
