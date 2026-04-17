-- Seed FAQ documents (without embeddings) for AI knowledge base.
-- After inserting, generate embeddings and update `embedding` column.

insert into public.ai_knowledge_documents (title, language, category, content, source, tags)
values
  (
    'Gio lam viec va khung gio kham',
    'both',
    'booking',
    'Phong kham hoat dong buoi sang 07:30-11:30 va buoi chieu 13:00-16:30. Benh nhan nen den som 15-20 phut de xac nhan thong tin.',
    'FAQ_NOI_BO',
    array['gio lam viec','lich kham','opening hours']
  ),
  (
    'Chinh sach huy doi lich',
    'both',
    'policy',
    'Dat lich co the huy hoac doi neu thuc hien truoc gio kham toi thieu 1 gio. Neu qua moc nay, he thong co the tu choi thao tac de bao toan cong suat kham.',
    'FAQ_NOI_BO',
    array['huy lich','doi lich','cancel policy']
  ),
  (
    'Thanh toan QR Banking',
    'both',
    'payment',
    'He thong hien ho tro thanh toan chuyen khoan QR Banking. Sau khi tao lich, benh nhan se nhan duoc thong tin thanh toan de hoan tat.',
    'FAQ_NOI_BO',
    array['thanh toan','qr','banking']
  ),
  (
    'BHYT va bao hiem tu nhan',
    'both',
    'insurance',
    'Benh nhan can mang giay to hop le khi su dung BHYT hoac bao hiem tu nhan. Quyen loi cu the phu thuoc quy dinh tung don vi bao hiem va tinh trang ho so tai thoi diem tiep nhan.',
    'FAQ_NOI_BO',
    array['bhyt','bao hiem','insurance']
  )
on conflict (title, language)
do update set
  category = excluded.category,
  content = excluded.content,
  source = excluded.source,
  tags = excluded.tags,
  updated_at = now();

