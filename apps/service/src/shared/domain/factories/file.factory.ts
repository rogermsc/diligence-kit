import { File } from "@/shared/domain/entities/file.entity"
import { File as MulterFile } from "multer"

export class FileFactory {
    static createFromMulterFile(multerFile: MulterFile): File {
        return new File(
            multerFile.originalname,
            multerFile.size,
            multerFile.mimetype,
            multerFile.buffer,
        )
    }

    static create(props: {
        name: string
        size: number
        mimeType: string
        buffer: Buffer
    }): File {
        return new File(props.name, props.size, props.mimeType, props.buffer)
    }
}
