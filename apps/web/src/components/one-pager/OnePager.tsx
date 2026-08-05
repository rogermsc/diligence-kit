"use client"

import React, { useMemo } from "react"
import { marked } from "marked"
import DOMPurify from "dompurify"
import type { Config } from "dompurify"

const DOMPURIFY_CONFIG: Config = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'code', 'pre', 'blockquote', 'hr',
    'table', 'thead', 'tbody', 'tr', 'th', 'td'],
  ALLOWED_ATTR: ['href', 'title', 'class', 'target', 'rel'],
  ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel):/i,
}
import { Expand, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useOnePagerViewModel, OnePagerViewModelProps } from "./onePagerViewModel"

export interface OnePagerProps extends OnePagerViewModelProps {
    title: string
    markdown: string
    classNameCollapsed?: string
    classNameExpanded?: string
    previewContent?: string
    expandIcon?: React.ReactNode
    collapseIcon?: React.ReactNode
    markedOptions?: Parameters<typeof marked.setOptions>[0]
}

export function OnePager({
    title,
    markdown,
    classNameCollapsed,
    classNameExpanded,
    expandIcon,
    collapseIcon,
    markedOptions,
    ...viewModelProps
}: OnePagerProps) {
    const {
        isExpanded,
        isAnimating,
        containerStyle,
        expand,
        collapse
    } = useOnePagerViewModel(viewModelProps)

    useMemo(() => {
        const defaultOptions = {
            gfm: true,
            breaks: true,
            headerIds: false,
            mangle: false,
            ...markedOptions
        }

        marked.setOptions(defaultOptions)
    }, [markedOptions])

    const sanitizedHtml = useMemo(() => {
        if (typeof window === 'undefined') {
            return '' // DOMPurify is browser-only; client hydration will populate
        }

        const rawHtml = marked.parse(markdown) as string
        return DOMPurify.sanitize(rawHtml, DOMPURIFY_CONFIG)
    }, [markdown])


    if (isExpanded) {
        return (
            <>
                <div
                    className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
                    onClick={collapse}
                />

                <div
                    className={cn(
                        "fixed z-50 bg-background border rounded-lg shadow-2xl transition-all duration-300 overflow-hidden",
                        "top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
                        isAnimating && "transition-all duration-300",
                        classNameExpanded
                    )}
                    style={{
                        width: containerStyle.width,
                        height: containerStyle.height,
                    }}
                >
                    <Card className="h-full border-0 gap-0 rounded-lg">
                        <CardHeader className="items-center justify-between py-0 border-b flex flex-row">
                            <div className="text-lg font-semibold truncate pr-4">
                                {title}
                            </div>
                            <Button
                                variant="ghost"
                                size="lg"
                                onClick={collapse}
                                className="h-10 w-10 cursor-pointer"
                                disabled={isAnimating}
                            >
                                {collapseIcon || <X className="h-full w-full" />}
                            </Button>

                        </CardHeader>
                        <CardContent className="flex-1 overflow-auto p-6">
                            <div
                                className="prose prose-sm dark:prose-invert max-w-none"
                                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                            />
                        </CardContent>
                    </Card>
                </div>
            </>
        )
    }

    return (
        <div
            className={cn(
                "relative transition-all duration-300 cursor-pointer",
                isAnimating && "transition-all duration-300",
                classNameCollapsed
            )}
            style={containerStyle}
            onClick={expand}
        >
            <Card className="h-full gap-2 hover:shadow-md transition-shadow flex flex-col">
                <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                        <CardTitle className="text-sm font-medium line-clamp-2 pr-2">
                            {title}
                        </CardTitle>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation()
                                expand()
                            }}
                            disabled={isAnimating}
                        >
                            {expandIcon || <Expand className="h-3 w-3" />}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-0 relative flex-1 overflow-hidden">
                    <div
                        className={cn(
                            "text-xs text-muted-foreground",
                            "overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800",
                            "pr-2"
                        )}
                        style={{
                            height: '100%',
                            maxHeight: '100%'
                        }}
                    >
                        <div
                            className="prose prose-sm dark:prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                        />
                    </div>

                </CardContent>            
            </Card>
        </div>
    )
} 