import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Product } from './database.types';

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // ==================== Products ====================
  async saveProduct(product: Product): Promise<void> {
    //    const parsed = {
    //	...product,
    //	externalId: Number(product.externalId),
    //	flag: product.flag === '' ? false : true,
    //    };
    await this.product.upsert({
      where: { externalId: product.externalId },
      create: product,
      update: product,
    });
  }

  async clearSheetProducts(sheetName: string): Promise<void> {
    await this.product.deleteMany({
      where: { sheetName },
    });
  }
}
