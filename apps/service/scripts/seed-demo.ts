/**
 * Seeds the demo: one user, one company, and one completed analysis of the
 * synthetic dataroom in apps/agent/fixtures/dataroom.
 *
 * The point is that `make demo` lands on a finished run rather than an empty
 * dashboard — you can read the one-pager, see the three conflicting revenue
 * figures and open the documents they came from, without an API key.
 *
 *   pnpm exec ts-node -r tsconfig-paths/register scripts/seed-demo.ts
 *
 * Idempotent: rerunning replaces the demo company and leaves everything else.
 */
import { PrismaClient } from "@prisma/client"
import * as bcrypt from "bcryptjs"
import { randomUUID } from "crypto"
import { promises as fs } from "fs"
import * as path from "path"

const prisma = new PrismaClient()

const EMAIL = process.env.DEMO_EMAIL || "you@example.com"
const PASSWORD = process.env.DEMO_PASSWORD || "demo-password"
const COMPANY = "Northwind Robotics"

// Fixed ids so the seeded rows line up with the recorded agent fixtures, which
// key their storage paths on the automation id.
const AUTOMATION_ID = "00000000-0000-4000-8000-000000000001"
const COMPANY_ID = "00000000-0000-4000-8000-000000000002"

const BUCKET = process.env.GCLOUD_STORAGE_BUCKET || "local-bucket"
const STORAGE_ROOT = path.resolve(process.env.STORAGE_LOCAL_ROOT || ".data/storage")
const FIXTURES =
    process.env.DEMO_FIXTURES || path.resolve(__dirname, "../../agent/fixtures")
const DATAROOM = path.join(FIXTURES, "dataroom")
const OUTPUT = path.join(FIXTURES, "demo-output")

async function copyInto(from: string, to: string): Promise<void> {
    const dest = path.join(STORAGE_ROOT, to)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.copyFile(from, dest)
}

/** Copies the dataroom into local storage under the path the pipeline uses. */
async function stageDataroom(): Promise<string[]> {
    const names = (await fs.readdir(DATAROOM)).filter((n) => !n.startsWith(".")).sort()

    for (const name of names) {
        await copyInto(path.join(DATAROOM, name), `${COMPANY}/${AUTOMATION_ID}/${name}`)
    }
    return names
}

/**
 * Copies the committed pipeline output — the rendered one-pager plus the facts
 * and one-pager JSON behind it — into the same paths a live run would write.
 * Shipping the output means the demo needs only Docker and Node; producing it
 * needs Python, LibreOffice and the recorded fixtures.
 */
async function stageAnalysis(): Promise<boolean> {
    const files: [string, string][] = [
        ["one_pager.pdf", `one-pagers/${AUTOMATION_ID}.pdf`],
        ["facts.json", `agent-facts/${AUTOMATION_ID}/facts.json`],
        ["one_pager.json", `agent-facts/${AUTOMATION_ID}/one_pager.json`],
    ]

    for (const [name, key] of files) {
        const source = path.join(OUTPUT, name)
        if (!(await fs.access(source).then(() => true, () => false))) return false
        await copyInto(source, key)
    }
    return true
}

async function main() {
    const dataroom = await stageDataroom()
    console.log(`Staged ${dataroom.length} documents into ${STORAGE_ROOT}`)

    const user = await prisma.user.upsert({
        where: { email: EMAIL },
        update: {},
        create: {
            id: randomUUID(),
            email: EMAIL,
            password: await bcrypt.hash(PASSWORD, 10),
        },
    })

    // Replace rather than update: cascades clear the old automation, documents
    // and one-pager so a rerun is not additive.
    await prisma.company.deleteMany({ where: { id: COMPANY_ID } })
    await prisma.company.create({
        data: { id: COMPANY_ID, name: COMPANY, ownerId: user.id },
    })

    await prisma.automation.create({
        data: {
            id: AUTOMATION_ID,
            companyId: COMPANY_ID,
            status: "COMPLETED",
            stage: "TRIAGE",
            Documents: {
                create: dataroom.map((name) => ({
                    name,
                    bucketPath: `gs://${BUCKET}/${COMPANY}/${AUTOMATION_ID}/${name}`,
                })),
            },
        },
    })

    const hasAnalysis = await stageAnalysis()

    if (hasAnalysis) {
        await prisma.onePager.create({
            data: {
                automationId: AUTOMATION_ID,
                companyId: COMPANY_ID,
                url: `gs://${BUCKET}/one-pagers/${AUTOMATION_ID}.pdf`,
            },
        })
    }

    console.log(`\n  user      ${EMAIL} / ${PASSWORD}`)
    console.log(`  company   ${COMPANY} (${dataroom.length} documents)`)
    console.log(
        `  analysis  ${hasAnalysis ? "completed one-pager staged" : "missing — run the agent to produce it"}`,
    )
    console.log(`\nOpen http://localhost:3000 and sign in.`)
}

main()
    .catch((error) => {
        console.error("Seed failed:", error)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
