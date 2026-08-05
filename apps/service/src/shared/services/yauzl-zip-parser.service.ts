import { Injectable } from "@nestjs/common"
import { ZipParserService, ParsedZipEntry } from "./zip-parser.service"
import { Folder, File } from "@/shared/domain/entities/file.entity"
import { ZipContentValidator } from "@/features/automation/start-automation/helpers/zip-content-validator.helper"
import * as yauzl from "yauzl"
import { promisify } from "util"

@Injectable()
export class YauzlZipParserService implements ZipParserService {
    async parseZipToFolder(
        zipBuffer: Buffer,
        rootFolderName: string,
    ): Promise<Folder> {
        const entries = await this.extractZipEntries(zipBuffer)

        // Validar e filtrar conteúdo do ZIP - mantém apenas arquivos válidos
        const validEntries = ZipContentValidator.validateAndFilterZipContent(entries)

        return this.buildFolderStructure(validEntries, rootFolderName)
    }

    private static readonly MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024; // 500 MB

    private async extractZipEntries(
        zipBuffer: Buffer,
    ): Promise<ParsedZipEntry[]> {
        return new Promise((resolve, reject) => {
            const entries: ParsedZipEntry[] = []
            let totalUncompressedSize = 0

            yauzl.fromBuffer(
                zipBuffer,
                { lazyEntries: true },
                (err, zipfile) => {
                    if (err) {
                        reject(err)
                        return
                    }

                    if (!zipfile) {
                        reject(new Error("Failed to open zip file"))
                        return
                    }

                    zipfile.readEntry()

                    zipfile.on("entry", async (entry) => {
                        totalUncompressedSize += entry.uncompressedSize
                        if (totalUncompressedSize > YauzlZipParserService.MAX_UNCOMPRESSED_BYTES) {
                            reject(new Error("ZIP file exceeds maximum uncompressed size of 500 MB"))
                            return
                        }

                        const isDirectory = /\/$/.test(entry.fileName)
                        const normalizedPath = entry.fileName.replace(
                            /\\/g,
                            "/",
                        )

                        // Skip macOS system files and folders
                        if (this.shouldSkipEntry(normalizedPath)) {
                            zipfile.readEntry()
                            return
                        }

                        if (isDirectory) {
                            entries.push({
                                path: normalizedPath,
                                name: this.getFileNameFromPath(normalizedPath),
                                isDirectory: true,
                                size: 0,
                            })
                            zipfile.readEntry()
                        } else {
                            try {
                                const buffer = await this.extractFileBuffer(
                                    zipfile,
                                    entry,
                                )
                                entries.push({
                                    path: normalizedPath,
                                    name: this.getFileNameFromPath(
                                        normalizedPath,
                                    ),
                                    isDirectory: false,
                                    buffer,
                                    size: entry.uncompressedSize,
                                })
                                zipfile.readEntry()
                            } catch (error) {
                                reject(error)
                            }
                        }
                    })

                    zipfile.on("end", () => {
                        resolve(entries)
                    })

                    zipfile.on("error", (error) => {
                        reject(error)
                    })
                },
            )
        })
    }

    private extractFileBuffer(
        zipfile: yauzl.ZipFile,
        entry: yauzl.Entry,
    ): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            zipfile.openReadStream(entry, (err, readStream) => {
                if (err) {
                    reject(err)
                    return
                }

                if (!readStream) {
                    reject(new Error("Failed to create read stream"))
                    return
                }

                const chunks: Buffer[] = []
                readStream.on("data", (chunk) => {
                    chunks.push(chunk)
                })

                readStream.on("end", () => {
                    resolve(Buffer.concat(chunks))
                })

                readStream.on("error", (error) => {
                    reject(error)
                })
            })
        })
    }

    private buildFolderStructure(
        entries: ParsedZipEntry[],
        rootFolderName: string,
    ): Folder {
        const rootFolder = new Folder(this.normalizeName(rootFolderName))
        const folderMap = new Map<string, Folder>()
        folderMap.set("", rootFolder)

        // Ordenar entradas para processar diretórios antes dos arquivos
        const sortedEntries = entries.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1
            if (!a.isDirectory && b.isDirectory) return 1
            return a.path.localeCompare(b.path)
        })

        for (const entry of sortedEntries) {
            const pathParts = entry.path
                .split("/")
                .filter((part) => part.length > 0)

            if (entry.isDirectory) {
                this.createDirectoryPath(pathParts, folderMap, rootFolder)
            } else {
                this.createFileInPath(entry, pathParts, folderMap, rootFolder)
            }
        }

        return rootFolder
    }

    private createDirectoryPath(
        pathParts: string[],
        folderMap: Map<string, Folder>,
        rootFolder: Folder,
    ): void {
        let currentPath = ""
        let currentFolder = rootFolder

        for (const part of pathParts) {
            const previousPath = currentPath
            currentPath = currentPath ? `${currentPath}/${part}` : part

            if (!folderMap.has(currentPath)) {
                const newFolder = new Folder(this.normalizeName(part))
                folderMap.set(currentPath, newFolder)
                currentFolder.add(newFolder)
            }

            currentFolder = folderMap.get(currentPath)!
        }
    }

    private createFileInPath(
        entry: ParsedZipEntry,
        pathParts: string[],
        folderMap: Map<string, Folder>,
        rootFolder: Folder,
    ): void {
        if (pathParts.length === 0 || !entry.buffer) return

        const fileName = pathParts[pathParts.length - 1]
        const directoryParts = pathParts.slice(0, -1)

        // Criar diretórios pais se não existirem
        if (directoryParts.length > 0) {
            this.createDirectoryPath(directoryParts, folderMap, rootFolder)
        }

        const parentPath = directoryParts.join("/")
        const parentFolder = folderMap.get(parentPath) || rootFolder

        const mimeType = this.getMimeTypeFromFileName(fileName)
        const file = new File(
            this.normalizeName(fileName),
            entry.size,
            mimeType,
            entry.buffer,
        )

        parentFolder.add(file)
    }

    private getFileNameFromPath(path: string): string {
        const parts = path.split("/").filter((part) => part.length > 0)
        return parts[parts.length - 1] || ""
    }

    private normalizeName(name: string): string {
        return name.trim().toLowerCase().replace(/\s+/g, "_")
    }

    private getMimeTypeFromFileName(fileName: string): string {
        const extension = fileName.split(".").pop()?.toLowerCase()

        const mimeTypes: Record<string, string> = {
            pdf: "application/pdf",
            doc: "application/msword",
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            xls: "application/vnd.ms-excel",
            xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            txt: "text/plain",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            gif: "image/gif",
        }

        return mimeTypes[extension || ""] || "application/octet-stream"
    }

    /**
     * Determines if a ZIP entry should be skipped during processing.
     * Filters out system metadata files from various operating systems and tools.
     */
    private shouldSkipEntry(normalizedPath: string): boolean {
        const fileName = this.getFileNameFromPath(normalizedPath)
        const lowerFileName = fileName.toLowerCase()
        const lowerPath = normalizedPath.toLowerCase()

        // Skip empty entries
        if (!fileName || fileName.trim().length === 0) {
            return true
        }

        // === macOS METADATA ===
        // Skip macOS metadata folder
        if (normalizedPath.startsWith("__MACOSX/")) {
            return true
        }

        // Skip .DS_Store files (macOS folder metadata)
        if (lowerFileName === ".ds_store") {
            return true
        }

        // Skip resource fork files (start with ._)
        if (fileName.startsWith("._")) {
            return true
        }

        // === WINDOWS METADATA ===
        // Skip Windows thumbnail cache
        if (lowerFileName === "thumbs.db" || lowerFileName === "thumbs.db:encryptable") {
            return true
        }

        // Skip Windows folder customization files
        if (lowerFileName === "desktop.ini") {
            return true
        }

        // Skip Windows recycle bin
        if (lowerPath.startsWith("$recycle.bin/")) {
            return true
        }

        // Skip Windows system folders
        if (lowerPath.startsWith("system volume information/")) {
            return true
        }

        // === LINUX METADATA ===
        // Skip KDE folder settings
        if (lowerFileName === ".directory") {
            return true
        }

        // Skip thumbnail caches
        if (lowerPath.includes("/.thumbnails/")) {
            return true
        }

        // Skip Linux trash folders
        if (lowerPath.includes("/.trash-")) {
            return true
        }

        // === CLOUD STORAGE METADATA ===
        // Skip Dropbox metadata
        if (lowerFileName === ".dropbox" || lowerFileName === ".dropbox.attr") {
            return true
        }

        if (lowerPath.includes("/.dropbox.cache/")) {
            return true
        }

        // Skip sync service folders
        if (lowerPath.includes("/.sync/") || lowerPath.includes("/@eadir/")) {
            return true
        }

        // === VERSION CONTROL ===
        // Skip Git repositories
        if (lowerPath.includes("/.git/")) {
            return true
        }

        // Skip SVN repositories
        if (lowerPath.includes("/.svn/")) {
            return true
        }

        // === EDITOR/TOOL METADATA ===
        // Skip temporary files
        if (lowerFileName.endsWith(".tmp") || lowerFileName.endsWith(".temp")) {
            return true
        }

        // Skip Vim swap files
        if (lowerFileName.endsWith(".swp") || lowerFileName.endsWith(".swo")) {
            return true
        }

        // Skip backup files
        if (lowerFileName.endsWith("~") || lowerFileName.endsWith(".bak")) {
            return true
        }

        // === GENERAL HIDDEN FILES ===
        // Skip other hidden files (start with .) but allow legitimate files like .env, .gitignore if explicitly named
        if (fileName.startsWith(".") && fileName !== "." && !this.isLegitimateHiddenFile(fileName)) {
            return true
        }

        return false
    }

    /**
     * Determines if a hidden file (starting with .) is a legitimate document
     * that should be preserved rather than filtered out.
     */
    private isLegitimateHiddenFile(fileName: string): boolean {
        const legitimateHiddenFiles = [
            '.env',
            '.gitignore',
            '.dockerignore',
            '.editorconfig',
            '.htaccess'
        ]

        return legitimateHiddenFiles.includes(fileName.toLowerCase())
    }
}
