// src/data/newsData.ts

export interface NewsArticle {
    id: string;
    categorySlug: 'y-hoc-thuong-thuc' | 'tin-tuc-su-kien' | 'hoi-dap-y-khoa';
    title: string;
    slug: string;
    summary: string;
    imageUrl: string; // URL từ CMS/DB — không import file tĩnh
    publishedAt: string; // VD: '21/01/2025'
    isFeatured?: boolean;
    htmlContent?: string;
}

const TEMPLATE_HTML = (title: string, index: number) => `
  <p><strong>${title}</strong> là một chủ đề được nhiều độc giả quan tâm. Bài viết này sẽ phân tích từ góc nhìn chuyên môn y khoa, cung cấp những kiến thức cần thiết để chăm sóc sức khỏe chủ động.</p>
  
  <h2>1. Nguyên nhân và yếu tố nguy cơ</h2>
  <p>Tại UMC Clinic, hiện tượng này bắt nguồn từ sự kết hợp của nhiều yếu tố khác nhau như thói quen sinh hoạt, chế độ dinh dưỡng, và đôi khi là yếu tố di truyền. Việc nhận biết sớm đóng vai trò then chốt.</p>
  <img src="https://placehold.co/800x450/e0f2fe/0369a1?text=Hinh+Minh+Hoa+${index}" alt="Hình minh họa ${index}" />

  <h2>2. Phương pháp phòng ngừa hiệu quả</h2>
  <p>Đội ngũ bác sĩ khuyên mọi người nên tuân thủ các nguyên tắc sau:</p>
  <ul>
    <li>Thực hiện khám sức khỏe định kỳ mỗi 6 tháng một lần.</li>
    <li>Ăn uống theo chế độ cân bằng dưỡng chất, tăng cường rau xanh.</li>
    <li>Tập luyện thể thao đều đặn ít nhất 30 phút mỗi ngày.</li>
  </ul>

  <h2>3. Tham vấn ý kiến chuyên gia (UMC Clinic)</h2>
  <p>Nếu bạn hoặc người thân gặp phải các triệu chứng kéo dài không thuyên giảm, đừng ngần ngại đăng ký tư vấn với <strong>Bác sĩ chuyên khoa tại UMC</strong> để được cá nhân hóa phác đồ điều trị.</p>
`;

// Hàm sinh data ngẫu nhiên cho 1 danh mục
const generateNews = (categorySlug: 'y-hoc-thuong-thuc' | 'tin-tuc-su-kien' | 'hoi-dap-y-khoa', count: number, startIndex = 1): NewsArticle[] => {
    return Array.from({ length: count }).map((_, i) => {
        const id = startIndex + i;
        const indexStr = id.toString().padStart(3, '0');
        const title = `[${categorySlug.toUpperCase()}] Kiến thức bài ${indexStr}: Cập nhật quan trọng`;
        
        return {
            id: `${categorySlug}-${indexStr}`,
            categorySlug,
            slug: `bai-viet-so-${id}`,
            title,
            summary: `Tóm tắt nhanh cho bài viết số ${id} thuộc danh mục ${categorySlug}. Bài viết này cung cấp những kiến thức cơ bản và chuyên sâu giúp bạn hiểu rõ hơn về tình trạng y khoa này.`,
            imageUrl: `https://placehold.co/800x450/f8fafc/0f172a?text=News+${indexStr}`,
            publishedAt: `2026-03-${((id % 28) + 1).toString().padStart(2, '0')}`,
            htmlContent: TEMPLATE_HTML(title, id),
        };
    });
};

export const NEWS_ARTICLES: NewsArticle[] = [
    // ── Y học thường thức ──────────────────────────────
    {
        id: 'yhtt-001',
        categorySlug: 'y-hoc-thuong-thuc',
        title: 'CHẾ ĐỘ DINH DƯỠNG LÀNH MẠNH CHO NGƯỜI CAO TUỔI',
        slug: 'che-do-dinh-duong-lanh-manh-cho-nguoi-cao-tuoi',
        summary:
            'Người cao tuổi cần chú ý đặc biệt đến chế độ ăn uống để duy trì sức khỏe, tăng cường hệ miễn dịch và phòng ngừa các bệnh mãn tính. Bài viết cung cấp những nguyên tắc dinh dưỡng quan trọng mà người cao tuổi nên áp dụng hàng ngày.',
        imageUrl: 'https://placehold.co/800x400/1d4ed8/ffffff?text=Dinh+Duong+Nguoi+Cao+Tuoi',
        publishedAt: '15/01/2025',
        isFeatured: true,
        htmlContent: TEMPLATE_HTML('CHẾ ĐỘ DINH DƯỠNG LÀNH MẠNH CHO NGƯỜI CAO TUỔI', 1),
    },
    {
        id: 'yhtt-002',
        categorySlug: 'y-hoc-thuong-thuc',
        title: 'PHÒNG NGỪA ĐỘT QUỴ: NHỮNG ĐIỀU BẠN CẦN BIẾT',
        slug: 'phong-ngua-dot-quy-nhung-dieu-ban-can-biet',
        summary:
            'Đột quỵ là một trong những nguyên nhân gây tử vong và tàn tật hàng đầu. Nhận biết sớm dấu hiệu và thực hiện các biện pháp phòng ngừa có thể cứu sống hàng nghìn người mỗi năm.',
        imageUrl: 'https://placehold.co/400x300/1e40af/ffffff?text=Phong+Ngua+Dot+Quy',
        publishedAt: '10/01/2025',
        htmlContent: TEMPLATE_HTML('PHÒNG NGỪA ĐỘT QUỴ: NHỮNG ĐIỀU BẠN CẦN BIẾT', 2),
    },
    ...generateNews('y-hoc-thuong-thuc', 14, 3),

    // ── Tin tức sự kiện ────────────────────────────────
    {
        id: 'ttsk-001',
        categorySlug: 'tin-tuc-su-kien',
        title: 'UMC CLINIC KHAI TRƯƠNG CƠ SỞ MỚI TẠI CẦN THƠ',
        slug: 'umc-clinic-khai-truong-co-so-moi-tai-can-tho',
        summary:
            'Ngày 01/01/2025, UMC Clinic chính thức khai trương cơ sở thứ 3 tại Cần Thơ với hệ thống máy móc hiện đại và đội ngũ bác sĩ chuyên khoa đầu ngành. Đây là bước phát triển quan trọng trong chiến lược mở rộng ra toàn quốc.',
        imageUrl: 'https://placehold.co/800x400/1d4ed8/ffffff?text=UMC+Khai+Truong+Can+Tho',
        publishedAt: '01/01/2025',
        isFeatured: true,
        htmlContent: TEMPLATE_HTML('UMC CLINIC KHAI TRƯƠNG CƠ SỞ MỚI TẠI CẦN THƠ', 5),
    },
    ...generateNews('tin-tuc-su-kien', 5, 6),

    // ── Hỏi đáp y khoa ────────────────────────────────
    {
        id: 'hdyk-001',
        categorySlug: 'hoi-dap-y-khoa',
        title: 'HỎI ĐÁP: TẠI SAO BÉ HAY BỊ SỐT VỀ ĐÊM?',
        slug: 'hoi-dap-tai-sao-be-hay-bi-sot-ve-dem',
        summary:
            'Bé sốt về đêm là lo lắng thường gặp của nhiều bậc phụ huynh. BS. Nguyễn Văn An giải thích các nguyên nhân phổ biến và hướng dẫn cách xử lý đúng cách tại nhà, cũng như khi nào cần đưa bé đến bệnh viện gấp.',
        imageUrl: 'https://placehold.co/800x400/1d4ed8/ffffff?text=Be+Hay+Bi+Sot+Ve+Dem',
        publishedAt: '08/01/2025',
        isFeatured: true,
        htmlContent: TEMPLATE_HTML('TẠI SAO BÉ HAY BỊ SỐT VỀ ĐÊM', 10),
    },
    ...generateNews('hoi-dap-y-khoa', 5, 11),
];

export const NEWS_CATEGORIES = [
    { slug: 'y-hoc-thuong-thuc', label: 'Y học thường thức' },
    { slug: 'tin-tuc-su-kien', label: 'Tin tức sự kiện' },
    { slug: 'hoi-dap-y-khoa', label: 'Hỏi đáp y khoa' },
] as const;

export type NewsCategorySlug = (typeof NEWS_CATEGORIES)[number]['slug'];
