// src/data/specialtiesData.ts

export interface SpecialtyData {
    id: string;
    slug: string;
    name: string;
    iconName: string; // Lucide icon name dùng để render
    shortDesc: string;
    htmlContent: string; // HTML content
}

export const SPECIALTIES_DATA: SpecialtyData[] = [
    {
        id: 'chan-doan-hinh-anh',
        slug: 'chan-doan-hinh-anh',
        name: 'Chẩn đoán hình ảnh',
        iconName: 'ScanLine',
        shortDesc: 'X-quang, siêu âm, CT, MRI hiện đại',
        htmlContent: `
<h2>1. Giới thiệu chung</h2>
    <p>Chuyên khoa Chẩn đoán hình ảnh cung cấp dịch vụ khám, chẩn đoán và điều trị chất lượng cao với đội ngũ chuyên gia giàu kinh nghiệm. Chúng tôi ứng dụng các phương pháp y khoa hiện đại để mang lại hiệu quả điều trị tốt nhất cho người bệnh.</p>
    <img src="https://placehold.co/800x400?text=Chẩn+đoán+hình+ảnh+1" alt="Minh họa 1" />
    
    <h2>2. Chức năng nhiệm vụ</h2>
    <p>Đảm nhận việc tiếp nhận, cấp cứu, khám và điều trị các bệnh lý liên quan đến chẩn đoán hình ảnh. Đồng thời, chuyên khoa cũng thực hiện công tác nghiên cứu khoa học, đào tạo và hợp tác quốc tế để nâng cao năng lực chuyên môn.</p>
    
    <h2>3. Các bệnh lý thường gặp</h2>
    <ul>
      <li>Các bệnh lý cấp tính và mạn tính phổ biến liên quan đến chẩn đoán hình ảnh.</li>
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
    <img src="https://placehold.co/800x400?text=Chẩn+đoán+hình+ảnh+2" alt="Minh họa 2" />
        `,
    },
    {
        id: 'co-xuong-khop',
        slug: 'co-xuong-khop',
        name: 'Cơ - xương - khớp',
        iconName: 'ActivitySquare',
        shortDesc: 'Chẩn đoán và điều trị bệnh lý cơ xương khớp',
        htmlContent: `
<h2>1. Giới thiệu chung</h2>
    <p>Chuyên khoa Cơ - xương - khớp cung cấp dịch vụ khám, chẩn đoán và điều trị chất lượng cao với đội ngũ chuyên gia giàu kinh nghiệm. Chúng tôi ứng dụng các phương pháp y khoa hiện đại để mang lại hiệu quả điều trị tốt nhất cho người bệnh.</p>
    <img src="https://placehold.co/800x400?text=Cơ+-+xương+-+khớp+1" alt="Minh họa 1" />
    
    <h2>2. Chức năng nhiệm vụ</h2>
    <p>Đảm nhận việc tiếp nhận, cấp cứu, khám và điều trị các bệnh lý liên quan đến cơ - xương - khớp. Đồng thời, chuyên khoa cũng thực hiện công tác nghiên cứu khoa học, đào tạo và hợp tác quốc tế để nâng cao năng lực chuyên môn.</p>
    
    <h2>3. Các bệnh lý thường gặp</h2>
    <ul>
      <li>Các bệnh lý cấp tính và mạn tính phổ biến liên quan đến cơ - xương - khớp.</li>
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
    <img src="https://placehold.co/800x400?text=Cơ+-+xương+-+khớp+2" alt="Minh họa 2" />
        `,
    },
    {
        id: 'da-lieu',
        slug: 'da-lieu',
        name: 'Da liễu',
        iconName: 'Sparkles',
        shortDesc: 'Điều trị các bệnh về da và thẩm mỹ da',
        htmlContent: `
<h2>1. Giới thiệu chung</h2>
    <p>Chuyên khoa Da liễu cung cấp dịch vụ khám, chẩn đoán và điều trị chất lượng cao với đội ngũ chuyên gia giàu kinh nghiệm. Chúng tôi ứng dụng các phương pháp y khoa hiện đại để mang lại hiệu quả điều trị tốt nhất cho người bệnh.</p>
    <img src="https://placehold.co/800x400?text=Da+liễu+1" alt="Minh họa 1" />
    
    <h2>2. Chức năng nhiệm vụ</h2>
    <p>Đảm nhận việc tiếp nhận, cấp cứu, khám và điều trị các bệnh lý liên quan đến da liễu. Đồng thời, chuyên khoa cũng thực hiện công tác nghiên cứu khoa học, đào tạo và hợp tác quốc tế để nâng cao năng lực chuyên môn.</p>
    
    <h2>3. Các bệnh lý thường gặp</h2>
    <ul>
      <li>Các bệnh lý cấp tính và mạn tính phổ biến liên quan đến da liễu.</li>
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
    <img src="https://placehold.co/800x400?text=Da+liễu+2" alt="Minh họa 2" />
        `,
    },
    {
        id: 'di-ung-mien-dich',
        slug: 'di-ung-mien-dich',
        name: 'Dị ứng - Miễn dịch',
        iconName: 'Stethoscope',
        shortDesc: 'Chẩn đoán và điều trị các bệnh lý dị ứng, miễn dịch',
        htmlContent: `
<h2>1. Giới thiệu chung</h2>
    <p>Chuyên khoa Dị ứng - Miễn dịch cung cấp dịch vụ khám, chẩn đoán và điều trị chất lượng cao với đội ngũ chuyên gia giàu kinh nghiệm. Chúng tôi ứng dụng các phương pháp y khoa hiện đại để mang lại hiệu quả điều trị tốt nhất cho người bệnh.</p>
    <img src="https://placehold.co/800x400?text=Dị+ứng+-+Miễn+dịch+1" alt="Minh họa 1" />
    
    <h2>2. Chức năng nhiệm vụ</h2>
    <p>Đảm nhận việc tiếp nhận, cấp cứu, khám và điều trị các bệnh lý liên quan đến dị ứng - miễn dịch. Đồng thời, chuyên khoa cũng thực hiện công tác nghiên cứu khoa học, đào tạo và hợp tác quốc tế để nâng cao năng lực chuyên môn.</p>
    
    <h2>3. Các bệnh lý thường gặp</h2>
    <ul>
      <li>Các bệnh lý cấp tính và mạn tính phổ biến liên quan đến dị ứng - miễn dịch.</li>
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
    <img src="https://placehold.co/800x400?text=Dị+ứng+-+Miễn+dịch+2" alt="Minh họa 2" />
        `,
    },
    {
        id: 'ho-hap',
        slug: 'ho-hap',
        name: 'Hô hấp',
        iconName: 'Stethoscope',
        shortDesc: 'Chẩn đoán và điều trị các bệnh lý hô hấp',
        htmlContent: `
<h2>1. Giới thiệu chung</h2>
    <p>Chuyên khoa Hô hấp cung cấp dịch vụ khám, chẩn đoán và điều trị chất lượng cao với đội ngũ chuyên gia giàu kinh nghiệm. Chúng tôi ứng dụng các phương pháp y khoa hiện đại để mang lại hiệu quả điều trị tốt nhất cho người bệnh.</p>
    <img src="https://placehold.co/800x400?text=Hô+hấp+1" alt="Minh họa 1" />
    
    <h2>2. Chức năng nhiệm vụ</h2>
    <p>Đảm nhận việc tiếp nhận, cấp cứu, khám và điều trị các bệnh lý liên quan đến hô hấp. Đồng thời, chuyên khoa cũng thực hiện công tác nghiên cứu khoa học, đào tạo và hợp tác quốc tế để nâng cao năng lực chuyên môn.</p>
    
    <h2>3. Các bệnh lý thường gặp</h2>
    <ul>
      <li>Các bệnh lý cấp tính và mạn tính phổ biến liên quan đến hô hấp.</li>
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
    <img src="https://placehold.co/800x400?text=Hô+hấp+2" alt="Minh họa 2" />
        `,
    },
    {
        id: 'kham-suc-khoe-hau-covid-19',
        slug: 'kham-suc-khoe-hau-covid-19',
        name: 'Khám sức khỏe hậu Covid-19',
        iconName: 'Heart',
        shortDesc: 'Khám sức khỏe cho người sau khi mắc Covid-19',
        htmlContent: `
<h2>1. Giới thiệu chung</h2>
    <p>Chuyên khoa Khám sức khỏe hậu Covid-19 cung cấp dịch vụ khám, chẩn đoán và điều trị chất lượng cao với đội ngũ chuyên gia giàu kinh nghiệm. Chúng tôi ứng dụng các phương pháp y khoa hiện đại để mang lại hiệu quả điều trị tốt nhất cho người bệnh.</p>
    <img src="https://placehold.co/800x400?text=Khám+sức+khỏe+hậu+Covid-19+1" alt="Minh họa 1" />
    
    <h2>2. Chức năng nhiệm vụ</h2>
    <p>Đảm nhận việc tiếp nhận, cấp cứu, khám và điều trị các bệnh lý liên quan đến khám sức khỏe hậu covid-19. Đồng thời, chuyên khoa cũng thực hiện công tác nghiên cứu khoa học, đào tạo và hợp tác quốc tế để nâng cao năng lực chuyên môn.</p>
    
    <h2>3. Các bệnh lý thường gặp</h2>
    <ul>
      <li>Các bệnh lý cấp tính và mạn tính phổ biến liên quan đến khám sức khỏe hậu covid-19.</li>
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
    <img src="https://placehold.co/800x400?text=Khám+sức+khỏe+hậu+Covid-19+2" alt="Minh họa 2" />
        `,
    },
    {
        id: 'kham-suc-khoe-tong-quat',
        slug: 'kham-suc-khoe-tong-quat',
        name: 'Khám sức khỏe tổng quát',
        iconName: 'Stethoscope',
        shortDesc: 'Kiểm tra sức khỏe tổng quát định kỳ',
        htmlContent: `
<h2>1. Giới thiệu chung</h2>
    <p>Chuyên khoa Khám sức khỏe tổng quát cung cấp dịch vụ khám, chẩn đoán và điều trị chất lượng cao với đội ngũ chuyên gia giàu kinh nghiệm. Chúng tôi ứng dụng các phương pháp y khoa hiện đại để mang lại hiệu quả điều trị tốt nhất cho người bệnh.</p>
    <img src="https://placehold.co/800x400?text=Khám+sức+khỏe+tổng+quát+1" alt="Minh họa 1" />
    
    <h2>2. Chức năng nhiệm vụ</h2>
    <p>Đảm nhận việc tiếp nhận, cấp cứu, khám và điều trị các bệnh lý liên quan đến khám sức khỏe tổng quát. Đồng thời, chuyên khoa cũng thực hiện công tác nghiên cứu khoa học, đào tạo và hợp tác quốc tế để nâng cao năng lực chuyên môn.</p>
    
    <h2>3. Các bệnh lý thường gặp</h2>
    <ul>
      <li>Các bệnh lý cấp tính và mạn tính phổ biến liên quan đến khám sức khỏe tổng quát.</li>
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
    <img src="https://placehold.co/800x400?text=Khám+sức+khỏe+tổng+quát+2" alt="Minh họa 2" />
        `,
    },
    {
        id: 'mat',
        slug: 'mat',
        name: 'Mắt',
        iconName: 'Stethoscope',
        shortDesc: 'Khám và điều trị các bệnh lý về mắt',
        htmlContent: `
<h2>1. Giới thiệu chung</h2>
    <p>Chuyên khoa Mắt cung cấp dịch vụ khám, chẩn đoán và điều trị chất lượng cao với đội ngũ chuyên gia giàu kinh nghiệm. Chúng tôi ứng dụng các phương pháp y khoa hiện đại để mang lại hiệu quả điều trị tốt nhất cho người bệnh.</p>
    <img src="https://placehold.co/800x400?text=Mắt+1" alt="Minh họa 1" />
    
    <h2>2. Chức năng nhiệm vụ</h2>
    <p>Đảm nhận việc tiếp nhận, cấp cứu, khám và điều trị các bệnh lý liên quan đến mắt. Đồng thời, chuyên khoa cũng thực hiện công tác nghiên cứu khoa học, đào tạo và hợp tác quốc tế để nâng cao năng lực chuyên môn.</p>
    
    <h2>3. Các bệnh lý thường gặp</h2>
    <ul>
      <li>Các bệnh lý cấp tính và mạn tính phổ biến liên quan đến mắt.</li>
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
    <img src="https://placehold.co/800x400?text=Mắt+2" alt="Minh họa 2" />
        `,
    },
    {
        id: 'ngoai',
        slug: 'ngoai',
        name: 'Ngoại',
        iconName: 'Scissors',
        shortDesc: 'Phẫu thuật ngoại khoa toàn diện',
        htmlContent: `
<h2>1. Giới thiệu chung</h2>
    <p>Chuyên khoa Ngoại cung cấp dịch vụ khám, chẩn đoán và điều trị chất lượng cao với đội ngũ chuyên gia giàu kinh nghiệm. Chúng tôi ứng dụng các phương pháp y khoa hiện đại để mang lại hiệu quả điều trị tốt nhất cho người bệnh.</p>
    <img src="https://placehold.co/800x400?text=Ngoại+1" alt="Minh họa 1" />
    
    <h2>2. Chức năng nhiệm vụ</h2>
    <p>Đảm nhận việc tiếp nhận, cấp cứu, khám và điều trị các bệnh lý liên quan đến ngoại. Đồng thời, chuyên khoa cũng thực hiện công tác nghiên cứu khoa học, đào tạo và hợp tác quốc tế để nâng cao năng lực chuyên môn.</p>
    
    <h2>3. Các bệnh lý thường gặp</h2>
    <ul>
      <li>Các bệnh lý cấp tính và mạn tính phổ biến liên quan đến ngoại.</li>
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
    <img src="https://placehold.co/800x400?text=Ngoại+2" alt="Minh họa 2" />
        `,
    },
    {
        id: 'nhi-khoa',
        slug: 'nhi-khoa',
        name: 'Nhi khoa',
        iconName: 'Baby',
        shortDesc: 'Chăm sóc sức khỏe cho trẻ em',
        htmlContent: `
<h2>1. Giới thiệu chung</h2>
    <p>Chuyên khoa Nhi khoa cung cấp dịch vụ khám, chẩn đoán và điều trị chất lượng cao với đội ngũ chuyên gia giàu kinh nghiệm. Chúng tôi ứng dụng các phương pháp y khoa hiện đại để mang lại hiệu quả điều trị tốt nhất cho người bệnh.</p>
    <img src="https://placehold.co/800x400?text=Nhi+khoa+1" alt="Minh họa 1" />
    
    <h2>2. Chức năng nhiệm vụ</h2>
    <p>Đảm nhận việc tiếp nhận, cấp cứu, khám và điều trị các bệnh lý liên quan đến nhi khoa. Đồng thời, chuyên khoa cũng thực hiện công tác nghiên cứu khoa học, đào tạo và hợp tác quốc tế để nâng cao năng lực chuyên môn.</p>
    
    <h2>3. Các bệnh lý thường gặp</h2>
    <ul>
      <li>Các bệnh lý cấp tính và mạn tính phổ biến liên quan đến nhi khoa.</li>
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
    <img src="https://placehold.co/800x400?text=Nhi+khoa+2" alt="Minh họa 2" />
        `,
    },
    {
        id: 'noi-than-kinh',
        slug: 'noi-than-kinh',
        name: 'Nội thần kinh',
        iconName: 'Brain',
        shortDesc: 'Chẩn đoán và điều trị bệnh lý thần kinh',
        htmlContent: `
<h2>1. Giới thiệu chung</h2>
    <p>Chuyên khoa Nội thần kinh cung cấp dịch vụ khám, chẩn đoán và điều trị chất lượng cao với đội ngũ chuyên gia giàu kinh nghiệm. Chúng tôi ứng dụng các phương pháp y khoa hiện đại để mang lại hiệu quả điều trị tốt nhất cho người bệnh.</p>
    <img src="https://placehold.co/800x400?text=Nội+thần+kinh+1" alt="Minh họa 1" />
    
    <h2>2. Chức năng nhiệm vụ</h2>
    <p>Đảm nhận việc tiếp nhận, cấp cứu, khám và điều trị các bệnh lý liên quan đến nội thần kinh. Đồng thời, chuyên khoa cũng thực hiện công tác nghiên cứu khoa học, đào tạo và hợp tác quốc tế để nâng cao năng lực chuyên môn.</p>
    
    <h2>3. Các bệnh lý thường gặp</h2>
    <ul>
      <li>Các bệnh lý cấp tính và mạn tính phổ biến liên quan đến nội thần kinh.</li>
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
    <img src="https://placehold.co/800x400?text=Nội+thần+kinh+2" alt="Minh họa 2" />
        `,
    },
    {
        id: 'noi-tiet',
        slug: 'noi-tiet',
        name: 'Nội tiết',
        iconName: 'ActivitySquare',
        shortDesc: 'Phòng ngừa, chẩn đoán, và điều trị các bệnh lý nội tiết',
        htmlContent: `
<h2>1. Giới thiệu chung</h2>
    <p>Chuyên khoa Nội tiết cung cấp dịch vụ khám, chẩn đoán và điều trị chất lượng cao với đội ngũ chuyên gia giàu kinh nghiệm. Chúng tôi ứng dụng các phương pháp y khoa hiện đại để mang lại hiệu quả điều trị tốt nhất cho người bệnh.</p>
    <img src="https://placehold.co/800x400?text=Nội+tiết+1" alt="Minh họa 1" />
    
    <h2>2. Chức năng nhiệm vụ</h2>
    <p>Đảm nhận việc tiếp nhận, cấp cứu, khám và điều trị các bệnh lý liên quan đến nội tiết. Đồng thời, chuyên khoa cũng thực hiện công tác nghiên cứu khoa học, đào tạo và hợp tác quốc tế để nâng cao năng lực chuyên môn.</p>
    
    <h2>3. Các bệnh lý thường gặp</h2>
    <ul>
      <li>Các bệnh lý cấp tính và mạn tính phổ biến liên quan đến nội tiết.</li>
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
    <img src="https://placehold.co/800x400?text=Nội+tiết+2" alt="Minh họa 2" />
        `,
    },
    {
        id: 'noi-tong-quat',
        slug: 'noi-tong-quat',
        name: 'Nội tổng quát',
        iconName: 'Heart',
        shortDesc: 'Chẩn đoán và điều trị các bệnh lý nội khoa',
        htmlContent: `
<h2>1. Giới thiệu chung</h2>
    <p>Chuyên khoa Nội tổng quát cung cấp dịch vụ khám, chẩn đoán và điều trị chất lượng cao với đội ngũ chuyên gia giàu kinh nghiệm. Chúng tôi ứng dụng các phương pháp y khoa hiện đại để mang lại hiệu quả điều trị tốt nhất cho người bệnh.</p>
    <img src="https://placehold.co/800x400?text=Nội+tổng+quát+1" alt="Minh họa 1" />
    
    <h2>2. Chức năng nhiệm vụ</h2>
    <p>Đảm nhận việc tiếp nhận, cấp cứu, khám và điều trị các bệnh lý liên quan đến nội tổng quát. Đồng thời, chuyên khoa cũng thực hiện công tác nghiên cứu khoa học, đào tạo và hợp tác quốc tế để nâng cao năng lực chuyên môn.</p>
    
    <h2>3. Các bệnh lý thường gặp</h2>
    <ul>
      <li>Các bệnh lý cấp tính và mạn tính phổ biến liên quan đến nội tổng quát.</li>
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
    <img src="https://placehold.co/800x400?text=Nội+tổng+quát+2" alt="Minh họa 2" />
        `,
    },
    {
        id: 'rang-ham-mat',
        slug: 'rang-ham-mat',
        name: 'Răng - Hàm - Mặt',
        iconName: 'Stethoscope',
        shortDesc: 'Chăm sóc sức khỏe răng miệng',
        htmlContent: `
<h2>1. Giới thiệu chung</h2>
    <p>Chuyên khoa Răng - Hàm - Mặt cung cấp dịch vụ khám, chẩn đoán và điều trị chất lượng cao với đội ngũ chuyên gia giàu kinh nghiệm. Chúng tôi ứng dụng các phương pháp y khoa hiện đại để mang lại hiệu quả điều trị tốt nhất cho người bệnh.</p>
    <img src="https://placehold.co/800x400?text=Răng+-+Hàm+-+Mặt+1" alt="Minh họa 1" />
    
    <h2>2. Chức năng nhiệm vụ</h2>
    <p>Đảm nhận việc tiếp nhận, cấp cứu, khám và điều trị các bệnh lý liên quan đến răng - hàm - mặt. Đồng thời, chuyên khoa cũng thực hiện công tác nghiên cứu khoa học, đào tạo và hợp tác quốc tế để nâng cao năng lực chuyên môn.</p>
    
    <h2>3. Các bệnh lý thường gặp</h2>
    <ul>
      <li>Các bệnh lý cấp tính và mạn tính phổ biến liên quan đến răng - hàm - mặt.</li>
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
    <img src="https://placehold.co/800x400?text=Răng+-+Hàm+-+Mặt+2" alt="Minh họa 2" />
        `,
    },
    {
        id: 'san-phu-khoa',
        slug: 'san-phu-khoa',
        name: 'Sản - Phụ khoa',
        iconName: 'Baby',
        shortDesc: 'Chăm sóc thai sản và sức khỏe phụ nữ',
        htmlContent: `
<h2>1. Giới thiệu chung</h2>
    <p>Chuyên khoa Sản - Phụ khoa cung cấp dịch vụ khám, chẩn đoán và điều trị chất lượng cao với đội ngũ chuyên gia giàu kinh nghiệm. Chúng tôi ứng dụng các phương pháp y khoa hiện đại để mang lại hiệu quả điều trị tốt nhất cho người bệnh.</p>
    <img src="https://placehold.co/800x400?text=Sản+-+Phụ+khoa+1" alt="Minh họa 1" />
    
    <h2>2. Chức năng nhiệm vụ</h2>
    <p>Đảm nhận việc tiếp nhận, cấp cứu, khám và điều trị các bệnh lý liên quan đến sản - phụ khoa. Đồng thời, chuyên khoa cũng thực hiện công tác nghiên cứu khoa học, đào tạo và hợp tác quốc tế để nâng cao năng lực chuyên môn.</p>
    
    <h2>3. Các bệnh lý thường gặp</h2>
    <ul>
      <li>Các bệnh lý cấp tính và mạn tính phổ biến liên quan đến sản - phụ khoa.</li>
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
    <img src="https://placehold.co/800x400?text=Sản+-+Phụ+khoa+2" alt="Minh họa 2" />
        `,
    },
    {
        id: 'tai-mui-hong',
        slug: 'tai-mui-hong',
        name: 'Tai - Mũi - Họng',
        iconName: 'Stethoscope',
        shortDesc: 'Khám và điều trị các bệnh lý tai mũi họng',
        htmlContent: `
<h2>1. Giới thiệu chung</h2>
    <p>Chuyên khoa Tai - Mũi - Họng cung cấp dịch vụ khám, chẩn đoán và điều trị chất lượng cao với đội ngũ chuyên gia giàu kinh nghiệm. Chúng tôi ứng dụng các phương pháp y khoa hiện đại để mang lại hiệu quả điều trị tốt nhất cho người bệnh.</p>
    <img src="https://placehold.co/800x400?text=Tai+-+Mũi+-+Họng+1" alt="Minh họa 1" />
    
    <h2>2. Chức năng nhiệm vụ</h2>
    <p>Đảm nhận việc tiếp nhận, cấp cứu, khám và điều trị các bệnh lý liên quan đến tai - mũi - họng. Đồng thời, chuyên khoa cũng thực hiện công tác nghiên cứu khoa học, đào tạo và hợp tác quốc tế để nâng cao năng lực chuyên môn.</p>
    
    <h2>3. Các bệnh lý thường gặp</h2>
    <ul>
      <li>Các bệnh lý cấp tính và mạn tính phổ biến liên quan đến tai - mũi - họng.</li>
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
    <img src="https://placehold.co/800x400?text=Tai+-+Mũi+-+Họng+2" alt="Minh họa 2" />
        `,
    },
    {
        id: 'tam-the',
        slug: 'tam-the',
        name: 'Tâm thể',
        iconName: 'Brain',
        shortDesc: 'Khám và điều trị các vấn đề tâm lý, tâm thần',
        htmlContent: `
<h2>1. Giới thiệu chung</h2>
    <p>Chuyên khoa Tâm thể cung cấp dịch vụ khám, chẩn đoán và điều trị chất lượng cao với đội ngũ chuyên gia giàu kinh nghiệm. Chúng tôi ứng dụng các phương pháp y khoa hiện đại để mang lại hiệu quả điều trị tốt nhất cho người bệnh.</p>
    <img src="https://placehold.co/800x400?text=Tâm+thể+1" alt="Minh họa 1" />
    
    <h2>2. Chức năng nhiệm vụ</h2>
    <p>Đảm nhận việc tiếp nhận, cấp cứu, khám và điều trị các bệnh lý liên quan đến tâm thể. Đồng thời, chuyên khoa cũng thực hiện công tác nghiên cứu khoa học, đào tạo và hợp tác quốc tế để nâng cao năng lực chuyên môn.</p>
    
    <h2>3. Các bệnh lý thường gặp</h2>
    <ul>
      <li>Các bệnh lý cấp tính và mạn tính phổ biến liên quan đến tâm thể.</li>
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
    <img src="https://placehold.co/800x400?text=Tâm+thể+2" alt="Minh họa 2" />
        `,
    },
    {
        id: 'tieu-hoa-gan-mat',
        slug: 'tieu-hoa-gan-mat',
        name: 'Tiêu hoá - Gan mật',
        iconName: 'Stethoscope',
        shortDesc: 'Khám và điều trị bệnh lý tiêu hóa, gan mật',
        htmlContent: `
<h2>1. Giới thiệu chung</h2>
    <p>Chuyên khoa Tiêu hoá - Gan mật cung cấp dịch vụ khám, chẩn đoán và điều trị chất lượng cao với đội ngũ chuyên gia giàu kinh nghiệm. Chúng tôi ứng dụng các phương pháp y khoa hiện đại để mang lại hiệu quả điều trị tốt nhất cho người bệnh.</p>
    <img src="https://placehold.co/800x400?text=Tiêu+hoá+-+Gan+mật+1" alt="Minh họa 1" />
    
    <h2>2. Chức năng nhiệm vụ</h2>
    <p>Đảm nhận việc tiếp nhận, cấp cứu, khám và điều trị các bệnh lý liên quan đến tiêu hoá - gan mật. Đồng thời, chuyên khoa cũng thực hiện công tác nghiên cứu khoa học, đào tạo và hợp tác quốc tế để nâng cao năng lực chuyên môn.</p>
    
    <h2>3. Các bệnh lý thường gặp</h2>
    <ul>
      <li>Các bệnh lý cấp tính và mạn tính phổ biến liên quan đến tiêu hoá - gan mật.</li>
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
    <img src="https://placehold.co/800x400?text=Tiêu+hoá+-+Gan+mật+2" alt="Minh họa 2" />
        `,
    },
    {
        id: 'tim-mach',
        slug: 'tim-mach',
        name: 'Tim mạch',
        iconName: 'Heart',
        shortDesc: 'Chẩn đoán và can thiệp tim mạch',
        htmlContent: `
<h2>1. Giới thiệu chung</h2>
    <p>Chuyên khoa Tim mạch cung cấp dịch vụ khám, chẩn đoán và điều trị chất lượng cao với đội ngũ chuyên gia giàu kinh nghiệm. Chúng tôi ứng dụng các phương pháp y khoa hiện đại để mang lại hiệu quả điều trị tốt nhất cho người bệnh.</p>
    <img src="https://placehold.co/800x400?text=Tim+mạch+1" alt="Minh họa 1" />
    
    <h2>2. Chức năng nhiệm vụ</h2>
    <p>Đảm nhận việc tiếp nhận, cấp cứu, khám và điều trị các bệnh lý liên quan đến tim mạch. Đồng thời, chuyên khoa cũng thực hiện công tác nghiên cứu khoa học, đào tạo và hợp tác quốc tế để nâng cao năng lực chuyên môn.</p>
    
    <h2>3. Các bệnh lý thường gặp</h2>
    <ul>
      <li>Các bệnh lý cấp tính và mạn tính phổ biến liên quan đến tim mạch.</li>
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
    <img src="https://placehold.co/800x400?text=Tim+mạch+2" alt="Minh họa 2" />
        `,
    },
    {
        id: 'tu-van-giac-ngu',
        slug: 'tu-van-giac-ngu',
        name: 'Tư vấn giấc ngủ',
        iconName: 'Brain',
        shortDesc: 'Khám và tư vấn các rối loạn giấc ngủ',
        htmlContent: `
<h2>1. Giới thiệu chung</h2>
    <p>Chuyên khoa Tư vấn giấc ngủ cung cấp dịch vụ khám, chẩn đoán và điều trị chất lượng cao với đội ngũ chuyên gia giàu kinh nghiệm. Chúng tôi ứng dụng các phương pháp y khoa hiện đại để mang lại hiệu quả điều trị tốt nhất cho người bệnh.</p>
    <img src="https://placehold.co/800x400?text=Tư+vấn+giấc+ngủ+1" alt="Minh họa 1" />
    
    <h2>2. Chức năng nhiệm vụ</h2>
    <p>Đảm nhận việc tiếp nhận, cấp cứu, khám và điều trị các bệnh lý liên quan đến tư vấn giấc ngủ. Đồng thời, chuyên khoa cũng thực hiện công tác nghiên cứu khoa học, đào tạo và hợp tác quốc tế để nâng cao năng lực chuyên môn.</p>
    
    <h2>3. Các bệnh lý thường gặp</h2>
    <ul>
      <li>Các bệnh lý cấp tính và mạn tính phổ biến liên quan đến tư vấn giấc ngủ.</li>
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
    <img src="https://placehold.co/800x400?text=Tư+vấn+giấc+ngủ+2" alt="Minh họa 2" />
        `,
    },
    {
        id: 'xet-nghiem',
        slug: 'xet-nghiem',
        name: 'Xét nghiệm',
        iconName: 'ScanLine',
        shortDesc: 'Dịch vụ xét nghiệm máu, sinh hóa, miễn dịch',
        htmlContent: `
<h2>1. Giới thiệu chung</h2>
    <p>Chuyên khoa Xét nghiệm cung cấp dịch vụ khám, chẩn đoán và điều trị chất lượng cao với đội ngũ chuyên gia giàu kinh nghiệm. Chúng tôi ứng dụng các phương pháp y khoa hiện đại để mang lại hiệu quả điều trị tốt nhất cho người bệnh.</p>
    <img src="https://placehold.co/800x400?text=Xét+nghiệm+1" alt="Minh họa 1" />
    
    <h2>2. Chức năng nhiệm vụ</h2>
    <p>Đảm nhận việc tiếp nhận, cấp cứu, khám và điều trị các bệnh lý liên quan đến xét nghiệm. Đồng thời, chuyên khoa cũng thực hiện công tác nghiên cứu khoa học, đào tạo và hợp tác quốc tế để nâng cao năng lực chuyên môn.</p>
    
    <h2>3. Các bệnh lý thường gặp</h2>
    <ul>
      <li>Các bệnh lý cấp tính và mạn tính phổ biến liên quan đến xét nghiệm.</li>
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
    <img src="https://placehold.co/800x400?text=Xét+nghiệm+2" alt="Minh họa 2" />
        `,
    },
];

/** Tìm theo slug */
export function getSpecialtyBySlug(slug: string): SpecialtyData | undefined {
    return SPECIALTIES_DATA.find((s) => s.slug === slug);
}
