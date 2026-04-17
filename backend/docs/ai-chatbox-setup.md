# AI Chatbox Setup (RAG + Realtime DB)

## 1) Backend env vars

Add these values to `backend/.env`:

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBED_MODEL=text-embedding-3-small

SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_VECTOR_RPC_NAME=match_ai_knowledge
SUPABASE_VECTOR_MATCH_COUNT=4
SUPABASE_VECTOR_MIN_SIMILARITY=0.68

AI_CLINIC_NAME=Can Tho University Medical Center
AI_CLINIC_ADDRESS=Khu II, Duong 3 Thang 2, Xuan Khanh, Ninh Kieu, Can Tho, Vietnam
AI_CLINIC_HOTLINE=0867504590
AI_CLINIC_WORKING_HOURS_MORNING=07:30 - 11:30
AI_CLINIC_WORKING_HOURS_AFTERNOON=13:00 - 16:30
AI_CLINIC_CANCEL_BEFORE_HOURS=1
AI_CLINIC_PAYMENT_METHODS=QR_BANKING
AI_MANDATORY_NOTICE=day chi la goi y tu he thong, khong thay the duoc tu van tu bac si
```

## 2) Prepare Supabase vector schema

Run SQL scripts on Supabase DB:

1. `backend/scripts/sql/ai_assistant_rag_setup.sql`
2. `backend/scripts/sql/ai_assistant_rag_seed.sql`

After seed insert, generate embeddings and update `ai_knowledge_documents.embedding`.

## 3) Endpoint

Authenticated patient endpoint:

- `POST /ai-assistant/chat`

Payload:

```json
{
  "message": "Toi muon dat lich vao ngay mai",
  "locale": "vi",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

## 4) Data safety

The assistant is forced to:

- Read-only mode.
- Access only allowed domains (doctor/schedule/booking/payment snapshot + current user profiles).
- Never return masked sensitive fields (CCCD, BHYT ID, personal contact details, internal notes).

