/* eslint-disable prettier/prettier */
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  UnauthorizedException,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LogoutService } from './logout.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Roles } from './roles.decorator';
import { Role } from './roles.enum';
import { RolesGuard } from './roles.guard';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleAuthGuard } from './google-auth.guard';


import type { UserResponse, UserDocument } from '../users/schema/user.schema';
import type {
  CookieOptions,
  Request as ExpressRequest,
  Response,
} from 'express';

import { RefreshTokenDto } from './dto/refresh-token.dto';

// Stricter than the global limit: these are the brute-force / email-bomb targets.
const AUTH_THROTTLE = {
  default: { limit: Number(process.env.AUTH_THROTTLE_LIMIT) || 10, ttl: 60000 },
};

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private logoutService: LogoutService,
  ) { }

  private getBaseCookieOptions(): CookieOptions {
    const domain = process.env.COOKIE_DOMAIN || undefined;
    // Cross-site cookies (frontend and API on different hostnames) need
    // SameSite=None, which browsers only accept together with Secure/HTTPS.
    // Same-origin deployments behind one nginx should use the Lax default.
    const crossSite = process.env.COOKIE_CROSS_SITE === 'true';
    const secure = crossSite || process.env.COOKIE_SECURE !== 'false';
    return {
      httpOnly: true,
      secure,
      sameSite: (crossSite ? 'none' : 'lax'),
      path: '/',
      ...(domain ? { domain } : {}),
    };
  }

  private setAuthCookie(res: Response, token: string, req?: ExpressRequest) {
    res.cookie('glitera_access_token', token, {
      ...this.getBaseCookieOptions(),
      maxAge: 60 * 60 * 1000,
    });
  }

  private setRefreshCookie(res: Response, token: string, req?: ExpressRequest) {
    res.cookie('glitera_refresh_token', token, {
      ...this.getBaseCookieOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearAuthCookie(res: Response, req?: ExpressRequest) {
    const cookieOptions = this.getBaseCookieOptions();
    res.clearCookie('glitera_access_token', cookieOptions);
    res.clearCookie('glitera_refresh_token', cookieOptions);
  }

  private getCookieValue(req: ExpressRequest, name: string): string | undefined {
    const cookies = (req as any)?.cookies as Record<string, string> | undefined;
    if (cookies && cookies[name]) return cookies[name];
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return undefined;
    for (const cookie of cookieHeader.split(';')) {
      const separatorIndex = cookie.indexOf('=');
      if (separatorIndex === -1) continue;
      const key = cookie.slice(0, separatorIndex).trim();
      if (key !== name) continue;
      const raw = cookie.slice(separatorIndex + 1).trim();
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
    return undefined;
  }

  @Post('register')
  @Throttle(AUTH_THROTTLE)
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  @Throttle(AUTH_THROTTLE)
  async login(@Body() loginDto: LoginDto, @Request() req: ExpressRequest, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const result = await this.authService.login(user);
    this.setAuthCookie(res, result.access_token, req);
    this.setRefreshCookie(res, result.refresh_token, req);
    return result;
  }

  @Post('refresh')
  async refresh(
    @Request() req: ExpressRequest,
    @Body() body: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      this.getCookieValue(req, 'glitera_refresh_token') ||
      body?.refresh_token ||
      (req.headers['x-refresh-token'] as string);
    if (!refreshToken) throw new UnauthorizedException('Refresh token is required');
    const result = await this.authService.refreshAccessToken(refreshToken);
    this.setAuthCookie(res, result.access_token, req);
    this.setRefreshCookie(res, result.refresh_token, req);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Request() req: Request & { user: UserResponse }): UserResponse {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @Request() req: Request & { user: UserResponse },
    @Res({ passthrough: true }) res: Response,
  ) {
    this.clearAuthCookie(res, req as any);
    return await this.logoutService.logout(req.user);
  }

  // Admin logout
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/logout')
  async adminLogout(
    @Request() req: Request & { user: UserResponse },
    @Res({ passthrough: true }) res: Response,
  ) {
    this.clearAuthCookie(res, req as any);
    return await this.logoutService.logoutWithRole(req.user, 'Admin');
  }

  // Manager logout
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER)
  @Post('manager/logout')
  async managerLogout(
    @Request() req: Request & { user: UserResponse },
    @Res({ passthrough: true }) res: Response,
  ) {
    this.clearAuthCookie(res, req as any);
    return await this.logoutService.logoutWithRole(req.user, 'Manager');
  }

  // only ADMIN can access
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin-only')
  adminOnly(@Request() req: Request & { user: UserResponse }): {
    msg: string;
    user: UserResponse;
  } {
    return { msg: 'Hello Admin', user: req.user };
  }

  // Change password
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(
    @Request() req: Request & { user: UserResponse },
    @Body() changePasswordDto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.changePassword(
      req.user._id,
      changePasswordDto.oldPassword,
      changePasswordDto.newPassword,
    );
    // Force re-login: drop auth cookies so the browser session ends immediately.
    this.clearAuthCookie(res, req as any);
    return result;
  }

  // Forgot password
  @Post('forgot-password')
  @Throttle(AUTH_THROTTLE)

  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  // Reset password
  @Post('reset-password')
  @Throttle(AUTH_THROTTLE)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }

  // Google OAuth login
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Guard redirects to Google
  }

  // Google OAuth callback
  @Get('google/callback') // auth/google/callback
  @UseGuards(GoogleAuthGuard)
  async googleAuthRedirect(
    @Request() req: Request & { user: UserDocument },
    @Res() res: Response,
  ) {
    const result = await this.authService.googleLogin(req.user);
    this.setAuthCookie(res, result.access_token, req as any);
    this.setRefreshCookie(res, result.refresh_token, req as any);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:9008';
    // Validate FRONTEND_URL to prevent open redirect via env poisoning
    let redirectUrl: string;
    try {
      const parsed = new URL(`${frontendUrl}/auth/google/callback`);
      const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
      const allowed = [frontendUrl, ...allowedOrigins];
      const isAllowed = allowed.some(o => {
        try { return new URL(o).origin === parsed.origin; } catch { return false; }
      });
      if (!isAllowed && process.env.NODE_ENV === 'production') {
        throw new Error('FRONTEND_URL not in allowlist');
      }
      redirectUrl = parsed.toString();
    } catch {
      redirectUrl = 'http://localhost:9008/auth/google/callback';
    }
    res.redirect(redirectUrl);
  }

}
