// src/data/guidesData.ts

export interface GuideStep {
    title: string;
    description: string;
    imageUrl?: string; // Ảnh minh họa từng bước — URL từ CMS
}

export interface GuideArticle {
    id: string;
    slug: 'quy-trinh-dat-lich' | 'chuan-bi-kham' | 'thanh-toan-va-bao-hiem';
    title: string;
    subtitle?: string;
    coverImage: string; // Banner đầu trang — URL từ CMS
    htmlContent: string; // Nội dung chung (prose)
    steps?: GuideStep[]; // Timeline / Step Cards (nếu có)
}

export const GUIDE_ARTICLES: GuideArticle[] = [
    // ── 1. Quy trình đặt lịch ──────────────────────────────────────────────
    {
        id: 'guide-001',
        slug: 'quy-trinh-dat-lich',
        title: 'Quy trình đặt lịch khám',
        subtitle: 'Chỉ với vài bước đơn giản, bạn đã có thể đặt lịch khám tại UMC Clinic',
        coverImage: 'https://placehold.co/1200x350/1d4ed8/ffffff?text=Quy+Trinh+Dat+Lich+Kham',
        htmlContent: `
            <p>UMC Clinic cung cấp hệ thống đặt lịch khám trực tuyến hoạt động <strong>24/7</strong>, giúp bạn chủ động sắp xếp thời gian mà không cần xếp hàng chờ đợi. Dưới đây là quy trình chi tiết để đặt lịch khám thành công.</p>
            <p>Sau khi đặt lịch, bạn sẽ nhận được <strong>tin nhắn xác nhận</strong> qua email hoặc SMS bao gồm thời gian, địa điểm và thông tin bác sĩ phụ trách.</p>
        `,
        steps: [
            {
                title: 'Truy cập hệ thống',
                description:
                    'Truy cập website UMC Clinic tại umcclinic.vn hoặc tải ứng dụng UMC Clinic trên App Store / Google Play. Đăng nhập bằng tài khoản đã đăng ký hoặc tạo tài khoản mới nếu đây là lần đầu sử dụng.',
                imageUrl: 'https://placehold.co/600x300/dbeafe/1e40af?text=Buoc+1%3A+Truy+Cap+He+Thong',
            },
            {
                title: 'Chọn chuyên khoa và bác sĩ',
                description:
                    'Duyệt danh sách chuyên khoa và chọn lĩnh vực phù hợp với tình trạng của bạn. Xem thông tin chi tiết về từng bác sĩ: kinh nghiệm, bằng cấp, lịch làm việc và đánh giá từ bệnh nhân trước.',
                imageUrl: 'https://placehold.co/600x300/dbeafe/1e40af?text=Buoc+2%3A+Chon+Bac+Si',
            },
            {
                title: 'Điền thông tin và chọn giờ khám',
                description:
                    'Nhập họ tên, ngày sinh, số điện thoại và triệu chứng sơ bộ. Chọn ngày và khung giờ khám còn trống trong lịch làm việc của bác sĩ. Hệ thống hiển thị thời gian thực — chỉ những slot trống mới được hiển thị.',
                imageUrl: 'https://placehold.co/600x300/dbeafe/1e40af?text=Buoc+3%3A+Chon+Gio+Kham',
            },
            {
                title: 'Xác nhận và thanh toán',
                description:
                    'Kiểm tra lại thông tin lịch hẹn, chọn hình thức thanh toán (chuyển khoản, ví điện tử, hoặc thanh toán tại quầy). Nhấn "Xác nhận đặt lịch" để hoàn tất. Bạn sẽ nhận ngay email và SMS xác nhận kèm mã QR để check-in nhanh tại phòng khám.',
                imageUrl: 'https://placehold.co/600x300/dbeafe/1e40af?text=Buoc+4%3A+Xac+Nhan',
            },
        ],
    },

    // ── 2. Chuẩn bị khám ──────────────────────────────────────────────────
    {
        id: 'guide-002',
        slug: 'chuan-bi-kham',
        title: 'Chuẩn bị trước khi khám',
        subtitle: 'Những điều cần chuẩn bị để buổi khám diễn ra thuận lợi và chính xác nhất',
        coverImage: 'https://placehold.co/1200x350/0369a1/ffffff?text=Chuan+Bi+Kham+Benh',
        htmlContent: `
            <h2>Giấy tờ cần mang theo</h2>
            <ul>
                <li><strong>Chứng minh nhân dân / Căn cước công dân</strong> (bản gốc)</li>
                <li><strong>Thẻ bảo hiểm y tế</strong> còn hạn sử dụng (nếu có)</li>
                <li><strong>Hồ sơ bệnh án cũ</strong>: kết quả xét nghiệm, phim X-quang, đơn thuốc gần nhất liên quan đến tình trạng hiện tại</li>
                <li><strong>Giấy giới thiệu</strong> từ cơ sở y tế khác (nếu được chuyển tuyến)</li>
                <li><strong>Mã QR xác nhận lịch hẹn</strong> từ email/SMS của UMC Clinic</li>
            </ul>

            <h2>Lưu ý về ăn uống và sinh hoạt</h2>
            <ul>
                <li><strong>Xét nghiệm máu tổng quát:</strong> Nhịn ăn hoàn toàn ít nhất <strong>8 tiếng</strong> trước khi lấy máu. Chỉ được uống nước lọc.</li>
                <li><strong>Siêu âm bụng:</strong> Nhịn ăn tối thiểu <strong>6 tiếng</strong> và uống đủ 1–1.5 lít nước trước 1 giờ để bàng quang đầy.</li>
                <li><strong>Siêu âm tim / Điện tâm đồ:</strong> Không cần nhịn ăn, nhưng tránh uống cà phê, trà đặc trước 2 giờ.</li>
                <li><strong>Khám phụ khoa:</strong> Không quan hệ tình dục trong 24 giờ trước khi khám. Không thụt rửa âm đạo.</li>
                <li><strong>Nội soi dạ dày:</strong> Nhịn ăn hoàn toàn ít nhất <strong>8 tiếng</strong>. Thông báo với bác sĩ nếu đang dùng thuốc loãng máu.</li>
            </ul>

            <h2>Trang phục và tư thế</h2>
            <ul>
                <li>Mặc quần áo thoải mái, dễ cởi (tránh các loại trang phục một mảnh khó tháo).</li>
                <li>Không đeo đồ trang sức kim loại nếu có lịch chụp X-quang hoặc MRI.</li>
                <li>Đến trước giờ hẹn ít nhất <strong>15 phút</strong> để làm thủ tục check-in.</li>
            </ul>

            <h2>Lưu ý đặc biệt với trẻ em</h2>
            <ul>
                <li>Mang theo sổ tiêm chủng và phiếu theo dõi sức khỏe của trẻ.</li>
                <li>Chuẩn bị đồ chơi hoặc sách để giúp trẻ bình tĩnh trong phòng chờ.</li>
                <li>Thông báo cho bác sĩ nếu trẻ đang dị ứng với bất kỳ loại thuốc nào.</li>
            </ul>
        `,
    },

    // ── 3. Thanh toán & Bảo hiểm ──────────────────────────────────────────
    {
        id: 'guide-003',
        slug: 'thanh-toan-va-bao-hiem',
        title: 'Thanh toán và bảo hiểm y tế',
        subtitle: 'Các hình thức thanh toán và quyền lợi bảo hiểm y tế tại UMC Clinic',
        coverImage: 'https://placehold.co/1200x350/065f46/ffffff?text=Thanh+Toan+Va+Bao+Hiem',
        htmlContent: `
            <h2>Hình thức thanh toán được chấp nhận</h2>
            <ul>
                <li><strong>Tiền mặt (VNĐ):</strong> Thanh toán trực tiếp tại quầy thu ngân.</li>
                <li><strong>Chuyển khoản ngân hàng:</strong> Hỗ trợ tất cả ngân hàng nội địa. Quét mã QR hiển thị tại quầy hoặc trên ứng dụng.</li>
                <li><strong>Thẻ ngân hàng (ATM/Visa/Mastercard):</strong> Máy POS đặt tại quầy thu ngân và các khu vực dịch vụ.</li>
                <li><strong>Ví điện tử:</strong> MoMo, ZaloPay, VNPay — thanh toán ngay trên ứng dụng UMC Clinic.</li>
                <li><strong>Thanh toán online:</strong> Thanh toán khi đặt lịch qua website/app để được ưu tiên xếp lịch.</li>
            </ul>

            <h2>Quyền lợi bảo hiểm y tế (BHYT)</h2>
            <ul>
                <li>UMC Clinic là cơ sở <strong>khám chữa bệnh theo yêu cầu</strong> — có tiếp nhận bệnh nhân BHYT đúng tuyến và trái tuyến.</li>
                <li><strong>BHYT đúng tuyến:</strong> Thanh toán theo quy định của Nhà nước (80–100% chi phí tùy loại thẻ).</li>
                <li><strong>BHYT trái tuyến:</strong> BHYT thanh toán 40% mức hưởng đúng tuyến đối với tuyến tỉnh/thành phố.</li>
                <li>Vui lòng xuất trình <strong>thẻ BHYT gốc còn hạn</strong> và <strong>CCCD/CMND</strong> khi làm thủ tục.</li>
                <li>Không áp dụng BHYT cho các dịch vụ theo yêu cầu, phòng VIP, và một số kỹ thuật cao không trong danh mục BHYT.</li>
            </ul>

            <h2>Hoàn trả và hủy lịch</h2>
            <ul>
                <li>Hủy lịch trước <strong>24 giờ</strong>: Hoàn 100% phí đặt cọc (nếu có) vào ví UMC hoặc tài khoản ngân hàng trong 3–5 ngày làm việc.</li>
                <li>Hủy lịch trong vòng <strong>2–24 giờ</strong>: Hoàn 50% phí đặt cọc.</li>
                <li>Hủy lịch trong vòng <strong>2 giờ</strong> hoặc không đến: Không hoàn phí đặt cọc.</li>
                <li>Trường hợp lịch bị hủy do phòng khám: Hoàn 100% và ưu tiên sắp xếp lịch mới sớm nhất.</li>
            </ul>

            <h2>Liên hệ hỗ trợ</h2>
            <ul>
                <li>Hotline: <strong>(084) 867 504 590</strong> — Hỗ trợ từ 7:00 – 20:00 hàng ngày</li>
                <li>Email: <strong>thaib2203469@student.ctu.edu.vn</strong></li>
                <li>Chat trực tiếp qua ứng dụng UMC Clinic</li>
            </ul>
        `,
    },
];

export const GUIDE_MENU = [
    { slug: 'quy-trinh-dat-lich', label: 'Quy trình đặt lịch' },
    { slug: 'chuan-bi-kham', label: 'Chuẩn bị khám' },
    { slug: 'thanh-toan-va-bao-hiem', label: 'Thanh toán và bảo hiểm' },
] as const;

export type GuideSlug = (typeof GUIDE_MENU)[number]['slug'];
