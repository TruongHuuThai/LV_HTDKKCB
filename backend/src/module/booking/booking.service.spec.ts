import { BadRequestException } from '@nestjs/common';
import { BookingService } from './booking.service';

describe('BookingService debug availability', () => {
  const repo = {
    debugAvailability: jest.fn(),
  } as any;
  const vnpay = {} as any;
  const paymentRepo = {} as any;

  const service = new BookingService(repo, vnpay, paymentRepo);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws for invalid date input', async () => {
    await expect(service.getAvailabilityDebug('')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('delegates to repository with parsed date', async () => {
    repo.debugAvailability.mockResolvedValueOnce({ ok: true });
    await expect(
      service.getAvailabilityDebug('2026-05-11', 21),
    ).resolves.toEqual({ ok: true });
    expect(repo.debugAvailability).toHaveBeenCalledTimes(1);
  });
});
