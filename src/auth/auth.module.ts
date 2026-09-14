/* eslint-disable prettier/prettier */
import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LogoutService } from './logout.service';
import { EmailService } from './email.service';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './constants';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './google.strategy';
import { AuthController } from './auth.controller';
import { ConfigModule } from '@nestjs/config';
import { ActivityModule } from '../managers/activity.module';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    PassportModule,
    ConfigModule,
    ActivityModule,
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: jwtConstants.expiresIn as any, algorithm: 'HS256' },
    }),
  ],
  providers: [AuthService, LogoutService, EmailService, JwtStrategy, GoogleStrategy],
  controllers: [AuthController],
  exports: [AuthService, LogoutService, EmailService],
})
export class AuthModule { }
