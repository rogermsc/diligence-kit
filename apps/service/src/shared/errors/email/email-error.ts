import { ApplicationError } from '../errors'
import { EmailErrorType } from './types'

export class EmailSendError extends ApplicationError<EmailErrorType> {
    constructor(message: string, cause?: Error) {
        super({
            message,
            code: 500,
            type: EmailErrorType.SEND_ERROR
        })
    }
}

export class MissingNotificationEmailError extends ApplicationError<EmailErrorType> {
    constructor() {
        super({
            message: 'Notification email is not configured. Please set AUTOMATION_NOTIFICATION_EMAIL in environment variables.',
            code: 500,
            type: EmailErrorType.MISSING_NOTIFICATION_EMAIL
        })
    }
}

export class MissingSenderEmailError extends ApplicationError<EmailErrorType> {
    constructor() {
        super({
            message: 'Sender email is required. Please provide a "from" address in the notification message.',
            code: 400,
            type: EmailErrorType.MISSING_SENDER_EMAIL
        })
    }
}

export class MissingDestinationEmailError extends ApplicationError<EmailErrorType> {
    constructor() {
        super({
            message: 'Destination email is not configured. Please set EMAIL_DESTINATION in environment variables.',
            code: 500,
            type: EmailErrorType.MISSING_DESTINATION_EMAIL
        })
    }
}

export class EmailProviderError extends ApplicationError<EmailErrorType> {
    constructor() {
        super({
            message: 'Failed to send email',
            code: 500,
            type: EmailErrorType.PROVIDER_ERROR
        })
    }
}

export class EmailConfigurationError extends ApplicationError<EmailErrorType> {
    constructor() {
        super({
            message: 'Email service is not properly configured',
            code: 500,
            type: EmailErrorType.CONFIGURATION_ERROR
        })
    }
} 