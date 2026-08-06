import { Module } from "@nestjs/common"
import { LiaisonController } from "./presentation/liaison.controller"
import { LiaisonGatewayAxiosAdapter } from "./infra/adapters/liaison-gateway-axios.adapter"
import { AuthModule } from "@/features/auth/auth.module"

@Module({
    imports: [AuthModule],
    controllers: [LiaisonController],
    providers: [
        {
            provide: "LiaisonGateway",
            useClass: LiaisonGatewayAxiosAdapter,
        },
    ],
    exports: [],
})
export class LiaisonModule {}
