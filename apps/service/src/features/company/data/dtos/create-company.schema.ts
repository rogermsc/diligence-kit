import { z } from "zod"

export const CreateCompanySchema = z.object({
    name: z
        .string()
        .min(1, "Nome da empresa é obrigatório")
        .max(255, "Nome da empresa deve ter no máximo 255 caracteres"),
})

export type CreateCompanyDto = z.infer<typeof CreateCompanySchema>
