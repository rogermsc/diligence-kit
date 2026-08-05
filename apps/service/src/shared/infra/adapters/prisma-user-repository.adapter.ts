import { Injectable, Logger } from '@nestjs/common';
import { IUserRepository } from '@/shared/repository/user-repository.interface';
import { User } from '@/shared/domain/entities/user.entity';
import { prisma } from "@/shared/infra/prisma"
import { DatabaseAccessError } from '@/shared/errors/db/data-base-error';

@Injectable()
export class PrismaUserRepositoryAdapter implements IUserRepository {

    async findByEmail(email: string): Promise<User | null> {
        try {
            const user = await prisma.user.findUnique({
                where: { email }
            });

            if (!user) return null;

            return new User({
                id: user.id,
                email: user.email,
                password: user.password,
                created_at: user.created_at,
                companyId: user.companyId ?? undefined,
            });
        } catch (error) {
            Logger.error(error);
            throw new DatabaseAccessError();
        }
    }

    async findById(id: string): Promise<User | null> {
        try {
            const user = await prisma.user.findUnique({
                where: { id }
            });

            if (!user) return null;

            return new User({
                id: user.id,
                email: user.email,
                password: user.password,
                created_at: user.created_at,
                companyId: user.companyId ?? undefined,
            });
        } catch (error) {
            Logger.error(error);
            throw new DatabaseAccessError();
        }
    }
} 