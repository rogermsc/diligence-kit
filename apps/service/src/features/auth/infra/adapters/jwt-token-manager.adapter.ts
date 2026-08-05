import { Injectable } from "@nestjs/common"
import {
    ITokenManager,
    UserJwt,
} from "@/features/auth/domain/interfaces/token-manager.interface"
import { SignOptions, Secret } from "jsonwebtoken"
import * as jwt from "jsonwebtoken"
import { User } from "@/shared/domain/entities/user.entity"

/**
 * Access and refresh tokens are signed with the same secret and algorithm, so the
 * only thing separating them is this claim. Both verifiers check it: without that,
 * a refresh token presented as a bearer credential verifies fine and authenticates
 * a request whose user id is undefined.
 */
const TOKEN_TYPE = {
    access: "access",
    refresh: "refresh",
} as const

type AccessTokenPayload = {
    sub: string
    email: string
    name: string
    typ: typeof TOKEN_TYPE.access
}

type RefreshTokenPayload = {
    refreshTokenId: string
    typ: typeof TOKEN_TYPE.refresh
}

@Injectable()
export class JwtTokenManagerAdapter implements ITokenManager {
    private readonly secret: Secret
    private readonly defaultExpiresIn: string
    private readonly refreshExpiresIn: string

    constructor() {
        this.secret = process.env.JWT_SECRET!
        this.defaultExpiresIn = process.env.JWT_EXPIRES_IN || "24h"
        // Must match the expiresAt written to the refresh_tokens row, or the JWT
        // expires days before the database thinks the session ended.
        this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "7d"
    }

    async generate(user: User, expire?: string): Promise<string> {
        const payload: AccessTokenPayload = {
            sub: user.id,
            email: user.email,
            name: user.name || "",
            typ: TOKEN_TYPE.access,
        }

        const options = {
            algorithm: "HS256" as const,
            expiresIn: expire || this.defaultExpiresIn,
        } as SignOptions

        return jwt.sign(payload, this.secret, options)
    }

    async generateRefreshToken(
        refreshTokenId: string,
        expire?: string,
    ): Promise<string> {
        const payload: RefreshTokenPayload = {
            refreshTokenId,
            typ: TOKEN_TYPE.refresh,
        }
        const options = {
            algorithm: "HS256" as const,
            expiresIn: expire || this.refreshExpiresIn,
        } as SignOptions
        return jwt.sign(payload, this.secret, options)
    }

    async verifyAccessToken(token: string): Promise<UserJwt | null> {
        try {
            const decoded = jwt.verify(token, this.secret, {
                algorithms: ["HS256"],
            }) as Partial<AccessTokenPayload>

            if (decoded.typ !== TOKEN_TYPE.access) return null
            // A payload without a subject would authenticate a request as user
            // `undefined`, which downstream code reads as "no tenant filter".
            if (!decoded.sub) return null

            return {
                id: decoded.sub,
                name: decoded.name ?? "",
                email: decoded.email ?? "",
            }
        } catch {
            return null
        }
    }

    async verifyRefreshToken(
        token: string,
    ): Promise<{ refreshTokenId: string } | null> {
        try {
            const decoded = jwt.verify(token, this.secret, {
                algorithms: ["HS256"],
            }) as Partial<RefreshTokenPayload>

            if (decoded.typ !== TOKEN_TYPE.refresh) return null
            if (!decoded.refreshTokenId) return null

            return { refreshTokenId: decoded.refreshTokenId }
        } catch {
            return null
        }
    }
}
