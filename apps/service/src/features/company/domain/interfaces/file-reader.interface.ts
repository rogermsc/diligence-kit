export interface FileReaderService {
    readFileContent(filePath: string): Promise<string>
}
