import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUserPayload } from '../auth/current-user.decorator';
import { CreatePatientProfileDto } from './dto/create-patient-profile.dto';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';

const MAX_PATIENT_PROFILES = 10;

type PatientProfileLocation = {
  AK_MA: number;
  AK_TEN: string;
  XA_PHUONG: {
    XP_MA: number;
    XP_TEN: string;
    TINH_TP: {
      TTP_MA: number;
      TTP_TEN: string;
    } | null;
  } | null;
} | null;

type PatientProfileRecord = {
  BN_MA: number;
  TK_SDT: string | null;
  AK_MA: number | null;
  BN_HO_CHU_LOT: string | null;
  BN_TEN: string | null;
  BN_NGAY_SINH: Date | string | null;
  BN_LA_NAM: boolean | null;
  BN_SDT_DANG_KY: string | null;
  BN_EMAIL: string | null;
  BN_CCCD: string | null;
  BN_SO_BHYT: string | null;
  BN_QUOC_GIA: string | null;
  BN_DAN_TOC: string | null;
  BN_SO_DDCN: string | null;
  BN_DIA_CHI: string | null;
  BN_QUAN_HE_VOI_TK: string | null;
  BN_DA_VO_HIEU: boolean | null;
  BN_ANH: string | null;
  BN_MOI: boolean | null;
  location: PatientProfileLocation;
};

function normalizeText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function parseDateOnly(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return new Date(`${trimmed}T00:00:00.000Z`);
}

function fullName(profile: {
  BN_HO_CHU_LOT?: string | null;
  BN_TEN?: string | null;
}) {
  return [profile.BN_HO_CHU_LOT, profile.BN_TEN]
    .map((item) => item?.trim() || '')
    .filter(Boolean)
    .join(' ')
    .trim();
}

function buildLocationLabel(location?: PatientProfileLocation) {
  if (!location) return null;
  return [
    location.AK_TEN,
    location.XA_PHUONG?.XP_TEN,
    location.XA_PHUONG?.TINH_TP?.TTP_TEN,
  ]
    .filter(Boolean)
    .join(', ');
}

function normalizeKeyword(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isImagingService(type?: string | null, name?: string | null) {
  const keyword = `${normalizeKeyword(type)} ${normalizeKeyword(name)}`;
  return ['x-quang', 'x quang', 'ct', 'mri', 'sieu am', 'noi soi', 'imaging'].some(
    (item) => keyword.includes(item),
  );
}

function isLabService(type?: string | null, name?: string | null) {
  if (isImagingService(type, name)) return false;
  const keyword = `${normalizeKeyword(type)} ${normalizeKeyword(name)}`;
  return ['xet nghiem', 'huyet hoc', 'sinh hoa', 'vi sinh', 'nuoc tieu', 'lab'].some(
    (item) => keyword.includes(item),
  );
}

@Injectable()
export class PatientProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  private async getPatientColumnSet() {
    const rows = await this.prisma
      .getClient()
      .$queryRawUnsafe<Array<{ column_name: string }>>(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'BENH_NHAN'`,
      );

    return new Set(rows.map((row) => row.column_name));
  }

  private async hasPatientColumn(columnName: string) {
    return (await this.getPatientColumnSet()).has(columnName);
  }

  private async buildPatientProfileSelect() {
    const columns = await this.getPatientColumnSet();
    const select: Record<string, any> = {
      BN_MA: true,
      TK_SDT: true,
      AK_MA: true,
      BN_HO_CHU_LOT: true,
      BN_TEN: true,
      BN_LA_NAM: true,
      BN_SDT_DANG_KY: true,
      BN_EMAIL: true,
      BN_CCCD: true,
      BN_QUOC_GIA: true,
      BN_DAN_TOC: true,
      BN_SO_DDCN: true,
      BN_ANH: true,
      BN_MOI: true,
      AP_KV: {
        select: {
          AK_MA: true,
          AK_TEN: true,
          XA_PHUONG: {
            select: {
              XP_MA: true,
              XP_TEN: true,
              TINH_TP: {
                select: {
                  TTP_MA: true,
                  TTP_TEN: true,
                },
              },
            },
          },
        },
      },
    };

    if (columns.has('BN_NGAY_SINH')) select.BN_NGAY_SINH = true;
    if (columns.has('BN_SO_BHYT')) select.BN_SO_BHYT = true;
    if (columns.has('BN_DIA_CHI')) select.BN_DIA_CHI = true;
    if (columns.has('BN_QUAN_HE_VOI_TK')) select.BN_QUAN_HE_VOI_TK = true;
    if (columns.has('BN_DA_VO_HIEU')) select.BN_DA_VO_HIEU = true;

    return select;
  }

  private normalizeProfile(profile: Record<string, any>): PatientProfileRecord {
    return {
      BN_MA: profile.BN_MA,
      TK_SDT: profile.TK_SDT ?? null,
      AK_MA: profile.AK_MA ?? null,
      BN_HO_CHU_LOT: profile.BN_HO_CHU_LOT ?? null,
      BN_TEN: profile.BN_TEN ?? null,
      BN_NGAY_SINH: profile.BN_NGAY_SINH ?? null,
      BN_LA_NAM: profile.BN_LA_NAM ?? null,
      BN_SDT_DANG_KY: profile.BN_SDT_DANG_KY ?? null,
      BN_EMAIL: profile.BN_EMAIL ?? null,
      BN_CCCD: profile.BN_CCCD ?? null,
      BN_SO_BHYT: profile.BN_SO_BHYT ?? null,
      BN_QUOC_GIA: profile.BN_QUOC_GIA ?? null,
      BN_DAN_TOC: profile.BN_DAN_TOC ?? null,
      BN_SO_DDCN: profile.BN_SO_DDCN ?? null,
      BN_DIA_CHI: profile.BN_DIA_CHI ?? null,
      BN_QUAN_HE_VOI_TK: profile.BN_QUAN_HE_VOI_TK ?? 'SELF',
      BN_DA_VO_HIEU: profile.BN_DA_VO_HIEU ?? false,
      BN_ANH: profile.BN_ANH ?? null,
      BN_MOI: profile.BN_MOI ?? null,
      location: profile.AP_KV ?? null,
    };
  }

  private parseBirthDateOrThrow(value?: string | null) {
    const date = parseDateOnly(value);
    if (!date) return null;

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (date.getTime() > endOfToday.getTime()) {
      throw new BadRequestException('Ngay sinh khong duoc lon hon ngay hien tai');
    }

    return date;
  }

  private async getAreaOrThrow(AK_MA?: number) {
    if (!AK_MA) return null;

    const rows = await this.prisma
      .getClient()
      .$queryRawUnsafe<
        Array<{
          AK_MA: number;
          AK_TEN: string;
          XP_MA: number | null;
          XP_TEN: string | null;
          TTP_MA: number | null;
          TTP_TEN: string | null;
        }>
      >(
        `SELECT
          ak."AK_MA",
          ak."AK_TEN",
          xp."XP_MA",
          xp."XP_TEN",
          ttp."TTP_MA",
          ttp."TTP_TEN"
        FROM "AP_KV" ak
        LEFT JOIN "XA_PHUONG" xp ON xp."XP_MA" = ak."XP_MA"
        LEFT JOIN "TINH_TP" ttp ON ttp."TTP_MA" = xp."TTP_MA"
        WHERE ak."AK_MA" = $1
        LIMIT 1`,
        AK_MA,
      );

    const row = rows[0];

    if (!row) {
      throw new BadRequestException('Ap/khu vuc duoc chon khong hop le');
    }

    return {
      AK_MA: row.AK_MA,
      AK_TEN: row.AK_TEN,
      XA_PHUONG: row.XP_MA
        ? {
            XP_MA: row.XP_MA,
            XP_TEN: row.XP_TEN || '',
            TINH_TP: row.TTP_MA
              ? {
                  TTP_MA: row.TTP_MA,
                  TTP_TEN: row.TTP_TEN || '',
                }
              : null,
          }
        : null,
    } satisfies NonNullable<PatientProfileLocation>;
  }

  private async buildPatientCreateData(
    user: CurrentUserPayload,
    dto: CreatePatientProfileDto,
  ) {
    const columns = await this.getPatientColumnSet();
    const parsedBirthDate = this.parseBirthDateOrThrow(dto.BN_NGAY_SINH);
    const area = await this.getAreaOrThrow(dto.AK_MA);
    const data: Record<string, any> = {
      TK_SDT: user.TK_SDT,
      BN_HO_CHU_LOT: normalizeText(dto.BN_HO_CHU_LOT),
      BN_TEN: dto.BN_TEN.trim(),
      BN_LA_NAM: dto.BN_LA_NAM ?? null,
      BN_SDT_DANG_KY: normalizeText(dto.BN_SDT_DANG_KY),
      BN_EMAIL: normalizeText(dto.BN_EMAIL),
      BN_CCCD: normalizeText(dto.BN_CCCD),
      BN_QUOC_GIA: normalizeText(dto.BN_QUOC_GIA),
      BN_DAN_TOC: normalizeText(dto.BN_DAN_TOC),
      BN_SO_DDCN: normalizeText(dto.BN_SO_DDCN),
      BN_ANH: normalizeText(dto.BN_ANH),
      BN_MOI: dto.BN_MOI ?? false,
    };

    if (columns.has('AK_MA')) {
      data.AK_MA = area?.AK_MA ?? null;
    }

    if (columns.has('BN_NGAY_SINH')) {
      data.BN_NGAY_SINH = parsedBirthDate;
    }
    if (columns.has('BN_SO_BHYT')) {
      data.BN_SO_BHYT = normalizeText(dto.BN_SO_BHYT);
    }
    if (columns.has('BN_DIA_CHI')) {
      data.BN_DIA_CHI = normalizeText(dto.BN_DIA_CHI) || buildLocationLabel(area);
    }
    if (columns.has('BN_QUAN_HE_VOI_TK')) {
      data.BN_QUAN_HE_VOI_TK = normalizeText(dto.BN_QUAN_HE_VOI_TK) || 'SELF';
    }
    if (columns.has('BN_DA_VO_HIEU')) {
      data.BN_DA_VO_HIEU = false;
    }

    return data;
  }

  private async buildPatientUpdateData(dto: UpdatePatientProfileDto) {
    const columns = await this.getPatientColumnSet();
    const parsedBirthDate =
      dto.BN_NGAY_SINH !== undefined
        ? this.parseBirthDateOrThrow(dto.BN_NGAY_SINH)
        : undefined;
    const area = dto.AK_MA !== undefined ? await this.getAreaOrThrow(dto.AK_MA) : undefined;
    const data: Record<string, any> = {};

    if (columns.has('AK_MA') && dto.AK_MA !== undefined) {
      data.AK_MA = area?.AK_MA ?? null;
    }
    if (dto.BN_HO_CHU_LOT !== undefined) data.BN_HO_CHU_LOT = normalizeText(dto.BN_HO_CHU_LOT);
    if (dto.BN_TEN !== undefined) data.BN_TEN = dto.BN_TEN.trim();
    if (dto.BN_LA_NAM !== undefined) data.BN_LA_NAM = dto.BN_LA_NAM;
    if (dto.BN_SDT_DANG_KY !== undefined) data.BN_SDT_DANG_KY = normalizeText(dto.BN_SDT_DANG_KY);
    if (dto.BN_EMAIL !== undefined) data.BN_EMAIL = normalizeText(dto.BN_EMAIL);
    if (dto.BN_CCCD !== undefined) data.BN_CCCD = normalizeText(dto.BN_CCCD);
    if (dto.BN_QUOC_GIA !== undefined) data.BN_QUOC_GIA = normalizeText(dto.BN_QUOC_GIA);
    if (dto.BN_DAN_TOC !== undefined) data.BN_DAN_TOC = normalizeText(dto.BN_DAN_TOC);
    if (dto.BN_SO_DDCN !== undefined) data.BN_SO_DDCN = normalizeText(dto.BN_SO_DDCN);
    if (dto.BN_MOI !== undefined) data.BN_MOI = dto.BN_MOI;
    if (dto.BN_ANH !== undefined) data.BN_ANH = normalizeText(dto.BN_ANH);

    if (columns.has('BN_NGAY_SINH') && dto.BN_NGAY_SINH !== undefined) {
      data.BN_NGAY_SINH = parsedBirthDate;
    }
    if (columns.has('BN_SO_BHYT') && dto.BN_SO_BHYT !== undefined) {
      data.BN_SO_BHYT = normalizeText(dto.BN_SO_BHYT);
    }
    if (columns.has('BN_DIA_CHI') && (dto.BN_DIA_CHI !== undefined || dto.AK_MA !== undefined)) {
      data.BN_DIA_CHI =
        normalizeText(dto.BN_DIA_CHI) || (dto.AK_MA !== undefined ? buildLocationLabel(area) : undefined);
    }
    if (columns.has('BN_QUAN_HE_VOI_TK') && dto.BN_QUAN_HE_VOI_TK !== undefined) {
      data.BN_QUAN_HE_VOI_TK = normalizeText(dto.BN_QUAN_HE_VOI_TK);
    }

    return data;
  }

  private async insertPatientProfileLegacy(data: Record<string, any>) {
    const entries = Object.entries(data).filter(([, value]) => value !== undefined);
    const columns = entries.map(([key]) => `"${key}"`).join(', ');
    const placeholders = entries.map((_, index) => `$${index + 1}`).join(', ');
    const values = entries.map(([, value]) => value);

    const rows = await this.prisma
      .getClient()
      .$queryRawUnsafe<Array<{ BN_MA: number }>>(
        `INSERT INTO "BENH_NHAN" (${columns}) VALUES (${placeholders}) RETURNING "BN_MA"`,
        ...values,
      );

    return rows[0];
  }

  private async updatePatientProfileLegacy(BN_MA: number, data: Record<string, any>) {
    const entries = Object.entries(data).filter(([, value]) => value !== undefined);
    if (entries.length === 0) return;

    const assignments = entries
      .map(([key], index) => `"${key}" = $${index + 1}`)
      .join(', ');
    const values = entries.map(([, value]) => value);

    await this.prisma
      .getClient()
      .$executeRawUnsafe(
        `UPDATE "BENH_NHAN" SET ${assignments} WHERE "BN_MA" = $${entries.length + 1}`,
        ...values,
        BN_MA,
      );
  }

  private async deletePatientProfileLegacy(BN_MA: number) {
    await this.prisma
      .getClient()
      .$executeRawUnsafe(`DELETE FROM "BENH_NHAN" WHERE "BN_MA" = $1`, BN_MA);
  }

  private async getOwnedProfileOrThrow(user: CurrentUserPayload, BN_MA: number) {
    const select = await this.buildPatientProfileSelect();
    const profile = await this.prisma.bENH_NHAN.findFirst({
      where: {
        BN_MA,
        TK_SDT: user.TK_SDT,
      },
      select: select as any,
    });

    if (!profile) {
      throw new NotFoundException('Khong tim thay ho so benh nhan thuoc tai khoan hien tai');
    }

    return this.normalizeProfile(profile);
  }

  private async getProfileUsageSnapshot(BN_MA: number) {
    const [
      appointmentsCount,
      healthMetricsCount,
      clinicalDocumentCount,
      prescriptionCount,
      invoiceCount,
    ] = await this.prisma.$transaction([
      this.prisma.dANG_KY.count({
        where: { BN_MA },
      }),
      this.prisma.cHI_SO_SUC_KHOE.count({
        where: { BN_MA },
      }),
      this.prisma.pHIEU_CDCLS.count({
        where: {
          PHIEU_KHAM_BENH: {
            is: {
              DANG_KY: {
                is: {
                  BN_MA,
                },
              },
            },
          },
        },
      }),
      this.prisma.dON_THUOC.count({
        where: {
          PHIEU_KHAM_BENH: {
            is: {
              DANG_KY: {
                is: {
                  BN_MA,
                },
              },
            },
          },
        },
      }),
      this.prisma.tHANH_TOAN.count({
        where: {
          OR: [
            {
              DANG_KY: {
                is: {
                  BN_MA,
                },
              },
            },
            {
              PHIEU_KHAM_BENH: {
                is: {
                  DANG_KY: {
                    is: {
                      BN_MA,
                    },
                  },
                },
              },
            },
          ],
        },
      }),
    ]);

    return {
      appointmentsCount,
      healthMetricsCount,
      clinicalDocumentCount,
      prescriptionCount,
      invoiceCount,
      hasRelatedData:
        appointmentsCount +
          healthMetricsCount +
          clinicalDocumentCount +
          prescriptionCount +
          invoiceCount >
        0,
    };
  }

  private async mapProfileCard(profile: PatientProfileRecord) {
    const usage = await this.getProfileUsageSnapshot(profile.BN_MA);
    return {
      ...profile,
      fullName: fullName(profile),
      canBook: profile.BN_DA_VO_HIEU !== true,
      locationLabel: buildLocationLabel(profile.location) || profile.BN_DIA_CHI || null,
      relationshipLabel: profile.BN_QUAN_HE_VOI_TK || 'Khac',
      usage,
    };
  }

  async getLocationOptions() {
    const rows = await this.prisma
      .getClient()
      .$queryRawUnsafe<
        Array<{
          TTP_MA: number;
          TTP_TEN: string;
          XP_MA: number | null;
          XP_TEN: string | null;
          AK_MA: number | null;
          AK_TEN: string | null;
        }>
      >(
        `SELECT
          ttp."TTP_MA",
          ttp."TTP_TEN",
          xp."XP_MA",
          xp."XP_TEN",
          ak."AK_MA",
          ak."AK_TEN"
        FROM "TINH_TP" ttp
        LEFT JOIN "XA_PHUONG" xp ON xp."TTP_MA" = ttp."TTP_MA"
        LEFT JOIN "AP_KV" ak ON ak."XP_MA" = xp."XP_MA"
        ORDER BY ttp."TTP_TEN" ASC, xp."XP_TEN" ASC, ak."AK_TEN" ASC`,
      );

    const provinces = rows.reduce<Array<any>>((acc, row) => {
      let province = acc.find((item) => item.TTP_MA === row.TTP_MA);
      if (!province) {
        province = {
          TTP_MA: row.TTP_MA,
          TTP_TEN: row.TTP_TEN,
          XA_PHUONG: [],
        };
        acc.push(province);
      }

      if (!row.XP_MA) {
        return acc;
      }

      let ward = province.XA_PHUONG.find((item: any) => item.XP_MA === row.XP_MA);
      if (!ward) {
        ward = {
          XP_MA: row.XP_MA,
          XP_TEN: row.XP_TEN || '',
          AP_KV: [],
        };
        province.XA_PHUONG.push(ward);
      }

      if (row.AK_MA) {
        ward.AP_KV.push({
          AK_MA: row.AK_MA,
          AK_TEN: row.AK_TEN || '',
        });
      }

      return acc;
    }, []);

    return {
      provinces,
    };
  }

  async listMine(user: CurrentUserPayload) {
    const select = await this.buildPatientProfileSelect();
    const hasDisableColumn = await this.hasPatientColumn('BN_DA_VO_HIEU');
    const orderBy = hasDisableColumn
      ? ([{ BN_DA_VO_HIEU: 'asc' }, { BN_MA: 'asc' }] as any)
      : ([{ BN_MA: 'asc' }] as any);

    const [profiles, total] = await this.prisma.$transaction([
      this.prisma.bENH_NHAN.findMany({
        where: { TK_SDT: user.TK_SDT },
        orderBy,
        select: select as any,
      }),
      this.prisma.bENH_NHAN.count({
        where: { TK_SDT: user.TK_SDT },
      }),
    ]);

    const items = await Promise.all(
      profiles.map((profile) => this.mapProfileCard(this.normalizeProfile(profile))),
    );

    return {
      items,
      meta: {
        total,
        active: items.filter((item) => item.BN_DA_VO_HIEU !== true).length,
        disabled: hasDisableColumn
          ? items.filter((item) => item.BN_DA_VO_HIEU === true).length
          : 0,
        limit: MAX_PATIENT_PROFILES,
        remainingSlots: Math.max(0, MAX_PATIENT_PROFILES - total),
        accountPhone: user.TK_SDT,
      },
    };
  }

  async create(user: CurrentUserPayload, dto: CreatePatientProfileDto) {
    const totalManaged = await this.prisma.bENH_NHAN.count({
      where: { TK_SDT: user.TK_SDT },
    });

    if (totalManaged >= MAX_PATIENT_PROFILES) {
      throw new ConflictException(
        'Tai khoan da dat gioi han 10 ho so benh nhan. Vui long quan ly cac ho so hien co.',
      );
    }

    const createData = await this.buildPatientCreateData(user, dto);
    const hasDisableColumn = await this.hasPatientColumn('BN_DA_VO_HIEU');

    const profile = hasDisableColumn
      ? await this.prisma.bENH_NHAN.create({
          data: createData as any,
          select: { BN_MA: true },
        })
      : await this.insertPatientProfileLegacy(createData);

    return this.getDetail(user, profile.BN_MA);
  }

  async getDetail(user: CurrentUserPayload, BN_MA: number) {
    const profile = await this.getOwnedProfileOrThrow(user, BN_MA);
    const usage = await this.getProfileUsageSnapshot(BN_MA);

    return {
      profile: {
        ...profile,
        fullName: fullName(profile),
        canBook: profile.BN_DA_VO_HIEU !== true,
        locationLabel: buildLocationLabel(profile.location) || profile.BN_DIA_CHI || null,
      },
      summary: usage,
    };
  }

  async update(user: CurrentUserPayload, BN_MA: number, dto: UpdatePatientProfileDto) {
    await this.getOwnedProfileOrThrow(user, BN_MA);

    const updateData = await this.buildPatientUpdateData(dto);
    const hasDisableColumn = await this.hasPatientColumn('BN_DA_VO_HIEU');

    if (hasDisableColumn) {
      await this.prisma.bENH_NHAN.update({
        where: { BN_MA },
        data: updateData as any,
      });
    } else {
      await this.updatePatientProfileLegacy(BN_MA, updateData);
    }

    return this.getDetail(user, BN_MA);
  }

  async remove(user: CurrentUserPayload, BN_MA: number) {
    const profile = await this.getOwnedProfileOrThrow(user, BN_MA);
    const usage = await this.getProfileUsageSnapshot(BN_MA);
    const hasDisableColumn = await this.hasPatientColumn('BN_DA_VO_HIEU');

    if (usage.hasRelatedData) {
      if (!hasDisableColumn) {
        throw new ConflictException(
          'Ho so nay da co du lieu lien quan va CSDL hien tai chua ho tro vo hieu hoa an toan. Vui long cap nhat cau truc CSDL truoc khi xoa.',
        );
      }

      await this.prisma.bENH_NHAN.update({
        where: { BN_MA },
        data: { BN_DA_VO_HIEU: true } as any,
      });

      return {
        action: 'disabled',
        message:
          'Ho so da co lich su kham hoac thanh toan lien quan, he thong da chuyen ho so sang trang thai vo hieu hoa de bao toan du lieu.',
        profileId: BN_MA,
      };
    }

    if (hasDisableColumn) {
      await this.prisma.bENH_NHAN.delete({
        where: { BN_MA },
      });
    } else {
      await this.deletePatientProfileLegacy(BN_MA);
    }

    return {
      action: 'deleted',
      message: `Da xoa ho so ${fullName(profile) || `#${BN_MA}`}`,
      profileId: BN_MA,
    };
  }

  async getAppointments(user: CurrentUserPayload, BN_MA: number) {
    await this.getOwnedProfileOrThrow(user, BN_MA);

    const items = await this.prisma.dANG_KY.findMany({
      where: { BN_MA },
      orderBy: [{ N_NGAY: 'desc' }, { KG_MA: 'desc' }],
      include: {
        KHUNG_GIO: true,
        LOAI_HINH_KHAM: true,
        LICH_BSK: {
          include: {
            BAC_SI: {
              include: {
                CHUYEN_KHOA: true,
              },
            },
            PHONG: true,
            BUOI: true,
          },
        },
        PHIEU_KHAM_BENH: true,
        THANH_TOAN: {
          orderBy: { TT_THOI_GIAN: 'desc' },
          take: 1,
        },
      },
    });

    return {
      items: items.map((item) => ({
        ...item,
        doctorName: item.LICH_BSK?.BAC_SI?.BS_HO_TEN || null,
        specialtyName: item.LICH_BSK?.BAC_SI?.CHUYEN_KHOA?.CK_TEN || null,
        roomName: item.LICH_BSK?.PHONG?.P_TEN || null,
      })),
    };
  }

  async getHealthMetrics(user: CurrentUserPayload, BN_MA: number) {
    await this.getOwnedProfileOrThrow(user, BN_MA);

    const items = await this.prisma.cHI_SO_SUC_KHOE.findMany({
      where: { BN_MA },
      orderBy: { CSSK_NGAY_DO: 'desc' },
    });

    return { items };
  }

  private async getClinicalDocuments(user: CurrentUserPayload, BN_MA: number) {
    await this.getOwnedProfileOrThrow(user, BN_MA);

    const documents = await this.prisma.pHIEU_CDCLS.findMany({
      where: {
        PHIEU_KHAM_BENH: {
          is: {
            DANG_KY: {
              is: {
                BN_MA,
              },
            },
          },
        },
      },
      orderBy: { PCD_GIO_IN: 'desc' },
      include: {
        PHIEU_KHAM_BENH: {
          include: {
            DANG_KY: {
              include: {
                KHUNG_GIO: true,
                LICH_BSK: {
                  include: {
                    BAC_SI: {
                      include: {
                        CHUYEN_KHOA: true,
                      },
                    },
                    PHONG: true,
                  },
                },
              },
            },
          },
        },
        THUCHIEN: {
          include: {
            DICHVU: true,
            KET_QUA_CAN_LAM_SAN: true,
          },
        },
      },
    });

    return documents.flatMap((document) =>
      document.THUCHIEN.map((execution) => ({
        documentId: document.PCD_MA,
        createdAt: document.PCD_GIO_IN,
        service: execution.DICHVU,
        result: execution.KET_QUA_CAN_LAM_SAN,
        appointment: document.PHIEU_KHAM_BENH?.DANG_KY || null,
        doctorName:
          document.PHIEU_KHAM_BENH?.DANG_KY?.LICH_BSK?.BAC_SI?.BS_HO_TEN || null,
        specialtyName:
          document.PHIEU_KHAM_BENH?.DANG_KY?.LICH_BSK?.BAC_SI?.CHUYEN_KHOA?.CK_TEN ||
          null,
      })),
    );
  }

  async getLabResults(user: CurrentUserPayload, BN_MA: number) {
    const items = await this.getClinicalDocuments(user, BN_MA);
    return {
      items: items.filter((item) =>
        isLabService(item.service?.DVCLS_LOAI, item.service?.DVCLS_TEN),
      ),
    };
  }

  async getImagingResults(user: CurrentUserPayload, BN_MA: number) {
    const items = await this.getClinicalDocuments(user, BN_MA);
    return {
      items: items.filter((item) =>
        isImagingService(item.service?.DVCLS_LOAI, item.service?.DVCLS_TEN),
      ),
    };
  }

  async getPrescriptions(user: CurrentUserPayload, BN_MA: number) {
    await this.getOwnedProfileOrThrow(user, BN_MA);

    const items = await this.prisma.dON_THUOC.findMany({
      where: {
        PHIEU_KHAM_BENH: {
          is: {
            DANG_KY: {
              is: {
                BN_MA,
              },
            },
          },
        },
      },
      orderBy: { DT_NGAY_TAO: 'desc' },
      include: {
        PHIEU_KHAM_BENH: {
          include: {
            DANG_KY: {
              include: {
                LICH_BSK: {
                  include: {
                    BAC_SI: true,
                  },
                },
              },
            },
          },
        },
        CHI_TIET_DON_THUOC: {
          include: {
            THUOC: {
              include: {
                BIET_DUOC: true,
                DON_VI_TINH: true,
              },
            },
          },
        },
      },
    });

    return { items };
  }

  async getInvoices(user: CurrentUserPayload, BN_MA: number) {
    await this.getOwnedProfileOrThrow(user, BN_MA);

    const items = await this.prisma.tHANH_TOAN.findMany({
      where: {
        OR: [
          {
            DANG_KY: {
              is: {
                BN_MA,
              },
            },
          },
          {
            PHIEU_KHAM_BENH: {
              is: {
                DANG_KY: {
                  is: {
                    BN_MA,
                  },
                },
              },
            },
          },
        ],
      },
      orderBy: { TT_THOI_GIAN: 'desc' },
      include: {
        DANG_KY: {
          include: {
            KHUNG_GIO: true,
            LOAI_HINH_KHAM: true,
            LICH_BSK: {
              include: {
                BAC_SI: {
                  include: {
                    CHUYEN_KHOA: true,
                  },
                },
                PHONG: true,
              },
            },
          },
        },
        PHIEU_KHAM_BENH: true,
      },
    });

    return { items };
  }
}
