import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(input: {
    table: string;
    action: string;
    pk?: any;
    old?: any;
    new?: any;
    by?: string;
  }) {
    return this.prisma.aUDIT_LOG.create({
      data: {
        AL_TABLE: input.table,
        AL_ACTION: input.action,
        AL_PK: input.pk ?? null,
        AL_OLD: input.old ?? null,
        AL_NEW: input.new ?? null,
        AL_CHANGED_BY: input.by ?? null,
      },
    });
  }
}