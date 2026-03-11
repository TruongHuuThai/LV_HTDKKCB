// src/data/specialtiesData.ts

export interface SpecialtyData {
    id: string;
    slug: string;
    name: string;
    iconName: string; // Lucide icon name dùng để render
    shortDesc: string;
    description: string; // HTML content
    images: string[];
}

const img = (w: number, h: number, label: string) =>
    `https://placehold.co/${w}x${h}/dbeafe/1e40af?text=${encodeURIComponent(label)}`;

export const SPECIALTIES_DATA: SpecialtyData[] = [
    {
        id: '1',
        slug: 'noi-tong-quat',
        name: 'Nội tổng quát',
        iconName: 'Heart',
        shortDesc: 'Chẩn đoán và điều trị các bệnh lý nội khoa',
        description: `
      <h2>Giới thiệu Khoa Nội tổng quát</h2>
      <p>Khoa Nội tổng quát chuyên tiếp nhận và điều trị các bệnh nhân mắc bệnh lý nội khoa phức tạp, đặc biệt là người cao tuổi và bệnh nhân mắc nhiều bệnh đồng thời.</p>
      <h2>Dịch vụ nổi bật</h2>
      <ul>
        <li>Khám và điều trị tăng huyết áp, đái tháo đường</li>
        <li>Điều trị bệnh phổi mạn tính (COPD, hen phế quản)</li>
        <li>Xử lý các bệnh lý tiêu hóa: viêm loét dạ dày, gan nhiễm mỡ</li>
        <li>Quản lý bệnh lý thận và rối loạn điện giải</li>
        <li>Khám sức khỏe định kỳ và tư vấn phòng bệnh</li>
      </ul>
      <h2>Đối tượng khám</h2>
      <p>Người lớn từ 18 tuổi trở lên có các vấn đề về nội khoa cần thăm khám và theo dõi dài hạn.</p>
    `,
        images: [
            img(800, 500, 'Khoa Nội - Phòng khám'),
            img(800, 500, 'Khoa Nội - Thiết bị'),
            img(800, 500, 'Khoa Nội - Bệnh phòng'),
        ],
    },
    {
        id: '2',
        slug: 'ngoai-tong-quat',
        name: 'Ngoại tổng quát',
        iconName: 'Scissors',
        shortDesc: 'Phẫu thuật nội soi và ngoại khoa toàn diện',
        description: `
      <h2>Giới thiệu Khoa Ngoại tổng quát</h2>
      <p>Khoa Ngoại tổng quát thực hiện các can thiệp phẫu thuật từ cấp cứu đến phẫu thuật chương trình, ứng dụng kỹ thuật nội soi tiên tiến giúp bệnh nhân hồi phục nhanh.</p>
      <h2>Dịch vụ nổi bật</h2>
      <ul>
        <li>Phẫu thuật nội soi cắt túi mật, ruột thừa</li>
        <li>Phẫu thuật thoát vị bẹn, thoát vị rốn</li>
        <li>Phẫu thuật ung thư đại tràng, trực tràng</li>
        <li>Điều trị áp xe, nhọt, u mềm dưới da</li>
        <li>Phẫu thuật tuyến giáp, tuyến vú</li>
      </ul>
      <h2>Đối tượng khám</h2>
      <p>Bệnh nhân có chỉ định phẫu thuật các cơ quan trong ổ bụng và ngoại khoa tổng quát.</p>
    `,
        images: [
            img(800, 500, 'Phòng mổ nội soi'),
            img(800, 500, 'Hồi phục sau mổ'),
            img(800, 500, 'Thiết bị ngoại khoa'),
        ],
    },
    {
        id: '3',
        slug: 'san-phu-khoa',
        name: 'Sản - Phụ khoa',
        iconName: 'Baby',
        shortDesc: 'Chăm sóc thai sản và sức khỏe phụ nữ',
        description: `
      <h2>Giới thiệu Khoa Sản - Phụ khoa</h2>
      <p>Khoa Sản - Phụ khoa cung cấp dịch vụ chăm sóc toàn diện cho phụ nữ trong suốt thai kỳ, sinh nở và các vấn đề phụ khoa sau sinh.</p>
      <h2>Dịch vụ nổi bật</h2>
      <ul>
        <li>Khám thai định kỳ và siêu âm thai</li>
        <li>Sinh thường và sinh mổ an toàn</li>
        <li>Tầm soát ung thư cổ tử cung (Pap smear, HPV test)</li>
        <li>Điều trị u xơ tử cung, u nang buồng trứng</li>
        <li>Tư vấn kế hoạch hóa gia đình và hỗ trợ sinh sản</li>
      </ul>
      <h2>Đối tượng khám</h2>
      <p>Phụ nữ ở mọi lứa tuổi, đặc biệt là phụ nữ mang thai và phụ nữ có các vấn đề phụ khoa.</p>
    `,
        images: [
            img(800, 500, 'Phòng sinh'),
            img(800, 500, 'Siêu âm thai'),
            img(800, 500, 'Chăm sóc sơ sinh'),
        ],
    },
    {
        id: '4',
        slug: 'nhi-khoa',
        name: 'Nhi khoa',
        iconName: 'Baby',
        shortDesc: 'Chăm sóc sức khỏe cho trẻ em từ sơ sinh đến 15 tuổi',
        description: `
      <h2>Giới thiệu Khoa Nhi</h2>
      <p>Khoa Nhi được trang bị đầy đủ thiết bị chuyên dụng, đội ngũ bác sĩ giàu kinh nghiệm trong chăm sóc sức khỏe trẻ em từ sơ sinh đến 15 tuổi.</p>
      <h2>Dịch vụ nổi bật</h2>
      <ul>
        <li>Khám và điều trị bệnh hô hấp: viêm phổi, hen suyễn</li>
        <li>Điều trị tiêu chảy, rối loạn tiêu hóa ở trẻ</li>
        <li>Theo dõi tăng trưởng và phát triển trẻ</li>
        <li>Tiêm phòng vắc-xin theo lịch</li>
        <li>Tư vấn dinh dưỡng cho trẻ</li>
      </ul>
      <h2>Đối tượng khám</h2>
      <p>Trẻ em từ sơ sinh đến 15 tuổi có các vấn đề sức khỏe cần được thăm khám và điều trị.</p>
    `,
        images: [
            img(800, 500, 'Phòng khám Nhi'),
            img(800, 500, 'Chăm sóc trẻ sơ sinh'),
            img(800, 500, 'Thiết bị Nhi khoa'),
        ],
    },
    {
        id: '5',
        slug: 'chan-doan-hinh-anh',
        name: 'Chẩn đoán hình ảnh',
        iconName: 'ScanLine',
        shortDesc: 'X-quang, siêu âm, CT, MRI hiện đại',
        description: `
      <h2>Giới thiệu Khoa Chẩn đoán hình ảnh</h2>
      <p>Khoa Chẩn đoán hình ảnh được trang bị hệ thống máy móc hiện đại thế hệ mới, hỗ trợ chẩn đoán chính xác các bệnh lý phức tạp.</p>
      <h2>Dịch vụ nổi bật</h2>
      <ul>
        <li>X-quang kỹ thuật số (DR) toàn thân</li>
        <li>Siêu âm ổ bụng, tim, mạch máu, thai nhi</li>
        <li>Chụp CT 128 lát cắt — CT mạch vành, não, ngực</li>
        <li>Chụp MRI 1.5 Tesla — cột sống, khớp, não</li>
        <li>Chụp nhũ ảnh (Mammography) tầm soát ung thư vú</li>
      </ul>
      <h2>Đối tượng khám</h2>
      <p>Mọi bệnh nhân có chỉ định chẩn đoán hình ảnh từ bác sĩ điều trị.</p>
    `,
        images: [
            img(800, 500, 'Máy MRI 1.5T'),
            img(800, 500, 'Máy CT 128 lát'),
            img(800, 500, 'Phòng X-quang DR'),
        ],
    },
    {
        id: '6',
        slug: 'tim-mach',
        name: 'Tim mạch',
        iconName: 'ActivitySquare',
        shortDesc: 'Chẩn đoán và can thiệp tim mạch',
        description: `
      <h2>Giới thiệu Khoa Tim mạch</h2>
      <p>Khoa Tim mạch UMC là một trong những trung tâm tim mạch hàng đầu, với đầy đủ trang thiết bị hiện đại để chẩn đoán và can thiệp mọi bệnh lý tim mạch.</p>
      <h2>Dịch vụ nổi bật</h2>
      <ul>
        <li>Đo điện tâm đồ (ECG) và Holter ECG 24h</li>
        <li>Siêu âm tim qua thành ngực và qua thực quản</li>
        <li>Can thiệp mạch vành — đặt stent</li>
        <li>Cấy máy tạo nhịp, máy khử rung tim</li>
        <li>Điều trị suy tim, rối loạn nhịp tim</li>
      </ul>
      <h2>Đối tượng khám</h2>
      <p>Bệnh nhân có các triệu chứng hoặc tiền sử bệnh tim mạch, rối loạn nhịp tim.</p>
    `,
        images: [
            img(800, 500, 'Phòng can thiệp tim mạch'),
            img(800, 500, 'Siêu âm tim'),
            img(800, 500, 'Điện tâm đồ'),
        ],
    },
    {
        id: '7',
        slug: 'than-kinh',
        name: 'Thần kinh',
        iconName: 'Brain',
        shortDesc: 'Chẩn đoán và điều trị bệnh lý thần kinh',
        description: `
      <h2>Giới thiệu Khoa Thần kinh</h2>
      <p>Khoa Thần kinh chuyên chẩn đoán và điều trị các bệnh lý về não, tủy sống và hệ thần kinh ngoại biên, với đội ngũ chuyên gia đầu ngành.</p>
      <h2>Dịch vụ nổi bật</h2>
      <ul>
        <li>Điều trị đột quỵ não cấp tính — thrombolysis IV</li>
        <li>Chẩn đoán và điều trị Parkinson, Alzheimer</li>
        <li>Điều trị động kinh, đau đầu mạn tính</li>
        <li>Phục hồi chức năng sau đột quỵ</li>
        <li>Đo điện não đồ (EEG), điện cơ (EMG)</li>
      </ul>
      <h2>Đối tượng khám</h2>
      <p>Bệnh nhân có các triệu chứng thần kinh: đau đầu, chóng mặt, yếu liệt, rối loạn ý thức.</p>
    `,
        images: [
            img(800, 500, 'Phòng điều trị đột quỵ'),
            img(800, 500, 'MRI não'),
            img(800, 500, 'Phục hồi chức năng'),
        ],
    },
    {
        id: '8',
        slug: 'da-lieu',
        name: 'Da liễu',
        iconName: 'Sparkles',
        shortDesc: 'Điều trị các bệnh về da và thẩm mỹ da',
        description: `
      <h2>Giới thiệu Khoa Da liễu</h2>
      <p>Khoa Da liễu cung cấp dịch vụ điều trị các bệnh lý da liễu và thẩm mỹ da, sử dụng các kỹ thuật laser và công nghệ hiện đại nhất.</p>
      <h2>Dịch vụ nổi bật</h2>
      <ul>
        <li>Điều trị mụn trứng cá, sẹo thâm, sẹo rỗ</li>
        <li>Điều trị viêm da cơ địa, vảy nến, nấm da</li>
        <li>Laser xóa nám, tàn nhang, đốm nâu</li>
        <li>Tiêm botox, filler thẩm mỹ</li>
        <li>Tầm soát và điều trị ung thư da</li>
      </ul>
      <h2>Đối tượng khám</h2>
      <p>Mọi lứa tuổi có các vấn đề về da, tóc, móng hay nhu cầu thẩm mỹ da an toàn.</p>
    `,
        images: [
            img(800, 500, 'Phòng laser thẩm mỹ'),
            img(800, 500, 'Điều trị da liễu'),
            img(800, 500, 'Thiết bị laser'),
        ],
    },
];

/** Tìm theo slug */
export function getSpecialtyBySlug(slug: string): SpecialtyData | undefined {
    return SPECIALTIES_DATA.find((s) => s.slug === slug);
}
