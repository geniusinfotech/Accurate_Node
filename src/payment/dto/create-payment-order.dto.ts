/* eslint-disable prettier/prettier */
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { CreateOrderItemDto } from '../../orders/dto/create-order.dto';

/**
 * What the cart wants to buy and where it is going — deliberately no amount.
 * The server prices it, so a tampered client cannot open a payment for less
 * than the goods cost.
 */
export class CreatePaymentOrderDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'pincode must be 6 digits' })
  pincode: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  couponCode?: string;
}
