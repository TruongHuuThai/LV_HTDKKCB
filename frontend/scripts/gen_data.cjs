const fs = require('fs');

const specialties = [
  { id: 'chan-doan-hinh-anh', name: 'Chẩn đoán hình ảnh', icon: 'ScanLine', short: 'X-quang, siêu âm, CT, MRI hiện đại' },
  { id: 'co-xuong-khop', name: 'Cơ - xương - khớp', icon: 'ActivitySquare', short: 'Chẩn đoán và điều trị bệnh lý cơ xương khớp' },
  { id: 'da-lieu', name: 'Da liễu', icon: 'Sparkles', short: 'Điều trị các bệnh về da và thẩm mỹ da' },
  { id: 'di-ung-mien-dich', name: 'Dị ứng - Miễn dịch', icon: 'Stethoscope', short: 'Chẩn đoán và điều trị các bệnh lý dị ứng, miễn dịch' },
  { id: 'ho-hap', name: 'Hô hấp', icon: 'Stethoscope', short: 'Chẩn đoán và điều trị các bệnh lý hô hấp' },
  { id: 'kham-suc-khoe-hau-covid-19', name: 'Khám sức khỏe hậu Covid-19', icon: 'Heart', short: 'Khám sức khỏe cho người sau khi mắc Covid-19' },
  { id: 'kham-suc-khoe-tong-quat', name: 'Khám sức khỏe tổng quát', icon: 'Stethoscope', short: 'Kiểm tra sức khỏe tổng quát định kỳ' },
  { id: 'mat', name: 'Mắt', icon: 'Stethoscope', short: 'Khám và điều trị các bệnh lý về mắt' },
  { id: 'ngoai', name: 'Ngoại', icon: 'Scissors', short: 'Phẫu thuật ngoại khoa toàn diện' },
  { id: 'nhi-khoa', name: 'Nhi khoa', icon: 'Baby', short: 'Chăm sóc sức khỏe cho trẻ em' },
  { id: 'noi-than-kinh', name: 'Nội thần kinh', icon: 'Brain', short: 'Chẩn đoán và điều trị bệnh lý thần kinh' },
  { id: 'noi-tiet', name: 'Nội tiết', icon: 'ActivitySquare', short: 'Phòng ngừa, chẩn đoán, và điều trị các bệnh lý nội tiết' },
  { id: 'noi-tong-quat', name: 'Nội tổng quát', icon: 'Heart', short: 'Chẩn đoán và điều trị các bệnh lý nội khoa' },
  { id: 'rang-ham-mat', name: 'Răng - Hàm - Mặt', icon: 'Stethoscope', short: 'Chăm sóc sức khỏe răng miệng' },
  { id: 'san-phu-khoa', name: 'Sản - Phụ khoa', icon: 'Baby', short: 'Chăm sóc thai sản và sức khỏe phụ nữ' },
  { id: 'tai-mui-hong', name: 'Tai - Mũi - Họng', icon: 'Stethoscope', short: 'Khám và điều trị các bệnh lý tai mũi họng' },
  { id: 'tam-the', name: 'Tâm thể', icon: 'Brain', short: 'Khám và điều trị các vấn đề tâm lý, tâm thần' },
  { id: 'tieu-hoa-gan-mat', name: 'Tiêu hoá - Gan mật', icon: 'Stethoscope', short: 'Khám và điều trị bệnh lý tiêu hóa, gan mật' },
  { id: 'tim-mach', name: 'Tim mạch', icon: 'Heart', short: 'Chẩn đoán và can thiệp tim mạch' },
  { id: 'tu-van-giac-ngu', name: 'Tư vấn giấc ngủ', icon: 'Brain', short: 'Khám và tư vấn các rối loạn giấc ngủ' },
  { id: 'xet-nghiem', name: 'Xét nghiệm', icon: 'ScanLine', short: 'Dịch vụ xét nghiệm máu, sinh hóa, miễn dịch' },
];

function generateHtml(s) {
  const title = s.name.replace(/ /g, '+');
  return `
    <h2>1. Giới thiệu chung</h2>
    <p>Chuyên khoa ${s.name} cung cấp dịch vụ khám, chẩn đoán và điều trị chất lượng cao với đội ngũ chuyên gia giàu kinh nghiệm. Chúng tôi ứng dụng các phương pháp y khoa hiện đại để mang lại hiệu quả điều trị tốt nhất cho người bệnh.</p>
    <img src="https://placehold.co/800x400?text=${title}+1" alt="Minh họa 1" />
    
    <h2>2. Chức năng nhiệm vụ</h2>
    <p>Đảm nhận việc tiếp nhận, cấp cứu, khám và điều trị các bệnh lý liên quan đến ${s.name.toLowerCase()}. Đồng thời, chuyên khoa cũng thực hiện công tác nghiên cứu khoa học, đào tạo và hợp tác quốc tế để nâng cao năng lực chuyên môn.</p>
    
    <h2>3. Các bệnh lý thường gặp</h2>
    <ul>
      <li>Các bệnh lý cấp tính và mạn tính phổ biến liên quan đến ${s.name.toLowerCase()}.</li>
      <li>Tầm soát và phát hiện sớm các nguy cơ tiềm ẩn.</li>
      <li>Quản lý và theo dõi chuyên sâu cho nhóm bệnh nhân có nguy cơ cao.</li>
    </ul>
    
    <h2>4. Các dịch vụ nổi bật</h2>
    <p>Chúng tôi cung cấp các gói dịch vụ đa dạng từ cơ bản đến chuyên sâu:</p>
    <ul>
      <li>Khám, tư vấn và lập phác đồ điều trị cá thể hóa.</li>
      <li>Can thiệp thủ thuật, phẫu thuật (nếu có chỉ định).</li>
      <li>Chăm sóc phục hồi và theo dõi sau điều trị.</li>
    </ul>
    <img src="https://placehold.co/800x400?text=${title}+2" alt="Minh họa 2" />
  `.trim();
}

let fileContent = `// src/data/specialtiesData.ts

export interface SpecialtyData {
    id: string;
    slug: string;
    name: string;
    iconName: string; // Lucide icon name dùng để render
    shortDesc: string;
    htmlContent: string; // HTML content
}

export const SPECIALTIES_DATA: SpecialtyData[] = [
`;

specialties.forEach((s) => {
  fileContent += `    {
        id: '${s.id}',
        slug: '${s.id}',
        name: '${s.name}',
        iconName: '${s.icon}',
        shortDesc: '${s.short}',
        htmlContent: \`
${generateHtml(s)}
        \`,
    },\n`;
});

fileContent += `];

/** Tìm theo slug */
export function getSpecialtyBySlug(slug: string): SpecialtyData | undefined {
    return SPECIALTIES_DATA.find((s) => s.slug === slug);
}
`;

// Ghi file
try {
  fs.writeFileSync('d:/9. Luận văn/0. code/umc/frontend/src/data/specialtiesData.ts', fileContent, 'utf-8');
  console.log('Sinh dữ liệu thành công! Hãy kiểm tra file src/data/specialtiesData.ts nhé.');
} catch (error) {
  console.error('Có lỗi khi ghi file:', error);
}