import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateShopBrandDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9_]+$/, {
    message: 'Code must be uppercase alphanumeric with underscores',
  })
  code: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
