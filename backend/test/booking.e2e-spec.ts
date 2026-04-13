jest.mock('../src/module/auth/jwt-auth.guard', () => ({
  JwtAuthGuard: class MockJwtAuthGuard {
    canActivate() {
      return true;
    }
  },
}));

jest.mock('../src/module/auth/roles.guard', () => ({
  RolesGuard: class MockRolesGuard {
    canActivate() {
      return true;
    }
  },
}));

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { BookingController } from '../src/module/booking/booking.controller';
import { BookingService } from '../src/module/booking/booking.service';
import { SCHEDULE_STATUS_CONTRACT_VERSION } from '../src/module/schedules/schedule-status';
import { BOOKING_AVAILABILITY_REASON } from '../src/module/booking/booking-availability.contract';

describe('BookingController (e2e)', () => {
  let app: INestApplication<App>;
  const bookingService = {
    getAvailableDoctors: jest.fn(),
    getDoctorCatalog: jest.fn(),
    getAvailabilityDebug: jest.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [BookingController],
      providers: [
        {
          provide: BookingService,
          useValue: bookingService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  it('GET /booking/doctors parses specialtyId number', async () => {
    bookingService.getAvailableDoctors.mockResolvedValueOnce([]);

    await request(app.getHttpServer())
      .get('/booking/doctors?date=2026-04-09&specialtyId=21')
      .expect(200);

    expect(bookingService.getAvailableDoctors).toHaveBeenCalledWith(
      '2026-04-09',
      21,
      undefined,
    );
  });

  it('GET /booking/debug-availability returns reason summary contract', async () => {
    bookingService.getAvailabilityDebug.mockResolvedValueOnce({
      contractVersion: SCHEDULE_STATUS_CONTRACT_VERSION,
      input: { date: '2026-04-09', specialtyId: 21 },
      summary: {
        candidateDoctors: 0,
        availableDoctors: 0,
        reasonCounts: [{ reason: BOOKING_AVAILABILITY_REASON.NO_SHIFT_ON_DATE, count: 1 }],
        reasons: [BOOKING_AVAILABILITY_REASON.NO_SHIFT_ON_DATE],
      },
      doctors: [],
    });

    const res = await request(app.getHttpServer())
      .get('/booking/debug-availability?date=2026-04-09&specialtyId=21')
      .expect(200);

    expect(bookingService.getAvailabilityDebug).toHaveBeenCalledWith(
      '2026-04-09',
      21,
      undefined,
    );
    expect(res.body.summary.reasons).toEqual([BOOKING_AVAILABILITY_REASON.NO_SHIFT_ON_DATE]);
    expect(res.body.contractVersion).toBe(SCHEDULE_STATUS_CONTRACT_VERSION);
  });

  it('GET /booking/doctor-catalog parses paging and filter params', async () => {
    bookingService.getDoctorCatalog.mockResolvedValueOnce({
      items: [],
      page: 2,
      pageSize: 8,
      total: 0,
      totalPages: 1,
      filters: { specialties: [], degrees: [], genderSupported: false },
    });

    await request(app.getHttpServer())
      .get(
        '/booking/doctor-catalog?q=an&specialtyId=21&degree=TS%20BS.&gender=male&sortBy=name&sortDirection=desc&page=2&pageSize=8',
      )
      .expect(200);

    expect(bookingService.getDoctorCatalog).toHaveBeenCalledWith({
      q: 'an',
      specialtyId: 21,
      degree: 'TS BS.',
      gender: 'male',
      sortBy: 'name',
      sortDirection: 'desc',
      page: 2,
      pageSize: 8,
    });
  });
});
