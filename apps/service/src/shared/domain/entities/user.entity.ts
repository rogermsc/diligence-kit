export class User {
    id: string;
    email: string;
    password: string;
    name?: string;
    companyId?: string;
    created_at: Date;

    constructor(props: Partial<User>) {
        Object.assign(this, props);
    }
} 