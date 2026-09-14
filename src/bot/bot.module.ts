import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';
import { BotQa, BotQaSchema } from './schemas/bot-qa.schema';
import { BotQaController } from './bot-qa.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: BotQa.name, schema: BotQaSchema }]),
  ],
  controllers: [BotController, BotQaController],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
