/**
 * A file on its way into storage.
 *
 * There used to be a Folder composite and a FileSystemComponent interface here,
 * supporting recursive folder uploads that no caller ever made.
 */
export class File {
    constructor(
        public readonly name: string,
        public readonly size: number,
        public readonly mimeType: string,
        public readonly buffer: Buffer,
    ) {}

    getName(): string {
        return this.name
    }
    getSize(): number {
        return this.size
    }
    getMimeType(): string {
        return this.mimeType
    }
    getBuffer(): Buffer {
        return this.buffer
    }
}
