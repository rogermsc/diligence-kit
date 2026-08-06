import { User } from "@/shared/domain/entities/user.entity"
import { User as PrismaUser } from "@prisma/client"

export class UserMapper {
    static toDomain(prismaUser: PrismaUser): User {
        return new User({
            id: prismaUser.id,
            email: prismaUser.email,
            password: prismaUser.password,
            companyId: prismaUser.companyId ?? undefined,
            created_at: prismaUser.created_at,
        })
    }

    static toPrisma(user: User): PrismaUser {
        return {
            id: user.id,
            email: user.email,
            password: user.password,
            companyId: user.companyId ?? null,
            created_at: user.created_at,
        }
    }
}
