import { Controller, Get, Header, StreamableFile } from '@nestjs/common';
import { ExporterService } from '@/exporter/exporter.service';
import { createReadStream, existsSync } from 'node:fs';

@Controller('export')
export class ExportController {
  constructor(private readonly exporter: ExporterService) {}

  @Get()
  @Header('Content-Disposition', 'attachment; filename="products_export.xlsx"')
  async exportToExcel() {
    const filePath = await this.exporter.exportToExcel();
    if (!existsSync(filePath)) {
      throw new Error(`File does not exist at path: ${filePath}`);
    }
    const stream = createReadStream(filePath);
    return new StreamableFile(stream);
  }
}
