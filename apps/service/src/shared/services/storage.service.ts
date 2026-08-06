import {
    FileSystemComponent,
    Folder,
    File,
} from "@/shared/domain/entities/file.entity"

export interface UploadedFile {
    url: string
    path: string
    name: string
}

export interface StorageService {
    uploadFolderOnEnterpriseRoot(
        enterpriseName: string,
        folder: Folder,
    ): Promise<UploadedFile[]>
    uploadSingleFile(
        path: string,
        file: File,
        subPath?: string,
    ): Promise<UploadedFile>
    downloadFile(filePath: string): Promise<Buffer>
    deleteFile(filePath: string): Promise<void>
    deleteFolder(folderPath: string): Promise<void>
}
