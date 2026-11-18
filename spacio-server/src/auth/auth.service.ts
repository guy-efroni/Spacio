import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import type { IAuthResponse, IUserProfile } from '@spacio/shared-types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { IJwtPayload } from './interfaces/authenticated-request.interface';

const SALT_ROUNDS: number = 10;

interface IStoredUser {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
}

@Injectable()
export class AuthService {
  private readonly _users: Map<string, IStoredUser> = new Map<
    string,
    IStoredUser
  >();

  constructor(private readonly jwtService: JwtService) {}

  public async register(dto: RegisterDto): Promise<IAuthResponse> {
    const email: string = this._normalizeEmail(dto.email);
    for (const user of this._users.values()) {
      if (user.email === email)
        throw new ConflictException('Email is already registered');
    }

    const user: IStoredUser = {
      id: randomUUID(),
      email,
      displayName: dto.displayName.trim(),
      passwordHash: await hash(dto.password, SALT_ROUNDS),
    };
    this._users.set(user.id, user);
    return this._buildResponse(user);
  }

  public async login(dto: LoginDto): Promise<IAuthResponse> {
    const email: string = this._normalizeEmail(dto.email);
    const user: IStoredUser | undefined = [...this._users.values()].find(
      (item: IStoredUser): boolean => item.email === email,
    );
    if (!user || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this._buildResponse(user);
  }

  public async validateToken(token: string): Promise<IUserProfile> {
    let payload: IJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<IJwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user: IStoredUser | undefined = this._users.get(payload.sub);
    if (!user) throw new UnauthorizedException('User no longer exists');
    return this._toProfile(user);
  }

  private _buildResponse(user: IStoredUser): IAuthResponse {
    const profile: IUserProfile = this._toProfile(user);
    const payload: IJwtPayload = { sub: user.id, email: user.email };
    return {
      accessToken: this.jwtService.sign(payload),
      user: profile,
    };
  }

  private _toProfile(user: IStoredUser): IUserProfile {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    };
  }

  private _normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
