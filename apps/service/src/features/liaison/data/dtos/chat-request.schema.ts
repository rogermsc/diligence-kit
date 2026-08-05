import { z } from 'zod';

export const chatRequestSchema = z.object({
  message: z.string().min(1).max(10_000, 'Message too long'),
  session_id: z.string().uuid().optional(),
  automation_id: z.string().uuid().optional(),
  company_context: z.record(z.string(), z.string().max(1_000)).optional(),
});

export type ChatRequestDto = z.infer<typeof chatRequestSchema>;
