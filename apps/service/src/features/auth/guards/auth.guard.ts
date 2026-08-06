import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common"
import { AuthService } from "@/features/auth/services/auth.service"
import {
    MissingAuthHeaderError,
    UnauthorizedError,
} from "@/features/auth/domain/errors/auth.errors"

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private readonly authService: AuthService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest()
        const authHeader = request.headers.authorization

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

        // Adiciona o usuário ao request para uso posterior
        request["user"] = payload

        return true
    }
}
