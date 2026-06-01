import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { User } from './users/user.entity';
import { ReportsModule } from './reports/reports.module';
import { Report } from './reports/report.entity';
import { RolesModule } from './roles/roles.module';
import { Role } from './roles/role.entity';
import { ProductsModule } from './products/products.module';
import { ProductVariantsModule } from './product_variants/product_variants.module';
import { CategoriesModule } from './categories/categories.module';
import { CartsModule } from './carts/carts.module';
import { OrdersModule } from './orders/orders.module';
import { AddressesModule } from './addresses/addresses.module';
import { Address } from './addresses/addresses.entity';
import { Order, OrderLineItem } from './orders/orders.entity';
import { Product } from './products/product.entity';
import { ProductVariant } from './product_variants/product-variant.entity';
import { Category } from './categories/categories.entity';
import { Cart } from './carts/carts.entity';
import { CartItem } from './carts/cart-item.entity';
import { TagsModule } from './tags/tags.module';
import { Tag } from './tags/tags.entity';

@Module({
  // implementing typeorm
  imports: [
    // Load .env into process.env app-wide so ConfigService works everywhere
    // (without this, getOrThrow('JWT_SECRET') only worked if the var was already
    // exported in the shell).
    ConfigModule.forRoot({ isGlobal: true }),
    // Global rate limit (100 req / 60s per IP) to blunt brute-force /
    // credential-stuffing. Auth routes tighten this further via @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    // Async so the DB credentials are read from config *after* .env is loaded.
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.getOrThrow<number>('DB_PORT'),
        username: config.getOrThrow<string>('DB_USER'),
        password: config.getOrThrow<string>('DB_PASS'),
        database: config.getOrThrow<string>('DB_NAME'),
        entities: [
          User,
          Report,
          Role,
          Address,
          Order,
          OrderLineItem,
          Product,
          ProductVariant,
          Category,
          Tag,
          Cart,
          CartItem,
        ], // Connect the entity to the root connection
        synchronize: true, // migrate codes and update tables automatically
      }),
    }),
    UsersModule,
    ReportsModule,
    RolesModule,
    ProductsModule,
    ProductVariantsModule,
    CategoriesModule,
    CartsModule,
    OrdersModule,
    AddressesModule,
    TagsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Apply the throttler to every route by default.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
