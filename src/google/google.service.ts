import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, sheets_v4 } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';

import { ENV } from '@/constants';
import { ExportData } from '@/interfaces/ExportDataInterface';
import { RedisService } from '@/redis/redis.service';
import { LoggerService } from '@/logger/logger.service';

@Injectable()
export class GoogleService {
  private sheets: sheets_v4.Sheets;
  private readonly filePath: string;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly logger: LoggerService,
  ) {
    const auth = new google.auth.GoogleAuth({
      keyFile: this.config.get<string>(ENV.GOOGLE_APPLICATION_CREDENTIALS),
      scopes: [
        this.config.get<string>(ENV.SHEETS_SCOPES),
        this.config.get<string>(ENV.DRIVE_SCOPES),
      ],
    });

    this.sheets = google.sheets({ version: 'v4', auth });
    this.filePath = path.join(__dirname, '..', '..', 'public', 'actual.xlsx');
    this.ensurePublicDirectoryExists();
    this.ensureArchiveDirectoryExists();
  }

  private ensurePublicDirectoryExists(): void {
    const publicDir = path.join(__dirname, '..', '..', 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
  }

  private ensureArchiveDirectoryExists(): void {
    const archiveDir = path.join(__dirname, '..', '..', 'public', 'archive');
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }
  }

  private async ensureActualExcelFileExists(): Promise<void> {
    if (!fs.existsSync(this.filePath)) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.writeFile(this.filePath);

      await this.logger.set({
        service: 'google',
        message: 'Создан актуальный Excel файл: actual.xlsx',
      });
    }
  }

  async setLastUid(uid: string): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.config.get<string>(ENV.EXPORT_SPREADSHEET_ID),
        range: 'Control!A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[uid]],
        },
      });
    } catch (error) {
      console.error('Ошибка при обновлении значения в Google Sheets:', error);
      throw error;
    }
  }

  async getLastUid(): Promise<string | null> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.get<string>(ENV.EXPORT_SPREADSHEET_ID),
        range: 'Control!A1',
      });

      const value = response.data.values?.[0]?.[0];
      return value || null;
    } catch (error) {
      console.error('Ошибка при получении значения из Google Sheets:', error);
      throw error;
    }
  }

  async increaseLastUid(): Promise<void> {
    try {
      const uid = await this.getLastUid();
      const newUid = String(Number(uid) + 1);
      await this.setLastUid(newUid);
    } catch (error) {
      console.error('Ошибка при увеличении значения в Google Sheets:', error);
      throw error;
    }
  }

  async getLastUidRow(): Promise<ExportData> {
    try {
      await this.moveSheetToArchive();
      let uid = await this.getLastUid();

      if (!uid) {
        uid = '1';
        await this.setLastUid('1');
      }

      const range = `${this.config.get<string>(ENV.EXPORT_SHEET_ID)}!A${uid}:Z${uid}`;

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.get<string>(ENV.EXPORT_SPREADSHEET_ID),
        range: range,
      });

      const { values } = response.data;

      if (!values) {
        await this.setLastUid('1');
        await this.getLastUidRow();
        return;
      }

      return values.map(([uid, name, url]) => ({
        uid,
        name,
        url,
      }))[0];
    } catch (error) {
      await this.logger.set({
        service: 'google',
        message: error,
      });
    }
  }

  async moveSheetToArchive() {
    try {
      await this.ensureActualExcelFileExists();
      const now = new Date();
      const timestamp = now
        .toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .split('Z')[0];
      const archiveTableName = `export-data-${timestamp}.xlsx`;

      const srcPath = this.filePath;
      const archiveDir = path.join(__dirname, '..', '..', 'public', 'archive');
      const dstPath = path.join(archiveDir, archiveTableName);

      fs.copyFileSync(srcPath, dstPath);

      const files = fs.readdirSync(archiveDir);

      if (files.length > 10) {
        const sortedFiles = files
          .map((file) => ({
            name: file,
            time: fs.statSync(path.join(archiveDir, file)).mtime.getTime(),
          }))
          .sort((a, b) => a.time - b.time);

        while (sortedFiles.length > 10) {
          const fileToDelete = sortedFiles.shift();
          fs.unlinkSync(path.join(archiveDir, fileToDelete.name));
          await this.logger.set({
            service: 'google',
            message: `Удалён старый архивный Excel файл: ${fileToDelete.name}`,
          });
        }
      }

      await this.logger.set({
        service: 'google',
        message: `Новый архивный Excel файл: ${archiveTableName}`,
      });
    } catch (error) {
      await this.logger.set({
        service: 'google',
        message: error,
      });
    }
  }

  private async sheetExists(sheetName: string): Promise<boolean> {
    await this.ensureActualExcelFileExists();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(this.filePath);
    return workbook.worksheets.some(
      (ws: { name: string }) => ws.name === sheetName,
    );
  }

  async createSheet(sheetName: string) {
    const workbook = new ExcelJS.Workbook();

    try {
      await this.ensureActualExcelFileExists();
      await workbook.xlsx.readFile(this.filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    workbook.addWorksheet(sheetName);
    await workbook.xlsx.writeFile(this.filePath);

    await this.logger.set({
      service: 'google',
      message: `Создан новый лист: ${sheetName}.`,
    });
  }

  async insertData(sheetName: string, data: any[][]): Promise<void> {
    try {
      sheetName = sheetName.substring(0, 31);
      if (!(await this.sheetExists(sheetName))) {
        await this.createSheet(sheetName);
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(this.filePath);

      let worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) {
        worksheet = workbook.addWorksheet(sheetName);
      }

      if (data.length === 1 && data[0].length === 0) {
        workbook.removeWorksheet(sheetName);
        workbook.addWorksheet(sheetName);
        await workbook.xlsx.writeFile(this.filePath);
        return;
      }

      const idIndex = 0;
      const existingRows = worksheet.getRows(1, worksheet.rowCount) || [];

      data.forEach((newRow) => {
        const newId = newRow[idIndex];
        const existingRow = existingRows.find(
          (row) => row.getCell(idIndex + 1).value === newId,
        );

        if (existingRow) {
          newRow.forEach((value, colIndex) => {
            existingRow.getCell(colIndex + 1).value = value;
          });
        } else {
          worksheet.addRow(newRow);
        }
      });

      await workbook.xlsx.writeFile(this.filePath);
    } catch (error) {
      await this.logger.set({
        service: 'google',
        message: error,
      });
    }
  }
}
