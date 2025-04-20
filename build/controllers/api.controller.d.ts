import { ParserService } from '@services/parser.service';
export declare class ApiController {
    private readonly parser;
    constructor(parser: ParserService);
    restart(): Promise<{
        message: string;
        error?: undefined;
    } | {
        message: string;
        error: any;
    }>;
}
