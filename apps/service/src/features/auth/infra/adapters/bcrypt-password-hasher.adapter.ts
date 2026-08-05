import { IPasswordHasher } from '@/features/auth/domain/interfaces/password-hasher.interface';
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class BcryptPasswordHasherAdapter implements IPasswordHasher {
    private readonly saltRounds = 10;

    async hash(password: string): Promise<string> {
        return bcrypt.hash(password, this.saltRounds);
    }

    async verify(password: string, hashedPassword: string): Promise<boolean> {
        return bcrypt.compare(password, hashedPassword);
    }
} 