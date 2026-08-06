export class RefreshToken {
    id: string
    userId: string
    expiresAt: Date
    createdAt?: Date

    constructor(props: RefreshToken) {
        Object.assign(this, props)
    }
}
