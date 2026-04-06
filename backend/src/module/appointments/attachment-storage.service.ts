import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

@Injectable()
export class AttachmentStorageService {
  private readonly baseDir: string;
  private readonly signSecret: string;

  constructor(private readonly config: ConfigService) {
    this.baseDir = this.config.get<string>('ATTACHMENT_STORAGE_DIR', path.resolve(process.cwd(), 'uploads'));
    this.signSecret = this.config.get<string>('ATTACHMENT_SIGN_SECRET', 'attachment-secret');
  }

  async savePreVisitFile(input: {
    appointmentId: number;
    fileName: string;
    ext: string;
    base64Content: string;
  }) {
    const safeExt = input.ext.toLowerCase().replace(/[^a-z0-9]/g, '');
    const key = `pre-visit/${input.appointmentId}/${Date.now()}-${randomUUID()}.${safeExt}`;
    const fullPath = path.join(this.baseDir, key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    const content = Buffer.from(input.base64Content, 'base64');
    await fs.writeFile(fullPath, content);
    return { storageKey: key, filePath: fullPath };
  }

  async softDelete(storageKey?: string | null) {
    if (!storageKey) return;
    const fullPath = path.join(this.baseDir, storageKey);
    try {
      await fs.access(fullPath);
      const revokedPath = `${fullPath}.revoked`;
      await fs.rename(fullPath, revokedPath);
    } catch {
      return;
    }
  }

  buildSignedToken(payload: { attachmentId: number; expiresAt: number }) {
    const raw = `${payload.attachmentId}.${payload.expiresAt}`;
    const signature = createHmac('sha256', this.signSecret).update(raw).digest('hex');
    return Buffer.from(`${raw}.${signature}`, 'utf8').toString('base64url');
  }

  verifySignedToken(token: string) {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const [attachmentIdRaw, expiresRaw, signature] = decoded.split('.');
      if (!attachmentIdRaw || !expiresRaw || !signature) return { valid: false };
      const raw = `${attachmentIdRaw}.${expiresRaw}`;
      const expected = createHmac('sha256', this.signSecret).update(raw).digest('hex');
      if (expected !== signature) return { valid: false };
      const attachmentId = Number.parseInt(attachmentIdRaw, 10);
      const expiresAt = Number.parseInt(expiresRaw, 10);
      if (!Number.isFinite(attachmentId) || !Number.isFinite(expiresAt)) return { valid: false };
      if (Date.now() > expiresAt) return { valid: false };
      return { valid: true, attachmentId, expiresAt };
    } catch {
      return { valid: false };
    }
  }

  resolveFilePath(storageKey: string) {
    return path.join(this.baseDir, storageKey);
  }
}

