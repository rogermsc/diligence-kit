import { DocumentSections, Document } from "./types"

export const generateDocumentStatusHtml = (documents: DocumentSections) => {
    const statusColors = {
        OK: "#4ade80", // Soft green
        MISSING: "#f87171", // Soft red
        OPTIONAL: "#fbbf24", // Soft yellow
    }

    const statusLabels = {
        OK: "Received",
        MISSING: "Pending",
        OPTIONAL: "Optional",
    }

    const createTableForSection = (title: string, docs: Document[]) => `
        <div style="
            margin-bottom: 24px;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        ">
            <div style="
                padding: 16px 20px;
                background-color: #f8fafc;
                border-bottom: 1px solid #e2e8f0;
            ">
                <h2 style="
                    color: #1e293b;
                    font-size: 18px;
                    font-weight: 600;
                    margin: 0;
                ">
                    ${title}
                </h2>
            </div>
            <div style="padding: 16px 20px;">
                ${docs
                    .map(
                        (doc) => `
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 12px 0;
                        border-bottom: 1px solid #e2e8f0;
                    ">
                        <div style="
                            color: #334155;
                            font-size: 15px;
                            flex: 1;
                        ">
                            ${doc.name}
                        </div>
                        <div style="
                            display: flex;
                            align-items: center;
                            margin-left: 16px;
                        ">
                            <span style="
                                background-color: ${statusColors[doc.status]};
                                color: white;
                                padding: 6px 12px;
                                border-radius: 20px;
                                font-size: 14px;
                                font-weight: 500;
                                min-width: 80px;
                                text-align: center;
                            ">
                                ${statusLabels[doc.status]}
                            </span>
                        </div>
                    </div>
                `,
                    )
                    .join("")}
            </div>
        </div>
    `

    const sections = [
        { title: "Company Overview", key: "company_summary_documents" },
        { title: "Team", key: "team_documents" },
        { title: "Corporate Documents", key: "corporate_documents" },
        { title: "Clients", key: "clients_documents" },
        { title: "Investment", key: "investment_documents" },
        { title: "Legal", key: "legal_documents" },
        { title: "Financial", key: "financial_documents" },
    ]

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Document Status</title>
        </head>
        <body style="
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.5;
            color: #334155;
            background-color: #f1f5f9;
            margin: 0;
            padding: 24px;
        ">
            <div style="
                max-width: 800px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 16px;
                padding: 32px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            ">
                <div style="text-align: center; margin-bottom: 32px;">
                    <h1 style="
                        color: #0f172a;
                        font-size: 28px;
                        font-weight: 600;
                        margin: 0 0 24px 0;
                    ">
                        Document Status Report
                    </h1>
                    
                    <div style="
                        display: flex;
                        justify-content: center;
                        gap: 20px;
                        flex-wrap: wrap;
                    ">
                        ${Object.entries(statusLabels)
                            .map(
                                ([status, label]) => `
                            <div style="
                                display: flex;
                                align-items: center;
                                gap: 8px;
                                padding: 8px 16px;
                                background-color: #f8fafc;
                                border-radius: 8px;
                            ">
                                <span style="
                                    width: 12px;
                                    height: 12px;
                                    background-color: ${statusColors[status as keyof typeof statusColors]};
                                    border-radius: 50%;
                                "></span>
                                <span style="
                                    color: #64748b;
                                    font-size: 14px;
                                    font-weight: 500;
                                ">
                                    ${label}
                                </span>
                            </div>
                        `,
                            )
                            .join("")}
                    </div>
                </div>

                ${sections
                    .map((section) =>
                        createTableForSection(
                            section.title,
                            documents[section.key],
                        ),
                    )
                    .join("")}
            </div>
        </body>
        </html>
    `
}
