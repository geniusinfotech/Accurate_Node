import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from './schemas/order.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { verifyRazorpaySignature } from '../payment/razorpay-signature.util';
import {
  getRazorpayInstance,
  toPaise,
} from '../payment/razorpay-client.util';
import { getTestOrder } from '../payment/test-orders.store';
import { UpdateTrackingDto } from './dto/update-tracking.dto';
import { Role } from '../auth/roles.enum';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * The shipping rules the Shipping Charges screen maintains: a `default`
   * charge with per-pincode overrides on top. The checkout page quotes the
   * customer from this same setting, so pricing an order any other way bills
   * them one amount and records another.
   */
  private async resolveShippingCost(pincode: string): Promise<number> {
    const FALLBACK = 100; // matches the checkout page when no setting exists
    try {
      const rules = await this.settingsService.getSetting('shipping');
      if (!rules || typeof rules !== 'object') return FALLBACK;
      const override = rules[pincode];
      const cost = override !== undefined ? override : rules.default;
      const parsed = Number(cost);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : FALLBACK;
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

    if (
      process.env.NODE_ENV !== 'production' &&
      razorpayOrderId.startsWith('order_test_')
    ) {
      const expected = toPaise(totalAmount);
      const testOrder = getTestOrder(razorpayOrderId);
      if (testOrder && testOrder.amount !== expected) {
        this.logger.error(
          `Payment amount mismatch on ${razorpayOrderId}: test order holds ${testOrder.amount} paise, order comes to ${expected} paise. Recording unpaid.`,
        );
        return false;
      }
      return true;
    }

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
  ): Promise<{ shippingCost: number; discount: number; totalAmount: number }> {
    const shippingCost = await this.resolveShippingCost(pincode);
    const discount =
      subtotal > 1000 ? Number((subtotal * 0.1).toFixed(2)) : 0;
    const totalAmount = Number(
      (subtotal - discount + shippingCost).toFixed(2),
    );
    return { shippingCost, discount, totalAmount };
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
  ): Promise<{
    items: any[];
    subtotal: number;
    shippingCost: number;
    discount: number;
    totalAmount: number;
  }> {
    const { items, subtotal } = await this.priceItems(cartItems);
    const quote = await this.quoteOrder(subtotal, pincode);
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
      if (item.productId) {
        if (!Types.ObjectId.isValid(item.productId)) {
          throw new BadRequestException(`Invalid productId: ${item.productId}`);
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
      } else {
        // Custom item without productId — validate price bounds
        if (
          !Number.isFinite(serverPrice) ||
          serverPrice < 0 ||
          serverPrice > 1000000
        ) {
          throw new BadRequestException('Invalid item price');
        }
      }
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
    const { items, subtotal: serverSubtotal, shippingCost, discount, totalAmount } =
      await this.quoteCart(createOrderDto.items, createOrderDto.pincode.trim());

    // A payment counts only when Razorpay signed it AND the amount it captured
    // is the amount this order comes to. Without the second half, a client can
    // pay for a cheap cart and then post an expensive order with that same
    // signature.
    const paymentVerified =
      verifyRazorpaySignature(createOrderDto) &&
      (await this.paymentCoversOrder(
        createOrderDto.razorpay_order_id,
        totalAmount,
      ));

    const orderNumber = await this.generateOrderNumber();
    const order = new this.orderModel({
      orderNumber,
      userId: userId ? new Types.ObjectId(userId) : undefined,
      customerName: createOrderDto.customerName.trim(),
      phone: createOrderDto.phone.trim().replace(/\D/g, ''),
      address: createOrderDto.address.trim(),
      pincode: createOrderDto.pincode.trim(),
      items,
      subtotal: serverSubtotal,
      discount,
      shippingCost,
      totalAmount,
      paymentId: paymentVerified
        ? createOrderDto.razorpay_payment_id
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
    // Enforce: if userId present, only return that user's orders (ignore phone enumeration)
    if (userId) {
      if (!Types.ObjectId.isValid(userId)) return [];
      return this.orderModel
        .find({ userId: new Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .exec();
    }
    // Anonymous phone lookup — require phone and limit results
    if (phone) {
      const clean = phone.trim().replace(/\s+/g, '');
      if (!/^\+?[0-9]{10,15}$/.test(clean)) {
        throw new BadRequestException('Invalid phone format');
      }
      return this.orderModel
        .find({ phone: clean, userId: { $exists: false } })
        .sort({ createdAt: -1 })
        .limit(20)
        .exec();
    }
    return [];
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
}
