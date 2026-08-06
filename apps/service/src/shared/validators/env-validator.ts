import { Logger } from "@nestjs/common"

export interface EnvConfig {
    // Database
    DATABASE_URL: string

    // Redis
    REDIS_HOST: string
    REDIS_PORT: string

    // Server
    PORT?: string

    // Google Cloud Storage
    GCLOUD_STORAGE_BUCKET: string

    // Agent API
    AGENT_API_URL: string
    LIAISON_AGENT_URL: string
    LIAISON_API_KEY: string

    // JWT
    JWT_SECRET: string
    JWT_EXPIRES_IN?: string
    JWT_REFRESH_EXPIRES_IN?: string

    // Email SMTP
    SMTP_HOST?: string
    SMTP_PORT?: string
    SMTP_USER?: string
    SMTP_PASS?: string
    SMTP_SECURE?: string

    // Email providers
    EMAIL_SENDER?: string
    EMAIL_DESTINATION?: string
    RESEND_API_KEY?: string

    // Feature flags
    ONEPAGER_INCREMENTAL_ENABLED?: string

    // Agent auth
    AGENT_SECRET: string
    AGENT_API_KEY: string
    WEBHOOK_SECRET: string
}

export class EnvValidator {
    private static readonly logger = new Logger(EnvValidator.name)

    // Required environment variables
    private static readonly REQUIRED_VARS: (keyof EnvConfig)[] = [
        "DATABASE_URL",
        "REDIS_HOST",
        "REDIS_PORT",
        "GCLOUD_STORAGE_BUCKET",
        "AGENT_API_URL",
        "LIAISON_AGENT_URL",
        "LIAISON_API_KEY",
        "JWT_SECRET",
        "AGENT_SECRET",
        "AGENT_API_KEY",
        "WEBHOOK_SECRET",
    ]

    // Optional environment variables with default values
    private static readonly OPTIONAL_WITH_DEFAULTS: Record<
        keyof EnvConfig,
        string
    > = {
        DATABASE_URL: "",
        REDIS_HOST: "",
        REDIS_PORT: "",
        PORT: "3000",
        GCLOUD_STORAGE_BUCKET: "",
        AGENT_API_URL: "",
        LIAISON_AGENT_URL: "",
        LIAISON_API_KEY: "",
        JWT_SECRET: "",
        JWT_EXPIRES_IN: "24h",
        JWT_REFRESH_EXPIRES_IN: "7d",
        SMTP_HOST: "",
        SMTP_PORT: "587",
        SMTP_USER: "",
        SMTP_PASS: "",
        SMTP_SECURE: "false",
        EMAIL_SENDER: "",
        EMAIL_DESTINATION: "",
        RESEND_API_KEY: "",
        ONEPAGER_INCREMENTAL_ENABLED: "false",
        AGENT_SECRET: "",
        AGENT_API_KEY: "",
        WEBHOOK_SECRET: "",
    }

    static validateEnvironmentVariables(): EnvConfig {
        const missingVars: string[] = []
        const config: Partial<EnvConfig> = {}

        this.logger.log("🔍 Validating environment variables...")

        // Check required variables
        for (const varName of this.REQUIRED_VARS) {
            const value = process.env[varName]
            if (!value || value.trim() === "") {
                missingVars.push(varName)
            } else {
                config[varName] = value
                this.logger.log(`✅ ${varName}: *** (set)`)
            }
        }

        // Check optional variables and set defaults
        for (const [varName, defaultValue] of Object.entries(
            this.OPTIONAL_WITH_DEFAULTS,
        )) {
            const key = varName as keyof EnvConfig
            if (this.REQUIRED_VARS.includes(key)) continue // Skip required vars already processed

            const value = process.env[key] || defaultValue
            config[key] = value

            if (process.env[key]) {
                this.logger.log(`✅ ${key}: *** (set)`)
            } else {
                this.logger.log(`⚠️ ${key}: using default "${defaultValue}"`)
            }
        }

        // Throw error if required variables are missing
        if (missingVars.length > 0) {
            const errorMessage = `❌ Missing required environment variables: ${missingVars.join(", ")}`
            this.logger.error(errorMessage)
            throw new Error(errorMessage)
        }

        // Validate specific formats
        this.validateSpecificFormats(config as EnvConfig)

        this.logger.log("✅ All environment variables validated successfully")
        return config as EnvConfig
    }

    private static validateSpecificFormats(config: EnvConfig): void {
        // Validate PORT is a number
        if (config.PORT && isNaN(parseInt(config.PORT))) {
            throw new Error(
                `❌ PORT must be a valid number, got: ${config.PORT}`,
            )
        }

        // Validate REDIS_PORT is a number
        if (config.REDIS_PORT && isNaN(parseInt(config.REDIS_PORT))) {
            throw new Error(
                `❌ REDIS_PORT must be a valid number, got: ${config.REDIS_PORT}`,
            )
        }

        // Validate SMTP_PORT is a number
        if (config.SMTP_PORT && isNaN(parseInt(config.SMTP_PORT))) {
            throw new Error(
                `❌ SMTP_PORT must be a valid number, got: ${config.SMTP_PORT}`,
            )
        }

        // Validate boolean flags
        const booleanVars = ["SMTP_SECURE", "ONEPAGER_INCREMENTAL_ENABLED"]
        for (const varName of booleanVars) {
            const value = config[varName as keyof EnvConfig]
            if (value && !["true", "false"].includes(value.toLowerCase())) {
                this.logger.warn(
                    `⚠️ ${varName} should be 'true' or 'false', got: ${value}`,
                )
            }
        }

        // Validate URLs
        if (config.AGENT_API_URL && !config.AGENT_API_URL.startsWith("http")) {
            throw new Error(
                `❌ AGENT_API_URL must be a valid URL, got: ${config.AGENT_API_URL}`,
            )
        }

        // Validate secret entropy
        if (config.JWT_SECRET && config.JWT_SECRET.length < 32) {
            throw new Error("❌ JWT_SECRET must be at least 32 characters long")
        }
        if (config.AGENT_SECRET && config.AGENT_SECRET.length < 32) {
            throw new Error(
                "❌ AGENT_SECRET must be at least 32 characters long",
            )
        }
        if (
            config.JWT_SECRET &&
            config.AGENT_SECRET &&
            config.JWT_SECRET === config.AGENT_SECRET
        ) {
            throw new Error(
                "❌ JWT_SECRET and AGENT_SECRET must be different values",
            )
        }
        if (config.WEBHOOK_SECRET && config.WEBHOOK_SECRET.length < 32) {
            throw new Error(
                "❌ WEBHOOK_SECRET must be at least 32 characters long",
            )
        }
    }

    static getEnvSummary(): void {
        this.logger.log("📋 Environment Variables Summary:")
        this.logger.log(
            `   🌍 NODE_ENV: ${process.env.NODE_ENV || "development"}`,
        )
        this.logger.log(`   🚀 PORT: ${process.env.PORT || "3000"}`)
        this.logger.log(
            `   📊 REDIS: ${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || "6381"}`,
        )
        this.logger.log(
            `   ☁️ GCLOUD_STORAGE_BUCKET: ${process.env.GCLOUD_STORAGE_BUCKET ? "configured" : "❌ NOT SET"}`,
        )
        this.logger.log(
            `   🤖 AGENT_API_URL: ${process.env.AGENT_API_URL ? "configured" : "❌ NOT SET"}`,
        )
        this.logger.log(
            `   📄 ONEPAGER_INCREMENTAL: ${process.env.ONEPAGER_INCREMENTAL_ENABLED || "false"}`,
        )
    }
}
