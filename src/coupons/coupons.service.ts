import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Coupon,
  CouponDocument,
  DiscountType,
} from './schemas/coupon.schema';
import { User, UserDocument } from '../users/schema/user.schema';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@Injectable()
export class CouponsService {
  constructor(
    @InjectModel(Coupon.name) private couponModel: Model<CouponDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(dto: CreateCouponDto): Promise<Coupon> {
    this.assertCoherent(dto);
    const coupon = new this.couponModel(dto);
    try {
      return await coupon.save();
    } catch (err) {
      throw this.translateDuplicateCode(err, dto.code);
    }
  }

  async findAll(): Promise<Coupon[]> {
    return this.couponModel.find().sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<CouponDocument> {
    const coupon = await this.couponModel.findById(id);
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  async update(id: string, dto: UpdateCouponDto): Promise<Coupon> {
    const existing = await this.findById(id);

    // Cross-field rules have to be checked against the merged record: a PATCH
    // may change only validUntil, or only the discount type.
    this.assertCoherent({
      code: dto.code ?? existing.code,
      discountValue: dto.discountValue ?? existing.discountValue,
      discountType: dto.discountType ?? existing.discountType,
      minSpendGoal: dto.minSpendGoal ?? existing.minSpendGoal,
      // `??` would treat an explicit null (clearing the date) as "not supplied",
      // so distinguish undefined from null here.
      validFrom:
        dto.validFrom !== undefined
          ? dto.validFrom
          : existing.validFrom?.toISOString(),
      validUntil:
        dto.validUntil !== undefined
          ? dto.validUntil
          : existing.validUntil?.toISOString(),
    });

    try {
      const updated = await this.couponModel.findByIdAndUpdate(id, dto, {
        new: true,
        runValidators: true,
      });
      if (!updated) throw new NotFoundException('Coupon not found');
      return updated;
    } catch (err) {
      throw this.translateDuplicateCode(err, dto.code ?? existing.code);
    }
  }

  async remove(id: string): Promise<Coupon> {
    const deleted = await this.couponModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException('Coupon not found');
    return deleted;
  }

  /**
   * Rules that span more than one field, so class-validator can't express them.
   */
  private assertCoherent(dto: {
    code: string;
    discountValue: number;
    discountType?: DiscountType;
    minSpendGoal?: number;
    validFrom?: string | null;
    validUntil?: string | null;
  }) {
    if (
      dto.discountType === DiscountType.PERCENT &&
      Number(dto.discountValue) > 100
    ) {
      throw new BadRequestException(
        'A percentage discount cannot be more than 100%.',
      );
    }

    if (dto.validFrom && dto.validUntil) {
      const from = new Date(dto.validFrom);
      const until = new Date(dto.validUntil);
      if (until <= from) {
        throw new BadRequestException(
          'The coupon must expire after it becomes valid.',
        );
      }
    }
  }

  /**
   * `code` is uniquely indexed, so a clash surfaces as a Mongo E11000 rather
   * than anything the caller can act on. Turn it into a 409 that names the code.
   */
  private translateDuplicateCode(err: any, code?: string) {
    if (err?.code === 11000) {
      return new ConflictException(
        `A coupon with the code ${code ?? ''} already exists.`.replace(
          '  ',
          ' ',
        ),
      );
    }
    return err;
  }

  async findActive(): Promise<Coupon[]> {
    return this.couponModel.find({ isActive: true }).exec();
  }

  async validateCoupon(code: string, userId: string): Promise<Coupon> {
    const coupon = await this.couponModel.findOne({ code, isActive: true });
    if (!coupon) {
      throw new NotFoundException('Invalid or expired coupon');
    }

    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (user.totalAmountSpent < coupon.minSpendGoal) {
      throw new Error(
        `Goal not met. You need to spend ₹${coupon.minSpendGoal - user.totalAmountSpent} more to use this coupon.`,
      );
    }

    // Date checks
    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom)
      throw new Error('Coupon is not yet active');
    if (coupon.validUntil && now > coupon.validUntil)
      throw new Error('Coupon has expired');

    return coupon;
  }

  async getUserLoyaltyStatus(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const allCoupons = await this.couponModel
      .find({ isActive: true })
      .sort({ minSpendGoal: 1 });

    return allCoupons.map((coupon) => {
      const isUnlocked = user.totalAmountSpent >= coupon.minSpendGoal;
      const progress = isUnlocked
        ? 100
        : (user.totalAmountSpent / coupon.minSpendGoal) * 100;

      return {
        id: coupon._id,
        code: coupon.code,
        discountValue: coupon.discountValue,
        discountType: coupon.discountType,
        minSpendGoal: coupon.minSpendGoal,
        isUnlocked,
        progress: Math.min(progress, 100),
        remainingSpend: isUnlocked
          ? 0
          : coupon.minSpendGoal - user.totalAmountSpent,
      };
    });
  }
}
