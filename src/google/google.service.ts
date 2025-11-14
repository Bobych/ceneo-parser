import { ExportData } from '@/interfaces/ExportDataInterface';
import { ConfigService } from '@nestjs/config';
import { google, sheets_v4 } from 'googleapis';
import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';
import { ENV } from '@/constants';
import { join } from 'path';

@Injectable()
export class GoogleService {
    private sheets: sheets_v4.Sheets;

    constructor(private readonly config: ConfigService) {
        const auth = new google.auth.GoogleAuth({
            keyFile: this.config.get<string>(ENV.GOOGLE_APPLICATION_CREDENTIALS),
            scopes: [
                this.config.get<string>(ENV.SHEETS_SCOPES),
                this.config.get<string>(ENV.DRIVE_SCOPES),
            ],
        });

        this.sheets = google.sheets({ version: 'v4', auth });
        this.ensurePublicDirectoryExists();
        this.ensureArchiveDirectoryExists();
    }

    private ensurePublicDirectoryExists(): void {
        const publicDir = join(__dirname, '..', '..', 'public');
        if (!existsSync(publicDir)) {
            mkdirSync(publicDir, { recursive: true });
        }
    }

    private ensureArchiveDirectoryExists(): void {
        const archiveDir = join(__dirname, '..', '..', 'public', 'archive');
        if (!existsSync(archiveDir)) {
            mkdirSync(archiveDir, { recursive: true });
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
            console.error(error);
        }
    }
}
