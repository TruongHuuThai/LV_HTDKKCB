import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private prismaClient: PrismaClient;
          bAC_SI: any;
          cHUYEN_KHOA: any;
          bENH_NHAN: any;

  constructor() {
    const adapter = new PrismaPg({
      url: process.env.DATABASE_URL,
    });
    
    this.prismaClient = new PrismaClient({ adapter });
  }

  async onModuleInit() {
    await this.prismaClient.$connect();
  }

  async onModuleDestroy() {
    await this.prismaClient.$disconnect();
  }

  getClient() {
    return this.prismaClient;
  }
}
