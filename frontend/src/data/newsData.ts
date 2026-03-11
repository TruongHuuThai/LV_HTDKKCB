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
}

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
    },
    {
        id: 'yhtt-003',
        categorySlug: 'y-hoc-thuong-thuc',
        title: 'LỢI ÍCH CỦA VIỆC TẬP THỂ DỤC MỖI NGÀY 30 PHÚT',
        slug: 'loi-ich-cua-viec-tap-the-duc-moi-ngay-30-phut',
        summary:
            'Chỉ cần 30 phút vận động mỗi ngày có thể cải thiện đáng kể sức khỏe tim mạch, kiểm soát cân nặng và tăng cường tâm trạng. Tìm hiểu các bài tập phù hợp cho từng độ tuổi.',
        imageUrl: 'https://placehold.co/400x300/1e3a8a/ffffff?text=Tap+The+Duc',
        publishedAt: '05/01/2025',
    },
    {
        id: 'yhtt-004',
        categorySlug: 'y-hoc-thuong-thuc',
        title: 'HIỂU ĐÚNG VỀ BỆNH TIỂU ĐƯỜNG TYPE 2',
        slug: 'hieu-dung-ve-benh-tieu-duong-type-2',
        summary:
            'Bệnh tiểu đường type 2 ngày càng phổ biến trong xã hội hiện đại. Bài viết giải thích cơ chế bệnh, yếu tố nguy cơ và các phương pháp kiểm soát đường huyết hiệu quả.',
        imageUrl: 'https://placehold.co/400x300/1e40af/ffffff?text=Benh+Tieu+Duong',
        publishedAt: '02/01/2025',
    },

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
    },
    {
        id: 'ttsk-002',
        categorySlug: 'tin-tuc-su-kien',
        title: 'HỘI THẢO KHOA HỌC VỀ UNG THƯ VÚ NĂM 2025',
        slug: 'hoi-thao-khoa-hoc-ve-ung-thu-vu-nam-2025',
        summary:
            'UMC Clinic phối hợp với Bộ Y tế tổ chức hội thảo khoa học quốc tế về ung thư vú, quy tụ hơn 200 chuyên gia y tế từ 15 quốc gia chia sẻ những phương pháp điều trị tiên tiến nhất.',
        imageUrl: 'https://placehold.co/400x300/1e40af/ffffff?text=Hoi+Thao+Ung+Thu',
        publishedAt: '20/12/2024',
    },
    {
        id: 'ttsk-003',
        categorySlug: 'tin-tuc-su-kien',
        title: 'CHIẾN DỊCH KHÁM MIỄN PHÍ CHO 1000 BỆNH NHÂN KHÓ KHĂN',
        slug: 'chien-dich-kham-mien-phi-cho-1000-benh-nhan-kho-khan',
        summary:
            'Nhân dịp Tết Nguyên Đán 2025, UMC Clinic triển khai chương trình khám bệnh và cấp thuốc miễn phí cho 1.000 hộ gia đình có hoàn cảnh khó khăn tại Cần Thơ.',
        imageUrl: 'https://placehold.co/400x300/1e3a8a/ffffff?text=Kham+Mien+Phi',
        publishedAt: '18/12/2024',
    },

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
    },
    {
        id: 'hdyk-002',
        categorySlug: 'hoi-dap-y-khoa',
        title: 'HỎI ĐÁP: ĂN GÌ ĐỂ HẠ CHOLESTEROL MÁU?',
        slug: 'hoi-dap-an-gi-de-ha-cholesterol-mau',
        summary:
            'Cholesterol cao là yếu tố nguy cơ hàng đầu của bệnh tim mạch. BS. Trần Thị Bình tư vấn thực phẩm nên ăn và nên tránh, cùng những thay đổi lối sống giúp kiểm soát cholesterol tự nhiên.',
        imageUrl: 'https://placehold.co/400x300/1e40af/ffffff?text=Ha+Cholesterol',
        publishedAt: '06/01/2025',
    },
    {
        id: 'hdyk-003',
        categorySlug: 'hoi-dap-y-khoa',
        title: 'HỎI ĐÁP: ĐAU ĐẦU THƯỜNG XUYÊN CÓ NGUY HIỂM KHÔNG?',
        slug: 'hoi-dap-dau-dau-thuong-xuyen-co-nguy-hiem-khong',
        summary:
            'Đau đầu mãn tính có thể là dấu hiệu của nhiều bệnh lý khác nhau. PGS.TS Lê Văn Cường phân tích các loại đau đầu thường gặp, khi nào là bình thường và khi nào cần đi khám ngay.',
        imageUrl: 'https://placehold.co/400x300/1e3a8a/ffffff?text=Dau+Dau+Thuong+Xuyen',
        publishedAt: '03/01/2025',
    },
];

export const NEWS_CATEGORIES = [
    { slug: 'y-hoc-thuong-thuc', label: 'Y học thường thức' },
    { slug: 'tin-tuc-su-kien', label: 'Tin tức sự kiện' },
    { slug: 'hoi-dap-y-khoa', label: 'Hỏi đáp y khoa' },
] as const;

export type NewsCategorySlug = (typeof NEWS_CATEGORIES)[number]['slug'];
