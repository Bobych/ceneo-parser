import { NestFactory } from '@nestjs/core';
import { BoardService } from '@/queue/board.service';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    app.setBaseViewsDir(join(__dirname, '..', '/views'));
    app.setViewEngine('ejs');

    const boardService = app.get(BoardService);
    boardService.setupBoard(app);

    await app.listen(3333, '0.0.0.0');
}
bootstrap();
