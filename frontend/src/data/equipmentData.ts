// src/data/equipmentData.ts

export interface EquipmentItem {
    id: string;
    name: string;
    description: string;
    imageUrl: string;
}

export const equipmentData: EquipmentItem[] = [
    {
        id: 'mri-3t',
        name: 'Hệ thống MRI 3 Tesla',
        description: 'Ứng dụng trong chẩn đoán hình ảnh thần kinh, cơ xương khớp, tim mạch và ung bướu với độ phân giải cao, rút ngắn thời gian chụp.',
        imageUrl: 'https://placehold.co/400x300?text=MRI+3.0T',
    },
    {
        id: 'ct-128',
        name: 'Máy chụp cắt lớp CT 128 lát cắt',
        description: 'Công nghệ chụp nhanh, liều tia thấp, cho phép đánh giá chính xác các tổn thương nhỏ từ động mạch vành đến các bệnh lý hô hấp.',
        imageUrl: 'https://placehold.co/400x300?text=CT+Scanner+128',
    },
    {
        id: 'pet-ct',
        name: 'Hệ thống chụp PET/CT',
        description: 'Quét toàn thân và đánh giá chức năng chuyển hóa tế bào ở cấp độ phân tử, thiết bị chuyên dụng phát hiện sớm ung thư và di căn.',
        imageUrl: 'https://placehold.co/400x300?text=PET/CT',
    },
    {
        id: 'sieu-am-4d',
        name: 'Máy siêu âm màu 4D thế hệ mới',
        description: 'Hỗ trợ thăm khám chuyên khoa Sản phụ khoa, Tim mạch và siêu âm tổng quát với khả năng hình ảnh sắc nét và đo lường chính xác.',
        imageUrl: 'https://placehold.co/400x300?text=Sieu+Am+4D',
    },
    {
        id: 'x-quang-ts',
        name: 'Hệ thống X-quang kỹ thuật số',
        description: 'Giải pháp chụp x quang thế hệ mới đảm bảo liều tia được kiểm soát chặt chẽ, tối ưu hóa chất lượng hình ảnh nhanh chóng.',
        imageUrl: 'https://placehold.co/400x300?text=X-Quang+KTS',
    }
];
