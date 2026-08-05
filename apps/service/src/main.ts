import { ErrorDispatcherService } from "@/shared/errors/error-dispatcher.service"
import { ApplicationExceptionFilter } from "@/shared/infra/filters/application-exception"
import { NestFactory } from "@nestjs/core"
import { NestExpressApplication } from "@nestjs/platform-express"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import { json, urlencoded } from "express"
import { config } from "dotenv"
import { AppModule } from "./app.module"
import { EnvValidator } from "@/shared/validators/env-validator"

async function bootstrap() {
    config()

    // Validate environment variables before starting the application
    try {
        EnvValidator.validateEnvironmentVariables()
        EnvValidator.getEnvSummary()
    } catch (error) {
        console.error('💥 Failed to start application due to environment validation errors:')
        console.error(error.message)
        process.exit(1)
    }

    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        bodyParser: false,
    })

    app.use(json({
        limit: '5mb',
        verify: (req: any, _res, buf) => { req.rawBody = buf },
    }))
    app.use(urlencoded({ extended: true, limit: '5mb' }))

    app.use((_req: any, res: any, next: any) => {
        res.removeHeader('X-Powered-By')
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.setHeader('X-Frame-Options', 'DENY')
        res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
        next()
    })

    const errorDispatcher = app.get(ErrorDispatcherService)
    app.useGlobalFilters(new ApplicationExceptionFilter(errorDispatcher))
    app.enableCors({
        origin: process.env.CORS_ORIGIN || false,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        credentials: true,
    })

    if (process.env.NODE_ENV !== 'production') {
        const configSwagger = new DocumentBuilder()
            .setTitle("API")
            .setDescription("API Diligence Kit backend")
            .setVersion("1.0")
            .addBasicAuth(
                {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
                "access-token",
            )
            .build()

        const document = SwaggerModule.createDocument(app, configSwagger)
        SwaggerModule.setup("docs", app, document)
    }

    const port = process.env.PORT ?? 3000
    await app.listen(port)
    console.log(`\n🚀 Server is running on: http://localhost:${port}`)
    if (process.env.NODE_ENV !== 'production') {
        console.log(`📚 API Documentation available at: http://localhost:${port}/docs\n`)
    }
}
bootstrap()
