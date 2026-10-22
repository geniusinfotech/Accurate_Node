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

  async validateCoupon(code: string, userId?: string): Promise<Coupon> {
    if (!code || typeof code !== 'string') {
      throw new BadRequestException('A valid coupon code is required');
    }
    const safeCode = String(code).trim().toUpperCase();
    const coupon = await this.couponModel.findOne({ code: safeCode, isActive: true });
    if (!coupon) {
      throw new NotFoundException('Invalid or expired coupon');
    }

    // Date checks
    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom) {
      throw new BadRequestException('Coupon is not yet active');
    }
    if (coupon.validUntil && now > coupon.validUntil) {
      throw new BadRequestException('Coupon has expired');
    }

    const minGoal = coupon.minSpendGoal || 0;
    if (minGoal > 0) {
      if (!userId) {
        throw new BadRequestException('Please log in to use this loyalty coupon');
      }
      const user = await this.userModel.findById(userId);
      if (!user) throw new NotFoundException('User not found');

      const userSpend = user.totalAmountSpent || 0;
      if (userSpend < minGoal) {
        throw new BadRequestException(
          `Goal not met. You need to spend ₹${minGoal - userSpend} more to use this coupon.`,
        );
      }
    }

    return coupon;
  }

  async calculateCouponDiscount(
    code: string | undefined,
    subtotal: number,
    userId?: string,
  ): Promise<{ discount: number; couponCode?: string; coupon?: Coupon }> {
    if (!code || !code.trim()) return { discount: 0 };
    const coupon = await this.validateCoupon(code, userId);
    let discount = 0;
    if (coupon.discountType === 'percent') {
      discount = Number(((subtotal * coupon.discountValue) / 100).toFixed(2));
    } else {
      discount = Number(coupon.discountValue);
    }
    discount = Math.min(discount, subtotal);
    return { discount, couponCode: coupon.code, coupon };
  }

  async getUserLoyaltyStatus(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const userSpend = user.totalAmountSpent || 0;
    const allCoupons = await this.couponModel
      .find({ isActive: true })
      .sort({ minSpendGoal: 1 });

    const coupons = allCoupons.map((coupon) => {
      const minGoal = coupon.minSpendGoal || 0;
      const isUnlocked = userSpend >= minGoal;
      const progress = isUnlocked
        ? 100
        : minGoal > 0 ? (userSpend / minGoal) * 100 : 100;

      return {
        id: coupon._id,
        code: coupon.code,
        discountValue: coupon.discountValue,
        discountType: coupon.discountType,
        minSpendGoal: minGoal,
        isUnlocked,
        progress: Math.min(progress, 100),
        remainingSpend: isUnlocked
          ? 0
          : minGoal - userSpend,
      };
    });

    return {
      lifetimeSpend: userSpend,
      unlockedCoupons: coupons.filter(c => c.isUnlocked),
      coupons,
    };
  }
}
