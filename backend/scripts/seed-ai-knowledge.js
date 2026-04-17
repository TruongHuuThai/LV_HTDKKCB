/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function loadDotEnvIfExists() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/g);
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    // Prefer project-local .env over machine-level environment variables
    // so local setup remains deterministic.
    process.env[key] = value;
  }
}

loadDotEnvIfExists();
const SEED_ITEMS = [
  {
    title: 'Gio lam viec va khung gio kham',
    language: 'both',
    category: 'booking',
    content:
      'Phong kham hoat dong buoi sang 07:30-11:30 va buoi chieu 13:00-16:30. Benh nhan nen den som 15-20 phut de xac nhan thong tin.',
    source: 'FAQ_NOI_BO',
    tags: ['gio lam viec', 'lich kham', 'opening hours'],
  },
  {
    title: 'Chinh sach huy doi lich',
    language: 'both',
    category: 'policy',
    content:
      'Dat lich co the huy hoac doi neu thuc hien truoc gio kham toi thieu 1 gio. Neu qua moc nay, he thong co the tu choi thao tac de bao toan cong suat kham.',
    source: 'FAQ_NOI_BO',
    tags: ['huy lich', 'doi lich', 'cancel policy'],
  },
  {
    title: 'Thanh toan QR Banking',
    language: 'both',
    category: 'payment',
    content:
      'He thong hien ho tro thanh toan chuyen khoan QR Banking. Sau khi tao lich, benh nhan se nhan duoc thong tin thanh toan de hoan tat.',
    source: 'FAQ_NOI_BO',
    tags: ['thanh toan', 'qr', 'banking'],
  },
  {
    title: 'BHYT va bao hiem tu nhan',
    language: 'both',
    category: 'insurance',
    content:
      'Benh nhan can mang giay to hop le khi su dung BHYT hoac bao hiem tu nhan. Quyen loi cu the phu thuoc quy dinh tung don vi bao hiem va tinh trang ho so tai thoi diem tiep nhan.',
    source: 'FAQ_NOI_BO',
    tags: ['bhyt', 'bao hiem', 'insurance'],
  },
];

function vectorLiteral(embedding) {
  return `[${embedding.join(',')}]`;
}

async function createEmbedding(text, apiKey, model) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Embedding API failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  const embedding = payload?.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('Embedding payload invalid');
  }
  return embedding;
}

async function upsertDocument(item, embeddingLiteral, supabaseUrl, supabaseKey) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/ai_knowledge_documents?on_conflict=title,language`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify([
        {
          ...item,
          embedding: embeddingLiteral,
          is_active: true,
        },
      ]),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase upsert failed (${response.status}): ${body}`);
  }
}

async function main() {
  const openAiApiKey = process.env.OPENAI_API_KEY;
  const embedModel = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!openAiApiKey) throw new Error('OPENAI_API_KEY is required');
  if (!supabaseUrl) throw new Error('SUPABASE_URL is required');
  if (!supabaseServiceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');

  console.log(`Seeding ${SEED_ITEMS.length} knowledge documents...`);
  for (const item of SEED_ITEMS) {
    const embedding = await createEmbedding(
      `${item.title}\n${item.content}\n${item.tags.join(' ')}`,
      openAiApiKey,
      embedModel,
    );
    await upsertDocument(item, vectorLiteral(embedding), supabaseUrl, supabaseServiceKey);
    console.log(`Upserted: ${item.title}`);
  }
  console.log('Done.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
