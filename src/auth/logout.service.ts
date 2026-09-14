import { Injectable } from '@nestjs/common';
import type { UserResponse } from '../users/schema/user.schema';
import { CustomLogger } from '../common/logger/logger.service';
import { ActivityService } from '../managers/activity.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class LogoutService {
  constructor(
    private readonly logger: CustomLogger,
    private readonly activityService: ActivityService,
    private readonly usersService: UsersService,
  ) {}

  async logout(
    user: UserResponse,
  ): Promise<{ message: string; username: string; timestamp: Date }> {
    this.logger.log(`User logged out`, 'LogoutService');

    await this.usersService.updateRefreshToken(user._id, null);
    await this.activityService.handleLogout(user._id);

    return {
      message: 'Successfully logged out',
      username: user.username || 'Unknown',
      timestamp: new Date(),
    };
  }

  async logoutWithRole(
    user: UserResponse,
    role: string,
  ): Promise<{
    message: string;
    username: string;
    role: string;
    timestamp: Date;
  }> {
    this.logger.log(`${role} user logged out`, 'LogoutService');

    await this.usersService.updateRefreshToken(user._id, null);
    await this.activityService.handleLogout(user._id);

    return {
      message: `Successfully logged out ${role}`,
      username: user.username || 'Unknown',
      role,
      timestamp: new Date(),
    };
  }

  // Future enhancement: Token blacklisting
  async blacklistToken(token: string): Promise<void> {
    // In a real application, you would store this token in a blacklist
    // This could be Redis, database, or in-memory cache
    this.logger.logSecurityEvent(
      'TOKEN_BLACKLISTED',
      { tokenPrefix: token.substring(0, 10) },
      'LogoutService',
    );
  }

  // Future enhancement: Session cleanup
  async cleanupSession(userId: string): Promise<void> {
    // In a real application, you would clean up user sessions
    // Remove from active sessions, clear cache, etc.
    this.logger.log('Session cleaned up', 'LogoutService');
  }
}
