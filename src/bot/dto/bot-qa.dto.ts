import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class CreateBotQaDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsString()
  @IsNotEmpty()
  answer: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  keywords?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateBotQaDto extends CreateBotQaDto {}

/** Public chat input: a bounded string, so it can't crash the handler or bloat the lookup. */
export class BotChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  message: string;
}
