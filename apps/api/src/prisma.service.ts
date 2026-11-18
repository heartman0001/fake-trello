import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    console.log('✅ Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }
    
    const models = Reflect.ownKeys(this).filter(
      (key) =>
        key !== 'constructor' && typeof (this as any)[key] === 'object'
    ) as string[];

    return Promise.all(
      models.map((modelKey) => {
        const model = (this as any)[modelKey];
        return model.deleteMany();
      })
    );
  }
}
