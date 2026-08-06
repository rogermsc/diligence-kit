import { Injectable, OnModuleDestroy } from "@nestjs/common"
import { Redis } from "ioredis"
import { TooManyLoginAttemptsError } from "@/features/auth/domain/errors/auth.errors"

const MAX_ATTEMPTS = 5
const WINDOW_SECONDS = 15 * 60 // 15 minutes

@Injectable()
export class LoginRateLimiterService implements OnModuleDestroy {
    private readonly redis: Redis

    constructor() {
        this.redis = new Redis({
            host: process.env.REDIS_HOST!,
            port: parseInt(process.env.REDIS_PORT!),
            lazyConnect: true,
        })
    }

    async onModuleDestroy() {
        await this.redis.quit()
    }

    private key(email: string): string {
        return `login:attempts:${email}`
    }

    async recordFailure(email: string): Promise<void> {
        const k = this.key(email)
        const count = await this.redis.incr(k)
        if (count === 1) {
            await this.redis.expire(k, WINDOW_SECONDS)
        }
        if (count >= MAX_ATTEMPTS) {
            const ttl = await this.redis.ttl(k)
            const minutesLeft = Math.ceil(ttl / 60)
            throw new TooManyLoginAttemptsError(minutesLeft, ttl * 1000)
        }
    }

    async assertNotBlocked(email: string): Promise<void> {
        const k = this.key(email)
        const count = await this.redis.get(k)
        if (count && parseInt(count) >= MAX_ATTEMPTS) {
            const ttl = await this.redis.ttl(k)
            const minutesLeft = Math.ceil(ttl / 60)
            throw new TooManyLoginAttemptsError(minutesLeft, ttl * 1000)
        }
    }

    async resetAttempts(email: string): Promise<void> {
        await this.redis.del(this.key(email))
    }
}
