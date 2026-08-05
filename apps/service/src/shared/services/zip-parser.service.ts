import { Folder } from "@/shared/domain/entities/file.entity"

export interface ZipParserService {
    parseZipToFolder(zipBuffer: Buffer, rootFolderName: string): Promise<Folder>
}

export interface ParsedZipEntry {
    path: string
    name: string
    isDirectory: boolean
    buffer?: Buffer
    size: number
}
