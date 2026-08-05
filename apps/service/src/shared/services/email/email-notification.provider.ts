import { IEmailProvider } from '@/shared/domain/interfaces/email-provider.interface'
import { NotificationMessage, Notifier } from '@/shared/domain/interfaces/notifier.interface'
import { MissingSenderEmailError } from '@/shared/errors/email/email-error'

export class EmailNotificationProvider implements Notifier {
    constructor(private readonly emailProvider: IEmailProvider) { }

    async send(message: NotificationMessage): Promise<void> {
        if (!message.from) {
            throw new MissingSenderEmailError()
        }

        await this.emailProvider.send(
            message.from,
            message.to,
            message.subject,
            message.content
        )
    }
} 