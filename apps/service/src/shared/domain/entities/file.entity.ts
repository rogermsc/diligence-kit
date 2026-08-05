export interface FileSystemComponent {
    getName(): string
    getSize(): number
    getMimeType(): string
    getChildren?(): FileSystemComponent[]
}

export class File implements FileSystemComponent {
    constructor(
        public readonly name: string,
        public readonly size: number,
        public readonly mimeType: string,
        public readonly buffer: Buffer,
    ) { }

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

export class Folder implements FileSystemComponent {
    private readonly children: FileSystemComponent[] = []

    constructor(private readonly name: string) { }

    add(child: FileSystemComponent) {
        this.children.push(child)
    }

    getName(): string {
        return this.name
    }
    getSize(): number {
        return this.children.reduce((acc, child) => acc + child.getSize(), 0)
    }
    getMimeType(): string {
        return "directory"
    }
    getChildren(): FileSystemComponent[] {
        return this.children
    }
}
