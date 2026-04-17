// src/data/servicesData.ts
// Central data config cho tất cả nhóm dịch vụ trang "Dịch vụ"

export interface ServicePackage {
    id: string;
    name: string;
    price: string;
    priceColor?: 'blue' | 'red' | 'orange';
    description: string;
    thumbnail: string;
    badge?: string;
    /** CMS-ready: URL ảnh đại diện cho card listing (Admin đổi link là xong) */
    imageUrl?: string;
    /** Đánh dấu gói nổi bật — hiển thị dạng card ngang to ở đầu trang */
    isFeatured?: boolean;
    /** Mô tả ngắn cho card listing */
    summary?: string;
}

export interface ServiceGroup {
    id: string;           // slug dùng cho URL /dich-vu/:slug
    title: string;        // Tên hiển thị trong menu và h1
    shortDesc: string;    // Mô tả ngắn trong dropdown Header
    heroImage: string;    // Ảnh banner lớn (nằm ngang)
    bannerTitle: string;  // Tiêu đề trong banner hero
    bannerDesc: string;   // Mô tả trong banner hero
    articleHtmlContent?: string; // Nội dung bài viết từ CMS (nếu có)
    packages: ServicePackage[];
}

// ─── Helper ──────────────────────────────────────────────────────────────────
const ph = (w: number, h: number, bg: string, fg: string, text: string) =>
    `https://placehold.co/${w}x${h}/${bg}/${fg}?text=${encodeURIComponent(text)}`;

// ─── 8 Nhóm dịch vụ ──────────────────────────────────────────────────────────
export const SERVICES: ServiceGroup[] = [
    // ── 1. Khám tổng quát cá nhân ────────────────────────────────────────────
    {
        id: 'kham-suc-khoe-tong-quat-ca-nhan',
        title: 'Khám sức khỏe tổng quát cá nhân',
        shortDesc: 'Gói khám toàn diện cho từng cá nhân',
        heroImage: ph(800, 400, 'bfdbfe', '1e40af', 'Khám%20tổng%20quát%20cá%20nhân'),
        bannerTitle: 'Khám sức khỏe tổng quát và Tầm soát ung thư',
        bannerDesc:
            'Chương trình kiểm tra sức khỏe định kỳ toàn diện, kết hợp tầm soát ung thư sớm với trang thiết bị hiện đại và đội ngũ chuyên gia đầu ngành tại UMC Clinic.',
        packages: [
            {
                id: 'kham-tong-quat-va-tam-soat-ung-thu',
                name: 'KHÁM SỨC KHỎE TỔNG QUÁT VÀ TẦM SOÁT UNG THƯ',
                price: '4.500.000đ',
                priceColor: 'orange',
                badge: 'Nổi bật',
                isFeatured: true,
                imageUrl: ph(800, 450, 'bfdbfe', '1e40af', 'Khám tổng quát và tầm soát ung thư'),
                summary: 'Khám sức khỏe tổng quát và tầm soát ung thư định kỳ đóng vai trò quan trọng trong việc phát hiện sớm các bệnh lý nguy hiểm. Nhiều loại ung thư hoàn toàn không có triệu chứng ở giai đoạn đầu — kiểm tra định kỳ là cách duy nhất để phát hiện và điều trị kịp thời, cải thiện tỷ lệ khỏi bệnh lên đến 90%.',
                description: 'Gói toàn diện tầm soát ung thư cơ bản (7 loại), nội soi tiêu hóa, CT ngực liều thấp, hơn 40 hạng mục.',
                thumbnail: ph(400, 300, 'fef9c3', '854d0e', 'VIP+Gold'),
            },
            {
                id: 'co-ban',
                name: 'GÓI KHÁM SỨC KHỎE TỔNG QUÁT CƠ BẢN',
                price: '1.200.000đ',
                priceColor: 'blue',
                isFeatured: false,
                imageUrl: ph(400, 280, 'dbeafe', '1e40af', 'Gói cơ bản'),
                summary: 'Bạn nên biết rằng giường bệnh là chiếc giường có chi phí đắt đỏ nhất. Hãy chủ động bảo vệ sức khỏe với gói kiểm tra cơ bản phù hợp cho lần đầu khám tổng quát.',
                description: 'Tổng phân tích tế bào máu, đo huyết áp, chỉ số BMI, xét nghiệm nước tiểu, tư vấn bác sĩ đa khoa.',
                thumbnail: ph(400, 300, 'dbeafe', '1e40af', 'Gói%20Cơ%20Bản'),
            },
            {
                id: 'nang-cao',
                name: 'GÓI KHÁM SỨC KHỎE TỔNG QUÁT NÂNG CAO',
                price: '2.500.000đ',
                priceColor: 'blue',
                badge: 'Phổ biến',
                isFeatured: false,
                imageUrl: ph(400, 280, 'e0f2fe', '0369a1', 'Goi+Nang+Cao'),
                summary: 'Bổ sung siêu âm bụng tổng quát, điện tâm đồ và X-quang ngực thẳng. Được khuyến nghị cho người từ 35 tuổi hoặc có yếu tố nguy cơ tim mạch.',
                description: 'Toàn bộ gói Cơ bản + siêu âm bụng tổng quát, điện tâm đồ, X-quang ngực thẳng.',
                thumbnail: ph(400, 300, 'e0f2fe', '0369a1', 'Gói%20Nâng%20Cao'),
            },
            {
                id: 'chuyen-sau',
                name: 'GÓI KHÁM SỨC KHỎE TỔNG QUÁT CHUYÊN SÂU',
                price: '3.900.000đ',
                priceColor: 'blue',
                isFeatured: false,
                imageUrl: ph(400, 280, 'e0e7ff', '3730a3', 'Goi+Chuyen+Sau'),
                summary: 'Kết hợp nâng cao với nội soi dạ dày không đau, marker ung thư (AFP, CEA, PSA/CA125), định lượng đường huyết HbA1c. Khuyến nghị từ 40 tuổi.',
                description: 'Gói Nâng cao + đo mật độ xương, nội soi dạ dày không đau, định lượng hormone tuyến giáp.',
                thumbnail: ph(400, 300, 'e0e7ff', '3730a3', 'Gói%20Chuyên%20Sâu'),
            },
        ],
        articleHtmlContent: `
            <h2>Tại sao cần khám sức khỏe tổng quát định kỳ?</h2>
            <p>Nhiều bệnh lý nguy hiểm như ung thư, tiểu đường, tim mạch giai đoạn đầu hoàn toàn <strong>không có triệu chứng rõ ràng</strong>. Khám tổng quát định kỳ là cách duy nhất để phát hiện sớm, điều trị kịp thời và cải thiện tỷ lệ khỏi bệnh lên đến <strong>90%</strong>.</p>
            <p>UMC Clinic cung cấp hệ thống khám tổng quát toàn diện — từ xét nghiệm máu, chẩn đoán hình ảnh đến nội soi và tầm soát ung thư — thực hiện trọn vẹn trong <strong>một buổi sáng</strong>, không cần nhập viện.</p>

            <img src="${ph(960, 380, 'bfdbfe', '1e40af', 'Kham+tong+quat+UMC+Clinic')}" alt="Khám tổng quát tại UMC Clinic" style="width:100%;border-radius:12px;margin:16px 0;" />

            <h2>Đối tượng nên khám định kỳ</h2>
            <ul>
                <li>Người <strong>từ 30 tuổi trở lên</strong>, kể cả khi cảm thấy khỏe mạnh.</li>
                <li>Người có tiền sử gia đình mắc ung thư, tim mạch, tiểu đường.</li>
                <li>Người thường xuyên làm việc trong môi trường áp lực, ít vận động.</li>
                <li>Người hút thuốc, uống rượu bia hoặc tiếp xúc môi trường ô nhiễm.</li>
                <li>Phụ nữ đang trong độ tuổi sinh sản hoặc đã mãn kinh.</li>
            </ul>

            <h2>Tầm soát ung thư — Phát hiện sớm, cứu sống nhiều hơn</h2>
            <p>UMC Clinic tích hợp <strong>tầm soát ung thư dựa trên bằng chứng y học</strong> vào các gói khám tổng quát, áp dụng các xét nghiệm marker ung thư tiên tiến và chẩn đoán hình ảnh độ phân giải cao.</p>

            <img src="${ph(960, 340, 'dcfce7', '166534', 'Tam+soat+ung+thu+UMC')}" alt="Tầm soát ung thư UMC" style="width:100%;border-radius:12px;margin:16px 0;" />

            <h2>Bảng giá các gói khám — So sánh nhanh</h2>
            <table>
                <thead>
                    <tr>
                        <th>Gói khám</th>
                        <th>Hạng mục nổi bật</th>
                        <th>Giá</th>
                        <th>Phù hợp với</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>Gói Cơ Bản</strong></td>
                        <td>Xét nghiệm máu, huyết áp, BMI, nước tiểu</td>
                        <td>1.200.000đ</td>
                        <td>Lần đầu kiểm tra sức khỏe</td>
                    </tr>
                    <tr>
                        <td><strong>Gói Nâng Cao</strong> ⭐</td>
                        <td>Cơ bản + siêu âm bụng, ECG, X-quang</td>
                        <td>2.200.000đ</td>
                        <td>Người 35+ có yếu tố nguy cơ</td>
                    </tr>
                    <tr>
                        <td><strong>Gói Chuyên Sâu</strong></td>
                        <td>Nâng cao + nội soi, đo loãng xương, hormone</td>
                        <td>3.500.000đ</td>
                        <td>Người 45+, tiền sử bệnh</td>
                    </tr>
                    <tr>
                        <td><strong>Gói VIP Gold</strong> 🔥</td>
                        <td>Toàn diện + tầm soát ung thư 7 loại, CT phổi</td>
                        <td>4.500.000đ</td>
                        <td>Muốn kiểm tra toàn diện nhất</td>
                    </tr>
                    <tr>
                        <td><strong>Gói Platinum</strong></td>
                        <td>MRI toàn thân, PET-CT, tư vấn 1-1 chuyên gia</td>
                        <td>8.800.000đ</td>
                        <td>Kiểm tra chuyên sâu tối đa</td>
                    </tr>
                </tbody>
            </table>

        `,
    },

    // ── 2. Khám tổng quát doanh nghiệp ───────────────────────────────────────
    {
        id: 'kham-tong-quat-doanh-nghiep',
        title: 'Khám sức khỏe tổng quát doanh nghiệp',
        shortDesc: 'Giải pháp khám định kỳ cho tập thể NLĐ',
        heroImage: ph(800, 400, 'dcfce7', '166534', 'Khám%20tổng%20quát%20doanh%20nghiệp'),
        bannerTitle: 'Gói khám cho doanh nghiệp – Nguồn nhân lực là tài sản vô giá',
        bannerDesc:
            'UMC Clinic cung cấp giải pháp khám sức khỏe định kỳ trọn gói cho doanh nghiệp, đáp ứng đầy đủ quy định pháp luật lao động, tổ chức linh hoạt tại cơ sở hoặc lưu động tại doanh nghiệp.',
        packages: [
            {
                id: 'thong-tu-14',
                name: 'Gói Theo Thông Tư 14',
                price: '350.000đ/NLĐ',
                priceColor: 'blue',
                description: 'Đáp ứng đầy đủ thông tư 14/2013/TT-BYT. Gồm: khám lâm sàng 8 chuyên khoa, xét nghiệm máu cơ bản, X-quang, thị lực, thính lực.',
                thumbnail: ph(400, 300, 'dcfce7', '166534', 'Thông%20Tư%2014'),
            },
            {
                id: 'thiet-ke-rieng',
                name: 'Gói Thiết Kế Riêng',
                price: 'Liên hệ',
                priceColor: 'orange',
                description: 'Gói khám được thiết kế theo đặc thù nghề nghiệp và nhu cầu cụ thể của từng doanh nghiệp. Hỗ trợ tổ chức lưu động.',
                thumbnail: ph(400, 300, 'fef3c7', '92400e', 'Thiết%20Kế%20Riêng'),
                badge: 'Tư vấn miễn phí',
            },
        ],
    },

    // ── 3. Tầm soát hô hấp ───────────────────────────────────────────────────
    {
        id: 'tam-soat-ho-hap',
        title: 'Tầm soát chức năng hô hấp',
        shortDesc: 'Hen suyễn, COPD và các bệnh phổi',
        heroImage: ph(800, 400, 'e0f2fe', '0369a1', 'Tầm%20soát%20hô%20hấp'),
        bannerTitle: 'Tầm soát Hen suyễn, COPD và các bệnh phổi',
        bannerDesc:
            'Đánh giá toàn diện chức năng hô hấp với hệ thống đo hô hấp ký (Spirometry) và CT phổi liều thấp. Phát hiện sớm COPD, hen suyễn, xơ phổi và ung thư phổi.',
        packages: [
            {
                id: 'tam-soat-co-ban',
                name: 'Tầm soát cơ bản',
                price: '890.000đ',
                priceColor: 'blue',
                description: 'Đo hô hấp ký (Spirometry), X-quang phổi thẳng, xét nghiệm đàm, tư vấn bác sĩ hô hấp.',
                thumbnail: ph(400, 300, 'e0f2fe', '0369a1', 'Tầm%20soát%20cơ%20bản'),
            },
            {
                id: 'tan-soat-ct',
                name: 'Tầm soát CT phổi liều thấp',
                price: '2.500.000đ',
                priceColor: 'blue',
                badge: 'Khuyến nghị',
                description: 'CT phổi liều thấp (LDCT) + hô hấp ký + xét nghiệm máu + tư vấn chuyên sâu. Phát hiện sớm ung thư phổi giai đoạn 0-1.',
                thumbnail: ph(400, 300, 'bfdbfe', '1e40af', 'CT%20phổi%20liều%20thấp'),
            },
        ],
    },

    // ── 4. Tầm soát tiêu hóa – gan mật ──────────────────────────────────────
    {
        id: 'tam-soat-tieu-hoa',
        title: 'Tầm soát tiêu hóa – gan mật',
        shortDesc: 'Nội soi dạ dày, đại tràng & gan mật',
        heroImage: ph(800, 400, 'fef3c7', '92400e', 'Tầm%20soát%20tiêu%20hóa'),
        bannerTitle: 'Nội soi tiêu hóa thực quản, dạ dày, đại tràng',
        bannerDesc:
            'Hệ thống nội soi Olympus thế hệ mới với công nghệ NBI (Narrow Band Imaging), thực hiện không đau bằng phương pháp nội soi có gây mê. Tầm soát sớm các bệnh lý ung thư tiêu hóa.',
        packages: [
            {
                id: 'ung-thu-gan',
                name: 'Tầm soát ung thư Gan',
                price: '1.850.000đ',
                priceColor: 'blue',
                description: 'Siêu âm gan mật tụy lách, AFP + AFP-L3, PIVKA-II, Viêm gan B/C (HBsAg, Anti-HCV).',
                thumbnail: ph(400, 300, 'fed7aa', '9a3412', 'Ung%20thư%20Gan'),
            },
            {
                id: 'ung-thu-da-day',
                name: 'Tầm soát ung thư Dạ dày',
                price: '2.100.000đ',
                priceColor: 'blue',
                badge: 'Phổ biến',
                description: 'Nội soi dạ dày NBI + sinh thiết H.pylori, CEA, CA 72-4. Không đau, có gây mê theo yêu cầu.',
                thumbnail: ph(400, 300, 'fef08a', '713f12', 'Ung%20thư%20Dạ%20dày'),
            },
            {
                id: 'ung-thu-dai-truc-trang',
                name: 'Tầm soát ung thư Đại trực tràng',
                price: '2.800.000đ',
                priceColor: 'blue',
                description: 'Nội soi đại tràng NBI + xét nghiệm máu ẩn trong phân, CEA, CA 19-9. Cắt polyp kèm theo nếu cần.',
                thumbnail: ph(400, 300, 'fde68a', '78350f', 'Đại%20trực%20tràng'),
            },
        ],
    },

    // ── 5. Tầm soát tim mạch ─────────────────────────────────────────────────
    {
        id: 'tam-soat-tim-mach',
        title: 'Tầm soát tim mạch',
        shortDesc: 'Tầm soát nguy cơ đột quỵ & bệnh tim',
        heroImage: ph(800, 400, 'fee2e2', '991b1b', 'Tầm%20soát%20tim%20mạch'),
        bannerTitle: 'Tầm soát nguy cơ đột quỵ & Bệnh lý tim mạch',
        bannerDesc:
            'Đánh giá toàn diện nguy cơ tim mạch với phương pháp tiếp cận đa thành phần: siêu âm tim, Holter ECG 24h, siêu âm Doppler mạch máu não và xét nghiệm chuyên sâu.',
        packages: [
            {
                id: 'dai-thao-duong',
                name: 'Gói Đái tháo đường',
                price: '1.500.000đ',
                priceColor: 'blue',
                description: 'Đường huyết lúc đói, HbA1c, C-peptide, Insulin định lượng, microalbumin niệu, đáy mắt đái tháo đường.',
                thumbnail: ph(400, 300, 'fee2e2', '991b1b', 'Đái%20tháo%20đường'),
            },
            {
                id: 'roi-loan-mo-mau',
                name: 'Gói Rối loạn mỡ máu',
                price: '980.000đ',
                priceColor: 'blue',
                description: 'Cholesterol toàn phần, LDL, HDL, Triglyceride, Lp(a), ApoB, CRP siêu nhạy. Tư vấn dinh dưỡng.',
                thumbnail: ph(400, 300, 'fecaca', '7f1d1d', 'Mỡ%20máu'),
            },
            {
                id: 'gut',
                name: 'Gói Gút (Gout)',
                price: '750.000đ',
                priceColor: 'blue',
                description: 'Acid uric máu, Creatinine, tổng phân tích nước tiểu, siêu âm khớp. Tư vấn điều chỉnh chế độ ăn.',
                thumbnail: ph(400, 300, 'fca5a5', '7f1d1d', 'Gút'),
            },
        ],
    },

    // ── 6. Tầm soát ung thư ──────────────────────────────────────────────────
    {
        id: 'tam-soat-ung-thu',
        title: 'Tầm soát ung thư',
        shortDesc: 'Phát hiện sớm ung thư – điều trị kịp thời',
        heroImage: ph(800, 400, 'f3e8ff', '5b21b6', 'Tầm%20soát%20ung%20thư'),
        bannerTitle: 'Tầm soát ung thư tổng quát – Phát hiện sớm, trị lành bệnh',
        bannerDesc:
            'Phát hiện sớm ung thư từ giai đoạn 0 giúp tỷ lệ chữa khỏi lên đến 90%. UMC Clinic cung cấp các gói tầm soát ung thư chuyên biệt theo từng cơ quan với công nghệ tiên tiến nhất.',
        packages: [
            {
                id: 'ung-thu-co-tu-cung',
                name: 'Tầm soát Ung thư Cổ tử cung',
                price: '1.200.000đ',
                priceColor: 'blue',
                badge: 'Khuyến nghị nữ',
                description: 'Pap smear, HPV DNA (14 type), soi cổ tử cung, siêu âm phụ khoa. Dành cho phụ nữ từ 21 tuổi.',
                thumbnail: ph(400, 300, 'fce7f3', '9d174d', 'Ung%20thư%20CTC'),
            },
            {
                id: 'ung-thu-phoi',
                name: 'Tầm soát Ung thư Phổi',
                price: '2.500.000đ',
                priceColor: 'blue',
                description: 'CT phổi liều thấp (LDCT), cyfra 21-1, CEA, NSE. Khuyến nghị người hút thuốc ≥ 20 gói-năm.',
                thumbnail: ph(400, 300, 'e0e7ff', '3730a3', 'Ung%20thư%20Phổi'),
            },
            {
                id: 'ung-thu-vom-hong',
                name: 'Tầm soát Ung thư Vòm họng',
                price: '1.650.000đ',
                priceColor: 'blue',
                description: 'Nội soi mũi họng, EBV-EA IgA, EBV-VCA IgA, CT vùng đầu cổ. Đặc biệt phù hợp người có tiền sử gia đình.',
                thumbnail: ph(400, 300, 'd8b4fe', '4c1d95', 'Vòm%20họng'),
            },
        ],
    },

    // ── 7. Dịch vụ bảo hiểm ──────────────────────────────────────────────────
    {
        id: 'dich-vu-bao-hiem',
        title: 'Dịch vụ Bảo hiểm',
        shortDesc: 'Bảo lãnh viện phí – kết nối bảo hiểm',
        heroImage: ph(800, 400, 'd1fae5', '065f46', 'Dịch%20vụ%20bảo%20hiểm'),
        bannerTitle: 'Dịch vụ Bảo lãnh viện phí – Kết nối với các công ty bảo hiểm',
        bannerDesc:
            'UMC Clinic hợp tác với hơn 20 công ty bảo hiểm hàng đầu Việt Nam và quốc tế. Quy trình bảo lãnh viện phí nhanh chóng, thủ tục đơn giản — bệnh nhân không cần tạm ứng chi phí.',
        packages: [
            {
                id: 'bao-lanh-noi-tru',
                name: 'Bảo lãnh điều trị Nội trú',
                price: 'Theo hợp đồng BH',
                priceColor: 'blue',
                description: 'Bảo lãnh viện phí trực tiếp tại quầy, hỗ trợ hồ sơ toàn diện 24/7 với đội ngũ tư vấn bảo hiểm chuyên nghiệp.',
                thumbnail: ph(400, 300, 'd1fae5', '065f46', 'Nội%20trú'),
            },
            {
                id: 'bao-lanh-ngoai-tru',
                name: 'Bảo lãnh điều trị Ngoại trú',
                price: 'Theo hợp đồng BH',
                priceColor: 'blue',
                description: 'Khám ngoại trú, xét nghiệm, chẩn đoán hình ảnh và dịch vụ ngoại trú được hỗ trợ bảo lãnh trực tiếp.',
                thumbnail: ph(400, 300, 'a7f3d0', '064e3b', 'Ngoại%20trú'),
            },
        ],
    },

    // ── 8. Dịch vụ khác ──────────────────────────────────────────────────────
    {
        id: 'dich-vu-khac',
        title: 'Các dịch vụ khác',
        shortDesc: 'Khám tiền hôn nhân và các dịch vụ đặc biệt',
        heroImage: ph(800, 400, 'fef3c7', '78350f', 'Dịch%20vụ%20khác'),
        bannerTitle: 'Khám sức khỏe Tiền hôn nhân',
        bannerDesc:
            'Gói khám tiền hôn nhân toàn diện giúp các cặp đôi hiểu rõ sức khỏe bản thân trước khi kết hôn, phát hiện sớm các bệnh di truyền, lây nhiễm qua đường tình dục, bảo vệ hạnh phúc gia đình.',
        packages: [
            {
                id: 'tien-hon-nhan-co-ban',
                name: 'Tiền hôn nhân – Cơ bản',
                price: '1.450.000đ',
                priceColor: 'blue',
                description: 'Xét nghiệm HIV/VDRL/HBsAg/Rubella, nhóm máu, tổng phân tích máu, tư vấn di truyền cơ bản.',
                thumbnail: ph(400, 300, 'fef9c3', '854d0e', 'Tiền%20hôn%20nhân%20cơ%20bản'),
            },
            {
                id: 'tien-hon-nhan-toan-dien',
                name: 'Tiền hôn nhân – Toàn diện',
                price: '3.200.000đ',
                priceColor: 'blue',
                badge: 'Khuyến nghị',
                description: 'Toàn bộ gói cơ bản + tầm soát bệnh di truyền (thalassemia, G6PD), chức năng sinh sản, siêu âm bụng.',
                thumbnail: ph(400, 300, 'fde68a', '78350f', 'Tiền%20hôn%20nhân%20toàn%20diện'),
            },
            {
                id: 'suc-khoe-hoc-duong',
                name: 'Khám sức khỏe học đường',
                price: '290.000đ/HS',
                priceColor: 'blue',
                description: 'Khám tổng quát, đo thị lực, cột sống, cân nặng/chiều cao, phát hiện bệnh lý thường gặp ở học sinh.',
                thumbnail: ph(400, 300, 'bfdbfe', '1e40af', 'Học%20đường'),
            },
        ],
    },
];

// ─── Lookup helper ────────────────────────────────────────────────────────────
export function getServiceBySlug(slug: string): ServiceGroup | undefined {
    return SERVICES.find((s) => s.id === slug);
}
