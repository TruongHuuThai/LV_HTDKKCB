import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrentUserPayload } from '../auth/current-user.decorator';
import { AiAssistantRepository } from './ai-assistant.repository';
import { AiAssistantChatDto } from './dto/chat.dto';
import { CLINIC_PROFILE } from './knowledge/clinic.profile';
import { AI_FAQ_SEED } from './knowledge/faq.seed';
import { INTENT, routeIntent, type IntentCode, type ExtractedEntities } from './intent-router';

type KnowledgeHit = {
  title: string;
  content: string;
  category: string;
  source: string;
  similarity: number;
};

const DATA_ACCESS_POLICY = {
  mode: 'READ_ONLY',
  allowedDomains: [
    'BAC_SI',
    'CHUYEN_KHOA',
    'LOAI_HINH_KHAM',
    'LICH_BSK',
    'KHUNG_GIO',
    'DANG_KY',
    'THANH_TOAN',
    'BENH_NHAN (chi ho so thuoc user dang dang nhap)',
  ],
  maskedColumns: [
    'BN_CCCD',
    'BN_SO_BHYT',
    'BN_SDT_DANG_KY',
    'BN_EMAIL',
    'BN_DIA_CHI',
    'DK_GHI_CHU_TIEN_KHAM',
    'AL_OLD',
    'AL_NEW',
  ],
} as const;

// ─── Câu hỏi lại khi thiếu tham số ──────────────────────────────────────────

const CLARIFICATION_MESSAGES: Record<string, { vi: string; en: string }> = {
  date: {
    vi: 'Bạn muốn xem lịch vào ngày nào? Vui lòng cho tôi biết ngày cụ thể (ví dụ: ngày mai, 20/04/2025).',
    en: 'Which date would you like to check? Please provide a specific date (e.g. tomorrow, 2025-04-20).',
  },
  doctorId: {
    vi: 'Bạn muốn tìm bác sĩ nào? Vui lòng cung cấp tên bác sĩ hoặc chuyên khoa.',
    en: 'Which doctor are you looking for? Please provide a doctor name or specialty.',
  },
  appointmentId: {
    vi: 'Bạn muốn tra cứu lịch hẹn nào? Vui lòng cung cấp mã đăng ký (ví dụ: "đăng ký 123").',
    en: 'Which appointment would you like to check? Please provide your booking ID (e.g. "booking 123").',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function detectLocale(rawMessage: string, requestedLocale?: 'vi' | 'en') {
  const normalized = normalizeText(rawMessage);
  const englishSignals = [
    'appointment', 'doctor', 'schedule', 'payment', 'insurance',
    'clinic', 'cancel', 'reschedule', 'hello', 'please',
  ];
  const vietnameseSignals = [
    'toi', 'bac si', 'lich', 'kham', 'thanh toan', 'bao hiem',
    'huy', 'doi lich', 'xin chao', 'vui long', 'ngay mai', 'hom nay',
  ];
  const englishScore = englishSignals.filter((item) => normalized.includes(item)).length;
  const vietnameseScore = vietnameseSignals.filter((item) => normalized.includes(item)).length;

  if (englishScore > vietnameseScore) return 'en';
  if (vietnameseScore > englishScore) return 'vi';
  if (requestedLocale === 'vi' || requestedLocale === 'en') return requestedLocale;
  return 'vi';
}

function tokenize(raw: string) {
  return normalizeText(raw)
    .split(/[^a-z0-9]+/g)
    .filter((item) => item.length >= 2);
}

function toVectorLiteral(input: number[]) {
  return `[${input.join(',')}]`;
}

function sanitizeAssistantAnswer(raw: string) {
  let output = String(raw || '');

  const blockedPatterns = [
    /Để biết thêm thông tin chi tiết,\s*bạn nên liên hệ trực tiếp với bệnh viện qua số hotline 0867504590\.?/giu,
    /De biet them thong tin chi tiet,\s*ban nen lien he truc tiep voi benh vien qua so hotline 0867504590\.?/giu,
  ];

  for (const pattern of blockedPatterns) {
    output = output.replace(pattern, '');
  }

  output = output
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  return output;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly repo: AiAssistantRepository,
  ) {}

  // ── Clinic profile ────────────────────────────────────────────────────────

  private getClinicProfile() {
    return {
      name: this.config.get<string>('AI_CLINIC_NAME') || CLINIC_PROFILE.name,
      address: this.config.get<string>('AI_CLINIC_ADDRESS') || CLINIC_PROFILE.address,
      hotline: this.config.get<string>('AI_CLINIC_HOTLINE') || CLINIC_PROFILE.hotline,
      workingHours: {
        morning:
          this.config.get<string>('AI_CLINIC_WORKING_HOURS_MORNING') ||
          CLINIC_PROFILE.workingHours.morning,
        afternoon:
          this.config.get<string>('AI_CLINIC_WORKING_HOURS_AFTERNOON') ||
          CLINIC_PROFILE.workingHours.afternoon,
      },
      cancellationPolicyHours: Number.parseInt(
        this.config.get<string>(
          'AI_CLINIC_CANCEL_BEFORE_HOURS',
          String(CLINIC_PROFILE.cancellationPolicyHours),
        ),
        10,
      ),
      paymentMethods:
        this.config
          .get<string>('AI_CLINIC_PAYMENT_METHODS', CLINIC_PROFILE.paymentMethods.join(','))
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean) || CLINIC_PROFILE.paymentMethods,
    };
  }

  // ── Embedding & RAG ───────────────────────────────────────────────────────

  private async createEmbedding(input: string) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) return null;

    const model = this.config.get<string>('OPENAI_EMBED_MODEL', 'text-embedding-3-small');
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input }),
    });

    if (!response.ok) {
      const errText = await response.text();
      this.logger.warn(`Embedding API failed: ${response.status} ${errText}`);
      return null;
    }

    const payload = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const embedding = payload.data?.[0]?.embedding;
    return Array.isArray(embedding) && embedding.length > 0 ? embedding : null;
  }

  private async searchKnowledgeFromSupabase(question: string, locale: 'vi' | 'en') {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const supabaseKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) return [];

    const embedding = await this.createEmbedding(question);
    if (!embedding) return [];

    const rpcName = this.config.get<string>('SUPABASE_VECTOR_RPC_NAME', 'match_ai_knowledge');
    const minSimilarity = Number.parseFloat(
      this.config.get<string>('SUPABASE_VECTOR_MIN_SIMILARITY', '0.68'),
    );
    const matchCount = Number.parseInt(
      this.config.get<string>('SUPABASE_VECTOR_MATCH_COUNT', '4'),
      10,
    );

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpcName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        query_embedding: toVectorLiteral(embedding),
        match_count: Number.isFinite(matchCount) ? matchCount : 4,
        min_similarity: Number.isFinite(minSimilarity) ? minSimilarity : 0.68,
        language_filter: locale,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      this.logger.warn(`Supabase RAG RPC failed: ${response.status} ${errText}`);
      return [];
    }

    const rows = (await response.json()) as Array<Record<string, unknown>>;
    return (rows || [])
      .map((item) => ({
        title: String(item.title || 'Knowledge'),
        content: String(item.content || ''),
        category: String(item.category || 'general'),
        source: String(item.source || 'SUPABASE_VECTOR'),
        similarity: Number(item.similarity || 0),
      }))
      .filter((item) => item.content.trim().length > 0);
  }

  private searchKnowledgeFromSeed(question: string, locale: 'vi' | 'en') {
    const questionTokens = new Set(tokenize(question));
    const ranked = AI_FAQ_SEED.map((item) => {
      if (item.language !== 'both' && item.language !== locale) {
        return { item, score: -1 };
      }
      const tokenPool = tokenize(`${item.title} ${item.content} ${item.tags.join(' ')}`);
      const overlap = tokenPool.reduce(
        (sum, token) => (questionTokens.has(token) ? sum + 1 : sum),
        0,
      );
      const score = tokenPool.length === 0 ? 0 : overlap / tokenPool.length;
      return { item, score };
    })
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((entry) => ({
        title: entry.item.title,
        content: entry.item.content,
        category: entry.item.category,
        source: entry.item.source,
        similarity: entry.score,
      }));

    return ranked;
  }

  private async retrieveKnowledge(question: string, locale: 'vi' | 'en', intent: IntentCode) {
    // Các intent đã có realtime DB data – skip Supabase vector search để tiết kiệm thời gian
    const DB_INTENTS: IntentCode[] = [
      INTENT.MY_APPOINTMENTS,
      INTENT.PAYMENT_STATUS,
      INTENT.DOCTOR_SLOTS,
      INTENT.SPECIALTY_INFO,
      INTENT.DOCTOR_CATALOG,
      INTENT.CANCEL_POLICY,
    ];
    if (DB_INTENTS.includes(intent)) {
      return this.searchKnowledgeFromSeed(question, locale);
    }
    try {
      const vectorResults = await this.searchKnowledgeFromSupabase(question, locale);
      if (vectorResults.length > 0) return vectorResults;
    } catch (error) {
      this.logger.warn(`Vector retrieval failed, fallback to seed FAQ: ${String(error)}`);
    }
    return this.searchKnowledgeFromSeed(question, locale);
  }

  // ── Intent-based data fetching ────────────────────────────────────────────

  /**
   * Gọi đúng các query cần thiết dựa trên intent đã phân loại.
   * Trả về { realtimeData, clarificationNeeded }.
   */
  private async fetchContextByIntent(
    intent: IntentCode,
    extracted: ExtractedEntities,
    accountPhone: string,
  ): Promise<{
    realtimeData: Record<string, unknown>;
    clarificationNeeded: string | null;
  }> {
    try {
      switch (intent) {
        // Lịch hẹn cá nhân
        case INTENT.MY_APPOINTMENTS: {
          if (extracted.appointmentId) {
            const detail = await this.repo.getAppointmentDetailForPatient(
              extracted.appointmentId,
              accountPhone,
            );
            return {
              realtimeData: { appointmentDetail: detail },
              clarificationNeeded: null,
            };
          }
          const upcoming = await this.repo.listSafeUpcomingAppointments(accountPhone);
          return {
            realtimeData: { upcomingAppointments: upcoming },
            clarificationNeeded: null,
          };
        }

        // Trạng thái thanh toán
        case INTENT.PAYMENT_STATUS: {
          if (extracted.appointmentId) {
            const payment = await this.repo.getPaymentStatusForAppointment(
              extracted.appointmentId,
              accountPhone,
            );
            const detail = await this.repo.getAppointmentDetailForPatient(
              extracted.appointmentId,
              accountPhone,
            );
            return {
              realtimeData: { paymentStatus: payment, appointmentDetail: detail },
              clarificationNeeded: null,
            };
          }
          // Không có mã DK → hiển thị danh sách lịch để user chọn
          const upcoming = await this.repo.listSafeUpcomingAppointments(accountPhone);
          return {
            realtimeData: { upcomingAppointments: upcoming },
            clarificationNeeded:
              'Bạn muốn kiểm tra thanh toán của lịch hẹn nào? Đây là danh sách lịch sắp tới.',
          };
        }

        // Slot bác sĩ theo ngày
        case INTENT.DOCTOR_SLOTS: {
          if (!extracted.date) {
            return {
              realtimeData: {},
              clarificationNeeded: null, // sẽ trả về clarification ở tầng trên
            };
          }
          // Kiểm tra ngày đã qua
          const todayStr = new Date().toISOString().slice(0, 10);
          if (extracted.date < todayStr) {
            return {
              realtimeData: {
                doctorSlots: {
                  _isPastDate: true,
                  targetDate: extracted.date,
                  totalAvailable: 0,
                  doctors: [],
                },
              },
              clarificationNeeded: null,
            };
          }
          const slots = await this.repo.getDoctorSlotsForDate(
            extracted.date,
            extracted.searchKeyword,
          );
          const slotSummary = slots as {
            totalAvailableSlots?: number;
          };
          const slotSearch = (slots as {
            searchResolution?:
              | { type: 'doctor'; doctorName: string; keyword: string }
              | { type: 'specialty'; specialtyName: string; keyword: string }
              | { type: 'keyword'; keyword: string }
              | null;
          }).searchResolution;
          const slotSummaryNote =
            Number(slotSummary.totalAvailableSlots || 0) > 0
              ? `Found ${slotSummary.totalAvailableSlots} available time slot(s) in total for ${extracted.date}.`
              : `No bookable time slots found for ${extracted.date}.`;
          const slotSearchContext = (() => {
            if (!extracted.searchKeyword) {
              return `Searching all available slots on ${extracted.date}.`;
            }
            if (slotSearch?.type === 'doctor') {
              return `Searching slots on ${extracted.date} for doctor keyword "${slotSearch.keyword}". Matched doctor "${slotSearch.doctorName}".`;
            }
            if (slotSearch?.type === 'specialty') {
              return `Searching slots on ${extracted.date} for specialty keyword "${slotSearch.keyword}". Matched specialty "${slotSearch.specialtyName}".`;
            }
            if (slotSearch?.type === 'keyword') {
              return `Searching slots on ${extracted.date} with doctor keyword "${slotSearch.keyword}".`;
            }
            return `Searching slots for specialty/doctor: "${extracted.searchKeyword}" on ${extracted.date}.`;
          })();
          return {
            realtimeData: {
              doctorSlots: {
                ...slots,
                _isPastDate: false,
                _searchContext: slotSearchContext,
                _note: slotSummaryNote,
              },
            },
            clarificationNeeded: null,
          };
        }

        // Chuyên khoa + loại khám + giá
        case INTENT.SPECIALTY_INFO: {
          const kw = extracted.searchKeyword;
          const specialties = await this.repo.getSpecialtiesWithServiceTypes(kw);
          // Kiểm tra xem có phải fallback không (keyword có nhưng kết quả là toàn bộ danh sách)
          const isSpecialtyFallback =
            kw != null &&
            specialties.length > 1 &&
            !specialties.some((s) =>
              s.specialtyName.toLowerCase().includes(kw.toLowerCase()),
            );
          return {
            realtimeData: {
              specialties,
              _searchContext: kw
                ? isSpecialtyFallback
                  ? `Searched for specialty "${kw}" but no exact match found. Showing all ${specialties.length} available specialties as fallback.`
                  : `Showing specialties matching "${kw}".`
                : `Showing all ${specialties.length} available specialties.`,
            },
            clarificationNeeded: null,
          };
        }

        // Chính sách hủy
        case INTENT.CANCEL_POLICY: {
          const policy = this.repo.getCancelPolicyInfo();
          return {
            realtimeData: { cancelPolicy: policy },
            clarificationNeeded: null,
          };
        }

        // Tìm bác sĩ
        case INTENT.DOCTOR_CATALOG: {
          const kw = extracted.searchKeyword;
          const doctors = await this.repo.searchDoctors(kw);
          // Kiểm tra fallback: có keyword nhưng không tìm được bác sĩ nào khớp tên/chuyên khoa đó
          const isDoctorFallback =
            kw != null &&
            doctors.length > 0 &&
            !doctors.some(
              (d) =>
                (d.doctorName ?? '').toLowerCase().includes(kw.toLowerCase()) ||
                (d.specialty ?? '').toLowerCase().includes(kw.toLowerCase()),
            );
          return {
            realtimeData: {
              doctorCatalog: doctors,
              _searchContext: kw
                ? isDoctorFallback
                  ? `Searched for "${kw}" but no doctor or specialty matched. Showing all ${doctors.length} available doctors as fallback. Please note this clearly to the user.`
                  : `Showing doctors matching "${kw}". Found ${doctors.length} result(s).`
                : `Showing all ${doctors.length} available doctors.`,
            },
            clarificationNeeded: null,
          };
        }

        // Thông tin chung – chỉ dùng clinic profile & FAQ
        case INTENT.GENERAL_INFO:
        default: {
          return {
            realtimeData: {},
            clarificationNeeded: null,
          };
        }
      }
    } catch (err) {
      this.logger.warn(`fetchContextByIntent(${intent}) error: ${String(err)}`);
      return { realtimeData: {}, clarificationNeeded: null };
    }
  }

  // ── Prompt builders ───────────────────────────────────────────────────────

  private buildSystemPrompt(locale: 'vi' | 'en') {
    const localeInstruction =
      locale === 'en'
        ? 'Respond only in English. Do not include Vietnamese translation.'
        : 'Respond only in Vietnamese. Do not include English translation.';

    return [
      'You are an AI patient scheduling assistant for a medical center.',
      'Follow this data policy strictly: READ-ONLY, no DB write actions, no appointment creation or mutation.',
      'Never expose sensitive fields (id cards, private contacts, internal notes, insurance IDs).',
      'Do not proactively tell users to contact hotline unless they explicitly ask for contact information.',
      'If user asks for diagnosis, refuse and suggest seeing a doctor.',
      'If user asks emergency symptoms, suggest urgent care immediately.',
      // Định dạng output
      'FORMATTING: Never use markdown symbols like **, *, #, _, >, or - bullet points. Use plain text with numbered lists (1. 2. 3.) only.',
      'When listing prices, always include the unit (VND). Format prices with thousand separator (e.g. 290.000 VND).',
      'When listing appointments, always show: date, time slot, doctor, specialty, status.',
      // Phân biệt rõ "dữ liệu rỗng" vs "không có dữ liệu"
      'DATA RULES: If realtimeData contains an empty array [], do NOT say "I don\'t have information". Instead describe what was searched and that no matching results were found, then offer alternatives.',
      'DATA RULES: Always read _searchContext and _note fields in realtimeData – they contain important context about what was found vs what was requested.',
      'DATA RULES: If _searchContext says "fallback", it means the exact search failed; explain this clearly and list the fallback data.',
      'DATA RULES: When realtimeData.paymentStatus is null but appointmentDetail exists, use appointmentDetail.statusLabel to answer the payment question.',
      'DATA RULES: If doctorSlots._isPastDate is true, tell the user that date has already passed and no schedule exists for it.',
      'DATA RULES: If doctorSlots.doctors[].availableSlots is present, list those concrete time ranges (slotStart-slotEnd) and do not claim missing slot-detail data.',
      'DATA RULES: For slot questions, prioritize doctorSlots.totalAvailableSlots and doctorSlots.doctors[].availableSlots over generic clinic working hours.',
      'Keep responses friendly, concise (under 200 words), and practical.',
      localeInstruction,
    ].join('\n');
  }

  private buildUserPrompt(input: {
    question: string;
    locale: 'vi' | 'en';
    intent: IntentCode;
    clinic: ReturnType<AiAssistantService['getClinicProfile']>;
    realtimeData: Record<string, unknown>;
    knowledge: KnowledgeHit[];
  }) {
    const contextPayload = JSON.stringify(
      {
        clinic: input.clinic,
        dataAccessPolicy: DATA_ACCESS_POLICY,
        intent: input.intent,
        realtimeData: input.realtimeData,
      },
      null,
      2,
    );
    const knowledgePayload = JSON.stringify(input.knowledge, null, 2);
    return [
      `User locale: ${input.locale}`,
      `Detected intent: ${input.intent}`,
      `User question: ${input.question}`,
      'Realtime context (safe, filtered by intent):',
      contextPayload,
      'RAG knowledge candidates:',
      knowledgePayload,
      'Please answer based on the context above. If data is insufficient, say so clearly and suggest next step.',
    ].join('\n\n');
  }

  // ── OpenAI call ───────────────────────────────────────────────────────────

  private async generateAnswerWithOpenAi(input: {
    question: string;
    locale: 'vi' | 'en';
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    intent: IntentCode;
    clinic: ReturnType<AiAssistantService['getClinicProfile']>;
    realtimeData: Record<string, unknown>;
    knowledge: KnowledgeHit[];
  }) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) return null;

    const model =
      this.config.get<string>('OPENAI_CHAT_MODEL') ||
      this.config.get<string>('OPENAI_JUDGE_MODEL') ||
      'gpt-4o-mini';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          {
            role: 'system',
            content: this.buildSystemPrompt(input.locale),
          },
          ...input.history.slice(-8).map((item) => ({
            role: item.role,
            content: item.content,
          })),
          {
            role: 'user',
            content: this.buildUserPrompt({
              question: input.question,
              locale: input.locale,
              intent: input.intent,
              clinic: input.clinic,
              realtimeData: input.realtimeData,
              knowledge: input.knowledge,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      this.logger.warn(`Chat completion failed: ${response.status} ${errText}`);
      return null;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = payload.choices?.[0]?.message?.content?.trim();
    return answer || null;
  }

  // ── Fallback answer ───────────────────────────────────────────────────────

  private buildFallbackAnswer(input: {
    locale: 'vi' | 'en';
    clinic: ReturnType<AiAssistantService['getClinicProfile']>;
    intent: IntentCode;
    realtimeData: Record<string, unknown>;
  }) {
    const { locale, clinic, intent, realtimeData } = input;

    // Fallback có ngữ cảnh theo intent
    if (intent === INTENT.CANCEL_POLICY && realtimeData.cancelPolicy) {
      const p = realtimeData.cancelPolicy as ReturnType<AiAssistantRepository['getCancelPolicyInfo']>;
      return locale === 'en'
        ? `Cancellation policy: You must cancel at least ${p.cutoffHours} hour(s) before your appointment. Reschedule is not supported – please cancel and rebook.`
        : `Chính sách hủy lịch: Bạn cần hủy trước giờ khám ít nhất ${p.cutoffHours} tiếng. Hệ thống chưa hỗ trợ đổi lịch – vui lòng hủy và đặt lại.`;
    }

    if (locale === 'en') {
      return [
        `I can help with scheduling info at ${clinic.name}.`,
        `Clinic hours: morning ${clinic.workingHours.morning}, afternoon ${clinic.workingHours.afternoon}.`,
        `Payment supported: ${clinic.paymentMethods.join(', ')}.`,
        `Try asking about doctor availability, appointment status, pricing, or cancellation policy.`,
      ].join('\n');
    }

    return [
      `Tôi có thể hỗ trợ thông tin đặt lịch tại ${clinic.name}.`,
      `Giờ làm việc: sáng ${clinic.workingHours.morning}, chiều ${clinic.workingHours.afternoon}.`,
      `Phương thức thanh toán: ${clinic.paymentMethods.join(', ')}.`,
      `Bạn có thể hỏi về: bác sĩ khả dụng, lịch hẹn của bạn, giá dịch vụ, chính sách hủy lịch.`,
    ].join('\n');
  }

  // ── Main chat handler ─────────────────────────────────────────────────────

  async chat(user: CurrentUserPayload, dto: AiAssistantChatDto) {
    const question = String(dto.message || '').trim();
    const locale = detectLocale(question, dto.locale);
    const clinic = this.getClinicProfile();

    // 1. Route intent
    const { intent, missingParams, extracted } = routeIntent(question);
    this.logger.debug(`Intent: ${intent} | missing: ${missingParams.join(',')} | date: ${extracted.date}`);

    // 2. Nếu thiếu tham số bắt buộc → hỏi lại ngay, không gọi model
    if (missingParams.length > 0) {
      const firstMissing = missingParams[0];
      const clarification =
        CLARIFICATION_MESSAGES[firstMissing]?.[locale] ||
        CLARIFICATION_MESSAGES[firstMissing]?.vi ||
        'Bạn có thể cung cấp thêm thông tin không?';

      await this.repo.writeAuditLog({
        actor: user.TK_SDT,
        questionPreview: question.slice(0, 240),
        locale,
        sourceCount: 0,
        intent,
      });

      return {
        answer: clarification,
        locale,
        intent,
        clarificationNeeded: firstMissing,
        generatedAt: new Date().toISOString(),
        sources: [],
        policy: DATA_ACCESS_POLICY,
      };
    }

    // 3. Fetch dữ liệu theo intent (song song với retrieval RAG)
    const [{ realtimeData, clarificationNeeded }, knowledge, profiles] = await Promise.all([
      this.fetchContextByIntent(intent, extracted, user.TK_SDT),
      this.retrieveKnowledge(question, locale, intent),
      // Luôn lấy profiles (nhẹ, cần cho context cá nhân)
      this.repo.listSafePatientProfiles(user.TK_SDT),
    ]);

    // 3b. Nếu paymentStatus = null nhưng appointmentDetail có — inject rõ trạng thái
    if (
      intent === INTENT.PAYMENT_STATUS &&
      (realtimeData as any).paymentStatus === null &&
      (realtimeData as any).appointmentDetail != null
    ) {
      const appt = (realtimeData as any).appointmentDetail as Record<string, unknown>;
      (realtimeData as any)._paymentNote =
        `No payment record found. Appointment status: "${appt.statusLabel ?? appt.status}".` +
        ` This means the appointment exists but payment has not been initiated or recorded yet.`;
    }

    // 4. Nếu service logic yêu cầu clarification (vd: PAYMENT thiếu DK_MA)
    if (clarificationNeeded) {
      await this.repo.writeAuditLog({
        actor: user.TK_SDT,
        questionPreview: question.slice(0, 240),
        locale,
        sourceCount: knowledge.length,
        intent,
      });

      return {
        answer: clarificationNeeded,
        locale,
        intent,
        clarificationNeeded: 'appointmentId',
        generatedAt: new Date().toISOString(),
        sources: knowledge.map((item) => ({
          title: item.title,
          category: item.category,
          source: item.source,
        })),
        policy: DATA_ACCESS_POLICY,
      };
    }

    // 5. Gọi OpenAI với context đã được lọc theo intent
    let answer = await this.generateAnswerWithOpenAi({
      question,
      locale,
      history: (dto.history || []).map((item) => ({
        role: item.role,
        content: String(item.content || '').trim(),
      })),
      intent,
      clinic,
      realtimeData: {
        patientProfiles: profiles,
        ...realtimeData,
      },
      knowledge,
    });

    // 6. Fallback nếu OpenAI không trả lời
    if (!answer) {
      answer = this.buildFallbackAnswer({ locale, clinic, intent, realtimeData });
    }

    answer = sanitizeAssistantAnswer(answer);
    if (!answer) {
      answer =
        locale === 'en'
          ? 'I can help with appointment information. Please tell me your preferred date or specialty.'
          : 'Tôi có thể hỗ trợ thông tin đặt lịch. Bạn vui lòng cho biết ngày khám hoặc chuyên khoa mong muốn.';
    }

    // 7. Audit log
    await this.repo.writeAuditLog({
      actor: user.TK_SDT,
      questionPreview: question.slice(0, 240),
      locale,
      sourceCount: knowledge.length,
      intent,
    });

    return {
      answer,
      locale,
      intent,
      generatedAt: new Date().toISOString(),
      sources: knowledge.map((item) => ({
        title: item.title,
        category: item.category,
        source: item.source,
      })),
      policy: DATA_ACCESS_POLICY,
    };
  }
}
