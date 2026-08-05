export interface NotificationMessage {
    to: string
    subject: string
    content: string
    from?: string
}

export interface Notifier {
    send(message: NotificationMessage): Promise<void>
} 