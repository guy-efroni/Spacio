import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { Repository } from 'typeorm';
import type { IAuthResponse, IUserProfile } from '@spacio/shared-types';
import { UserEntity } from './entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { IJwtPayload } from './interfaces/authenticated-request.interface';

const SALT_ROUNDS: number = 10;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
    private readonly jwtService: JwtService,
  ) {}

  public async register(dto: RegisterDto): Promise<IAuthResponse> {
    const email: string = this._normalizeEmail(dto.email);
    const existing: UserEntity | null = await this.repository.findOne({
      where: { email },
    });
    if (existing) throw new ConflictException('Email is already registered');

    const user: UserEntity = this.repository.create({
      email,
      displayName: dto.displayName.trim(),
      passwordHash: await hash(dto.password, SALT_ROUNDS),
    });
    return this._buildResponse(await this.repository.save(user));
  }

  public async login(dto: LoginDto): Promise<IAuthResponse> {
    const user: UserEntity | null = await this.repository.findOne({
      where: { email: this._normalizeEmail(dto.email) },
    });
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

    const user: UserEntity | null = await this.repository.findOne({
      where: { id: payload.sub },
    });
    if (!user) throw new UnauthorizedException('User no longer exists');
    return this._toProfile(user);
  }

  private _buildResponse(user: UserEntity): IAuthResponse {
    const profile: IUserProfile = this._toProfile(user);
    const payload: IJwtPayload = { sub: user.id, email: user.email };
    return {
      accessToken: this.jwtService.sign(payload),
      user: profile,
    };
  }

  private _toProfile(user: UserEntity): IUserProfile {
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
