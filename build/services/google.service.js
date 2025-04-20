"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const googleapis_1 = require("googleapis");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const exceljs_1 = __importDefault(require("exceljs"));
const redis_service_1 = require("./redis.service");
const logger_service_1 = require("./logger.service");
let GoogleService = class GoogleService {
    constructor(config, redis, logger) {
        this.config = config;
        this.redis = redis;
        this.logger = logger;
        const auth = new googleapis_1.google.auth.GoogleAuth({
            keyFile: this.config.get("GOOGLE_APPLICATION_CREDENTIALS"),
            scopes: [
                this.config.get("SHEETS_SCOPES"),
                this.config.get("DRIVE_SCOPES"),
            ],
        });
        this.sheets = googleapis_1.google.sheets({ version: 'v4', auth });
        this.filePath = path.join(__dirname, '..', '..', 'public', 'actual.xlsx');
        this.ensurePublicDirectoryExists();
        this.ensureArchiveDirectoryExists();
    }
    ensurePublicDirectoryExists() {
        const publicDir = path.join(__dirname, '..', '..', 'public');
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
        }
    }
    ensureArchiveDirectoryExists() {
        const archiveDir = path.join(__dirname, '..', '..', 'public', 'archive');
        if (!fs.existsSync(archiveDir)) {
            fs.mkdirSync(archiveDir, { recursive: true });
        }
    }
    async ensureActualExcelFileExists() {
        if (!fs.existsSync(this.filePath)) {
            const workbook = new exceljs_1.default.Workbook();
            await workbook.xlsx.writeFile(this.filePath);
            await this.logger.set({
                service: 'google',
                message: 'Создан актуальный Excel файл: actual.xlsx',
            });
        }
    }
    async setLastUid(uid) {
        try {
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.config.get("EXPORT_SPREADSHEET_ID"),
                range: 'Control!A1',
                valueInputOption: 'RAW',
                requestBody: {
                    values: [[uid]],
                },
            });
        }
        catch (error) {
            console.error('Ошибка при обновлении значения в Google Sheets:', error);
            throw error;
        }
    }
    async getLastUid() {
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.config.get("EXPORT_SPREADSHEET_ID"),
                range: 'Control!A1',
            });
            const value = response.data.values?.[0]?.[0];
            return value || null;
        }
        catch (error) {
            console.error('Ошибка при получении значения из Google Sheets:', error);
            throw error;
        }
    }
    async increaseLastUid() {
        try {
            const uid = await this.getLastUid();
            const newUid = String(Number(uid) + 1);
            await this.setLastUid(newUid);
        }
        catch (error) {
            console.error('Ошибка при увеличении значения в Google Sheets:', error);
            throw error;
        }
    }
    async getLastUidRow() {
        try {
            await this.moveSheetToArchive();
            let uid = await this.getLastUid();
            if (!uid) {
                uid = '1';
                await this.setLastUid('1');
            }
            const range = `${this.config.get("EXPORT_SHEET_ID")}!A${uid}:Z${uid}`;
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.config.get("EXPORT_SPREADSHEET_ID"),
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
        }
        catch (error) {
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
        }
        catch (error) {
            await this.logger.set({
                service: 'google',
                message: error,
            });
        }
    }
    async sheetExists(sheetName) {
        await this.ensureActualExcelFileExists();
        const workbook = new exceljs_1.default.Workbook();
        await workbook.xlsx.readFile(this.filePath);
        return workbook.worksheets.some((ws) => ws.name === sheetName);
    }
    async createSheet(sheetName) {
        const workbook = new exceljs_1.default.Workbook();
        try {
            await this.ensureActualExcelFileExists();
            await workbook.xlsx.readFile(this.filePath);
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
        }
        workbook.addWorksheet(sheetName);
        await workbook.xlsx.writeFile(this.filePath);
        await this.logger.set({
            service: 'google',
            message: `Создан новый лист: ${sheetName}.`,
        });
    }
    async insertData(sheetName, data) {
        try {
            sheetName = sheetName.substring(0, 31);
            if (!(await this.sheetExists(sheetName))) {
                await this.createSheet(sheetName);
            }
            const workbook = new exceljs_1.default.Workbook();
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
                const existingRow = existingRows.find((row) => row.getCell(idIndex + 1).value === newId);
                if (existingRow) {
                    newRow.forEach((value, colIndex) => {
                        existingRow.getCell(colIndex + 1).value = value;
                    });
                }
                else {
                    worksheet.addRow(newRow);
                }
            });
            await workbook.xlsx.writeFile(this.filePath);
        }
        catch (error) {
            await this.logger.set({
                service: 'google',
                message: error,
            });
        }
    }
};
exports.GoogleService = GoogleService;
exports.GoogleService = GoogleService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        redis_service_1.RedisService,
        logger_service_1.LoggerService])
], GoogleService);
//# sourceMappingURL=google.service.js.map