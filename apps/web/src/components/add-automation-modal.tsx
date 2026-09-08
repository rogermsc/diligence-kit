"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Upload, FileArchive, X, CheckCircle, AlertTriangle, Info, Loader2 } from "lucide-react"
import {
  useAutomationUpload,
  ALLOWED_EXTENSIONS,
  MAX_ZIP_COMPRESSED_SIZE,
  MAX_ZIP_UNCOMPRESSED_SIZE,
} from "@/presentation/automations/useAutomationUpload"

interface ConfirmUploadResponse {
  automationId: string
  status: string
}

interface AddAutomationModalProps {
  companyId: string
  onSuccess?: (response: ConfirmUploadResponse) => void
  disabled?: boolean
  disabledReason?: string
}

export function AddAutomationModal({
  companyId,
  onSuccess,
  disabled = false,
  disabledReason
}: AddAutomationModalProps) {
  const [open, setOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [fileAnalysis, setFileAnalysis] = useState<{
    allowedFiles: string[];
    removedFiles: string[];
    totalFiles: number;
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    startUpload,
    cancelUpload,
    uploadProgress,
    filterProgress,
    filterStatus,
    isUploading,
    isFiltering,
  } = useAutomationUpload({
    companyId,
    onSuccess: (response) => {
      setSelectedFile(null)
      setFileAnalysis(null)
      setOpen(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      onSuccess?.(response)
    },
    onError: (errorMessage) => {
      setError(errorMessage || "Something went wrong during upload, please try again.")
    },
    onFileAnalysis: (analysis) => {
      setFileAnalysis(analysis)
    }
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setError("Please select a ZIP file")
        return
      }
      setSelectedFile(file)
      setError("")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedFile) {
      setError("Please select a ZIP file")
      return
    }

    setError("")
    try {
      await startUpload(selectedFile)
    } catch {
      setError("Something went wrong during upload, please try again.");
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (disabled && newOpen) {
      return
    }

    setOpen(newOpen)
    if (!newOpen) {
      if (isUploading || isFiltering) {
        cancelUpload()
      }
      setSelectedFile(null)
      setFileAnalysis(null)
      setError("")
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setFileAnalysis(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const buttonContent = (
    <Button disabled={disabled}>
      <Plus className="h-4 w-4 mr-2" />
      Start automation
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {disabled ? (
        <div className="relative group">
          {buttonContent}
          {disabledReason && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block">
              <div className="bg-popover text-popover-foreground text-xs rounded px-2 py-1 whitespace-nowrap border shadow-sm">
                {disabledReason}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-popover"></div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <DialogTrigger asChild>
          {buttonContent}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Analyse a dataroom</DialogTitle>
          <DialogDescription>
            Upload the dataroom as a ZIP. Every document is classified, then read
            for facts, and the figures they state differently are reconciled.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="automation-file" className="text-sm font-medium">
                Automation File
              </label>

              {!selectedFile ? (
                <div
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-1">
                    Click to select a ZIP file
                  </p>
                  {/* Stated before the upload, not after it fails. Both limits
                      were enforced in useAutomationUpload and appeared nowhere
                      in the interface. */}
                  <p className="text-xs text-muted-foreground">
                    Up to {MAX_ZIP_COMPRESSED_SIZE / 1024 / 1024} MB zipped,{" "}
                    {MAX_ZIP_UNCOMPRESSED_SIZE / 1024 / 1024} MB unpacked
                  </p>
                </div>
              ) : (
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <FileArchive className="h-8 w-8 text-primary" />
                      <div>
                        <p className="text-sm font-medium">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(selectedFile.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="cursor-pointer"
                      size="sm"
                      onClick={handleRemoveFile}
                      disabled={isUploading || isFiltering}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* File Analysis Results */}
                  {fileAnalysis && (
                    <div className="mt-3 p-3 bg-muted/40/50 rounded-lg border border-border">
                      <div className="flex items-center space-x-2 mb-2">
                        <Info className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        <span className="text-sm font-medium text-foreground">
                          File Analysis Complete
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-3 w-3 text-gray-600 dark:text-gray-400" />
                          <span className="text-foreground">
                            {fileAnalysis.allowedFiles.length} files will be uploaded
                          </span>
                        </div>

                        {fileAnalysis.removedFiles.length > 0 && (
                          <div className="flex items-center space-x-2">
                            <AlertTriangle className="h-3 w-3 text-conflict" />
                            <span className="text-foreground">
                              {fileAnalysis.removedFiles.length} files will be skipped (invalid extensions)
                            </span>
                          </div>
                        )}

                        <div className="mt-2 pt-2 border-t border-border">
                          <p className="text-muted-foreground font-medium mb-1">
                            Accepted: {ALLOWED_EXTENSIONS.join(", ")}
                          </p>

                          {fileAnalysis.removedFiles.length > 0 && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100">
                                View skipped files ({fileAnalysis.removedFiles.length})
                              </summary>
                              <div className="mt-1 pl-4 space-y-1 max-h-20 overflow-y-auto">
                                {fileAnalysis.removedFiles.map((file, index) => (
                                  <p key={index} className="text-gray-600 dark:text-gray-400 text-xs break-all">
                                    {file}
                                  </p>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Filtering/Extraction Progress */}
                  {isFiltering && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Extracting files...</span>
                        <span>{filterProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-gray-600 dark:bg-gray-400 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${filterProgress}%` }}
                        />
                      </div>
                      <div className="text-xs text-center mt-1 text-muted-foreground">
                        {filterStatus || "Processing ZIP contents..."}
                      </div>
                    </div>
                  )}

                  {/* Upload Progress Bar */}
                  {isUploading && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Uploading...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-muted-foreground/20 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <div className="text-xs text-center mt-1 text-muted-foreground">
                        {uploadProgress < 90 ? 'Uploading files...' : uploadProgress < 100 ? 'Confirming...' : 'Done!'}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                id="automation-file"
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading || isFiltering}
              />

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isUploading || isFiltering}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!selectedFile || isUploading || isFiltering}>
              {isFiltering ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extracting...
                </>
              ) : isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Start automation
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
