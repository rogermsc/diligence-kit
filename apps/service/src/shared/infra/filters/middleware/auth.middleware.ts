import { Injectable, NestMiddleware } from "@nestjs/common"
import { Request, Response, NextFunction } from "express"
import { AuthService } from "@/features/auth/services/auth.service"
import {
    MissingAuthHeaderError,
    UnauthorizedError,
} from "@/features/auth/domain/errors/auth.errors"

@Injectable()
export class AuthMiddleware implements NestMiddleware {
    constructor(private readonly authService: AuthService) {}

    async use(req: Request, _res: Response, next: NextFunction) {
        const authHeader = req.headers.authorization

        if (!authHeader) {
            throw new MissingAuthHeaderError()
        }

        const [, token] = authHeader.split(" ")

        if (!token) {
            throw new UnauthorizedError("Invalid token format")
        }

        const payload = await this.authService.verifyAccessToken(token)

        if (!payload) {
            throw new UnauthorizedError("Invalid token")
        }

        req["user"] = payload

        next()
    }
}
