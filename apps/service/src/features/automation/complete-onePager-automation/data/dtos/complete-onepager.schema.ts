import { z } from 'zod';

const PRIVATE_HOST_PATTERNS = [
    /^localhost$/i,
    /^127\./,
    /^0\.0\.0\.0$/,
    /^::1$/,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
];

export const completeOnePagerSchema = z.object({
    onePagerUrl: z.string()
        .url('OnePager URL must be a valid URL')
        .refine((url) => {
            try {
                const { hostname } = new URL(url);
                return !PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
            } catch {
                return false;
            }
        }, 'URL must not point to private or internal addresses'),
    coverage: z.array(z.string()).optional(),
    missing: z.array(z.string()).optional(),
});

export type CompleteOnePagerRequest = z.infer<typeof completeOnePagerSchema>;