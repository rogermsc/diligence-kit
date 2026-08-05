import { Folder, File } from "@/shared/domain/entities/file.entity"
import { File as MulterFile } from "multer"

export class DataroomFolderFactory {
    private static normalizeName(name: string): string {
        return name.trim().toLowerCase().replace(/\s+/g, "_")
    }

    static createFromMulterFiles(
        enterpriseName: string,
        files: Record<string, MulterFile[]>,
    ): Folder {
        const rootFolder = new Folder(this.normalizeName(enterpriseName))

        Object.entries(files).forEach(([folderName, fileArr]) => {
            if (fileArr && fileArr.length > 0) {
                const file = fileArr[0]
                const fileEntity = new File(
                    this.normalizeName(file.originalname),
                    file.size,
                    file.mimetype,
                    file.buffer,
                )
                const subFolder = new Folder(this.normalizeName(folderName))
                subFolder.add(fileEntity)
                rootFolder.add(subFolder)
            }
        })

        return rootFolder
    }
}
