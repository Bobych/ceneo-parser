import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { NODE } from '@constants';
import { GoogleModule } from '@modules/google.module';
import { ParserModule } from '@modules/parser.module';
import { AppController } from '@controllers/app.controller';
import { ApiController } from '@controllers/api.controller';

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
  ],
  controllers: [AppController, ApiController],
})
export class AppModule {}
