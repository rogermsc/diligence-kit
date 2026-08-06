import { RefreshToken } from "@/shared/domain/entities/refresh-token.entity"

export interface IRefreshTokenRepository {
    create(token: RefreshToken): Promise<void>
    findById(id: string): Promise<RefreshToken | null>
    findByUserId(userId: string): Promise<RefreshToken | null>
    deleteById(id: string): Promise<void>
}
