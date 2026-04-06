import { ConfigService } from '@nestjs/config';
import { AttachmentStorageService } from './attachment-storage.service';

describe('AttachmentStorageService', () => {
  it('creates and verifies signed token', () => {
    const config = {
      get: (key: string, fallback?: string) => {
        if (key === 'ATTACHMENT_SIGN_SECRET') return 'test-secret';
        if (key === 'ATTACHMENT_STORAGE_DIR') return 'tmp';
        return fallback;
      },
    } as unknown as ConfigService;

    const service = new AttachmentStorageService(config);
    const expiresAt = Date.now() + 60_000;
    const token = service.buildSignedToken({ attachmentId: 10, expiresAt });
    const verified = service.verifySignedToken(token);
    expect(verified.valid).toBe(true);
    if (!verified.valid) return;
    expect(verified.attachmentId).toBe(10);
  });
});

