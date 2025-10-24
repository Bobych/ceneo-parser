import { Controller, Post, UseGuards } from '@nestjs/common';
import { ParserService } from '@/parser/parser.service';
import { ApiTokenGuard } from '@/api/api.guard';

@Controller('api')
export class ApiController {
    constructor(private readonly parser: ParserService) {}

    @Post('restart')
    @UseGuards(ApiTokenGuard)
    async restart() {
        try {
            return { message: 'Process restarted successfully.' };
        } catch (error) {
            return { message: 'Failed to restart process.', error: error.message };
        }
    }
}
