import type { Request } from 'express';
import type { IUserProfile } from '@spacio/shared-types';

export interface IJwtPayload {
  sub: string;
  email: string;
}

export interface IAuthenticatedRequest extends Request {
  user: IUserProfile;
}

export interface IOptionalAuthenticatedRequest extends Request {
  user?: IUserProfile;
}
