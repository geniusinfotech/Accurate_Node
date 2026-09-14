import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { MigrationService } from './scripts/migrate-customer-dealer-links';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { TestimonialsModule } from './testimonials/testimonials.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { BotModule } from './bot/bot.module';
import { CategoriesModule } from './categories/categories.module';
import { ShopProductsModule } from './shop-products/shop-products.module';
import { ShopCategoriesModule } from './shop-categories/shop-categories.module';
import { DealsOffersModule } from './deals-offers/deals-offers.module';
import { LoggerModule } from './common/logger/logger.module';
import { ManagersModule } from './managers/managers.module';
import { InventoryModule } from './inventory/inventory.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CouponsModule } from './coupons/coupons.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ActivityInterceptor } from './common/interceptors/activity.interceptor';
import { AdminsModule } from './admins/admins.module';
import { UploadModule } from './upload/upload.module';
import { BannersModule } from './banners/banners.module';
import { RawMaterialsModule } from './manufacturing/raw-materials/raw-materials.module';
import { WorkersModule } from './manufacturing/workers/workers.module';
import { WorkBatchesModule } from './manufacturing/work-batches/work-batches.module';
import { SemiFinishedStockModule } from './manufacturing/semi-finished-stock/semi-finished-stock.module';
import { WorkerPaymentsModule } from './manufacturing/worker-payments/worker-payments.module';
import { DealersModule } from './dealers/dealers.module';
import { LotsModule } from './lots/lots.module';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { DashboardModule } from './dashboard/dashboard.module';
import { SalesModule } from './sales/sales.module';
import { CacheModule } from './common/cache/cache.module';
import { SettingsModule } from './settings/settings.module';
import { PaymentModule } from './payment/payment.module';
import { OrdersModule } from './orders/orders.module';
import { CustomerLedgerModule } from './customer-ledger/customer-ledger.module';
import { CustomersModule } from './customers/customers.module';
import { ReportsModule } from './reports/reports.module';
import { CashBankAccountsModule } from './cash-bank-accounts/cash-bank-accounts.module';
import { CashBankEntriesModule } from './cash-bank-entries/cash-bank-entries.module';

const databaseLogger = new Logger('Database');

@Module({
  imports: [
    // ... imports
    ConfigModule.forRoot({
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().default(9004),
        MONGODB_URI: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRES_IN: Joi.string().default('1h'),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
        FRONTEND_URL: Joi.string().uri().default('http://localhost:9008'),
        ALLOWED_ORIGINS: Joi.string().allow('').default(''),
        // Auth cookie policy. See deploy/nginx/README.md.
        COOKIE_CROSS_SITE: Joi.string().valid('true', 'false').optional(),
        COOKIE_SECURE: Joi.string().valid('true', 'false').optional(),
        COOKIE_DOMAIN: Joi.string().allow('').optional(),
        GOOGLE_CLIENT_ID: Joi.string().allow(''),
        GOOGLE_CLIENT_SECRET: Joi.string().allow(''),
        GOOGLE_CALLBACK_URL: Joi.string().uri().allow(''),
        LOG_LEVEL: Joi.string().default('debug'),
        LOSS_ALERT_THRESHOLD_PCT: Joi.number().default(5),
        REDIS_HOST: Joi.string().allow('').optional(),
        REDIS_PORT: Joi.number().optional(),
        REDIS_PASSWORD: Joi.string().allow('').optional(),
        REDIS_DB: Joi.number().optional(),
        CACHE_TTL: Joi.number().optional(),
      }),
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI as string, {
      maxPoolSize: 50,
      minPoolSize: 10,
      connectionFactory: (connection: Connection) => {
        connection.on('connected', () => {
          databaseLogger.log('Database connected successfully');
          databaseLogger.log('MongoDB connection established');
        });
        connection.on('error', (err) => {
          databaseLogger.error('Database connection error', err);
        });
        connection.on('disconnected', () => {
          databaseLogger.warn('Database disconnected');
        });
        return connection;
      },
    }),
    UsersModule,
    ProductsModule,
    AuthModule,
    TestimonialsModule,
    WishlistModule,
    BotModule,
    CategoriesModule,
    ShopProductsModule,
    ShopCategoriesModule,
    DealsOffersModule,
    LoggerModule,
    ManagersModule,
    AdminsModule,
    InventoryModule,
    AnalyticsModule,
    CouponsModule,
    UploadModule,
    BannersModule,
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    RawMaterialsModule,
    WorkersModule,
    WorkBatchesModule,
    SemiFinishedStockModule,
    WorkerPaymentsModule,
    DealersModule,
    LotsModule,
    ActivityLogModule,
    DashboardModule,
    SalesModule,
    CacheModule,
    SettingsModule,
    PaymentModule,
    OrdersModule,
    CustomerLedgerModule,
    CustomersModule,
    ReportsModule,
    CashBankEntriesModule,
    CashBankAccountsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    MigrationService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  onModuleInit() {
    this.logger.log('Application module initialized');
  }
}
