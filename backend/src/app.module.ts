import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './module/auth/auth.module';
import { UsersModule } from './module/users/users.module';
import { SchedulesModule } from './module/schedules/schedules.module';
import { BookingModule } from './module/booking/booking.module';
import { PaymentModule } from './module/payment/payment.module';
import { AdminModule } from './module/admin/admin.module';
import { PatientProfilesModule } from './module/patient-profiles/patient-profiles.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';



@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60, limit: 30 }] as any),
    PrismaModule,
    AuthModule,
    UsersModule,
    SchedulesModule,
    BookingModule,
    PaymentModule,
    AdminModule,
    PatientProfilesModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule { }
