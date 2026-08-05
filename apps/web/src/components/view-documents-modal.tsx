"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { 
  FileText, 
  Image, 
  FileSpreadsheet, 
  FileVideo, 
  FileAudio, 
  FileCode,
  File,
  Archive,
  Loader2,
  Download,
  AlertCircle,
  Calendar,
  FolderOpen,
  RefreshCw
} from "lucide-react"
import type { Document } from "@/domain/documents/models/document"

interface ViewDocumentsModalProps {
  automationId: string
  disabled?: boolean
  documents: Document[]
  documentsLoading: boolean
  documentsError: string | null
  downloadingIds: Set<string>
  onFetchDocuments: (automationId: string) => void
  onDownloadDocument: (document: Document) => Promise<void>
}

export function ViewDocumentsModal({ 
  automationId, 
  disabled = false,
  documents,
  documentsLoading,
  documentsError,
  downloadingIds,
  onFetchDocuments,
  onDownloadDocument
}: ViewDocumentsModalProps) {
  const [open, setOpen] = useState(false)

  const getFileIcon = (fileName: string) => {
    const extension = fileName.toLowerCase().split('.').pop()
    
    switch (extension) {
      case 'pdf':
      case 'doc':
      case 'docx':
      case 'txt':
      case 'rtf':
        return <FileText className="h-5 w-5 text-red-500" />
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'svg':
      case 'webp':
        return <Image className="h-5 w-5 text-green-500" aria-label="Image file" />
      case 'xls':
      case 'xlsx':
      case 'csv':
        return <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'wmv':
      case 'flv':
      case 'webm':
        return <FileVideo className="h-5 w-5 text-purple-500" />
      case 'mp3':
      case 'wav':
      case 'flac':
      case 'aac':
        return <FileAudio className="h-5 w-5 text-orange-500" />
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
      case 'html':
      case 'css':
      case 'json':
      case 'xml':
        return <FileCode className="h-5 w-5 text-blue-500" />
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
      case 'gz':
        return <Archive className="h-5 w-5 text-yellow-600" />
      default:
        return <File className="h-5 w-5 text-gray-500" />
    }
  }

  const getFileExtension = (fileName: string) => {
    return fileName.toLowerCase().split('.').pop()?.toUpperCase() || 'FILE'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const truncateFileName = (fileName: string, maxLength: number = 35) => {
    if (fileName.length <= maxLength) return fileName
    
    const extension = fileName.split('.').pop()
    const nameWithoutExtension = fileName.substring(0, fileName.lastIndexOf('.'))
    
    if (nameWithoutExtension.length + (extension?.length || 0) + 1 <= maxLength) {
      return fileName
    }
    
    const availableLength = maxLength - (extension?.length || 0) - 4 // 4 for "..." and "."
    const truncatedName = nameWithoutExtension.substring(0, availableLength)
    
    return extension ? `${truncatedName}...${extension}` : `${truncatedName}...`
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (newOpen && !disabled) {
      onFetchDocuments(automationId)
    }
  }

  const handleDownload = async (doc: Document) => {
    try {
      await onDownloadDocument(doc)
    } catch (error) {
      console.error('Download failed:', error)
      // You could show an error toast here if you have a toast system
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={disabled}
          className="text-xs h-7 px-2"
        >
          <FolderOpen className="h-3 w-3 mr-1" />
          Documents
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            <span>Automation Documents</span>
          </DialogTitle>
          <DialogDescription>
            Documents uploaded for this automation
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {documentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading documents...</span>
              </div>
            </div>
          ) : documentsError ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <div className="flex items-center space-x-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm">{documentsError}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onFetchDocuments(automationId)}
                className="text-xs"
              >
                Try Again
              </Button>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No documents found</p>
              <p className="text-xs mt-1">Documents will appear here once uploaded</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors group"
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      {getFileIcon(document.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium" title={document.name}>
                          {truncateFileName(document.name)}
                        </p>
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                          {getFileExtension(document.name)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 mt-1">
                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(document.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(document)}
                      className="h-8 w-8 p-0"
                      title="Download document"
                      disabled={downloadingIds.has(document.id)}
                    >
                      {downloadingIds.has(document.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {documents.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {documents.length} document{documents.length !== 1 ? 's' : ''} found
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onFetchDocuments(automationId)}
              className="text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
} 