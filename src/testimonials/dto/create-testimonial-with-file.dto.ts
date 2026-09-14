/* eslint-disable prettier/prettier */
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';

function toBoolean({ value }: TransformFnParams): boolean | undefined {
  const source: unknown = value;
  if (source === undefined || source === null || source === '') return undefined;
  if (source === true || source === false) return source;
  if (typeof source === 'string') {
    const s = source.toLowerCase();
    if (s === 'true') return true;
    if (s === 'false') return false;
  }
  return undefined;
}

export class CreateTestimonialWithFileDto {
  @IsNotEmpty()
  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  youtubeUrl?: string;

  @IsNotEmpty()
  @IsString()
  customerName: string;

  @IsNotEmpty()
  @IsString()
  customerPost: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  sortOrder?: number;
}
