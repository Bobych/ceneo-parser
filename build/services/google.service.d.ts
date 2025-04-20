import { ConfigService } from '@nestjs/config';
import { ExportData } from '@interfaces';
import { RedisService } from './redis.service';
import { LoggerService } from './logger.service';
export declare class GoogleService {
    private readonly config;
    private readonly redis;
    private readonly logger;
    private sheets;
    private readonly filePath;
    constructor(config: ConfigService, redis: RedisService, logger: LoggerService);
    private ensurePublicDirectoryExists;
    private ensureArchiveDirectoryExists;
    private ensureActualExcelFileExists;
    setLastUid(uid: string): Promise<void>;
    getLastUid(): Promise<string | null>;
    increaseLastUid(): Promise<void>;
    getLastUidRow(): Promise<ExportData>;
    moveSheetToArchive(): Promise<void>;
    private sheetExists;
    createSheet(sheetName: string): Promise<void>;
    insertData(sheetName: string, data: any[][]): Promise<void>;
}
