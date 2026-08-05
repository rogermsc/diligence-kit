/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback, useRef } from "react";
import Resumable from "resumablejs";

interface UploadProgress {
  progress: number;
  loaded: number;
  total: number;
  isUploading: boolean;
  isComplete: boolean;
  error: string | null;
}

interface UseResumableUploadOptions {
  target: string;
  chunkSize?: number;
  simultaneousUploads?: number;
  testChunks?: boolean;
  onProgress?: (progress: UploadProgress) => void;
  onSuccess?: (response: any) => void;
  onError?: (error: string) => void;
}

function generateUUID(): string {
  return crypto.randomUUID();
}

export function useResumableUpload(options: UseResumableUploadOptions) {
  const [progress, setProgress] = useState<UploadProgress>({
    progress: 0,
    loaded: 0,
    total: 0,
    isUploading: false,
    isComplete: false,
    error: null,
  });

  const resumableRef = useRef<Resumable | null>(null);
  const fileIdRef = useRef<string>(generateUUID());

  const initializeResumable = useCallback(() => {
    if (resumableRef.current) {
      return resumableRef.current;
    }

    const resumable = new Resumable({
      target: options.target,
      chunkSize: options.chunkSize || 5 * 1024 * 1024,
      simultaneousUploads: options.simultaneousUploads || 1,
      testChunks: false,
      maxChunkRetries: 3,
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
      withCredentials: false,
      generateUniqueIdentifier: () => fileIdRef.current,
      parameterNamespace: "",
      query: (file: any, chunk: any) => {
        const chunkNumber = chunk.offset + 1;
        
        return {
          chunkNumber: chunkNumber,
          totalChunks: file.chunks.length,
          identifier: fileIdRef.current,
          filename: file.fileName,
          totalSize: file.size,
        };
      },
    });

    resumable.on("fileProgress", (file: any) => {
      const progressData = {
        progress: Math.round(resumable.progress() * 100),
        loaded: resumable.progress() * file.size,
        total: file.size,
        isUploading: true,
        isComplete: false,
        error: null,
      };
      setProgress(progressData);
      options.onProgress?.(progressData);
    });

    resumable.on("fileSuccess", (file: any, response: any) => {
      const finalProgress = {
        progress: 100,
        loaded: file.size,
        total: file.size,
        isUploading: false,
        isComplete: true,
        error: null,
      };
      setProgress(finalProgress);
      try {
        const parsedResponse = JSON.parse(response);
        options.onSuccess?.(parsedResponse);
      } catch {
        options.onSuccess?.(response);
      }
    });

    resumable.on("fileError", (file: any, message: any) => {
      const errorProgress = {
        progress: 0,
        loaded: 0,
        total: file.size,
        isUploading: false,
        isComplete: false,
        error: message,
      };
      setProgress(errorProgress);
      options.onError?.(message);
    });

    resumableRef.current = resumable;
    return resumable;
  }, [options]);

  const uploadFile = useCallback(
    (file: File) => {
      const resumable = initializeResumable();

      fileIdRef.current = generateUUID();

      setProgress({
        progress: 0,
        loaded: 0,
        total: file.size,
        isUploading: false,
        isComplete: false,
        error: null,
      });

      resumable.files = [];
      resumable.addFile(file);

      setTimeout(() => {
        resumable.upload();
      }, 100);
    },
    [initializeResumable]
  );

  const pauseUpload = useCallback(() => {
    resumableRef.current?.pause();
  }, []);

  const resumeUpload = useCallback(() => {
    resumableRef.current?.upload();
  }, []);

  const cancelUpload = useCallback(() => {
    resumableRef.current?.cancel();
    setProgress({
      progress: 0,
      loaded: 0,
      total: 0,
      isUploading: false,
      isComplete: false,
      error: null,
    });
  }, []);

  return {
    uploadFile,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    progress,
    isSupported: true,
  };
}
