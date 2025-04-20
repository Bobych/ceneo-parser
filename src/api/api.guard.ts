import { ENV } from '@constants';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    const validToken = this.configService.get<string>(ENV.API_TOKEN);

    if (!token || token !== validToken) {
      throw new UnauthorizedException('Invalid or missing token');
    }

    return true;
  }
}
