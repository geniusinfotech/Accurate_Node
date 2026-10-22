import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { DiscountType } from './schemas/coupon.schema';

describe('CouponsService', () => {
  let service: CouponsService;
  let mockCouponModel: any;
  let mockUserModel: any;

  beforeEach(() => {
    mockCouponModel = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
    };
    mockUserModel = {
      findById: jest.fn(),
    };
    service = new CouponsService(mockCouponModel, mockUserModel);
  });

  describe('validateCoupon', () => {
    it('throws if coupon code is missing', async () => {
      await expect(service.validateCoupon('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws if coupon is not found or inactive', async () => {
      mockCouponModel.findOne.mockResolvedValue(null);
      await expect(service.validateCoupon('NONEXISTENT')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('validates a standard public coupon successfully', async () => {
      const mockCoupon = {
        code: 'WELCOME10',
        discountType: DiscountType.PERCENT,
        discountValue: 10,
        isActive: true,
        minSpendGoal: 0,
      };
      mockCouponModel.findOne.mockResolvedValue(mockCoupon);

      const result = await service.validateCoupon('welcome10');
      expect(result).toEqual(mockCoupon);
      expect(mockCouponModel.findOne).toHaveBeenCalledWith({
        code: 'WELCOME10',
        isActive: true,
      });
    });

    it('requires login if coupon has a minSpendGoal > 0', async () => {
      const mockCoupon = {
        code: 'VIP50',
        discountType: DiscountType.FIXED,
        discountValue: 50,
        isActive: true,
        minSpendGoal: 5000,
      };
      mockCouponModel.findOne.mockResolvedValue(mockCoupon);

      await expect(service.validateCoupon('VIP50')).rejects.toThrow(
        'Please log in to use this loyalty coupon',
      );
    });

    it('validates loyalty coupon when user meets spend goal', async () => {
      const mockCoupon = {
        code: 'VIP50',
        discountType: DiscountType.FIXED,
        discountValue: 50,
        isActive: true,
        minSpendGoal: 5000,
      };
      mockCouponModel.findOne.mockResolvedValue(mockCoupon);
      mockUserModel.findById.mockResolvedValue({ totalAmountSpent: 6000 });

      const result = await service.validateCoupon('VIP50', 'user_123');
      expect(result).toEqual(mockCoupon);
    });

    it('throws when user does not meet spend goal', async () => {
      const mockCoupon = {
        code: 'VIP50',
        discountType: DiscountType.FIXED,
        discountValue: 50,
        isActive: true,
        minSpendGoal: 5000,
      };
      mockCouponModel.findOne.mockResolvedValue(mockCoupon);
      mockUserModel.findById.mockResolvedValue({ totalAmountSpent: 3000 });

      await expect(
        service.validateCoupon('VIP50', 'user_123'),
      ).rejects.toThrow('Goal not met. You need to spend ₹2000 more');
    });
  });

  describe('calculateCouponDiscount', () => {
    it('returns 0 discount if no coupon code provided', async () => {
      const result = await service.calculateCouponDiscount(undefined, 1000);
      expect(result).toEqual({ discount: 0 });
    });

    it('calculates percentage discount accurately', async () => {
      mockCouponModel.findOne.mockResolvedValue({
        code: 'SAVE15',
        discountType: DiscountType.PERCENT,
        discountValue: 15,
        isActive: true,
        minSpendGoal: 0,
      });

      const result = await service.calculateCouponDiscount('SAVE15', 2000);
      expect(result.discount).toBe(300);
      expect(result.couponCode).toBe('SAVE15');
    });

    it('calculates flat discount accurately', async () => {
      mockCouponModel.findOne.mockResolvedValue({
        code: 'FLAT100',
        discountType: DiscountType.FIXED,
        discountValue: 100,
        isActive: true,
        minSpendGoal: 0,
      });

      const result = await service.calculateCouponDiscount('FLAT100', 500);
      expect(result.discount).toBe(100);
      expect(result.couponCode).toBe('FLAT100');
    });

    it('caps discount at subtotal', async () => {
      mockCouponModel.findOne.mockResolvedValue({
        code: 'MEGA500',
        discountType: DiscountType.FIXED,
        discountValue: 500,
        isActive: true,
        minSpendGoal: 0,
      });

      const result = await service.calculateCouponDiscount('MEGA500', 300);
      expect(result.discount).toBe(300);
    });
  });
});
