"use client"

import { OnePager } from "@/components/one-pager"
import "@/app/globals.css"

// Mock markdown content for demonstration
const mockMarkdown: string = `## Sample Document

This is a **sample document** to demonstrate the OnePager component functionality.

## Features

The OnePager component includes:

- ✅ Expandable/collapsible interface
- ✅ Markdown rendering with GitHub Flavored Markdown
- ✅ Customizable size and position
- ✅ Smooth animations
- ✅ Preview mode with blur effect
- ✅ Full modal view when expanded

## Code Example

\`\`\`typescript
import { OnePager } from "@/components/one-pager"

function MyComponent() {
  return (
    <OnePager
      title="My Document"
      markdown="# Hello World"
      collapsedSize={{ width: "300px", height: "150px" }}
    />
  )
}
\`\`\`

## Lists and Tables

### Todo List
- [x] Create component structure
- [x] Implement expand/collapse logic
- [x] Add markdown rendering
- [ ] Add syntax highlighting
- [ ] Add custom themes

### Sample Table

| Feature | Status | Priority |
|---------|--------|----------|
| Basic rendering | ✅ Done | High |
| Animations | ✅ Done | Medium |
| Customization | ✅ Done | High |
| Documentation | 🔄 In Progress | Low |

## Long Content

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

### Subsection

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

**Bold text** and *italic text* work perfectly, along with \`inline code\` and [links](https://example.com).

> This is a blockquote that demonstrates how the component handles various markdown elements beautifully.

The component is designed to be highly customizable and should work well in various contexts and screen sizes.`

export default function OnePagerDemoPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-4">OnePager Component Demo</h1>
          <p className="text-muted-foreground mb-8">
            Click on any of the documents below to see the expand/collapse functionality.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <OnePager
            title="Getting Started Guide"
            markdown={mockMarkdown}
            expandedSize={{ width: "80vw", height: "80vh" }}
            collapsedSize={{ width: "w-full", height: "20vh" }}
          />

          <OnePager
            title="Technical Documentation"
            markdown={mockMarkdown}
            expandedSize={{ width: "80vw", height: "80vh" }}
            collapsedSize={{ width: "w-full", height: "40vh" }}
          />
        </div>
        <div className="grid grid-cols-1 gap-6">
          <OnePager
            title="Technical Documentation"
            markdown={mockMarkdown}
            expandedSize={{ width: "80vw", height: "80vh" }}
            collapsedSize={{ width: "w-full", height: "40vh" }}
          />
        </div>

      </div>
    </div>
  )
}