export type AiFaqSeedItem = {
  id: string;
  language: 'vi' | 'en' | 'both';
  category: 'booking' | 'insurance' | 'payment' | 'policy' | 'general';
  title: string;
  content: string;
  source: string;
  tags: string[];
};

export const AI_FAQ_SEED: AiFaqSeedItem[] = [
  // ── Giờ làm việc ────────────────────────────────────────────────────────
  {
    id: 'faq-booking-hours',
    language: 'both',
    category: 'booking',
    title: 'Gio lam viec va khung gio kham',
    content:
      'Phong kham hoat dong buoi sang 07:30-11:30 va buoi chieu 13:00-16:30. Benh nhan nen den som 15-20 phut de xac nhan thong tin va lay so thu tu. Mang theo CCCD hoac giay to tuy than.',
    source: 'FAQ_NOI_BO',
    tags: ['gio lam viec', 'lich kham', 'opening hours', 'gio mo cua', 'den luc may gio'],
  },

  // ── Chính sách hủy/đổi lịch ────────────────────────────────────────────
  {
    id: 'faq-booking-cancel',
    language: 'both',
    category: 'policy',
    title: 'Chinh sach huy doi lich kham',
    content:
      'Dat lich co the huy neu thuc hien truoc gio kham toi thieu 1 gio (60 phut). Neu qua moc nay hoac da check-in, he thong se tu choi huy. ' +
      'Hien tai he thong chua ho tro doi lich truc tiep – benh nhan can huy lich cu va dat lai lich moi. ' +
      'Neu bac si nghi dot xuat, he thong se tu dong huy lich va thong bao cho benh nhan.',
    source: 'FAQ_NOI_BO',
    tags: [
      'huy lich', 'doi lich', 'cancel', 'reschedule', 'chinh sach huy',
      'co the huy khong', 'huy truoc may gio', 'thoi han huy',
    ],
  },

  // ── Thanh toán QR Banking ───────────────────────────────────────────────
  {
    id: 'faq-payment-qr',
    language: 'both',
    category: 'payment',
    title: 'Thanh toan bang QR Banking',
    content:
      'He thong ho tro thanh toan qua QR Banking (chuyen khoan ngan hang). Quy trinh: (1) Dat lich thanh cong → (2) Quet ma QR hien thi tren man hinh → (3) Chuyen khoan dung so tien va noi dung → (4) He thong tu dong xac nhan trong vong vai phut. ' +
      'Khong can den quy thu phi tai phong kham. Neu chuyen khoan xong nhung chua xac nhan, vui long cho 5-10 phut hoac lien he hotline.',
    source: 'FAQ_NOI_BO',
    tags: [
      'thanh toan', 'qr', 'banking', 'payment', 'chuyen khoan',
      'qr code', 'quet ma', 'trang thai thanh toan', 'chua xac nhan',
    ],
  },

  // ── Trạng thái đăng ký ─────────────────────────────────────────────────
  {
    id: 'faq-appointment-status',
    language: 'both',
    category: 'booking',
    title: 'Giai thich trang thai lich hen',
    content:
      'Cac trang thai lich hen: ' +
      '(1) "Cho thanh toan" – da dat lich, chua chuyen khoan/thanh toan. ' +
      '(2) "Cho kham" – da thanh toan xong, cho den luot kham. ' +
      '(3) "Da check-in" – da xac nhan mat tai phong kham, dang cho goi ten. ' +
      '(4) "Da kham" – hoan tat. ' +
      '(5) "Da huy" – lich bi huy boi benh nhan hoac he thong.',
    source: 'FAQ_NOI_BO',
    tags: [
      'trang thai', 'cho thanh toan', 'cho kham', 'da checkin', 'da kham',
      'huy', 'status', 'appointment status', 'lich dang o trang thai nao',
    ],
  },

  // ── BHYT ────────────────────────────────────────────────────────────────
  {
    id: 'faq-insurance-bhyt',
    language: 'both',
    category: 'insurance',
    title: 'Cac loai BHYT duoc chap nhan',
    content:
      'He thong chap nhan 3 loai BHYT: ' +
      '(1) Co the BHYT dang ky Kham Chua Benh ban dau tai BV DH Y Duoc – ap dung doi tuong hop le theo quy dinh. ' +
      '(2) Co tai kham theo hen tren don thuoc BHYT cua BV DH Y Duoc – giay chuyen tuyen con han. ' +
      '(3) Co giay chuyen BHYT dung tuyen den BV DH Y Duoc – giay con hieu luc. ' +
      'Vui long mang theo the BHYT va giay to lien quan khi den kham.',
    source: 'FAQ_NOI_BO',
    tags: [
      'bhyt', 'bao hiem y te', 'insurance', 'bao hiem', 'the bhyt',
      'co bhyt', 'su dung bhyt', 'mang gi', 'giay to',
    ],
  },

  // ── Bảo hiểm tư nhân ───────────────────────────────────────────────────
  {
    id: 'faq-insurance-private',
    language: 'both',
    category: 'insurance',
    title: 'Bao hiem tu nhan duoc ho tro',
    content:
      'He thong ho tro khai bao bao hiem tu nhan tu cac don vi: Bao Viet, PVI, PTI, VBI (Vietin Bank Insurance), Pacific Cross (BHV), MIC (Quan doi), Generali, Manulife, Prudential. ' +
      'Khi dat lich, chon ten cong ty bao hiem tuong ung. Mang theo giay chung nhan bao hiem con hieu luc khi den kham.',
    source: 'FAQ_NOI_BO',
    tags: [
      'bao hiem tu nhan', 'private insurance', 'bao viet', 'pvi', 'pti',
      'generali', 'manulife', 'prudential', 'mic', 'pacific cross',
    ],
  },

  // ── Quy trình đặt lịch ─────────────────────────────────────────────────
  {
    id: 'faq-booking-process',
    language: 'both',
    category: 'booking',
    title: 'Cach dat lich kham truc tuyen',
    content:
      'Quy trinh dat lich: (1) Chon chuyen khoa hoac bac si → (2) Chon ngay kham co lich → (3) Chon buoi (sang/chieu) va khung gio → (4) Chon loai hinh kham va khai bao bao hiem → (5) Xac nhan va thanh toan qua QR Banking → (6) Nhan thong bao xac nhan. ' +
      'Benh nhan can dang nhap va co ho so cá nhan truoc khi dat lich. Chi dat duoc lich trong vong 3 thang tiep theo.',
    source: 'FAQ_NOI_BO',
    tags: [
      'cach dat lich', 'quy trinh', 'huong dan', 'how to book',
      'dat lich nhu the nao', 'buoc dat lich', 'booking process',
    ],
  },

  // ── Khám nội trú/cấp cứu ───────────────────────────────────────────────
  {
    id: 'faq-emergency-disclaimer',
    language: 'both',
    category: 'general',
    title: 'Luu y an toan va cap cuu',
    content:
      'Tro ly AI chi ho tro thong tin dat lich ngoai tru. Khong su dung he thong nay cho cac truong hop cap cuu. ' +
      'Neu co dau hieu cap cuu (kho tho, dau nguc, ngat xiu, tai nan...) hay goi 115 hoac den co so y te gan nhat ngay lap tuc.',
    source: 'FAQ_NOI_BO',
    tags: ['cap cuu', 'an toan', 'emergency', '115', 'khan cap'],
  },

  // ── Giá khám ────────────────────────────────────────────────────────────
  {
    id: 'faq-pricing-general',
    language: 'both',
    category: 'payment',
    title: 'Thong tin gia kham va loai hinh dich vu',
    content:
      'Gia kham phu thuoc vao loai hinh kham va chuyen khoa ban chon khi dat lich. ' +
      'He thong hien thi gia cu the cua tung loai hinh kham truoc khi xac nhan dat lich. ' +
      'Vui long hoi ve gia cua chuyen khoa cu the ban muon biet (vi du: kham noi khoa bao nhieu tien).',
    source: 'FAQ_NOI_BO',
    tags: [
      'gia kham', 'phi kham', 'chi phi', 'loai hinh kham', 'gia bao nhieu',
      'bao nhieu tien', 'price', 'fee', 'service price',
    ],
  },

  // ── Kết quả xét nghiệm ──────────────────────────────────────────────────
  {
    id: 'faq-test-results',
    language: 'both',
    category: 'general',
    title: 'Ket qua xet nghiem va don thuoc',
    content:
      'Tro ly AI khong co quyen truy cap ket qua xet nghiem, don thuoc hay ho so benh an. ' +
      'De xem ket qua xet nghiem, vui long lien he truc tiep voi phong kham hoac tra cuu qua he thong quan ly benh an (neu duoc cap quyen).',
    source: 'FAQ_NOI_BO',
    tags: [
      'ket qua xet nghiem', 'don thuoc', 'benh an', 'lab result',
      'prescription', 'medical record',
    ],
  },
];
