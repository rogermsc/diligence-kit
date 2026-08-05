import { StorageService, UploadedFile } from "./storage.service"
import { File, Folder } from "@/shared/domain/entities/file.entity"
import { Storage } from "@google-cloud/storage"
import { StorageError, StorageErrorType } from "@/shared/errors/storage-error"
import { Injectable, Logger } from "@nestjs/common"

@Injectable()
export class GoogleStorageService implements StorageService {
    private readonly storage: Storage
    private readonly bucketName: string
    private readonly logger = new Logger(GoogleStorageService.name)

    constructor() {
        this.storage = this.initStorage()
        this.bucketName = this.getBucketName()
    }

    private initStorage(): Storage {
        try {
            const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS

            if (credentialsEnv) {
                try {
                    const credentials = JSON.parse(credentialsEnv)
                    return new Storage({ credentials })
                } catch {
                    // Not JSON — file path or workload identity, let GCP SDK handle it
                }
            }

            return new Storage()
        } catch (err) {
            throw new StorageError(
                StorageErrorType.CREDENTIALS_ERROR,
                "Failed to initialize Google Cloud Storage credentials.",
            )
        }
    }

    private getBucketName(): string {
        const bucket = process.env.GCLOUD_STORAGE_BUCKET
        if (!bucket) {
            throw new StorageError(
                StorageErrorType.BUCKET_ERROR,
                "GCLOUD_STORAGE_BUCKET environment variable is required.",
            )
        }
        return bucket
    }

    /**
     * Recursively uploads a folder to the bucket, under the enterprise root folder.
     * @param enterpriseName The root folder (enterprise name) in the bucket.
     * @param folder The folder to upload (may contain subfolders and files).
     * @returns List of uploaded file details.
     */
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
        try {
            return await this.uploadFolderRecursive(folder.getName(), folder)
        } catch (err: any) {
            Logger.error(err)
            throw new StorageError(
                StorageErrorType.UPLOAD_ERROR,
                `Failed to upload folder: ${err.message}`,
            )
        }
    }

    private async uploadFolderRecursive(
        currentPath: string,
        folder: Folder,
    ): Promise<UploadedFile[]> {
        const uploadedFiles: UploadedFile[] = []
        for (const child of folder.getChildren()) {
            if (child instanceof File) {
                uploadedFiles.push(await this.uploadFile(currentPath, child))
                continue
            }
            if (child instanceof Folder) {
                const subfolderPath = `${currentPath}/${child.getName()}`
                const subfolderFiles = await this.uploadFolderRecursive(
                    subfolderPath,
                    child,
                )
                uploadedFiles.push(...subfolderFiles)
            }
        }
        return uploadedFiles
    }

    private async uploadFile(path: string, file: File): Promise<UploadedFile> {
        const destinationPath = `${path}/${file.getName()}`

        for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                const bucket = this.storage.bucket(this.bucketName)
                const fileRef = bucket.file(destinationPath)

                await fileRef.save(file.getBuffer(), {
                    contentType: file.getMimeType(),
                    resumable: false,
                })

                return {
                    url: `gs://${this.bucketName}/${destinationPath}`,
                    path: destinationPath,
                    name: file.getName(),
                }
            } catch (err: any) {
                const isRateLimited = err.code === 429 || err.errors?.some((e: any) => e.reason === 'rateLimitExceeded');

                if (isRateLimited && attempt < this.MAX_RETRIES) {
                    const delay = this.BASE_DELAY_MS * Math.pow(2, attempt);
                    this.logger.warn(
                        `GCS rate limited uploading "${file.getName()}", retrying in ${delay}ms (attempt ${attempt + 1}/${this.MAX_RETRIES})`,
                    );
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                throw new StorageError(
                    StorageErrorType.UPLOAD_ERROR,
                    `Failed to upload file ${file.getName()}: ${err.message}`,
                )
            }
        }

        throw new StorageError(
            StorageErrorType.UPLOAD_ERROR,
            `Failed to upload file ${file.getName()} after ${this.MAX_RETRIES} retries`,
        )
    }

    private readonly MAX_RETRIES = 5
    private readonly BASE_DELAY_MS = 1000

    async uploadSingleFile(
        path: string,
        file: File,
        subPath?: string,
    ): Promise<UploadedFile> {
        const finalPath = subPath ? `${path}/${subPath}` : path;
        const destinationPath = `${finalPath}/${file.getName()}`;

        for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                const bucket = this.storage.bucket(this.bucketName);
                const fileRef = bucket.file(destinationPath);

                await fileRef.save(file.getBuffer(), {
                    contentType: file.getMimeType(),
                    resumable: false,
                });

                return {
                    url: `gs://${this.bucketName}/${destinationPath}`,
                    path: destinationPath,
                    name: file.getName(),
                };
            } catch (err: any) {
                const isRateLimited = err.code === 429 || err.errors?.some((e: any) => e.reason === 'rateLimitExceeded');

                if (isRateLimited && attempt < this.MAX_RETRIES) {
                    const delay = this.BASE_DELAY_MS * Math.pow(2, attempt);
                    this.logger.warn(
                        `GCS rate limited uploading "${file.getName()}", retrying in ${delay}ms (attempt ${attempt + 1}/${this.MAX_RETRIES})`,
                    );
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                throw new StorageError(
                    StorageErrorType.UPLOAD_ERROR,
                    `Failed to upload file ${file.getName()}: ${err.message}`,
                );
            }
        }

        throw new StorageError(
            StorageErrorType.UPLOAD_ERROR,
            `Failed to upload file ${file.getName()} after ${this.MAX_RETRIES} retries`,
        );
    }

    async downloadFile(filePath: string): Promise<Buffer> {
        if (!filePath) {
            throw new StorageError(
                StorageErrorType.UPLOAD_ERROR,
                "File path cannot be empty.",
            )
        }

        try {
            // Remove o prefixo gs://{bucket}/ se existir
            const normalizedPath = filePath.replace(`gs://${this.bucketName}/`, '')

            const bucket = this.storage.bucket(this.bucketName)
            const file = bucket.file(normalizedPath)

            const [buffer] = await file.download()
            return buffer
        } catch (err: any) {
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
            const normalizedPath = filePath.replace(`gs://${this.bucketName}/`, '')
            const bucket = this.storage.bucket(this.bucketName)
            const file = bucket.file(normalizedPath)
            await file.delete()
        } catch (err: any) {
            this.logger.error(`Failed to delete file ${filePath}:`, err);
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
            const normalizedPath = folderPath.replace(`gs://${this.bucketName}/`, '').replace(/\/*$/, '')
            const bucket = this.storage.bucket(this.bucketName)

            this.logger.debug(`Deleting all files in folder: ${normalizedPath}`);

            // Lista todos os arquivos no prefixo (pasta)
            const [files] = await bucket.getFiles({
                prefix: `${normalizedPath}/`
            });

            if (files.length === 0) {
                this.logger.debug(`No files found in folder: ${normalizedPath}`);
                return;
            }

            // Deleta todos os arquivos em paralelo
            await Promise.all(files.map(file => file.delete()));

            this.logger.debug(`Successfully deleted ${files.length} files from folder: ${normalizedPath}`);
        } catch (err: any) {
            this.logger.error(`Failed to delete folder ${folderPath}:`, err);
            throw new StorageError(
                StorageErrorType.UPLOAD_ERROR,
                `Failed to delete folder ${folderPath}: ${err.message}`,
            )
        }
    }
}
