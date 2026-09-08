import JSZip from 'jszip';

/**
 * Allowed file extensions for automation uploads
 */
const ALLOWED_EXTENSIONS = [
    'pdf', 'csv', 'xls', 'xlsx', 'doc', 'docx', 'txt',
    'ppt', 'pptx',
    'png', 'jpg', 'jpeg', 'tiff', 'tif', 'bmp', 'webp',
];

/**
 * Checks if a file is allowed (valid extension, not macOS metadata)
 */
function isAllowedFile(path: string): boolean {
    const basename = path.split('/').pop() || path;
    if (basename.startsWith('._') || path.includes('__MACOSX/')) {
        return false;
    }
    const extension = basename.toLowerCase().split('.').pop();
    return extension ? ALLOWED_EXTENSIONS.includes(extension) : false;
}

/**
 * Filters a ZIP file to only include files with allowed extensions
 * @param zipFile - The original ZIP file
 * @param onProgress - Optional callback for progress updates
 * @returns Promise<File> - A new ZIP file containing only allowed files
 */
export async function analyzeZipFile(zipFile: File): Promise<{
    totalFiles: number;
    allowedFiles: string[];
    removedFiles: string[];
    allowedExtensions: string[];
}> {
    try {
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(zipFile);

        const allowedFiles: string[] = [];
        const removedFiles: string[] = [];

        for (const [relativePath, zipEntry] of Object.entries(zipContent.files)) {
            if (zipEntry.dir) {
                continue;
            }

            if (isAllowedFile(relativePath)) {
                allowedFiles.push(relativePath);
            } else {
                removedFiles.push(relativePath);
            }
        }

        return {
            totalFiles: allowedFiles.length + removedFiles.length,
            allowedFiles,
            removedFiles,
            allowedExtensions: ALLOWED_EXTENSIONS
        };

    } catch (error) {
        console.error('[zipFileFilter] Error analyzing ZIP file:', error);
        throw new Error(`Failed to analyze ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
