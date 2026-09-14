/* eslint-disable prettier/prettier */
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsUrl,
  IsNumber,
} from 'class-validator';

export class CreateTestimonialDto {
  @IsNotEmpty()
  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  videoLink?: string;

  @IsOptional()
  @IsString()
  youtubeUrl?: string;  // YouTube video URL

  @IsOptional()
  @IsNumber()
  sortOrder?: number;  // Sort order (lower numbers appear first)

  @IsNotEmpty()
  @IsString()
  customerName: string;

  @IsNotEmpty()
  @IsString()
  customerPost: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
