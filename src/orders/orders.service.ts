import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from './schemas/order.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { User, UserDocument } from '../users/schema/user.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { verifyRazorpaySignature } from '../payment/razorpay-signature.util';
import {
  getRazorpayInstance,
  toPaise,
} from '../payment/razorpay-client.util';
import { UpdateTrackingDto } from './dto/update-tracking.dto';
import { Role } from '../auth/roles.enum';
import { SettingsService } from '../settings/settings.service';
import { CouponsService } from '../coupons/coupons.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly settingsService: SettingsService,
    private readonly couponsService: CouponsService,
  ) {}

  /**
   * The shipping rules the Shipping Charges screen maintains:
   *   - `pincodes` overrides: any key matching the pincode wins (₹0 allowed),
   *   - `freeShippingAbove`: orders of at least this subtotal ship free (0 = off),
   *   - `flatRate` (or legacy `default`): the standard charge.
   * The checkout page quotes the customer from this same setting, so pricing an
   * order any other way bills them one amount and records another.
   */
  private async resolveShippingCost(pincode: string, subtotal: number): Promise<number> {
    const FALLBACK = 100; // matches the checkout page when no setting exists
    const valid = (n: unknown) => Number.isFinite(Number(n)) && Number(n) >= 0;
    try {
      const rules = await this.settingsService.getSetting('shipping');
      if (!rules || typeof rules !== 'object') return FALLBACK;
      if (rules[pincode] !== undefined) {
        return valid(rules[pincode]) ? Number(rules[pincode]) : FALLBACK;
      }
      if (Number(rules.freeShippingAbove) > 0 && subtotal >= Number(rules.freeShippingAbove)) {
        return 0;
      }
      const flat = rules.flatRate ?? rules.default;
      return valid(flat) ? Number(flat) : FALLBACK;
    } catch (err) {
      this.logger.warn(
        `Falling back to default shipping: ${err?.message || err}`,
      );
      return FALLBACK;
    }
  }

  /**
   * Confirms Razorpay actually holds a payment for this exact amount. The
   * signature only binds order_id to payment_id — it says nothing about how
   * much was charged — so the gateway is asked directly. Anything unexpected
   * (unknown order, wrong amount, gateway unreachable) leaves the order
   * unpaid for a human to look at rather than trusting the client.
   */
  private async paymentCoversOrder(
    razorpayOrderId: string | undefined,
    totalAmount: number,
  ): Promise<boolean> {
    if (!razorpayOrderId) return false;

    const instance = getRazorpayInstance();
    if (!instance) {
      this.logger.error(
        'Payment gateway not configured — cannot confirm payment amounts',
      );
      return false;
    }

    try {
      const gatewayOrder = await instance.orders.fetch(razorpayOrderId);
      const expected = toPaise(totalAmount);
      const charged = Number(gatewayOrder?.amount);
      if (charged !== expected) {
        this.logger.error(
          `Payment amount mismatch on ${razorpayOrderId}: gateway holds ` +
            `${charged} paise, order comes to ${expected} paise. Recording unpaid.`,
        );
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error(
        `Could not confirm payment ${razorpayOrderId} with the gateway: ` +
          `${err?.error?.description || err?.message || err}. Recording unpaid.`,
      );
      return false;
    }
  }

  /**
   * The single pricing rule for a web order. The checkout page shows the
   * customer these same numbers before it hands them to Razorpay, so any change
   * here has to land in `app/checkout/page.tsx` too — otherwise the amount
   * charged and the amount recorded drift apart.
   */
  async quoteOrder(
    subtotal: number,
    pincode: string,
    couponCode?: string,
    userId?: string,
  ): Promise<{
    shippingCost: number;
    discount: number;
    totalAmount: number;
    couponDiscount?: number;
    couponCode?: string;
  }> {
    const shippingCost = await this.resolveShippingCost(pincode, subtotal);
    const autoDiscount =
      subtotal > 1000 ? Number((subtotal * 0.1).toFixed(2)) : 0;

    let couponDiscount = 0;
    let appliedCouponCode: string | undefined;

    if (couponCode && couponCode.trim()) {
      try {
        const result = await this.couponsService.calculateCouponDiscount(
          couponCode.trim(),
          subtotal,
          userId,
        );
        couponDiscount = result.discount;
        appliedCouponCode = result.couponCode;
      } catch (err: any) {
        this.logger.warn(`Could not apply coupon "${couponCode}": ${err?.message || err}`);
        throw err;
      }
    }

    const discount = Number(
      Math.min(subtotal, autoDiscount + couponDiscount).toFixed(2),
    );
    const totalAmount = Number(
      Math.max(0, subtotal - discount + shippingCost).toFixed(2),
    );
    const res: {
      shippingCost: number;
      discount: number;
      totalAmount: number;
      couponDiscount?: number;
      couponCode?: string;
    } = {
      shippingCost,
      discount,
      totalAmount,
    };
    if (couponDiscount > 0 || appliedCouponCode) {
      res.couponDiscount = couponDiscount;
      res.couponCode = appliedCouponCode;
    }
    return res;
  }

  private getDiwaliYear(year: number, now: Date): number {
    const diwaliReference = new Date(year, 10, 1);
    return now < diwaliReference ? year - 1 : year;
  }

  private async generateOrderNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const diwaliYear = this.getDiwaliYear(year, now);
    const mmdd =
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    const startOfDay = new Date(year, now.getMonth(), now.getDate());
    const endOfDay = new Date(
      year,
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );
    const count = await this.orderModel.countDocuments({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });
    return `ORD-${diwaliYear}-${mmdd}-${String(count + 1).padStart(4, '0')}`;
  }

  /**
   * Re-prices a cart from the catalogue, ignoring whatever the client claimed
   * each line costs. Shared by order creation and by the payment endpoint, so
   * the amount charged and the amount recorded come from one calculation.
   */
  async quoteCart(
    cartItems: CreateOrderDto['items'],
    pincode: string,
    couponCode?: string,
    userId?: string,
  ): Promise<{
    items: any[];
    subtotal: number;
    shippingCost: number;
    discount: number;
    totalAmount: number;
    couponDiscount?: number;
    couponCode?: string;
  }> {
    const { items, subtotal } = await this.priceItems(cartItems);
    const quote = await this.quoteOrder(subtotal, pincode, couponCode, userId);
    return { items, subtotal, ...quote };
  }

  private async priceItems(
    cartItems: CreateOrderDto['items'],
  ): Promise<{ items: any[]; subtotal: number }> {
    if (!cartItems || cartItems.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }
    if (cartItems.length > 50) {
      throw new BadRequestException('Too many items in order');
    }

    // Server-side price verification — never trust client price
    const items: any[] = [];
    let serverSubtotal = 0;
    for (const item of cartItems) {
      let serverPrice = item.price;
      let serverName = item.name?.trim();
      let serverSku = item.sku || '';
      let serverImage = item.image || '';
      if (!item.productId || !Types.ObjectId.isValid(item.productId)) {
        throw new BadRequestException('A valid productId is required for each order item');
      }
      const product = await this.productModel
        .findById(item.productId)
        .select('name sku images price isActive status')
        .lean()
        .exec();
      if (!product) {
        throw new BadRequestException(`Product not found: ${item.productId}`);
      }
      if (
        (product as any).isActive === false ||
        (product as any).status !== 'published'
      ) {
        throw new BadRequestException(
          `Product not available: ${(product as any).name}`,
        );
      }
      serverPrice = (product as any).price;
      serverName = (product as any).name;
      serverSku = (product as any).sku || serverSku;
      serverImage = (product as any).images?.[0] || serverImage;
      if (
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 100
      ) {
        throw new BadRequestException('Invalid item quantity');
      }
      const lineSubtotal = serverPrice * item.quantity;
      serverSubtotal += lineSubtotal;
      items.push({
        productId: item.productId
          ? new Types.ObjectId(item.productId)
          : undefined,
        name: serverName,
        sku: serverSku,
        image: serverImage,
        quantity: item.quantity,
        price: serverPrice,
        subtotal: lineSubtotal,
      });
    }

    return { items, subtotal: serverSubtotal };
  }

  async create(
    createOrderDto: CreateOrderDto,
    userId?: string,
  ): Promise<OrderDocument> {
    // Server computes totals — client-supplied subtotal/totalAmount/discount/
    // shippingCost are ignored. The rules themselves must stay identical to the
    // ones the checkout page quotes from, or the customer pays one figure and
    // the order records another:
    //   shipping — the pincode's override, else the configured default
    //   discount — 10% once the verified subtotal is over ₹1000
    const {
      items,
      subtotal: serverSubtotal,
      shippingCost,
      discount,
      totalAmount,
      couponDiscount,
      couponCode: appliedCouponCode,
    } = await this.quoteCart(
      createOrderDto.items,
      createOrderDto.pincode.trim(),
      createOrderDto.couponCode?.trim(),
      userId,
    );

    // A valid Razorpay signature proves a real payment exists for that order id; it cannot
    // be produced without the secret. Without one, only an explicitly enabled COD (or a
    // ₹0 order, e.g. fully covered by a coupon) may be placed. Otherwise anyone could
    // spam the admin with unpaid orders through the public API.
    const signed = verifyRazorpaySignature(createOrderDto);
    if (!signed && totalAmount > 0 && process.env.COD_ENABLED !== 'true') {
      throw new BadRequestException('Payment is required to place an order.');
    }

    // One payment, one order. A retry by the same buyer (dropped connection) gets the same
    // order back; anyone else presenting this payment is refused.
    const phone = createOrderDto.phone.trim().replace(/\D/g, '');
    if (signed) {
      const used = await this.orderModel
        .findOne({ paymentId: createOrderDto.razorpay_payment_id })
        .exec();
      if (used) {
        if (used.phone === phone) return used;
        throw new ConflictException('This payment has already been used for an order.');
      }
    }

    // Counts as paid only when the amount Razorpay captured is the amount this order comes
    // to; otherwise a client could pay for a cheap cart and post an expensive order with
    // that same signature.
    const paymentVerified =
      signed &&
      (await this.paymentCoversOrder(
        createOrderDto.razorpay_order_id,
        totalAmount,
      ));

    const orderNumber = await this.generateOrderNumber();
    const order = new this.orderModel({
      orderNumber,
      userId: userId ? new Types.ObjectId(userId) : undefined,
      customerName: createOrderDto.customerName.trim(),
      phone,
      address: createOrderDto.address.trim(),
      pincode: createOrderDto.pincode.trim(),
      items,
      subtotal: serverSubtotal,
      discount,
      shippingCost,
      totalAmount,
      couponCode: appliedCouponCode || createOrderDto.couponCode?.trim() || '',
      couponDiscount: couponDiscount || 0,
      paymentId: signed
        ? createOrderDto.razorpay_payment_id // kept even when unverified, for review and replay protection
        : createOrderDto.paymentId || '',
      // Never allow the client to declare itself paid: the only thing that
      // flips this is a Razorpay signature this server re-verified above.
      paymentStatus: paymentVerified ? 'paid' : 'pending',
      orderStatus: 'placed',
      notes: (createOrderDto.notes || '').slice(0, 2000),
    });

    return order.save();
  }

  async findAll(
    status?: string,
    query: { date?: string; from?: string; to?: string } = {},
  ): Promise<OrderDocument[]> {
    const allowedStatuses = [
      'placed',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
    ];
    const filter: any = {};
    if (status && status !== 'all') {
      if (!allowedStatuses.includes(status)) {
        throw new BadRequestException('Invalid order status filter');
      }
      filter.orderStatus = status;
    }
    const dateRange = this.buildDateRange(query);
    if (dateRange) {
      filter.createdAt = dateRange;
    }
    return this.orderModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  private buildDateRange(query: {
    date?: string;
    from?: string;
    to?: string;
  }): { $gte?: Date; $lte?: Date } | undefined {
    const parse = (value?: string): Date | undefined => {
      if (!value) return undefined;
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
      const date = match
        ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
        : new Date(value);
      return isNaN(date.getTime()) ? undefined : date;
    };

    const range: { $gte?: Date; $lte?: Date } = {};
    if (query.date) {
      const start = parse(query.date);
      if (start) {
        start.setHours(0, 0, 0, 0);
        range.$gte = start;
      }
      const end = parse(query.date);
      if (end) {
        end.setHours(23, 59, 59, 999);
        range.$lte = end;
      }
    } else {
      const start = parse(query.from);
      if (start) {
        start.setHours(0, 0, 0, 0);
        range.$gte = start;
      }
      const end = parse(query.to);
      if (end) {
        end.setHours(23, 59, 59, 999);
        range.$lte = end;
      }
    }

    return range.$gte || range.$lte ? range : undefined;
  }

  async findByUser(userId?: string, phone?: string): Promise<OrderDocument[]> {
    const conditions: any[] = [];
    let userOid: Types.ObjectId | undefined;

    if (userId && Types.ObjectId.isValid(userId)) {
      userOid = new Types.ObjectId(userId);
      conditions.push({ userId: userOid });

      try {
        const user = await this.userModel.findById(userOid).exec();
        if (user?.phone) {
          const userPhoneDigits = user.phone.trim().replace(/\D/g, '');
          const last10 = userPhoneDigits.slice(-10);
          if (last10.length === 10) {
            const phoneVariants = [
              userPhoneDigits,
              last10,
              `+91${last10}`,
              `91${last10}`,
              `0${last10}`,
            ];
            // Guest orders placed with the phone on this profile. The phone is not verified
            // (no OTP), so these are shown masked below and never claimed as the user's.
            conditions.push({ phone: { $in: phoneVariants } });
          }
        }
      } catch {
        // non-blocking
      }
    }

    // Phone lookups are for guests only; a signed-in user cannot ask for someone else's number.
    if (phone && !userId) {
      const clean = phone.trim().replace(/\D/g, '');
      const last10 = clean.slice(-10);
      if (last10.length >= 10) {
        const phoneVariants = [
          clean,
          last10,
          `+91${last10}`,
          `91${last10}`,
          `0${last10}`,
        ];
        conditions.push({ phone: { $in: phoneVariants } });
      }
    }

    if (conditions.length === 0) {
      return [];
    }

    const orders = await this.orderModel
      .find({ $or: conditions })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();

    // Full details only for orders this account actually placed; everything matched by phone
    // number alone is masked to prevent PII harvesting.
    return orders.map((o) =>
      userOid && o.userId && o.userId.equals(userOid) ? o : this.maskSensitiveOrder(o),
    );
  }

  private maskSensitiveOrder(order: any): any {
    const plain: any = order.toObject ? order.toObject() : { ...order };
    if (plain.customerName) {
      const parts = plain.customerName.trim().split(/\s+/);
      plain.customerName = parts
        .map((p: string) => (p.length > 1 ? p[0] + '*'.repeat(Math.max(1, p.length - 1)) : p))
        .join(' ');
    }
    if (plain.phone) {
      const digits = String(plain.phone).replace(/\D/g, '');
      plain.phone = digits.length >= 4 ? '*'.repeat(digits.length - 4) + digits.slice(-4) : '****';
    }
    if (plain.address) {
      plain.address = plain.pincode
        ? `Delivery to PIN ${plain.pincode}`
        : 'Residential address (Masked for privacy)';
    }
    delete plain.userId; // internal id, not for anonymous lookups
    if (plain.paymentId) {
      plain.paymentId = plain.paymentId.length > 8 ? plain.paymentId.slice(0, 4) + '****' : '****';
    }
    return plain;
  }

  async findOne(id: string, user?: any): Promise<OrderDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid order ID');
    }
    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
    const isPrivileged =
      roles.includes(Role.ADMIN) ||
      roles.includes(Role.MANAGER) ||
      roles.includes('admin') ||
      roles.includes('manager');
    if (isPrivileged) {
      return order;
    }

    const userId = user?.userId || user?.sub || user?.id || user?._id;
    if (!userId) {
      throw new UnauthorizedException(
        'Authentication required to view this order',
      );
    }
    if (order.userId && order.userId.toString() !== userId.toString()) {
      throw new UnauthorizedException(
        'You do not have permission to access this order',
      );
    }
    // Anonymous orders (no userId) — only privileged users can view; authenticated non-owner cannot
    if (!order.userId) {
      throw new UnauthorizedException(
        'You do not have permission to access this order',
      );
    }

    return order;
  }

  async updateTracking(
    id: string,
    updateTrackingDto: UpdateTrackingDto,
  ): Promise<OrderDocument> {
    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    if (updateTrackingDto.orderStatus) {
      order.orderStatus = updateTrackingDto.orderStatus;
    }
    // COD: cash is collected on delivery, so delivered means paid.
    if (order.orderStatus === 'delivered' && order.paymentStatus === 'pending') {
      order.paymentStatus = 'paid';
    }
    if (updateTrackingDto.courierName !== undefined) {
      order.courierName = updateTrackingDto.courierName;
    }
    if (updateTrackingDto.trackingId !== undefined) {
      order.trackingId = updateTrackingDto.trackingId;
    }
    if (updateTrackingDto.notes !== undefined) {
      order.notes = updateTrackingDto.notes;
    }

    return order.save();
  }

  async updateShippingAddress(
    id: string,
    data: {
      customerName?: string;
      phone?: string;
      address?: string;
      pincode?: string;
    },
    user?: any,
  ): Promise<OrderDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid order ID');
    }
    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
    const isPrivileged =
      roles.includes(Role.ADMIN) ||
      roles.includes(Role.MANAGER) ||
      roles.includes('admin') ||
      roles.includes('manager');
    if (!isPrivileged) {
      const userId = user?.userId || user?.sub || user?.id || user?._id;
      if (
        !userId ||
        !order.userId ||
        order.userId.toString() !== userId.toString()
      ) {
        throw new UnauthorizedException(
          'You do not have permission to access this order',
        );
      }
    }

    if (order.orderStatus !== 'placed' && order.orderStatus !== 'processing') {
      throw new BadRequestException(
        'Cannot change shipping address for orders already shipped or delivered',
      );
    }

    if (data.customerName)
      order.customerName = data.customerName.trim().slice(0, 200);
    if (data.phone) {
      const clean = data.phone.trim().replace(/\s+/g, '');
      if (!/^\+?[0-9]{10,15}$/.test(clean))
        throw new BadRequestException('Invalid phone');
      order.phone = clean;
    }
    if (data.address) order.address = data.address.trim().slice(0, 1000);
    if (data.pincode) {
      const pin = data.pincode.trim();
      if (!/^[0-9]{4,10}$/.test(pin))
        throw new BadRequestException('Invalid pincode');
      order.pincode = pin;
    }

    return order.save();
  }

  async getSummary() {
    // Prepaid orders count once paid; COD orders (paymentStatus stays 'pending') once delivered.
    const isRevenue = (o: { orderStatus: string; paymentStatus: string }) =>
      o.orderStatus !== 'cancelled' &&
      (o.paymentStatus === 'paid' || o.orderStatus === 'delivered');

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    const [allOrders, todayOrders] = await Promise.all([
      this.orderModel.find().exec(),
      this.orderModel
        .find({ createdAt: { $gte: startOfToday, $lte: endOfToday } })
        .exec(),
    ]);

    let totalWebRevenue = 0;
    let placedCount = 0;
    let processingCount = 0;
    let shippedCount = 0;
    let deliveredCount = 0;
    let cancelledCount = 0;

    for (const o of allOrders) {
      if (isRevenue(o)) {
        totalWebRevenue += o.totalAmount || 0;
      }
      switch (o.orderStatus) {
        case 'placed':
          placedCount++;
          break;
        case 'processing':
          processingCount++;
          break;
        case 'shipped':
          shippedCount++;
          break;
        case 'delivered':
          deliveredCount++;
          break;
        case 'cancelled':
          cancelledCount++;
          break;
      }
    }

    let todayRevenue = 0;
    for (const o of todayOrders) {
      if (isRevenue(o)) {
        todayRevenue += o.totalAmount || 0;
      }
    }

    return {
      totalOrdersCount: allOrders.length,
      totalWebRevenue,
      placedCount,
      processingCount,
      shippedCount,
      deliveredCount,
      cancelledCount,
      pendingShipmentCount: placedCount + processingCount,
      todayOrdersCount: todayOrders.length,
      todayRevenue,
    };
  }

  async trackOrder(queryText?: string, phone?: string): Promise<OrderDocument> {
    const trimmed = (queryText || '').trim();
    if (!trimmed) {
      throw new BadRequestException('Order number or tracking ID is required');
    }

    const orConditions: any[] = [
      { orderNumber: trimmed.toUpperCase() },
      { orderNumber: trimmed },
      { trackingId: trimmed },
    ];

    if (Types.ObjectId.isValid(trimmed)) {
      orConditions.push({ _id: new Types.ObjectId(trimmed) });
    }

    const order = await this.orderModel.findOne({ $or: orConditions }).exec();

    if (!order) {
      throw new NotFoundException(
        `No order found matching "${trimmed}". Please check your order number or tracking ID.`,
      );
    }

    let phoneVerified = false;
    if (phone) {
      const cleanPhone = phone.trim().replace(/\D/g, '');
      const orderPhone = (order.phone || '').trim().replace(/\D/g, '');
      if (cleanPhone.length >= 10 && orderPhone.length >= 10) {
        if (cleanPhone.slice(-10) !== orderPhone.slice(-10)) {
          throw new BadRequestException(
            'The phone number provided does not match this order record.',
          );
        }
        phoneVerified = true;
      } else {
        throw new BadRequestException('Please provide a valid 10-digit phone number');
      }
    }

    if (phoneVerified) {
      return order;
    }

    return this.maskSensitiveOrder(order);
  }
}

