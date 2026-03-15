export const SERVICE_TYPES = [
    'CHAN_DOAN_HINH_ANH',
    'NOI_SOI',
    'THU_THUAT',
    'XET_NGHIEM',
    'THAM_DO_CHUC_NANG',
] as const;

export type ServiceTypeValue = (typeof SERVICE_TYPES)[number];

export const SERVICE_TYPE_LABELS: Record<ServiceTypeValue, string> = {
    CHAN_DOAN_HINH_ANH: 'Chẩn đoán hình ảnh',
    NOI_SOI: 'Nội soi',
    THU_THUAT: 'Thủ thuật',
    XET_NGHIEM: 'Xét nghiệm',
    THAM_DO_CHUC_NANG: 'Thăm dò chức năng',
};
