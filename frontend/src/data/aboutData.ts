// src/data/aboutData.ts

export interface WhyChooseUsItem {
    id: string;
    title: string;
    description: string;
    imageUrl: string; // CMS Ready
    linkTo: string; // Đường dẫn khi click "Xem chi tiết"
}

export const whyChooseUsData: WhyChooseUsItem[] = [
    {
        id: 'thiet-bi',
        title: 'TRANG THIẾT BỊ HIỆN ĐẠI',
        description: 'Hệ thống máy móc, trang thiết bị y tế hiện đại, đồng bộ...',
        imageUrl: 'https://placehold.co/600x400?text=Thiet+Bi',
        linkTo: '/co-so-vat-chat/trang-thiet-bi',
    },
    {
        id: 'bac-si',
        title: 'ĐỘI NGŨ BÁC SĨ CHUYÊN MÔN CAO',
        description: 'Quy tụ đội ngũ Thầy thuốc ưu tú, Giáo sư, Tiến sĩ...',
        imageUrl: 'https://placehold.co/600x400?text=Bac+Si',
        linkTo: '/doi-ngu-bac-si',
    },
    {
        id: 'dich-vu',
        title: 'DỊCH VỤ CHUẨN QUỐC TẾ',
        description: 'Quy trình khám chữa bệnh nhanh chóng, khép kín...',
        imageUrl: 'https://placehold.co/600x400?text=Dich+Vu',
        linkTo: '/dich-vu/tat-ca',
    },
];
