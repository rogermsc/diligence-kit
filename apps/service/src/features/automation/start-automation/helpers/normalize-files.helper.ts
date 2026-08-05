import { File as MulterFile } from "multer"

export function normalizeDataroomFiles(
    files: Record<string, MulterFile[]> | undefined,
    requiredFields: string[],
): Record<string, MulterFile[]> {
    const normalizedFiles: Record<string, MulterFile[]> = { ...files }
    for (const field of requiredFields) {
        if (!normalizedFiles[field]) {
            normalizedFiles[field] = []
        }
    }
    return normalizedFiles
}
