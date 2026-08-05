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
export async function filterZipFile(
    zipFile: File,
    onProgress?: (progress: number, currentFile?: string) => void
): Promise<File> {
    try {
        console.log('[zipFileFilter] Starting to filter ZIP file:', zipFile.name);

        // Load the ZIP file
        onProgress?.(5, 'Loading ZIP file...');
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(zipFile);

        onProgress?.(15, 'Analyzing files...');

        // Create a new ZIP instance for filtered content
        const filteredZip = new JSZip();

        let totalFiles = 0;
        let allowedFiles = 0;
        const removedFiles: string[] = [];

        // First pass: count total files (excluding directories)
        const allFiles = Object.entries(zipContent.files).filter(([, zipEntry]) => !zipEntry.dir);
        const totalFileCount = allFiles.length;

        onProgress?.(25, 'Scanning files...');

        onProgress?.(30, 'Processing files...');

        // Iterate through all files in the ZIP
        for (let i = 0; i < allFiles.length; i++) {
            const [relativePath, zipEntry] = allFiles[i];

            totalFiles++;

            // Update progress every 10% of files processed to avoid too many UI updates
            if (i % Math.max(1, Math.floor(totalFileCount / 10)) === 0) {
                const fileProgress = 30 + Math.round((i / totalFileCount) * 55);
                onProgress?.(fileProgress, 'Processing files...');
            }

            // Check if the file extension is allowed
            if (isAllowedFile(relativePath)) {
                // Add the file to the filtered ZIP
                const fileData = await zipEntry.async('arraybuffer');
                filteredZip.file(relativePath, fileData);
                allowedFiles++;
                console.log('[zipFileFilter] Keeping file:', relativePath);
            } else {
                // Track removed files for logging
                removedFiles.push(relativePath);
                console.log('[zipFileFilter] Removing file with invalid extension:', relativePath);
            }
        }

        console.log('[zipFileFilter] Filter summary:', {
            totalFiles,
            allowedFiles,
            removedFiles: removedFiles.length,
            removedFilesList: removedFiles
        });

        onProgress?.(85, 'Generating filtered ZIP...');

        // Generate the filtered ZIP as a blob
        const filteredZipBlob = await filteredZip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: {
                level: 6
            }
        }, (metadata) => {
            // Progress callback for ZIP generation (85% to 95%)
            const zipProgress = 85 + Math.round(metadata.percent * 0.1);
            onProgress?.(zipProgress, 'Compressing filtered ZIP...');
        });

        onProgress?.(95, 'Creating final file...');

        // Create a new File object from the filtered blob
        const filteredFile = new File(
            [filteredZipBlob],
            `filtered_${zipFile.name}`,
            {
                type: 'application/zip',
                lastModified: Date.now()
            }
        );

        onProgress?.(100, 'Filtering complete!');

        console.log('[zipFileFilter] Filtered ZIP created:', {
            originalSize: zipFile.size,
            filteredSize: filteredFile.size,
            compressionRatio: Math.round((1 - filteredFile.size / zipFile.size) * 100)
        });

        return filteredFile;

    } catch (error) {
        console.error('[zipFileFilter] Error filtering ZIP file:', error);
        throw new Error(`Failed to filter ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Gets a preview of what files would be kept/removed from a ZIP
 * @param zipFile - The ZIP file to analyze
 * @returns Promise with analysis results
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
