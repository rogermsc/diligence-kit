import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Plain elements with the density this product wants: 34px rows, hairline
 * rules, tabular figures. No dependency — a table is a table, and the only
 * thing a library would add here is a peer version to keep in step.
 *
 * Always render inside something with `overflow-x-auto`; a fact table on a
 * narrow viewport must scroll itself rather than the page.
 */
const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <table
      ref={ref}
      className={cn("w-full caption-bottom border-collapse text-[0.8125rem]", className)}
      {...props}
    />
  ),
)
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b [&_tr]:border-border/60", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
))
TableBody.displayName = "TableBody"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-border/60 transition-colors hover:bg-muted/40 data-[state=selected]:bg-secondary",
      className,
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-[30px] px-3 text-left align-middle text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground",
      className,
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn("h-[34px] px-3 align-middle", className)} {...props} />
))
TableCell.displayName = "TableCell"

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell }
