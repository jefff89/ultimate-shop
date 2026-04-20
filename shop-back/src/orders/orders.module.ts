import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './orders.entity';
import { OrderLineItem } from './orders.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderLineItem]),
    // ProductsModule, // to validate product/variant existence
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
