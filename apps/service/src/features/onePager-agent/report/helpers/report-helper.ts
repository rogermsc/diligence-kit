import { Report, ReportStatus } from '@/shared/domain/entities';

export class ReportHelper {
    static isCompleted(report: Report): boolean {
        return report.getStatus() === ReportStatus.COMPLETED;
    }


    static filterCompleted(reports: Report[]): Report[] {
        return reports.filter(report => this.isCompleted(report));
    }


    static countCompleted(reports: Report[]): number {
        return this.filterCompleted(reports).length;
    }


    static areAllCompleted(reports: Report[]): boolean {
        return reports.length > 0 && reports.every(report => this.isCompleted(report));
    }
}