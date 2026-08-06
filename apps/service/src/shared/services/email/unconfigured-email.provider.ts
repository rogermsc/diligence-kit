import { IEmailProvider } from "@/shared/domain/interfaces/email-provider.interface"
import { Logger } from "@nestjs/common"

/**
 * Stands in when SMTP is not configured.
 *
 * Email here is a completion notification, not part of any critical path, and
 * ENV_VARIABLES.md documents the SMTP settings as optional. Constructing the
 * real provider without them threw, and because it is built in a module factory
 * that took the whole application down at startup — an optional feature making
 * a first run impossible. This logs what would have been sent and continues.
 */
export class UnconfiguredEmailProvider implements IEmailProvider {
    private readonly logger = new Logger(UnconfiguredEmailProvider.name)

    send(from: string, to: string, subject: string): Promise<void> {
        this.logger.warn(
            `Email not sent — SMTP is not configured. Would have sent "${subject}" ` +
                `from ${from} to ${to}. Set SMTP_HOST, SMTP_PORT, SMTP_USER and ` +
                `SMTP_PASS to enable delivery.`,
        )
        return Promise.resolve()
    }
}

/** True when every SMTP setting the real provider needs is present. */
export function isSmtpConfigured(): boolean {
    return Boolean(
        process.env.SMTP_HOST &&
        process.env.SMTP_PORT &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS,
    )
}
