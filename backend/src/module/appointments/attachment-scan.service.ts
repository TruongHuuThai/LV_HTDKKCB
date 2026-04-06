import { Injectable } from '@nestjs/common';

@Injectable()
export class AttachmentScanService {
  async scan(input: {
    fileName: string;
    mimeType: string;
    firstBytes: Buffer;
  }): Promise<{ status: 'CLEAN' | 'INFECTED' | 'SCAN_FAILED'; reason?: string }> {
    try {
      const lower = input.fileName.toLowerCase();
      if (lower.endsWith('.exe') || lower.endsWith('.bat') || lower.endsWith('.cmd')) {
        return { status: 'INFECTED', reason: 'dangerous_extension' };
      }

      // Basic magic-byte check to block executable payloads renamed to safe extension.
      if (input.firstBytes.length >= 2 && input.firstBytes[0] === 0x4d && input.firstBytes[1] === 0x5a) {
        return { status: 'INFECTED', reason: 'executable_signature' };
      }

      return { status: 'CLEAN' };
    } catch {
      return { status: 'SCAN_FAILED', reason: 'scan_exception' };
    }
  }
}

