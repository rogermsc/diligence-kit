import { UploadedFile } from "@/shared/services/storage.service"
import { UploadedDocument } from "../use-case/automation-upload.usecase"

/**
 * Converte arquivos enviados pelo serviço de storage em documentos.
 *
 * Extrai apenas a URL de cada arquivo, removendo metadados desnecessários.
 *
 * @param uploadedFiles Array de arquivos retornados pelo serviço de storage
 * @returns Array de documentos contendo apenas as URLs
 *
 * @example
 * // Entrada: [{ url: 'https://storage.com/file1.pdf', path: '...', name: '...' }]
 * // Saída: [{ url: 'https://storage.com/file1.pdf' }]
 */
export function mapUploadedFilesToDocuments(
    uploadedFiles: UploadedFile[],
): UploadedDocument[] {
    if (!uploadedFiles || uploadedFiles.length === 0) {
        return []
    }

    return uploadedFiles.map((file) => ({
        url: file.url,
    }))
}
