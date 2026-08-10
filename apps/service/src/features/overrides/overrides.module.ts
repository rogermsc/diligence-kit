import { Module } from "@nestjs/common"

import { AuthModule } from "@/features/auth/auth.module"
import { PrismaOverrideRepositoryAdapter } from "@/shared/infra/adapters/prisma-override-repository.adapter"

import { OverridesController } from "./presentation/overrides.controller"
import { CreateOverrideUseCase } from "./use-case/create-override.usecase"
import { ListOverridesUseCase } from "./use-case/list-overrides.usecase"
import { RevertOverrideUseCase } from "./use-case/revert-override.usecase"

@Module({
    imports: [AuthModule],
    controllers: [OverridesController],
    providers: [
        {
            provide: "OverrideRepository",
            useClass: PrismaOverrideRepositoryAdapter,
        },
        CreateOverrideUseCase,
        ListOverridesUseCase,
        RevertOverrideUseCase,
    ],
    exports: [ListOverridesUseCase],
})
export class OverridesModule {}
