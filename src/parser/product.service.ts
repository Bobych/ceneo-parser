import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import { ProductDto } from './dto/product.dto';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: DatabaseService) {}

  async saveProduct(product: ProductDto): Promise<void> {
    console.log('\n\nSAVING:\n', JSON.stringify(product), '\n\n');

    try {
      const pr = product.externalId
        ? await this.prisma.product.findUnique({
            where: {
              externalId: product.externalId,
            },
          })
        : null;
      if (pr) {
        await this.prisma.product.update({
          where: { externalId: product.externalId },
          data: {
            name: product.name,
            price: product.price,
            url: product.url,
            flag: product.flag,
            sheetName: product.sheetName,
          },
        });
      } else {
        await this.prisma.product.create({
          data: {
            externalId: product.externalId,
            name: product.name,
            price: product.price,
            url: product.url,
            flag: product.flag,
            sheetName: product.sheetName,
          },
        });
      }
    } catch (e) {
      console.error('FULL ERROR: ', e, JSON.stringify(e, null, 2));
    }
  }

  async removeSheetName(sheetName: string): Promise<void> {
    const prefix = sheetName.split('_').slice(0, 2).join('_') + '_';
    console.log('\n\nREMOVING:\n', sheetName, '\n\nPREFIX: ', prefix, '\n\n');
    try {
      await this.prisma.product.deleteMany({
        where: {
          sheetName: {
            startsWith: prefix,
          },
        },
      });
    } catch (e) {
      console.error('FULL ERROR BY REMOVING: ', e, JSON.stringify(e, null, 2));
    }
  }
}
