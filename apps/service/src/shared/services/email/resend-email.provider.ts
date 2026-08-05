import { IEmailProvider } from '@/shared/domain/interfaces/email-provider.interface'
import { EmailConfigurationError, EmailProviderError } from '@/shared/errors/email/email-error'
import { Logger } from '@nestjs/common'
import { Resend } from 'resend'

export class ResendEmailProvider implements IEmailProvider {
    private readonly logger = new Logger(ResendEmailProvider.name)
    private resend: Resend

    constructor() {
        const apiKey = process.env.RESEND_API_KEY
        if (!apiKey) {
            this.logger.error('RESEND_API_KEY environment variable is not defined')
            throw new EmailConfigurationError()
        }

        this.resend = new Resend(apiKey)
        this.logger.log('ResendEmailProvider initialized successfully')
    }

    async send(from: string, to: string, subject: string, html?: string): Promise<void> {
        try {
            this.logger.debug(`Attempting to send email from ${from} to ${to}`, {
                subject,
                hasHtmlContent: !!html
            })

            const { error } = await this.resend.emails.send({
                from,
                to,
                subject,
                html: html || '<p>Mensagem vazia</p>',
            })

            if (error) {
                this.logger.error('Failed to send email through Resend', {
                    error,
                    from,
                    to,
                    subject
                })
                throw new EmailProviderError()
            }

            this.logger.debug('Email sent successfully', {
                from,
                to,
                subject
            })
        } catch (error) {
            if (error instanceof EmailProviderError) {
                throw error
            }

            this.logger.error('Unexpected error while sending email', {
                error,
                from,
                to,
                subject,
                stack: error instanceof Error ? error.stack : undefined
            })
            throw new EmailProviderError()
        }
    }
} 