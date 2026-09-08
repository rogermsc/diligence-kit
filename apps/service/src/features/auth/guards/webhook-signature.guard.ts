import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from "@nestjs/common"
import { createHmac, timingSafeEqual } from "crypto"
import { Request } from "express"

/**
 * How long a signed callback stays valid.
 *
 * The signature used to cover the body alone, so a captured callback was good
 * forever. That mattered most for complete-onepager-error, which the backend
 * applied unconditionally — replaying an old one demoted a COMPLETED
 * automation to FAILED. Five minutes is long enough to absorb clock skew and a
 * retry, short enough that a captured request is not a standing weapon.
 */
const MAX_SIGNATURE_AGE_SECONDS = 300

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
    private readonly secret: Buffer

    constructor() {
        this.secret = Buffer.from(process.env.WEBHOOK_SECRET!, "utf-8")
    }

    canActivate(context: ExecutionContext): boolean {
        const request = context
            .switchToHttp()
            .getRequest<Request & { rawBody?: Buffer }>()

        const signature = request.headers["x-webhook-signature"] as
            | string
            | undefined
        if (!signature?.startsWith("sha256=")) {
            throw new UnauthorizedException(
                "Missing or malformed webhook signature",
            )
        }

        const rawBody = request.rawBody
        if (!rawBody?.length) {
            throw new UnauthorizedException(
                "Raw body unavailable for signature verification",
            )
        }

        const timestamp = request.headers["x-webhook-timestamp"] as
            | string
            | undefined
        if (!timestamp || !/^\d{1,15}$/.test(timestamp)) {
            throw new UnauthorizedException(
                "Missing or malformed webhook timestamp",
            )
        }

        // Rejected in both directions. A far-future timestamp is not a clock
        // that needs tolerating — it is a replay reaching for a longer window.
        const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp))
        if (ageSeconds > MAX_SIGNATURE_AGE_SECONDS) {
            throw new UnauthorizedException("Webhook signature has expired")
        }

        // The timestamp is signed, not merely sent, so it cannot be edited to
        // move the window. The "." separator cannot appear in a decimal
        // timestamp, so there is exactly one way to split the signed material.
        const expected = Buffer.from(
            "sha256=" +
                createHmac("sha256", this.secret)
                    .update(`${timestamp}.`)
                    .update(rawBody)
                    .digest("hex"),
            "utf-8",
        )
        const received = Buffer.from(signature, "utf-8")

        if (
            expected.length !== received.length ||
            !timingSafeEqual(expected, received)
        ) {
            throw new UnauthorizedException("Invalid webhook signature")
        }

        return true
    }
}
