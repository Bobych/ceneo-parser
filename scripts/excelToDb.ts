import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BATCH_SIZE = 100;

function toNumberOrNull(v: any): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function toStringOrEmpty(v: any): string {
    if (v === null || v === undefined) return '';
    return String(v);
}

function toBooleanFromFlagCell(v: any): boolean {
    const n = toNumberOrNull(v);
    if (n !== null) return n === 1;
    if (typeof v === 'string') {
        const vv = v.trim().toLowerCase();
        return vv === '1' || vv === 'true' || vv === 'yes';
    }
    return false;
}

async function importExcel(filePath: string) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    console.log(`Opened workbook: ${filePath}`);
    const sheetNames = workbook.worksheets.map(ws => ws.name);
    console.log('Found sheets:', sheetNames);

    for (const sheetName of sheetNames) {
        const worksheet = workbook.getWorksheet(sheetName);
        console.log(`\nProcessing sheet "${sheetName}" (rows: ${worksheet.rowCount})`);

        const records: any[] = [];

        worksheet.eachRow(row => {
            const externalId = toNumberOrNull(row.getCell(1).value);
            if (externalId === null) return; // пропускаем, как при экспорте

            const name = toStringOrEmpty(row.getCell(2).value);
            const price = toNumberOrNull(row.getCell(3).value);
            const flag = toBooleanFromFlagCell(row.getCell(4).value);
            const url = toStringOrEmpty(row.getCell(5).value);

            records.push({
                externalId,
                name,
                price,
                flag,
                url,
                sheetName,
            });
        });

        console.log(`Collected ${records.length} records for "${sheetName}"`);

        if (records.length > 0) {
            let inserted = 0;
            for (let i = 0; i < records.length; i += BATCH_SIZE) {
                const batch = records.slice(i, i + BATCH_SIZE);
                try {
                    await prisma.product.createMany({
                        data: batch,
                    });
                    inserted += batch.length;
                    process.stdout.write(`Inserted ${inserted}/${records.length}\r`);
                } catch (err: any) {
                    console.error(`Error inserting batch at ${i}: ${err.message}`);
                }
            }
            console.log(`\nSheet "${sheetName}" done: ${inserted} records processed.`);
        } else {
            const placeholderExists = await prisma.product.findFirst({
                where: { sheetName, externalId: null },
            });
            if (!placeholderExists) {
                await prisma.product.create({
                    data: {
                        externalId: null,
                        name: '',
                        price: null,
                        flag: false,
                        url: '',
                        sheetName,
                    },
                });
                console.log(`Created placeholder for empty sheet "${sheetName}".`);
            } else {
                console.log(`Placeholder for sheet "${sheetName}" already exists.`);
            }
        }
    }
}

async function main() {
    const argv = process.argv.slice(2);
    if (argv.length < 1) {
        console.error('Usage: ts-node scripts/excelToDb.ts <path-to-file.xlsx>');
        process.exit(2);
    }

    const filePath = path.resolve(argv[0]);
    try {
        await importExcel(filePath);
        console.log('\n✅ Import finished.');
    } catch (err: any) {
        console.error('❌ Import failed:', err.message || err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
