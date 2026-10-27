import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { ProductNotFoundError } from './shop.errors';
import { ShopService } from './shop.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller()
@UseGuards(SessionGuard)
export class ShopController {
  constructor(private readonly shop: ShopService) {}

  @Get('products')
  listProducts() {
    return this.shop.listProducts();
  }

  @Post('orders')
  async placeOrder(
    @Req() req: Request & { user: { id: string; email: string } },
    @Body() body: { productId?: unknown },
  ) {
    try {
      if (typeof body?.productId !== 'string' || !UUID.test(body.productId)) {
        throw new ProductNotFoundError();
      }
      const order = await this.shop.placeOrder(req.user.id, body.productId);
      return {
        id: order.id,
        productId: order.productId,
        status: order.status,
      };
    } catch (err) {
      if (err instanceof ProductNotFoundError) {
        throw new NotFoundException({ code: 'product_not_found' });
      }
      throw err;
    }
  }
}
