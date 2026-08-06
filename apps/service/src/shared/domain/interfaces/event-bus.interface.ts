export interface EventHandler<T = any> {
    handle(event: T): Promise<void>
}

export interface EventBusPort {
    emit(eventName: string, data: any): Promise<void>
    on(eventName: string, handler: EventHandler): void
    off(eventName: string, handler: EventHandler): void
}

export interface JobOptions {
    attempts?: number
    backoff?: "fixed" | "exponential"
    delay?: number
    priority?: number
}

export interface JobStatus {
    id: string
    status: "waiting" | "active" | "completed" | "failed" | "delayed"
    progress?: number
    data?: any
    error?: string
}
