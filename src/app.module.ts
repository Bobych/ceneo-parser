import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { NODE } from '@/constants';
import { GoogleModule } from '@/google/google.module';
import { ParserModule } from '@/parser/parser.module';
import { AppController } from '@/app.controller';
import { ApiController } from '@/api/api.controller';
import { ExporterModule } from '@/exporter/exporter.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath:
                process.env.NODE_ENV == NODE.PRODUCTION
                    ? `./.env.${NODE.PRODUCTION}`
                    : `./.env.${NODE.DEVELOPMENT}`,
        }),
        GoogleModule,
        ParserModule,
        ExporterModule,
    ],
    controllers: [AppController, ApiController],
})
export class AppModule {}
