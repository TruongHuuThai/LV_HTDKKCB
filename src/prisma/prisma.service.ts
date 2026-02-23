import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
          xAC_THUC_OTP: any;
          dANG_KY: any;
          kHUNG_GIO: any;
  rEFRESH_TOKEN: any;
    aUDIT_LOG: any;
          $transaction(arg0: (tx: any) => Promise<{ N_NGAY: Date; B_TEN: string; BN_MA: number; KG_MA: number; LHK_MA: number | null; BS_MA: number; DK_TRANG_THAI: string | null; DK_STT: number | null; DK_LY_DO_HUY: string | null; DK_THOI_GIAN_TAO: Date | null; DK_MA: number; }>) {
                    throw new Error('Method not implemented.');
          }
  private prismaClient: PrismaClient;
          bAC_SI: any;
          cHUYEN_KHOA: any;
          bENH_NHAN: any;
          tAI_KHOAN: any;
          lICH_BSK: any;

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
