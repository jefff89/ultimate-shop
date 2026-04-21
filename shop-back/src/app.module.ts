import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { Category, ProductTag } from './categories/categories.entity';
import { Cart } from './carts/carts.entity';
import { CartItem } from './carts/cart-item.entity';
// import cookieSession from 'cookie-session';

@Module({
  // implementing typeorm
  imports: [
    TypeOrmModule.forRoot({
      // type: 'sqlite',
      // database: 'db.sqlite',
      type: 'postgres',
      host: 'localhost', // or '127.0.0.1'
      port: 5432, // default PostgreSQL port
      username: 'jeff',
      password: '1234',
      database: 'start_nest_shop_db',
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
        ProductTag,
        Cart,
        CartItem,
      ], // Connect the entity to the root connection
      synchronize: true, // migrate codes and update tables automatically
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  // this is for cookieSession authentication method
  // configure(consumer: MiddlewareConsumer) {
  //   consumer
  //     .apply(
  //       cookieSession({
  //         keys: ['assasfddf'],
  //       }),
  //     )
  //     .forRoutes('*');
  // }
}
