import { Injectable, Logger } from "@nestjs/common"

export interface PerformanceMetrics {
    readonly operationName: string
    readonly startTime: number
    readonly endTime: number
    readonly durationMs: number
    readonly throughputMBps?: number
    readonly itemsProcessed?: number
    readonly averageItemProcessingTime?: number
}

export interface BatchPerformanceComparison {
    readonly oldSystemMetrics: PerformanceMetrics
    readonly newSystemMetrics: PerformanceMetrics
    readonly performanceImprovement: number
    readonly throughputImprovement: number
}

@Injectable()
export class PerformanceMetricsService {
    private readonly logger = new Logger(PerformanceMetricsService.name)
    private readonly metrics = new Map<string, PerformanceMetrics>()

    startOperation(operationName: string): void {
        const startTime = Date.now()

        this.metrics.set(operationName, {
            operationName,
            startTime,
            endTime: 0,
            durationMs: 0,
        })
    }

    endOperation(
        operationName: string,
        itemsProcessed?: number,
        dataSizeBytes?: number,
    ): PerformanceMetrics {
        const existingMetric = this.metrics.get(operationName)
        const operationWasNotStarted = !existingMetric

        if (operationWasNotStarted) {
            throw new Error(`Operation ${operationName} was not started`)
        }

        const endTime = Date.now()
        const durationMs = endTime - existingMetric.startTime
        const throughputMBps = this.calculateThroughput(
            dataSizeBytes,
            durationMs,
        )
        const averageItemProcessingTime = this.calculateAverageProcessingTime(
            itemsProcessed,
            durationMs,
        )

        const completedMetric: PerformanceMetrics = {
            operationName,
            startTime: existingMetric.startTime,
            endTime,
            durationMs,
            throughputMBps,
            itemsProcessed,
            averageItemProcessingTime,
        }

        this.metrics.set(operationName, completedMetric)

        this.logger.log(`Performance metrics for ${operationName}`, {
            durationMs,
            throughputMBps,
            itemsProcessed,
            averageItemProcessingTime,
        })

        return completedMetric
    }

    comparePerformance(
        oldOperationName: string,
        newOperationName: string,
    ): BatchPerformanceComparison | null {
        const oldMetrics = this.metrics.get(oldOperationName)
        const newMetrics = this.metrics.get(newOperationName)

        const metricsAreMissing = !oldMetrics || !newMetrics

        if (metricsAreMissing) {
            return null
        }

        const performanceImprovement = this.calculatePerformanceImprovement(
            oldMetrics.durationMs,
            newMetrics.durationMs,
        )

        const throughputImprovement = this.calculateThroughputImprovement(
            oldMetrics.throughputMBps || 0,
            newMetrics.throughputMBps || 0,
        )

        const comparison: BatchPerformanceComparison = {
            oldSystemMetrics: oldMetrics,
            newSystemMetrics: newMetrics,
            performanceImprovement,
            throughputImprovement,
        }

        this.logger.log(
            `Performance comparison: ${oldOperationName} vs ${newOperationName}`,
            {
                performanceImprovement: `${performanceImprovement.toFixed(1)}x faster`,
                throughputImprovement: `${throughputImprovement.toFixed(1)}x higher throughput`,
                oldDuration: `${oldMetrics.durationMs}ms`,
                newDuration: `${newMetrics.durationMs}ms`,
            },
        )

        return comparison
    }

    getMetrics(operationName: string): PerformanceMetrics | null {
        return this.metrics.get(operationName) || null
    }

    clearMetrics(): void {
        this.metrics.clear()
    }

    private calculateThroughput(
        dataSizeBytes?: number,
        durationMs?: number,
    ): number | undefined {
        const dataIsAvailable = dataSizeBytes && durationMs && durationMs > 0

        if (!dataIsAvailable) {
            return undefined
        }

        const dataSizeMB = dataSizeBytes / (1024 * 1024)
        const durationSeconds = durationMs / 1000

        return dataSizeMB / durationSeconds
    }

    private calculateAverageProcessingTime(
        itemsProcessed?: number,
        durationMs?: number,
    ): number | undefined {
        const dataIsAvailable =
            itemsProcessed && durationMs && itemsProcessed > 0

        if (!dataIsAvailable) {
            return undefined
        }

        return durationMs / itemsProcessed
    }

    private calculatePerformanceImprovement(
        oldDurationMs: number,
        newDurationMs: number,
    ): number {
        const improvementRatio = oldDurationMs / newDurationMs
        return Math.round(improvementRatio * 10) / 10
    }

    private calculateThroughputImprovement(
        oldThroughput: number,
        newThroughput: number,
    ): number {
        const throughputIsZero = oldThroughput === 0

        if (throughputIsZero) {
            return 0
        }

        const improvementRatio = newThroughput / oldThroughput
        return Math.round(improvementRatio * 10) / 10
    }
}
