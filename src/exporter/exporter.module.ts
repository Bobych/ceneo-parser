import { Module } from '@nestjs/common';
import { ExporterService } from './exporter.service';
import { DatabaseService } from '@/database/database.service';
import { ExportController } from '@/exporter/exporter.controller';

@Module({
    providers: [ExporterService, DatabaseService],
    controllers: [ExportController],
    exports: [ExporterService],
})
export class ExporterModule {}
