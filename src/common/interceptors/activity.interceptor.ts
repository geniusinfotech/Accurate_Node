/* eslint-disable prettier/prettier */
import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ActivityService } from '../../managers/activity.service';

@Injectable()
export class ActivityInterceptor implements NestInterceptor {
    constructor(private readonly activityService: ActivityService) { }

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (user && user._id) {
            await this.activityService.updateActivity(user._id).catch(() => {});
        }

        return next.handle();
    }
}
