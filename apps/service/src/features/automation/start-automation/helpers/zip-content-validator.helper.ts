import { ParsedZipEntry } from "@/shared/services/zip-parser.service"
import { AutomationZipValidationError } from "../domain/errors/automation-errors"

/**
 * Validador e filtro de conteúdo de arquivos ZIP
 * Filtra arquivos válidos e valida se ZIP não está vazio
 */
export class ZipContentValidator {
    private static readonly ALLOWED_MIME_TYPES = [
        "application/pdf",
        "text/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "image/png",
        "image/jpeg",
        "image/tiff",
        "image/bmp",
        "image/webp",
    ]

    private static readonly ALLOWED_EXTENSIONS = [
        'pdf', 'csv', 'xls', 'xlsx', 'doc', 'docx', 'txt',
        'ppt', 'pptx',
        'png', 'jpg', 'jpeg', 'tiff', 'tif', 'bmp', 'webp',
    ]



    static validateAndFilterZipContent(entries: ParsedZipEntry[]): ParsedZipEntry[] {
        const allFiles = entries.filter(entry => !entry.isDirectory)
        const validFiles = allFiles.filter(file => this.isValidFileType(file))

        if (validFiles.length === 0) {
            throw new AutomationZipValidationError("ZIP file is empty or contains no valid files")
        }

        // Retorna entradas filtradas (diretórios + arquivos válidos)
        return entries.filter(entry =>
            entry.isDirectory || this.isValidFileType(entry)
        )
    }

    /**
     * Verifica se um arquivo é de um tipo válido (sem lançar erro)
     */
    private static isValidFileType(file: ParsedZipEntry): boolean {
        const extension = this.getFileExtension(file.name)
        return this.ALLOWED_EXTENSIONS.includes(extension)
    }

    private static getFileExtension(fileName: string): string {
        return fileName.split('.').pop()?.toLowerCase() || ''
    }

    private static getMimeTypeFromExtension(extension: string): string {
        const mimeTypes: Record<string, string> = {
            pdf: "application/pdf",
            csv: "text/csv",
            xls: "application/vnd.ms-excel",
            xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            doc: "application/msword",
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            txt: "text/plain",
            ppt: "application/vnd.ms-powerpoint",
            pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            png: "image/png",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            tiff: "image/tiff",
            tif: "image/tiff",
            bmp: "image/bmp",
            webp: "image/webp",
        }

        return mimeTypes[extension] || "application/octet-stream"
    }
}
