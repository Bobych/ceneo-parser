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
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
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
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleService = void 0;
const common_1 = require("@nestjs/common");
const googleapis_1 = require("googleapis");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const exceljs_1 = __importDefault(require("exceljs"));
let GoogleService = (() => {
    let _classDecorators = [(0, common_1.Injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var GoogleService = _classThis = class {
        constructor(config, redis, logger) {
            this.config = config;
            this.redis = redis;
            this.logger = logger;
            const auth = new googleapis_1.google.auth.GoogleAuth({
                keyFile: this.config.get("GOOGLE_APPLICATION_CREDENTIALS" /* ENV.GOOGLE_APPLICATION_CREDENTIALS */),
                scopes: [
                    this.config.get("SHEETS_SCOPES" /* ENV.SHEETS_SCOPES */),
                    this.config.get("DRIVE_SCOPES" /* ENV.DRIVE_SCOPES */),
                ],
            });
            this.sheets = googleapis_1.google.sheets({ version: 'v4', auth });
            this.filePath = path.join(__dirname, '..', '..', 'public', 'actual.xlsx');
        }
        async setLastUid(uid) {
            try {
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.config.get("EXPORT_SPREADSHEET_ID" /* ENV.EXPORT_SPREADSHEET_ID */),
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
                    spreadsheetId: this.config.get("EXPORT_SPREADSHEET_ID" /* ENV.EXPORT_SPREADSHEET_ID */),
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
                const range = `${this.config.get("EXPORT_SHEET_ID" /* ENV.EXPORT_SHEET_ID */)}!A${uid}:Z${uid}`;
                const response = await this.sheets.spreadsheets.values.get({
                    spreadsheetId: this.config.get("EXPORT_SPREADSHEET_ID" /* ENV.EXPORT_SPREADSHEET_ID */),
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
                            message: `Deleted old archive file: ${fileToDelete.name}`,
                        });
                    }
                }
                await this.logger.set({
                    service: 'google',
                    message: `New archive table: ${archiveTableName}`,
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
            const workbook = new exceljs_1.default.Workbook();
            await workbook.xlsx.readFile(this.filePath);
            return workbook.worksheets.some((ws) => ws.name === sheetName);
        }
        async createSheet(sheetName) {
            const workbook = new exceljs_1.default.Workbook();
            try {
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
                message: `Creating a new list: ${sheetName}.`,
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
    __setFunctionName(_classThis, "GoogleService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        GoogleService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return GoogleService = _classThis;
})();
exports.GoogleService = GoogleService;
