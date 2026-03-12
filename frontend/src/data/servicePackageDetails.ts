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
        categorySlug: 'kham-suc-khoe-tong-quat-ca-nhan',
        slug: 'kham-tong-quat-va-tam-soat-ung-thu',
        title: 'Khám sức khỏe tổng quát và Tầm soát ung thư',
        publishedAt: '10/03/2025',
        coverImage: ph(1200, 480, '1d4ed8', 'ffffff', 'Kham+Tong+Quat+Tam+Soat+Ung+Thu'),
        htmlContent: `
            <h2>Khám Sức Khỏe Tổng Quát &amp; Tầm Soát Ung Thư tại UMC Clinic</h2>
            <p>
                UMC Clinic cung cấp hệ thống gói khám sức khỏe tổng quát đa dạng — từ kiểm tra cơ bản đến tầm soát ung thư chuyên sâu — giúp mỗi khách hàng chủ động bảo vệ sức khỏe theo đúng nhu cầu và ngân sách của mình.
                Với đội ngũ bác sĩ chuyên khoa giàu kinh nghiệm và trang thiết bị hiện đại, kết quả xét nghiệm được trả trong vòng <strong>24–48 giờ</strong>, kèm tư vấn cá nhân hóa từ bác sĩ.
            </p>

            <img src="${ph(900, 380, 'dbeafe', '1e40af', 'Kham+suc+khoe+tong+quat+UMC+Clinic')}" alt="Khám sức khỏe tổng quát tại UMC Clinic" />

            <h2>Đối tượng nên khám định kỳ</h2>
            <ul>
                <li>Người từ <strong>25 tuổi trở lên</strong> chưa từng kiểm tra sức khỏe toàn diện.</li>
                <li>Người có tiền sử gia đình mắc bệnh ung thư, tim mạch hoặc tiểu đường.</li>
                <li>Người thường xuyên làm việc áp lực cao, ít vận động hoặc tiếp xúc hóa chất.</li>
                <li>Người hút thuốc lá hoặc sử dụng rượu bia thường xuyên.</li>
                <li>Phụ nữ sau 40 tuổi muốn tầm soát ung thư vú, cổ tử cung định kỳ.</li>
            </ul>

            <img src="${ph(900, 320, 'e0f2fe', '075985', 'Tam+soat+ung+thu+chuyen+sau')}" alt="Tầm soát ung thư chuyên sâu" />

            <h2>Bảng Giá Các Gói Khám</h2>
            <p>UMC Clinic cung cấp <strong>5 gói khám</strong> được thiết kế theo từng mức độ, giúp bạn lựa chọn phù hợp với tình trạng sức khỏe và nhu cầu cá nhân:</p>

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
                        <td><strong>Cơ Bản</strong></td>
                        <td>Khám đa khoa, xét nghiệm máu cơ bản, tổng phân tích nước tiểu, đo huyết áp &amp; BMI</td>
                        <td><strong>1.200.000đ</strong></td>
                        <td>Người từ 18–30 tuổi, lần đầu khám tổng quát</td>
                    </tr>
                    <tr>
                        <td><strong>Nâng Cao</strong></td>
                        <td>Gói Cơ Bản + Siêu âm bụng tổng quát, chức năng gan/thận, mỡ máu, điện tâm đồ, X-quang ngực</td>
                        <td><strong>2.500.000đ</strong></td>
                        <td>Người từ 30–40 tuổi, có yếu tố nguy cơ tim mạch</td>
                    </tr>
                    <tr>
                        <td><strong>Chuyên Sâu</strong></td>
                        <td>Gói Nâng Cao + Marker ung thư (AFP, CEA, PSA/CA125), nội soi dạ dày không đau, đường huyết HbA1c</td>
                        <td><strong>3.900.000đ</strong></td>
                        <td>Người từ 40 tuổi, có tiền sử gia đình ung thư hoặc dạ dày</td>
                    </tr>
                    <tr>
                        <td><strong>VIP Gold</strong></td>
                        <td>Gói Chuyên Sâu + CT ngực liều thấp (LDCT), hormone tuyến giáp (TSH/FT4), tư vấn chuyên khoa 1:1</td>
                        <td><strong>4.500.000đ</strong></td>
                        <td>Người hút thuốc, tiếp xúc ô nhiễm, muốn tầm soát ung thư phổi toàn diện</td>
                    </tr>
                    <tr>
                        <td><strong>Platinum</strong></td>
                        <td>Gói VIP Gold + MRI não/cột sống, siêu âm tim, nội soi đại tràng, xét nghiệm gene nguy cơ ung thư (optional)</td>
                        <td><strong>8.800.000đ</strong></td>
                        <td>Người trên 50 tuổi, điều kiện kinh tế tốt, cần tầm soát cực kỳ toàn diện</td>
                    </tr>
                </tbody>
            </table>

            <img src="${ph(900, 300, 'dcfce7', '166534', 'Co+so+vat+chat+hien+dai+UMC')}" alt="Cơ sở vật chất hiện đại UMC Clinic" />

            <h2>Lưu Ý Trước Khi Đến Khám</h2>
            <ul>
                <li><strong>Nhịn ăn</strong> ít nhất <strong>8 tiếng</strong> trước khi lấy máu và nội soi (chỉ được uống nước lọc).</li>
                <li>Mang theo <strong>CCCD/CMND gốc</strong> và thẻ BHYT (nếu có) để làm thủ tục nhanh hơn.</li>
                <li>Tránh sử dụng <strong>rượu bia trong 48 giờ</strong> và tránh vận động mạnh trước ngày khám.</li>
                <li>Mặc quần áo thoải mái, dễ cởi — tránh đeo trang sức kim loại.</li>
                <li>Phụ nữ <strong>không nên khám</strong> trong những ngày hành kinh (ảnh hưởng kết quả xét nghiệm nước tiểu &amp; phụ khoa).</li>
            </ul>
        `,
    },

    // ─── Gói Cơ Bản ──────────────────────────────────────────────────────────────
    {
        id: 'detail-002',
        categorySlug: 'kham-suc-khoe-tong-quat-ca-nhan',
        slug: 'co-ban',
        title: 'Gói Khám Sức Khỏe Tổng Quát Cơ Bản',
        publishedAt: '05/03/2025',
        coverImage: ph(1200, 480, '1e40af', 'ffffff', 'Goi+Co+Ban+Cover'),
        htmlContent: `
            <h2>Giới Thiệu Gói Khám Cơ Bản</h2>
            <p>Gói <strong>Cơ Bản</strong> là lựa chọn lý tưởng cho những ai lần đầu thực hiện khám sức khỏe tổng quát hoặc muốn kiểm tra định kỳ với chi phí hợp lý. Bao gồm các xét nghiệm thiết yếu nhất để phát hiện sớm các vấn đề sức khỏe phổ biến.</p>

            <img src="${ph(900, 360, 'dbeafe', '1e40af', 'Goi+Co+Ban+UMC+Clinic')}" alt="Gói Cơ Bản tại UMC Clinic" />

            <h2>Đối Tượng Phù Hợp</h2>
            <ul>
                <li>Người từ <strong>18–30 tuổi</strong> chưa từng khám tổng quát.</li>
                <li>Sinh viên, người đi làm muốn kiểm tra sức khỏe cơ bản định kỳ.</li>
                <li>Người muốn tầm soát sức khỏe nhanh gọn trong thời gian ngắn.</li>
            </ul>

            <h2>Danh Mục Xét Nghiệm</h2>
            <p>Gói Cơ Bản bao gồm các hạng mục khám lâm sàng và cận lâm sàng thiết yếu:</p>

            <table>
                <thead>
                    <tr>
                        <th>STT</th>
                        <th>Tên danh mục khám</th>
                        <th>Ghi chú</th>
                        <th>Giá lẻ</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>1</td><td>Khám lâm sàng đa khoa</td><td>Bác sĩ đa khoa thăm khám trực tiếp</td><td>200.000đ</td></tr>
                    <tr><td>2</td><td>Tổng phân tích tế bào máu (CBC)</td><td>18 chỉ số</td><td>130.000đ</td></tr>
                    <tr><td>3</td><td>Đường huyết lúc đói (Glucose)</td><td>Phát hiện tiểu đường</td><td>60.000đ</td></tr>
                    <tr><td>4</td><td>Xét nghiệm nước tiểu toàn phần</td><td>10 chỉ số</td><td>80.000đ</td></tr>
                    <tr><td>5</td><td>Đo huyết áp &amp; chỉ số BMI</td><td>Đánh giá tim mạch cơ bản</td><td>Miễn phí</td></tr>
                    <tr><td>6</td><td>Tư vấn kết quả với bác sĩ đa khoa</td><td>Tư vấn trực tiếp 1:1</td><td>Miễn phí</td></tr>
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3"><strong>Giá gói Cơ Bản (tiết kiệm ~35%)</strong></td>
                        <td><strong style="color:#2563eb;">1.200.000đ</strong></td>
                    </tr>
                </tfoot>
            </table>

            <img src="${ph(900, 300, 'e0f2fe', '0369a1', 'Tu+Van+Suc+Khoe+Co+Ban')}" alt="Tư vấn sức khỏe cơ bản" />

            <h2>Lưu Ý Trước Khi Khám</h2>
            <ul>
                <li><strong>Nhịn ăn</strong> ít nhất 6–8 tiếng trước khi lấy máu xét nghiệm.</li>
                <li>Mang theo <strong>CCCD/CMND</strong> gốc khi đến làm thủ tục.</li>
                <li>Mặc quần áo thoải mái, dễ cởi để thuận tiện khi khám lâm sàng.</li>
            </ul>
        `,
    },

    // ─── Gói Nâng Cao ────────────────────────────────────────────────────────────
    {
        id: 'detail-003',
        categorySlug: 'kham-suc-khoe-tong-quat-ca-nhan',
        slug: 'nang-cao',
        title: 'Gói Khám Sức Khỏe Tổng Quát Nâng Cao',
        publishedAt: '08/03/2025',
        coverImage: ph(1200, 480, '0369a1', 'ffffff', 'Goi+Nang+Cao+Cover'),
        htmlContent: `
            <h2>Giới Thiệu Gói Khám Nâng Cao</h2>
            <p>Gói <strong>Nâng Cao</strong> bổ sung thêm siêu âm bụng tổng quát, điện tâm đồ (ECG) và X-quang ngực thẳng so với gói Cơ Bản. Được khuyến nghị cho người <strong>từ 35 tuổi trở lên</strong> hoặc có yếu tố nguy cơ tim mạch, mỡ máu.</p>

            <img src="${ph(900, 360, 'e0f2fe', '0369a1', 'Goi+Nang+Cao+UMC+Clinic')}" alt="Gói Nâng Cao tại UMC Clinic" />

            <h2>Đối Tượng Phù Hợp</h2>
            <ul>
                <li>Người từ <strong>35–50 tuổi</strong> muốn kiểm tra tim mạch và nội tạng định kỳ.</li>
                <li>Người có tiền sử mỡ máu cao, thừa cân, hoặc ít vận động.</li>
                <li>Người đã từng khám gói Cơ Bản và muốn kiểm tra chuyên sâu hơn.</li>
            </ul>

            <h2>Danh Mục Xét Nghiệm &amp; Chẩn Đoán Hình Ảnh</h2>
            <p>Bao gồm toàn bộ gói Cơ Bản và bổ sung thêm các hạng mục sau:</p>

            <table>
                <thead>
                    <tr>
                        <th>STT</th>
                        <th>Tên danh mục khám</th>
                        <th>Ghi chú</th>
                        <th>Giá lẻ</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>1–6</td><td>Toàn bộ gói Cơ Bản</td><td>Xem chi tiết gói Cơ Bản</td><td>1.200.000đ</td></tr>
                    <tr><td>7</td><td>Chức năng gan (AST, ALT, GGT)</td><td>Phát hiện viêm gan, xơ gan</td><td>180.000đ</td></tr>
                    <tr><td>8</td><td>Chức năng thận (Creatinine, Urea)</td><td>Đánh giá sức lọc cầu thận</td><td>120.000đ</td></tr>
                    <tr><td>9</td><td>Bộ mỡ máu (Cholesterol, LDL, HDL, TG)</td><td>Nguy cơ tim mạch</td><td>200.000đ</td></tr>
                    <tr><td>10</td><td>Siêu âm bụng tổng quát</td><td>Gan, mật, tụy, lách, thận</td><td>350.000đ</td></tr>
                    <tr><td>11</td><td>Điện tâm đồ (ECG 12 chuyển đạo)</td><td>Phát hiện rối loạn nhịp tim</td><td>120.000đ</td></tr>
                    <tr><td>12</td><td>X-quang ngực thẳng (kỹ thuật số)</td><td>Kiểm tra phổi, tim, xương</td><td>150.000đ</td></tr>
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3"><strong>Tổng nếu đi lẻ</strong></td>
                        <td><strong>~2.320.000đ</strong></td>
                    </tr>
                    <tr>
                        <td colspan="3"><strong>Giá gói Nâng Cao (tiết kiệm ~30%)</strong></td>
                        <td><strong style="color:#2563eb;">2.500.000đ</strong></td>
                    </tr>
                </tfoot>
            </table>

            <img src="${ph(900, 300, 'dcfce7', '166534', 'Sieu+Am+Bung+UMC')}" alt="Siêu âm bụng tổng quát tại UMC" />

            <h2>Lưu Ý Trước Khi Khám</h2>
            <ul>
                <li><strong>Nhịn ăn</strong> ít nhất 8 tiếng trước khi siêu âm và lấy máu.</li>
                <li>Uống đủ nước lọc trước khi siêu âm để hình ảnh rõ nét hơn.</li>
                <li>Tránh sử dụng <strong>rượu bia và thuốc lá</strong> trong 24 giờ trước ngày khám.</li>
            </ul>
        `,
    },

    // ─── Gói Chuyên Sâu ──────────────────────────────────────────────────────────
    {
        id: 'detail-004',
        categorySlug: 'kham-suc-khoe-tong-quat-ca-nhan',
        slug: 'chuyen-sau',
        title: 'Gói Khám Sức Khỏe Tổng Quát Chuyên Sâu',
        publishedAt: '10/03/2025',
        coverImage: ph(1200, 480, '3730a3', 'ffffff', 'Goi+Chuyen+Sau+Cover'),
        htmlContent: `
            <h2>Giới Thiệu Gói Khám Chuyên Sâu</h2>
            <p>Gói <strong>Chuyên Sâu</strong> là bước nâng cấp toàn diện từ gói Nâng Cao, tích hợp thêm <strong>nội soi dạ dày không đau</strong>, xét nghiệm marker ung thư và đo mật độ xương. Phù hợp đặc biệt cho người <strong>từ 40 tuổi trở lên</strong> hoặc có tiền sử gia đình mắc bệnh.</p>

            <img src="${ph(900, 360, 'e0e7ff', '3730a3', 'Goi+Chuyen+Sau+UMC+Clinic')}" alt="Gói Chuyên Sâu tại UMC Clinic" />

            <h2>Điểm Nổi Bật Của Gói</h2>
            <ul>
                <li><strong>Nội soi dạ dày không đau</strong>: sử dụng phương pháp gây mê ngắn, không đau, phát hiện sớm viêm loét, polyp và ung thư.</li>
                <li><strong>Xét nghiệm marker ung thư</strong>: AFP, CEA, PSA (nam) / CA 125 (nữ) tầm soát các ung thư gan, đại tràng, tuyến tiền liệt.</li>
                <li><strong>Đo mật độ xương (DEXA)</strong>: phát hiện sớm loãng xương, đặc biệt quan trọng với phụ nữ sau mãn kinh.</li>
                <li><strong>Định lượng hormone tuyến giáp</strong> (TSH, FT4): phát hiện bướu cổ, suy giáp, cường giáp.</li>
            </ul>

            <h2>Danh Mục Xét Nghiệm Đầy Đủ</h2>

            <table>
                <thead>
                    <tr>
                        <th>STT</th>
                        <th>Tên danh mục khám</th>
                        <th>Ghi chú</th>
                        <th>Giá lẻ</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>1–12</td><td>Toàn bộ gói Nâng Cao</td><td>Bao gồm siêu âm, ECG, X-quang</td><td>2.500.000đ</td></tr>
                    <tr><td>13</td><td>Marker ung thư AFP, CEA</td><td>Ung thư gan, đại tràng</td><td>250.000đ</td></tr>
                    <tr><td>14</td><td>PSA (nam) / CA 125 (nữ)</td><td>Ung thư tuyến tiền liệt / buồng trứng</td><td>200.000đ</td></tr>
                    <tr><td>15</td><td>Nội soi dạ dày (gây mê ngắn)</td><td>Không đau, kết quả tức thì</td><td>980.000đ</td></tr>
                    <tr><td>16</td><td>HbA1c (đường huyết dài hạn)</td><td>Tầm soát tiền tiểu đường &amp; tiểu đường</td><td>100.000đ</td></tr>
                    <tr><td>17</td><td>Đo mật độ xương DEXA</td><td>Cột sống thắt lưng &amp; xương hông</td><td>350.000đ</td></tr>
                    <tr><td>18</td><td>Hormone tuyến giáp (TSH, FT4)</td><td>Phát hiện bệnh lý tuyến giáp</td><td>220.000đ</td></tr>
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3"><strong>Tổng nếu đi lẻ</strong></td>
                        <td><strong>~4.600.000đ</strong></td>
                    </tr>
                    <tr>
                        <td colspan="3"><strong>Giá gói Chuyên Sâu (tiết kiệm ~15%)</strong></td>
                        <td><strong style="color:#2563eb;">3.900.000đ</strong></td>
                    </tr>
                </tfoot>
            </table>

            <img src="${ph(900, 300, 'fce7f3', '9d174d', 'Noi+Soi+Da+Day+Khong+Dau')}" alt="Nội soi dạ dày không đau tại UMC" />

            <h2>Lưu Ý Trước Khi Khám</h2>
            <ul>
                <li><strong>Nhịn ăn bắt buộc 8 tiếng</strong> trước khi nội soi và lấy máu (chỉ uống nước lọc).</li>
                <li>Tránh uống <strong>rượu bia và hút thuốc</strong> trong 48 giờ trước ngày khám.</li>
                <li>Thông báo cho bác sĩ nếu đang sử dụng <strong>thuốc chống đông máu</strong> hoặc có dị ứng thuốc mê.</li>
                <li>Nên có người thân đi cùng nếu chọn gây mê để hỗ trợ sau nội soi.</li>
            </ul>
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
