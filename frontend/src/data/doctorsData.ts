// src/data/doctorsData.ts

export interface Doctor {
    id: string;
    name: string;
    avatar: string;
    degree: string;       // Ths.BS, TS.BS, PGS.TS.BS…
    experience: string;   // "15 năm"
    specialtySlug: string; // maps to CK_TEN (slug-form) for filtering
    specialtyName: string; // display name
    position: string;      // Trưởng khoa, Phó khoa…
    expertise: string;     // Sở trường
    featured?: boolean;
}

// ─── Helper ──────────────────────────────────────────────────────────────────
const av = (label: string) =>
    `https://placehold.co/150x200/bfdbfe/1e40af?text=${encodeURIComponent(label)}`;

// ─── Mock Doctors ─────────────────────────────────────────────────────────────
export const DOCTORS: Doctor[] = [
    {
        id: 'bs-001',
        name: 'TS.BS NGUYỄN THỊ THANH THUỶ',
        avatar: av('TS.BS\nThuỷ'),
        degree: 'Tiến sĩ Bác sĩ',
        experience: '20 năm',
        specialtySlug: 'noi-tong-quat',
        specialtyName: 'Nội tổng quát',
        position: 'Trưởng khoa Nội tổng quát',
        expertise: 'Điều trị bệnh lý nội khoa phức tạp, tư vấn sức khỏe toàn diện',
        featured: true,
    },
    {
        id: 'bs-002',
        name: 'PGS.TS.BS TRẦN MINH QUANG',
        avatar: av('PGS.TS\nQuang'),
        degree: 'Phó Giáo sư – Tiến sĩ Bác sĩ',
        experience: '25 năm',
        specialtySlug: 'tim-mach',
        specialtyName: 'Tim mạch',
        position: 'Phó Giám đốc Trung tâm Tim mạch',
        expertise: 'Can thiệp mạch vành, đặt stent, phẫu thuật tim hở',
        featured: true,
    },
    {
        id: 'bs-003',
        name: 'THS.BS PHẠM THỊ HỒNG NHUNG',
        avatar: av('THS.BS\nNhung'),
        degree: 'Thạc sĩ Bác sĩ',
        experience: '12 năm',
        specialtySlug: 'da-lieu',
        specialtyName: 'Da liễu',
        position: 'Bác sĩ chuyên khoa Da liễu',
        expertise: 'Điều trị mụn trứng cá, viêm da cơ địa, nấm da và laser thẩm mỹ',
    },
    {
        id: 'bs-004',
        name: 'BSCK2 LÊ VĂN HOÀNG',
        avatar: av('BSCK2\nHoàng'),
        degree: 'Bác sĩ chuyên khoa II',
        experience: '18 năm',
        specialtySlug: 'ngoai-tong-quat',
        specialtyName: 'Ngoại tổng quát',
        position: 'Trưởng khoa Ngoại tổng quát',
        expertise: 'Phẫu thuật nội soi tiêu hoá, cắt túi mật, thoát vị bẹn',
        featured: true,
    },
    {
        id: 'bs-005',
        name: 'TS.BS NGUYỄN HOÀI NAM',
        avatar: av('TS.BS\nNam'),
        degree: 'Tiến sĩ Bác sĩ',
        experience: '16 năm',
        specialtySlug: 'than-kinh',
        specialtyName: 'Thần kinh',
        position: 'Phó trưởng khoa Thần kinh',
        expertise: 'Đột quỵ não, Parkinson, động kinh, đau đầu mạn tính',
    },
    {
        id: 'bs-006',
        name: 'THS.BS CKI ĐINH THỊ LAN ANH',
        avatar: av('THS.BS\nLan Anh'),
        degree: 'Thạc sĩ – Bác sĩ Chuyên khoa I',
        experience: '10 năm',
        specialtySlug: 'nhi-khoa',
        specialtyName: 'Nhi khoa',
        position: 'Bác sĩ Nhi tổng quát',
        expertise: 'Chăm sóc trẻ sơ sinh, hô hấp nhi, dị ứng – miễn dịch nhi',
    },
    {
        id: 'bs-007',
        name: 'BSCK1 VÕ TRỌNG NGHĨA',
        avatar: av('BSCK1\nNghĩa'),
        degree: 'Bác sĩ Chuyên khoa I',
        experience: '8 năm',
        specialtySlug: 'noi-tong-quat',
        specialtyName: 'Nội tổng quát',
        position: 'Bác sĩ Nội tổng quát',
        expertise: 'Tăng huyết áp, đái tháo đường, rối loạn lipid máu',
    },
    {
        id: 'bs-008',
        name: 'PGS.TS.BS HUỲNH MINH TUẤN',
        avatar: av('PGS.TS\nTuấn'),
        degree: 'Phó Giáo sư – Tiến sĩ Bác sĩ',
        experience: '22 năm',
        specialtySlug: 'tim-mach',
        specialtyName: 'Tim mạch',
        position: 'Trưởng khoa Tim mạch',
        expertise: 'Siêu âm tim, Holter điện tâm đồ 24h, rối loạn nhịp tim',
        featured: true,
    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Lấy danh sách các chuyên khoa duy nhất từ mock data */
export function getMockSpecialties() {
    const seen = new Set<string>();
    return DOCTORS.reduce<{ slug: string; name: string }[]>((acc, d) => {
        if (!seen.has(d.specialtySlug)) {
            seen.add(d.specialtySlug);
            acc.push({ slug: d.specialtySlug, name: d.specialtyName });
        }
        return acc;
    }, []);
}

/** Lọc bác sĩ theo slug chuyên khoa */
export function getDoctorsBySpecialty(slug?: string): Doctor[] {
    if (!slug) return DOCTORS;
    return DOCTORS.filter((d) => d.specialtySlug === slug);
}
