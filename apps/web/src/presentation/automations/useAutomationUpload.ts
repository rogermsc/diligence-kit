"use client";

import { useState, useCallback, useRef } from "react";
import JSZip from "jszip";
import { analyzeZipFile } from "@/lib/zipFileFilter";

const ALLOWED_EXTENSIONS = [
  'pdf', 'csv', 'xls', 'xlsx', 'doc', 'docx', 'txt',
  'ppt', 'pptx',
  'png', 'jpg', 'jpeg', 'tiff', 'tif', 'bmp', 'webp',
];
const MAX_CONCURRENT_UPLOADS = 3;
const MAX_ZIP_COMPRESSED_SIZE = 200 * 1024 * 1024;  // 200 MB
const MAX_ZIP_UNCOMPRESSED_SIZE = 500 * 1024 * 1024; // 500 MB

interface UploadedFileInfo {
  fileName: string;
  gcsPath: string;
}

interface FileAnalysis {
  allowedFiles: string[];
  removedFiles: string[];
  totalFiles: number;
}

interface UseAutomationUploadOptions {
  companyId: string;
  onSuccess?: (response: { automationId: string; status: string }) => void;
  onError?: (error: string) => void;
  onFileAnalysis?: (analysis: FileAnalysis) => void;
}

function isAllowedFile(path: string): boolean {
  const basename = path.split('/').pop() || path;
  if (basename.startsWith('._') || path.includes('__MACOSX/')) {
    return false;
  }
  const ext = basename.toLowerCase().split('.').pop() || '';
  return ALLOWED_EXTENSIONS.includes(ext);
}

export function useAutomationUpload({
  companyId,
  onSuccess,
  onError,
  onFileAnalysis,
}: UseAutomationUploadOptions) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [filterProgress, setFilterProgress] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startUpload = useCallback(async (zipFile: File) => {
    if (!zipFile.name.toLowerCase().endsWith('.zip')) {
      onError?.('Only ZIP files are supported');
      return;
    }

    if (zipFile.size > MAX_ZIP_COMPRESSED_SIZE) {
      onError?.('ZIP file exceeds maximum allowed size (200MB)');
      return;
    }

    setIsFiltering(true);
    setFilterProgress(0);
    setFilterStatus('Analyzing ZIP file...');

    try {
      // 1. Analyze the ZIP
      const analysis = await analyzeZipFile(zipFile);
      onFileAnalysis?.(analysis);

      if (analysis.allowedFiles.length === 0) {
        setIsFiltering(false);
        onError?.('No files with allowed extensions found in the ZIP.');
        return;
      }

      // 2. Extract allowed files from the ZIP
      setFilterStatus('Extracting files...');
      setFilterProgress(30);

      const zip = new JSZip();
      const zipContent = await zip.loadAsync(zipFile);

      const extractedFiles: File[] = [];
      const allowedEntries = Object.entries(zipContent.files).filter(
        ([path, entry]) => !entry.dir && isAllowedFile(path)
      );

      let totalUncompressedBytes = 0;

      for (let i = 0; i < allowedEntries.length; i++) {
        const [relativePath, entry] = allowedEntries[i];
        const data = await entry.async('arraybuffer');

        totalUncompressedBytes += data.byteLength;
        if (totalUncompressedBytes > MAX_ZIP_UNCOMPRESSED_SIZE) {
          setIsFiltering(false);
          onError?.('ZIP content exceeds maximum allowed size (500MB uncompressed)');
          return;
        }

        const rawName = relativePath.split('/').pop() || relativePath;
        const fileName = rawName.replace(/\.\./g, '').replace(/[/\\]/g, '') || 'file';
        extractedFiles.push(new File([data], fileName));

        setFilterProgress(30 + Math.round((i / allowedEntries.length) * 60));
        setFilterStatus(`Extracting files... (${i + 1}/${allowedEntries.length})`);
      }

      setFilterProgress(100);
      setFilterStatus('Extraction complete');
      setIsFiltering(false);

      // 3. Create automation via proxy route (no token needed)
      setIsUploading(true);
      setUploadProgress(0);
      abortControllerRef.current = new AbortController();

      const createResponse = await fetch(
        `/api/automation/create/${companyId}`,
        {
          method: 'POST',
          signal: abortControllerRef.current?.signal,
        },
      );

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create automation');
      }

      const { automationId } = await createResponse.json();
      setUploadProgress(5);

      // 4. Upload extracted files one by one via proxy route
      const uploadedFiles: UploadedFileInfo[] = [];
      let completedCount = 0;
      const totalFiles = extractedFiles.length;

      const uploadFile = async (file: File): Promise<UploadedFileInfo> => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('companyId', companyId);

        const response = await fetch(
          `/api/automation/${automationId}/upload-document`,
          {
            method: 'POST',
            body: formData,
            signal: abortControllerRef.current?.signal,
          },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Upload failed for ${file.name}`);
        }

        const result = await response.json();
        completedCount++;
        setUploadProgress(5 + Math.round((completedCount / totalFiles) * 85));
        return result;
      };

      // Process in batches of MAX_CONCURRENT_UPLOADS
      for (let i = 0; i < extractedFiles.length; i += MAX_CONCURRENT_UPLOADS) {
        const batch = extractedFiles.slice(i, i + MAX_CONCURRENT_UPLOADS);
        const results = await Promise.all(batch.map(uploadFile));
        uploadedFiles.push(...results);
      }

      // 5. Confirm upload via proxy route
      setUploadProgress(95);
      const confirmResponse = await fetch(
        `/api/automation/${automationId}/confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, files: uploadedFiles }),
          signal: abortControllerRef.current?.signal,
        },
      );

      if (!confirmResponse.ok) {
        const errorData = await confirmResponse.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to confirm upload');
      }

      const confirmResult = await confirmResponse.json();
      setUploadProgress(100);
      setIsUploading(false);
      onSuccess?.(confirmResult);
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setIsUploading(false);
        setIsFiltering(false);
        return;
      }
      setIsUploading(false);
      setIsFiltering(false);
      const message = error instanceof Error ? error.message : 'Upload failed';
      onError?.(message);
    }
  }, [companyId, onSuccess, onError, onFileAnalysis]);

  const cancelUpload = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsUploading(false);
    setIsFiltering(false);
    setUploadProgress(0);
    setFilterProgress(0);
    setFilterStatus("");
  }, []);

  return {
    startUpload,
    cancelUpload,
    uploadProgress,
    filterProgress,
    filterStatus,
    isUploading,
    isFiltering,
  };
}
