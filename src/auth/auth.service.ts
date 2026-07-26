import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TYPE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TYPE,
} from './auth.constants';

const SALT_ROUNDS = 10;
const DEFAULT_ACCESS_EXPIRES_IN = '15m';
const DEFAULT_REFRESH_EXPIRES_IN = '7d';

// Mirrors the `${number}${'s'|'m'|'h'|'d'}` shape the token expiries are
// constrained to, so each cookie always expires alongside the token it carries.
function parseDurationMs(duration: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(duration);
  if (!match) return 24 * 60 * 60 * 1000;
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return Number(match[1]) * unitMs[match[2] as keyof typeof unitMs];
}

interface RefreshPayload {
  sub: string;
  type?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        role: Role.CUSTOMER,
      },
    });

    return this.buildAuthResponse(
      user.id,
      user.email,
      user.fullName,
      user.role,
    );
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.buildAuthResponse(
      user.id,
      user.email,
      user.fullName,
      user.role,
    );
  }

  // Exchanges a valid refresh token for a fresh access + refresh token pair.
  // Statelessly rotates both, so an active client keeps a sliding session while
  // the short-lived access token limits the blast radius of a leaked cookie.
  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    let payload: RefreshPayload;
    try {
      payload = this.jwt.verify<RefreshPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (payload.type !== REFRESH_TOKEN_TYPE) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Reload the user so the new access token reflects the current role/email
    // (and so a token for a since-deleted account is rejected).
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.buildAuthResponse(
      user.id,
      user.email,
      user.fullName,
      user.role,
    );
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
  }

  setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    const secure = this.config.get<string>('NODE_ENV') === 'production';
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: parseDurationMs(
        this.config.get<string>('JWT_EXPIRES_IN', DEFAULT_ACCESS_EXPIRES_IN),
      ),
      path: '/',
    });
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: parseDurationMs(
        this.config.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
          DEFAULT_REFRESH_EXPIRES_IN,
        ),
      ),
      path: '/',
    });
  }

  clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
  }

  private buildAuthResponse(
    id: string,
    email: string,
    fullName: string,
    role: Role,
  ) {
    const accessToken = this.jwt.sign({
      sub: id,
      email,
      role,
      type: ACCESS_TOKEN_TYPE,
    });
    const refreshToken = this.jwt.sign(
      { sub: id, type: REFRESH_TOKEN_TYPE },
      {
        expiresIn: this.config.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
          DEFAULT_REFRESH_EXPIRES_IN,
        ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );
    return {
      accessToken,
      refreshToken,
      user: { id, email, fullName, role },
    };
  }
}
