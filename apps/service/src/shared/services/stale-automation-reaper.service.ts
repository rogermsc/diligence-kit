import {
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from "@nestjs/common"
import { prisma } from "@/shared/infra/prisma"

const MINUTE = 60 * 1000

/**
 * Reads a duration in minutes, refusing anything that is not a positive number.
 *
 * `Number("5m")` is NaN, and `setInterval(fn, NaN)` coerces to about 1ms — a
 * plausible typo for a variable documented in minutes turned the sweep into a
 * busy loop hammering the database. NaN also made the cutoff an Invalid Date, so
 * every query threw and the reaper was silently disabled while looking healthy.
 * `0 || 60` quietly became 60 as well, so an explicit 0 never took effect.
 */
function minutes(name: string, fallback: number): number {
    const raw = process.env[name]
    if (raw === undefined || raw === "") return fallback * MINUTE

    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed <= 0) {
        new Logger("StaleAutomationReaper").error(
            `${name}="${raw}" is not a positive number of minutes; ` +
                `using ${fallback}.`,
        )
        return fallback * MINUTE
    }
    return parsed * MINUTE
}

/**
 * Fails automations that have been PROCESSING for longer than any real run takes.
 *
 * The agent runs analysis as a background task and calls back when it finishes.
 * If that process is restarted, redeployed or OOM-killed mid-run, the callback
 * never arrives and nothing else ever revisits the row: the automation stays
 * PROCESSING forever, the dashboard shows a spinner forever, and the only
 * recovery is a manual UPDATE. Whatever else is done about durability, something
 * has to notice.
 *
 * This is a timeout, not a recovery — the work is gone either way. Marking the
 * row FAILED is what makes it visible and lets the user retry.
 *
 * It measures wall-clock since the row was last written, which is not the same
 * as liveness: nothing touches updatedAt while the agent works, so a slow but
 * healthy run looks identical to an abandoned one. Two consequences follow, and
 * both argue for setting the timeout well above the longest run you expect
 * rather than tightly. First, a run failed while still executing can be retried
 * from the dashboard — retryAutomation's only precondition is FAILED — so the
 * same automation is dispatched to the agent twice and the two races on the same
 * callbacks and storage paths. Second, the original run's completion callback
 * then writes COMPLETED over the FAILED row. The default is deliberately
 * generous for that reason; a heartbeat written by the agent is the real fix and
 * is not implemented.
 *
 * Deliberately not a distributed lock: the update is idempotent and scoped by
 * status and age, so several replicas running it concurrently is harmless. The
 * first one wins and the rest match no rows.
 */
@Injectable()
export class StaleAutomationReaper implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(StaleAutomationReaper.name)
    private timer?: NodeJS.Timeout

    private readonly timeoutMs = minutes("AUTOMATION_TIMEOUT_MINUTES", 240)
    private readonly intervalMs = minutes(
        "AUTOMATION_REAPER_INTERVAL_MINUTES",
        5,
    )

    onModuleInit(): void {
        if (process.env.AUTOMATION_REAPER_ENABLED === "false") {
            this.logger.warn(
                "Stale-automation reaper disabled; runs interrupted mid-flight " +
                    "will stay PROCESSING indefinitely.",
            )
            return
        }

        this.timer = setInterval(() => {
            void this.reap()
        }, this.intervalMs)
        // Do not hold the process open just for the next sweep.
        this.timer.unref?.()

        this.logger.log(
            `Stale-automation reaper active: fails runs still PROCESSING after ` +
                `${this.timeoutMs / MINUTE} minutes, checked every ` +
                `${this.intervalMs / MINUTE} minutes.`,
        )
    }

    onModuleDestroy(): void {
        if (this.timer) clearInterval(this.timer)
    }

    /** Returns how many rows were failed. Exposed so it can be driven directly. */
    async reap(now: Date = new Date()): Promise<number> {
        const cutoff = new Date(now.getTime() - this.timeoutMs)

        try {
            const { count } = await prisma.automation.updateMany({
                where: { status: "PROCESSING", updatedAt: { lt: cutoff } },
                data: { status: "FAILED" },
            })

            if (count > 0) {
                this.logger.warn(
                    `Failed ${count} automation(s) that had been PROCESSING since ` +
                        `before ${cutoff.toISOString()}. The agent never called back — ` +
                        `most likely it was restarted mid-run.`,
                )
            }
            return count
        } catch (error) {
            // A sweep that throws must not kill the interval.
            this.logger.error(
                `Stale-automation sweep failed: ${(error as Error).message}`,
            )
            return 0
        }
    }
}
