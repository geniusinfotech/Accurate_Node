import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ManagersController } from './managers.controller';
import { ManagersService } from './managers.service';
import { ActivityModule } from './activity.module';
import { Manager, ManagerSchema } from './schema/manager.schema';
import { User, UserSchema } from '../users/schema/user.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Manager.name, schema: ManagerSchema },
      { name: User.name, schema: UserSchema },
    ]),
    ActivityModule,
  ],
  controllers: [ManagersController],
  providers: [ManagersService],
  exports: [ManagersService, ActivityModule],
})
export class ManagersModule {}
