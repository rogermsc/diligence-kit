import { z } from "zod"

export const UpdateCompanySchema = z.object({
    name: z
        .string()
        .min(1, "Nome da empresa é obrigatório")
        .max(255, "Nome da empresa deve ter no máximo 255 caracteres")
        .optional(),
})

export type UpdateCompanyDto = z.infer<typeof UpdateCompanySchema>
