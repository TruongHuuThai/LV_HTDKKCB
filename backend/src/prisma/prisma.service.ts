import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  // Expose all model delegates so Repository classes can call this.prisma.xAC_THUC_OTP etc.
  get xAC_THUC_OTP() { return this.prismaClient.xAC_THUC_OTP; }
  get dANG_KY() { return this.prismaClient.dANG_KY; }
  get kHUNG_GIO() { return this.prismaClient.kHUNG_GIO; }
  get rEFRESH_TOKEN() { return this.prismaClient.rEFRESH_TOKEN; }
  get aUDIT_LOG() { return this.prismaClient.aUDIT_LOG; }
  get tHANH_TOAN() { return this.prismaClient.tHANH_TOAN; }
  get bAC_SI() { return this.prismaClient.bAC_SI; }
  get cHUYEN_KHOA() { return this.prismaClient.cHUYEN_KHOA; }
  get bENH_NHAN() { return this.prismaClient.bENH_NHAN; }
  get tAI_KHOAN() { return this.prismaClient.tAI_KHOAN; }
  get lICH_BSK() { return this.prismaClient.lICH_BSK; }
  get lOAI_HINH_KHAM() { return this.prismaClient.lOAI_HINH_KHAM; }
  get $transaction() { return this.prismaClient.$transaction.bind(this.prismaClient); }

  private prismaClient: PrismaClient;
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined in environment variables');
    }
    this.pool = new Pool({ connectionString });
    const adapter = new PrismaPg(this.pool);
    this.prismaClient = new PrismaClient({ adapter } as any);
  }

  async onModuleInit() {
    await (this.prismaClient as any).$connect();
  }

  async onModuleDestroy() {
    await (this.prismaClient as any).$disconnect();
    await this.pool.end();
  }

  getClient() {
    return this.prismaClient;
  }
}
