import { Controller, Post, Body } from '@nestjs/common';
import { BotService } from './bot.service';

@Controller('bot')
export class BotController {
  constructor(private readonly botService: BotService) {}

  @Post('chat')
  chat(@Body('message') message: string) {
    return { response: this.botService.getResponse(message) };
  }
}
