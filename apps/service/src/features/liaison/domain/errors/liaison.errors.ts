export class LiaisonAgentError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LiaisonAgentError';
    }
}

export class LiaisonAgentConnectionError extends LiaisonAgentError {
    constructor(message: string = 'Failed to connect to liaison agent') {
        super(message);
        this.name = 'LiaisonAgentConnectionError';
    }
}

export class LiaisonAgentTimeoutError extends LiaisonAgentError {
    constructor(message: string = 'Liaison agent request timed out') {
        super(message);
        this.name = 'LiaisonAgentTimeoutError';
    }
}
