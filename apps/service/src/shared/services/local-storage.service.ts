import { StorageService, UploadedFile } from "./storage.service"
import { File, Folder } from "@/shared/domain/entities/file.entity"
import { StorageError, StorageErrorType } from "@/shared/errors/storage-error"
import { Injectable, Logger } from "@nestjs/common"
import { promises as fs } from "fs"
import * as path from "path"

/**
 * Filesystem-backed StorageService, so the platform runs with no cloud account.
 *
 * It deliberately keeps the `gs://<bucket>/<key>` URL shape that
 * GoogleStorageService produces. Those URLs are persisted in `documents.bucketPath`
 * and handed to the Python agent, so a driver that invented its own scheme would
 * make databases and stored paths non-portable between the two. Only the bytes
 * move: `gs://<bucket>/a/b.pdf` lives at `<root>/a/b.pdf` on disk.
 */
@Injectable()
export class LocalStorageService implements StorageService {
    private readonly root: string
    private readonly bucketName: string
    private readonly logger = new Logger(LocalStorageService.name)

    constructor() {
        this.root = path.resolve(
            process.env.STORAGE_LOCAL_ROOT || ".data/storage",
        )
        this.bucketName = process.env.GCLOUD_STORAGE_BUCKET || "local-bucket"
    }

    /**
     * Maps a storage key to an absolute path, refusing anything that escapes the
     * root. Keys are built from filenames that originate in uploaded archives, so
     * `../` in an entry name must not be able to write outside `.data/`.
     */
    private resolveKey(key: string): string {
        const normalized = key
            .replace(`gs://${this.bucketName}/`, "")
            .replace(/^\/+/, "")

        // A GCS object name is a flat string, so callers upstream reason about
        // these keys as opaque and deliberately do not reject "..": ConfirmUpload
        // pins a path by prefix on exactly that basis, and rejecting the
        // substring would fail legitimate names like "FY2023..2024.pdf".
        // path.resolve does not share that model — it collapses "..", which
        // turned a prefix-checked path into another tenant's directory. Refuse a
        // "." or ".." *segment* so both models agree; a name merely containing
        // dots is untouched.
        const segments = normalized.split("/")
        if (segments.some((part) => part === ".." || part === ".")) {
            throw new StorageError(
                StorageErrorType.UPLOAD_ERROR,
                `Path segment is not a valid object name: ${key}`,
            )
        }

        const full = path.resolve(this.root, normalized)

        // Defence in depth: nothing should reach here after the check above.
        if (full !== this.root && !full.startsWith(this.root + path.sep)) {
            throw new StorageError(
                StorageErrorType.UPLOAD_ERROR,
                `Path escapes storage root: ${key}`,
            )
        }
        return full
    }

    private async write(key: string, buffer: Buffer): Promise<UploadedFile> {
        const full = this.resolveKey(key)
        await fs.mkdir(path.dirname(full), { recursive: true })
        await fs.writeFile(full, buffer)

        return {
            url: `gs://${this.bucketName}/${key}`,
            path: key,
            name: path.basename(key),
        }
    }

    async uploadFolderOnEnterpriseRoot(
        enterpriseName: string,
        folder: Folder,
    ): Promise<UploadedFile[]> {
        if (!enterpriseName) {
            throw new StorageError(
                StorageErrorType.UPLOAD_ERROR,
                "Enterprise name cannot be empty.",
            )
        }
        if (!(folder instanceof Folder)) {
            throw new StorageError(
                StorageErrorType.UPLOAD_ERROR,
                "Parameter folder must be an instance of Folder.",
            )
        }
        return this.uploadFolderRecursive(folder.getName(), folder)
    }

    private async uploadFolderRecursive(
        currentPath: string,
        folder: Folder,
    ): Promise<UploadedFile[]> {
        const uploaded: UploadedFile[] = []
        for (const child of folder.getChildren()) {
            if (child instanceof File) {
                uploaded.push(
                    await this.write(
                        `${currentPath}/${child.getName()}`,
                        child.getBuffer(),
                    ),
                )
                continue
            }
            if (child instanceof Folder) {
                uploaded.push(
                    ...(await this.uploadFolderRecursive(
                        `${currentPath}/${child.getName()}`,
                        child,
                    )),
                )
            }
        }
        return uploaded
    }

    async uploadSingleFile(
        filePath: string,
        file: File,
        subPath?: string,
    ): Promise<UploadedFile> {
        const finalPath = subPath ? `${filePath}/${subPath}` : filePath
        return this.write(`${finalPath}/${file.getName()}`, file.getBuffer())
    }

    async downloadFile(filePath: string): Promise<Buffer> {
        if (!filePath) {
            throw new StorageError(
                StorageErrorType.UPLOAD_ERROR,
                "File path cannot be empty.",
            )
        }

        try {
            return await fs.readFile(this.resolveKey(filePath))
        } catch (err: any) {
            if (err instanceof StorageError) throw err
            throw new StorageError(
                StorageErrorType.UPLOAD_ERROR,
                `Failed to download file ${filePath}: ${err.message}`,
            )
        }
    }

    async deleteFile(filePath: string): Promise<void> {
        if (!filePath) {
            throw new StorageError(
                StorageErrorType.UPLOAD_ERROR,
                "File path cannot be empty.",
            )
        }

        try {
            await fs.rm(this.resolveKey(filePath), { force: true })
        } catch (err: any) {
            if (err instanceof StorageError) throw err
            this.logger.error(`Failed to delete file ${filePath}:`, err)
            throw new StorageError(
                StorageErrorType.UPLOAD_ERROR,
                "Storage error",
            )
        }
    }

    async deleteFolder(folderPath: string): Promise<void> {
        if (!folderPath) {
            throw new StorageError(
                StorageErrorType.UPLOAD_ERROR,
                "Folder path cannot be empty.",
            )
        }

        try {
            await fs.rm(this.resolveKey(folderPath.replace(/\/*$/, "")), {
                recursive: true,
                force: true,
            })
        } catch (err: any) {
            if (err instanceof StorageError) throw err
            this.logger.error(`Failed to delete folder ${folderPath}:`, err)
            throw new StorageError(
                StorageErrorType.UPLOAD_ERROR,
                `Failed to delete folder ${folderPath}: ${err.message}`,
            )
        }
    }
}
