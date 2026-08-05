# Diligence Kit System Operational Guide (For Support Agents)

This document maps the complete usage flow of the Diligence Kit system, focusing on the end-user perspective and the business rules governing interaction.

Objective: Serve as a knowledge base for the **Liaison Agent** (Level 2 Support) to guide users through operational inquiries.

---

## Process Overview

Diligence Kit automates due diligence document analysis for companies and investors. The process is divided into two main stages:

1. **Stage 1 (Screening & One-Pager):** Initial upload, file validation, and generation of an executive summary.
2. **Stage 2 (Deep Reports):** Automatic generation of specialized reports (Financial, Operational, Commercial, and Legal).

---

## Stage 1: Screening and One-Pager

### 1. Starting Automation (Upload)

* **User Action:** The user must access the company page and upload documents.
* **Accepted Format:** **Only `.zip` files**.
* **ZIP Content:** The ZIP file must contain documents (PDF, DOCX, XLSX) either organized or loose. The system will attempt to classify them automatically, but having them organized is ideal.
* **Valid Files:** The system only processes: `.pdf`, `.csv`, `.xls`, `.xlsx`, `.doc`, `.docx`, `.txt`. Other files inside the ZIP will be ignored during browser filtering.
* **Constraints:** Uploads are done in 5MB "chunks" to support large files.

### 2. Processing (What happens behind the scenes)

* **Status on Screen:** The user will see the status change to `PROCESSING`.
* **Validation:** The system checks if there are sufficient documents for minimum categories.
  * *If something critical is missing:* The system may mark documents as `MISSING`.
* **Result:** Upon completion, the status changes to `COMPLETED` and a **One-Pager** (Executive Summary in Markdown) is generated and displayed on the screen.

---

## Stage 2: Specialized Reports

### 1. Trigger (Start Stage 2)

* **Prerequisite:** Stage 1 must be `COMPLETED`.
* **User Action:** Click the **"Start Stage 2"** (or "Generate Detailed Reports") button on the interface.
* **What the system does:** Starts 4 parallel automations, one for each analysis domain.

### 2. The 4 Pillars of Analysis (Agents)

The system triggers expert agents that generate independent reports. Support should explain what each covers:

| Agent / Report         | What does it analyze?                               | Main Deliverables                                             |
| :--------------------- | :-------------------------------------------------- | :------------------------------------------------------------ |
| **Financial**          | Balance sheets, P&L, Cash Flow, Excel Models        | Adjusted EBITDA, Runway, Margins, Fiscal Risks.               |
| **Operational**        | Org Charts, Processes, HR, Tech Stack               | Team structure, Scalability, HR/Tech Risks.                   |
| **Commercial**         | Customer Contracts, Market Research, Sales          | TAM/SAM/SOM, Customer Profile, Churn, GTM Strategy.           |
| **Legal & Cap Table**  | Articles of Association, Cap Table (Excel), Agreements | Corporate Structure, Dilution, Legal Compliance, Risks.       |

### 3. Monitoring and Results

* **Status:** The user will see new cards or sections for each report with status `PENDING` -> `PROCESSING`.
* **Completion:** When finished (`COMPLETED`), the user can download the final reports (usually in professional **DOCX** format or PDF).

---

## Common Troubleshooting (FAQ for the Agent)

### "My upload failed or froze."

* **Probable cause:** Corrupted ZIP file, unstable internet, or very large file (>500MB may take time).
* **Guidance:** "Check if the file is a valid ZIP. If it is very large, try splitting it into two smaller files or ensure your connection is stable. The system supports resuming interrupted uploads."

### "The system says documents are missing (MISSING)."

* **Probable cause:** The system could not classify the uploaded files. Ex: A financial balance sheet named "doc1.pdf".
* **Guidance:** "Try renaming the files to clearer names (ex: 'Balance_Sheet_2023.pdf', 'Articles_of_Association.pdf') and upload again."

### "I can't start Stage 2."

* **Probable cause:** Stage 1 is still `PROCESSING` or has failed (`FAILED`).
* **Guidance:** "Wait for the initial screening (One-Pager generation) to complete. If the status is 'FAILED', you will need to restart the upload process."

### "Where do I see the final reports?"

* **Guidance:** "After Stage 2 is completed, download buttons will appear in the 'Detailed Reports' area on the company page."

---

## Status Glossary

* **PENDING:** Queued for processing.
* **PROCESSING:** AI agents are analyzing documents (may take several minutes).
* **COMPLETED:** Analysis finished successfully.
* **FAILED:** Technical error or validation failed. (In this case, suggest contacting technical support/Ombudsman).
