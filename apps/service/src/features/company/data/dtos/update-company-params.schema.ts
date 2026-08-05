import { z } from "zod"

export const UpdateCompanyParamsSchema = z.object({
    id: z.string().uuid("ID da empresa deve ser um UUID válido"),
})

export const UpdateCompanyWithParamsSchema = z.object({
    params: UpdateCompanyParamsSchema,
    body: z.object({
        name: z
            .string()
            .min(1, "Nome da empresa é obrigatório")
            .max(255, "Nome da empresa deve ter no máximo 255 caracteres")
            .optional(),
    }),
})

export type UpdateCompanyParamsDto = z.infer<typeof UpdateCompanyParamsSchema>
export type UpdateCompanyWithParamsDto = z.infer<
    typeof UpdateCompanyWithParamsSchema
>
