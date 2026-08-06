export interface ChatMessageDto {
    user_message: string
    agent_response: string
    created_at: Date
}

export interface MessageHistoryResponseDto {
    session_id: string
    messages: ChatMessageDto[]
}
