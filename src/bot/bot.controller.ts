import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BotService } from './bot.service';
import { BotChatDto } from './dto/bot-qa.dto';

@Controller('bot')
export class BotController {
  constructor(private readonly botService: BotService) {}

  // Public, and every message queries the database, so keep it modest.
  @Post('chat')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async chat(@Body() body: BotChatDto) {
    return { response: await this.botService.getResponse(body.message) };
  }
}
