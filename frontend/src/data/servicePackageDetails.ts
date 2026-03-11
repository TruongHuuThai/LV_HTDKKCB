// src/data/servicePackageDetails.ts
// Mock data giả lập API response khi fetch chi tiết một gói khám.
// htmlContent chứa WYSIWYG output từ CMS (TinyMCE / CKEditor).
// Mọi hình ảnh là URL string — Admin chỉ cần thay link, không cần đụng code.

export interface ServicePackageDetail {
    id: string;
    categorySlug: string; // Ứng với ServiceGroup.id
    slug: string;         // Ứng với ServicePackage.id
    title: string;
    publishedAt: string;
    coverImage: string;   // Ảnh hero đầu bài
    htmlContent: string;  // WYSIWYG output — có thể chứa tables, imgs, headings
}

// ─── Helper placeholder ───────────────────────────────────────────────────────
const ph = (w: number, h: number, bg: string, fg: string, text: string) =>
    `https://placehold.co/${w}x${h}/${bg}/${fg}?text=${encodeURIComponent(text)}`;

// ─── Mock Data ────────────────────────────────────────────────────────────────
export const SERVICE_PACKAGE_DETAILS: ServicePackageDetail[] = [
    {
        id: 'detail-001',
        categorySlug: 'kham-tong-quat-ca-nhan',
        slug: 'vip-gold',
        title: 'Gói VIP Gold – Khám sức khỏe tổng quát và tầm soát ung thư',
        publishedAt: '10/03/2025',
        coverImage: ph(1200, 480, '1d4ed8', 'ffffff', 'VIP+Gold+Package+Cover'),
        htmlContent: `
            <h2>Giới thiệu gói VIP Gold</h2>
            <p>Gói <strong>VIP Gold</strong> là chương trình khám sức khỏe toàn diện, kết hợp tầm soát ung thư cơ bản dành cho cá nhân muốn kiểm tra sức khỏe định kỳ một cách bài bản. Với hơn <strong>40 hạng mục xét nghiệm</strong> và chẩn đoán hình ảnh, khách hàng sẽ có bức tranh toàn diện về tình trạng sức khỏe của mình.</p>

            <img src="${ph(900, 380, 'dbeafe', '1e40af', 'Khach+hang+dang+duoc+kham')}" alt="Khách hàng đang được khám" style="width:100%; border-radius:12px; margin: 16px 0;" />

            <h2>Đối tượng phù hợp</h2>
            <ul>
                <li>Nam hoặc nữ từ <strong>30 tuổi trở lên</strong>.</li>
                <li>Người có tiền sử gia đình mắc bệnh ung thư.</li>
                <li>Người thường xuyên tiếp xúc với môi trường ô nhiễm hoặc hóa chất.</li>
                <li>Người muốn thực hiện kiểm tra sức khỏe định kỳ hàng năm.</li>
            </ul>

            <h2>Danh mục xét nghiệm và dịch vụ</h2>
            <p>Gói VIP Gold bao gồm đầy đủ các xét nghiệm lâm sàng, cận lâm sàng và chẩn đoán hình ảnh theo bảng chi tiết dưới đây:</p>

            <table>
                <thead>
                    <tr>
                        <th>STT</th>
                        <th>Tên danh mục khám</th>
                        <th>Giá tiền (đã bao gồm trong gói)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>1</td>
                        <td>Khám lâm sàng tổng quát (đa khoa)</td>
                        <td>200.000đ</td>
                    </tr>
                    <tr>
                        <td>2</td>
                        <td>Xét nghiệm máu toàn bộ (CBC 26 chỉ số)</td>
                        <td>180.000đ</td>
                    </tr>
                    <tr>
                        <td>3</td>
                        <td>Chức năng gan (AST, ALT, GGT, Bilirubin)</td>
                        <td>220.000đ</td>
                    </tr>
                    <tr>
                        <td>4</td>
                        <td>Chức năng thận (Creatinine, Urea, Acid Uric)</td>
                        <td>150.000đ</td>
                    </tr>
                    <tr>
                        <td>5</td>
                        <td>Bộ mỡ máu (Cholesterol, LDL, HDL, Triglyceride)</td>
                        <td>200.000đ</td>
                    </tr>
                    <tr>
                        <td>6</td>
                        <td>Đường huyết lúc đói + HbA1c</td>
                        <td>120.000đ</td>
                    </tr>
                    <tr>
                        <td>7</td>
                        <td>Xét nghiệm nước tiểu toàn phần (10 chỉ số)</td>
                        <td>80.000đ</td>
                    </tr>
                    <tr>
                        <td>8</td>
                        <td>Tầm soát ung thư: AFP, CEA, PSA (nam) / CA 125 (nữ)</td>
                        <td>680.000đ</td>
                    </tr>
                    <tr>
                        <td>9</td>
                        <td>Siêu âm bụng tổng quát (gan, mật, tụy, lách, thận)</td>
                        <td>350.000đ</td>
                    </tr>
                    <tr>
                        <td>10</td>
                        <td>Điện tâm đồ (ECG 12 chuyển đạo)</td>
                        <td>120.000đ</td>
                    </tr>
                    <tr>
                        <td>11</td>
                        <td>X-quang phổi thẳng (kỹ thuật số)</td>
                        <td>150.000đ</td>
                    </tr>
                    <tr>
                        <td>12</td>
                        <td>Nội soi dạ dày không đau (gây mê ngắn)</td>
                        <td>980.000đ</td>
                    </tr>
                    <tr>
                        <td>13</td>
                        <td>CT ngực liều thấp (LDCT) – tầm soát ung thư phổi</td>
                        <td>1.200.000đ</td>
                    </tr>
                    <tr>
                        <td>14</td>
                        <td>Tư vấn kết quả với bác sĩ chuyên khoa</td>
                        <td>Miễn phí</td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="2"><strong>Tổng nếu đi lẻ</strong></td>
                        <td><strong>~5.600.000đ</strong></td>
                    </tr>
                    <tr>
                        <td colspan="2"><strong>Giá gói VIP Gold (tiết kiệm 20%)</strong></td>
                        <td><strong style="color:#2563eb;">4.500.000đ</strong></td>
                    </tr>
                </tfoot>
            </table>

            <img src="${ph(900, 300, 'dcfce7', '166534', 'Co+so+vat+chat+hien+dai+UMC')}" alt="Cơ sở vật chất hiện đại UMC" style="width:100%; border-radius:12px; margin: 16px 0;" />

            <h2>Quy trình thực hiện</h2>
            <p>Sau khi đặt lịch trực tuyến, khách hàng đến phòng khám theo giờ hẹn. Toàn bộ quy trình khám được thực hiện trong <strong>một buổi sáng</strong> (3–4 giờ), kết quả được trả trong vòng <strong>24–48 giờ</strong>. Bác sĩ sẽ tư vấn trực tiếp và lập kế hoạch theo dõi sức khỏe cá nhân hóa.</p>

            <h2>Lưu ý trước khi đến khám</h2>
            <ul>
                <li><strong>Nhịn ăn</strong> ít nhất 8 tiếng trước khi lấy máu và nội soi.</li>
                <li>Mang theo <strong>CCCD/CMND gốc</strong> và thẻ BHYT (nếu có).</li>
                <li>Tránh uống rượu bia trong <strong>48 giờ</strong> trước ngày khám.</li>
                <li>Mặc quần áo thoải mái, dễ thay — tránh trang sức kim loại.</li>
            </ul>
        `,
    },

    // ─── Các gói khác (để related packages không bị trống) ───────────────────
    {
        id: 'detail-002',
        categorySlug: 'kham-tong-quat-ca-nhan',
        slug: 'co-ban',
        title: 'Gói Cơ Bản – Khám sức khỏe tổng quát cá nhân',
        publishedAt: '05/03/2025',
        coverImage: ph(1200, 480, '1e40af', 'ffffff', 'Co+Ban+Package+Cover'),
        htmlContent: `
            <h2>Giới thiệu gói Cơ Bản</h2>
            <p>Gói <strong>Cơ Bản</strong> là lựa chọn phù hợp cho những ai muốn kiểm tra sức khỏe tổng quát với chi phí hợp lý. Bao gồm các xét nghiệm thiết yếu nhất để phát hiện sớm các vấn đề sức khỏe phổ biến.</p>
            <table>
                <thead>
                    <tr><th>STT</th><th>Tên danh mục khám</th><th>Giá tiền</th></tr>
                </thead>
                <tbody>
                    <tr><td>1</td><td>Khám lâm sàng đa khoa</td><td>200.000đ</td></tr>
                    <tr><td>2</td><td>Tổng phân tích tế bào máu</td><td>130.000đ</td></tr>
                    <tr><td>3</td><td>Xét nghiệm nước tiểu</td><td>80.000đ</td></tr>
                    <tr><td>4</td><td>Đo huyết áp, BMI</td><td>Miễn phí</td></tr>
                    <tr><td>5</td><td>Tư vấn bác sĩ đa khoa</td><td>Miễn phí</td></tr>
                </tbody>
            </table>
        `,
    },
    {
        id: 'detail-003',
        categorySlug: 'kham-tong-quat-ca-nhan',
        slug: 'nang-cao',
        title: 'Gói Nâng Cao – Khám sức khỏe tổng quát với siêu âm',
        publishedAt: '08/03/2025',
        coverImage: ph(1200, 480, '0369a1', 'ffffff', 'Nang+Cao+Package+Cover'),
        htmlContent: `
            <h2>Giới thiệu gói Nâng Cao</h2>
            <p>Gói <strong>Nâng Cao</strong> bổ sung siêu âm bụng tổng quát, điện tâm đồ và X-quang ngực thẳng so với gói Cơ Bản. Được khuyến nghị cho người <strong>trên 35 tuổi</strong> hoặc có yếu tố nguy cơ tim mạch.</p>
            <table>
                <thead>
                    <tr><th>STT</th><th>Tên danh mục khám</th><th>Giá tiền</th></tr>
                </thead>
                <tbody>
                    <tr><td>1</td><td>Toàn bộ gói Cơ Bản</td><td>1.200.000đ</td></tr>
                    <tr><td>2</td><td>Siêu âm bụng tổng quát</td><td>350.000đ</td></tr>
                    <tr><td>3</td><td>Điện tâm đồ (ECG)</td><td>120.000đ</td></tr>
                    <tr><td>4</td><td>X-quang ngực thẳng</td><td>150.000đ</td></tr>
                </tbody>
            </table>
        `,
    },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────
export function getPackageDetail(
    categorySlug: string,
    packageSlug: string,
): ServicePackageDetail | undefined {
    return SERVICE_PACKAGE_DETAILS.find(
        (d) => d.categorySlug === categorySlug && d.slug === packageSlug,
    );
}

export function getRelatedPackages(
    categorySlug: string,
    excludeSlug: string,
    limit = 3,
): ServicePackageDetail[] {
    return SERVICE_PACKAGE_DETAILS.filter(
        (d) => d.categorySlug === categorySlug && d.slug !== excludeSlug,
    ).slice(0, limit);
}
