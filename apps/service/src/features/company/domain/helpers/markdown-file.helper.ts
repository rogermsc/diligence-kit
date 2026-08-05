import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MarkdownFileHelper {
    private readonly logger = new Logger(MarkdownFileHelper.name);

    /**
     * Parse markdown file buffer to text content
     * @param fileBuffer - Buffer containing the markdown file content
     * @param fileName - Original filename (for logging purposes)
     * @returns The markdown content as string
     */
    parseMarkdownContent(fileBuffer: Buffer, fileName?: string): string {
        try {
            // Convert buffer to string using UTF-8 encoding
            const markdownContent = fileBuffer.toString('utf-8');
            
            this.logger.debug('Successfully parsed markdown file', {
                fileName,
                contentLength: markdownContent.length,
                contentPreview: markdownContent.substring(0, 100) + (markdownContent.length > 100 ? '...' : '')
            });

            return markdownContent;
        } catch (error) {
            this.logger.error('Failed to parse markdown file', {
                fileName,
                error: error.message
            });
            throw new Error(`Failed to parse markdown file: ${error.message}`);
        }
    }

    /**
     * Validate if content appears to be valid markdown
     * @param content - The content to validate
     * @returns boolean indicating if content seems like valid markdown
     */
    isValidMarkdown(content: string): boolean {
        if (!content || typeof content !== 'string') {
            return false;
        }

        // Basic validation - check for common markdown patterns
        const markdownPatterns = [
            /^#+ /m,           // Headers
            /\*\*.*\*\*/,      // Bold text
            /\*.*\*/,          // Italic text
            /^\* /m,           // Bullet points
            /^\d+\. /m,        // Numbered lists
            /\[.*\]\(.*\)/,    // Links
            /```[\s\S]*```/,   // Code blocks
        ];

        // If content has at least one markdown pattern, consider it valid
        return markdownPatterns.some(pattern => pattern.test(content));
    }

    /**
     * Extract file name from storage path
     * @param filePath - Full path to the file
     * @returns Just the filename
     */
    extractFileName(filePath: string): string {
        return filePath.split('/').pop() || 'unknown.md';
    }
}