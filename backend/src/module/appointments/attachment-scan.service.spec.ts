import { AttachmentScanService } from './attachment-scan.service';

describe('AttachmentScanService', () => {
  const service = new AttachmentScanService();

  it('flags executable signature as infected', async () => {
    const result = await service.scan({
      fileName: 'report.pdf',
      mimeType: 'application/pdf',
      firstBytes: Buffer.from([0x4d, 0x5a, 0x90, 0x00]),
    });
    expect(result.status).toBe('INFECTED');
  });

  it('accepts safe content as clean', async () => {
    const result = await service.scan({
      fileName: 'image.png',
      mimeType: 'image/png',
      firstBytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    });
    expect(result.status).toBe('CLEAN');
  });
});

