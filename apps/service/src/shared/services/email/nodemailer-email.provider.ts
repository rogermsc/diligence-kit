import { IEmailProvider } from '@/shared/domain/interfaces/email-provider.interface'
import { EmailConfigurationError, EmailProviderError } from '@/shared/errors/email/email-error'
import { Logger } from '@nestjs/common'
import * as nodemailer from 'nodemailer'

export interface NodemailerConfig {
    host: string
    port: number
    secure: boolean
    auth: {
        user: string
        pass: string
    }
}

export class NodemailerEmailProvider implements IEmailProvider {
    private readonly logger = new Logger(NodemailerEmailProvider.name)
    private transporter: nodemailer.Transporter

    constructor(config?: NodemailerConfig) {
        try {
            const emailConfig = config || this.getConfigFromEnv()
            this.transporter = nodemailer.createTransport(emailConfig)
            this.logger.log('NodemailerEmailProvider initialized successfully')
        } catch (error) {
            this.logger.error('Failed to initialize NodemailerEmailProvider', {
                error,
                stack: error instanceof Error ? error.stack : undefined
            })
            throw new EmailConfigurationError()
        }
    }

    private getConfigFromEnv(): NodemailerConfig {
        const host = process.env.SMTP_HOST
        const port = process.env.SMTP_PORT
        const user = process.env.SMTP_USER
        const pass = process.env.SMTP_PASS
        const secure = process.env.SMTP_SECURE === 'true'

        if (!host || !port || !user || !pass) {
            this.logger.error('Missing SMTP configuration in environment variables')
            throw new EmailConfigurationError()
        }

        return {
            host,
            port: parseInt(port, 10),
            secure,
            auth: { user, pass }
        }
    }

    async send(from: string, to: string, subject: string, html?: string): Promise<void> {
        try {
            this.logger.debug(`Attempting to send email from ${from} to ${to}`, {
                subject,
                hasHtmlContent: !!html
            })

            await this.transporter.sendMail({
                from,
                to,
                subject,
                html: html || '<p>Mensagem vazia</p>'
            })

            this.logger.debug('Email sent successfully', {
                from,
                to,
                subject
            })
        } catch (error) {
            this.logger.error('Failed to send email through Nodemailer', {
                error,
                from,
                to,
                subject,
                stack: error instanceof Error ? error.stack : undefined
            })
            throw new EmailProviderError()
        }
    }

    async verifyConnection(): Promise<boolean> {
        try {
            await this.transporter.verify()
            this.logger.log('SMTP connection verified successfully')
            return true
        } catch (error) {
            this.logger.error('SMTP connection verification failed', {
                error,
                stack: error instanceof Error ? error.stack : undefined
            })
            return false
        }
    }
} 