import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function createUser() {
    try {
        // Verifica se foram passados argumentos
        const email = process.argv[2];
        const password = process.argv[3];

        if (!email || !password) {
            console.log('Usage: npm run create:user <email> <password>');
            console.log('Example: npm run create:user admin@example.com mypassword123');
            process.exit(1);
        }

        // Valida o formato do email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.error('Error: Invalid email format');
            process.exit(1);
        }

        // Verifica se o usuário já existe
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            console.error(`Error: User with email ${email} already exists`);
            process.exit(1);
        }

        // Hash da senha
        const hashedPassword = await bcrypt.hash(password, 10);

        // Cria o usuário
        const user = await prisma.user.create({
            data: {
                id: randomUUID(),
                email,
                password: hashedPassword,
            },
        });

        console.log('✅ User created successfully!');
        console.log(`ID: ${user.id}`);
        console.log(`Email: ${user.email}`);
        console.log(`Created at: ${user.created_at}`);

    } catch (error) {
        console.error('Error creating user:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

createUser(); 