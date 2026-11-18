import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { IOptionalAuthenticatedRequest } from './interfaces/authenticated-request.interface';

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest<Request>();
    const authorization: string | undefined = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) return true;

    const token: string = authorization.slice('Bearer '.length).trim();
    try {
      (request as IOptionalAuthenticatedRequest).user =
        await this.authService.validateToken(token);
    } catch {
      return true;
    }
    return true;
  }
}
