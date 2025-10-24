import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class ExporterService {
    private readonly logger = new Logger(ExporterService.name);
    private readonly CHUNK_SIZE = 50000;

    constructor(private readonly db: DatabaseService) {}

    private log(message: string) {
        console.log(`[EXPORTER] ${message}`);
    }

    async exportToExcel(outputDir: string = './exports'): Promise<string> {
        try {
            const sheetNames = await this.getUniqueSheetNames();

            const workbook = new ExcelJS.Workbook();

            for (const sheetName of sheetNames) {
                this.log(`Processing sheet: ${sheetName}`);
                await this.addSheetToWorkbook(workbook, sheetName);
            }

            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const fileName = `products_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
            const filePath = path.join(outputDir, fileName);

            await workbook.xlsx.writeFile(filePath);

            await this.cleanupOldFiles(outputDir);

            return filePath;
        } catch (error) {
            this.log(`[EXPORTER] Failed ${error}`);
            throw error;
        }
    }

    private async cleanupOldFiles(outputDir: string): Promise<void> {
        try {
            const files = await fs.promises.readdir(outputDir);

            const excelFiles = files
                .filter(file => file.endsWith('.xlsx') && file.startsWith('products_'))
                .map(file => {
                    const filePath = path.join(outputDir, file);
                    const stats = fs.statSync(filePath);
                    return {
                        name: file,
                        path: filePath,
                        mtime: stats.mtime.getTime(),
                    };
                })
                .sort((a, b) => b.mtime - a.mtime);

            if (excelFiles.length > 24) {
                const filesToDelete = excelFiles.slice(24);

                for (const file of filesToDelete) {
                    try {
                        await fs.promises.unlink(file.path);
                        this.log(`[EXPORTER] Deleted old file: ${file.name}`);
                    } catch (deleteError) {
                        this.log(`[EXPORTER] Failed to delete ${file.name}: ${deleteError}`);
                    }
                }

                this.log(`[EXPORTER] Cleanup completed: deleted ${filesToDelete.length} old files`);
            }
        } catch (error) {
            this.log(`[EXPORTER] Cleanup error: ${error}`);
        }
    }

    private async getUniqueSheetNames(): Promise<string[]> {
        const products = await this.db.product.findMany({
            select: { sheetName: true },
            distinct: ['sheetName'],
        });
        return products.map(p => p.sheetName).sort((a, b) => a.localeCompare(b));
    }

    private async getOrCreateWorksheet(workbook: ExcelJS.Workbook, sheetName: string) {
        const sanitizedName = this.sanitizeSheetName(sheetName);
        const existingWorksheet = workbook.getWorksheet(sanitizedName);

        if (existingWorksheet) {
            return existingWorksheet;
        }

        return workbook.addWorksheet(sanitizedName);
    }

    private async addSheetToWorkbook(workbook: ExcelJS.Workbook, sheetName: string) {
        let skipCount = 0;
        let processedCount = 0;
        const worksheet = await this.getOrCreateWorksheet(workbook, sheetName);

        let skip = 0;
        while (true) {
            const products = await this.db.product.findMany({
                where: { sheetName },
                orderBy: { price: 'desc' },
                skip,
                take: this.CHUNK_SIZE,
            });

            if (products.length === 0) break;

            for (const product of products) {
                if (!product.externalId) continue;
                try {
                    worksheet.addRow([
                        product.externalId,
                        product.name,
                        product.price,
                        product.flag ? 1 : 0,
                        product.url,
                    ]);
                    processedCount += 1;
                } catch (error) {
                    skipCount++;
                    this.log(`Skipped product ${product.id}: ${error.message}`);
                }
            }

            skip += this.CHUNK_SIZE;
            this.logger.log(
                `Processed ${processedCount} records (${skipCount} skipped) for sheet ${sheetName}`,
            );
        }

        return { processedCount, skipCount };
    }

    private sanitizeSheetName(name: string): string {
        return name.substring(0, 31).replace(/[\\/?*[\]]/g, '');
    }
}
