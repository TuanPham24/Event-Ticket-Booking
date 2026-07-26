import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { REFRESH_TOKEN_COOKIE } from './auth.constants';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new customer account' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.register(dto);
    this.authService.setAuthCookies(res, accessToken, refreshToken);
    return { user };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive httpOnly session cookies' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.login(dto);
    this.authService.setAuthCookies(res, accessToken, refreshToken);
    return { user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange the refresh-token cookie for a fresh token pair',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Public: the access token has usually expired by the time this is called,
    // so auth here comes from verifying the refresh-token cookie itself.
    const cookies = req.cookies as Record<string, string> | undefined;
    const { accessToken, refreshToken, user } = await this.authService.refresh(
      cookies?.[REFRESH_TOKEN_COOKIE],
    );
    this.authService.setAuthCookies(res, accessToken, refreshToken);
    return { user };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear the session cookies' })
  logout(@Res({ passthrough: true }) res: Response) {
    // Public so logging out always succeeds and clears the cookies, even if the
    // token has already expired (an authenticated-only logout would 401 and
    // leave the client stuck).
    this.authService.clearAuthCookies(res);
    return { success: true };
  }

  @Get('me')
  @ApiOperation({ summary: 'Return the currently authenticated user' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    // Wrapped in { user } to match the register/login response shape the
    // frontend consumes (res.user).
    return { user: await this.authService.me(user.userId) };
  }
}
