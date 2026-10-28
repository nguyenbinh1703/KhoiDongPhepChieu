# MÔ HÌNH THÍ NGHIỆM 3D: PHÉP CHIẾU SONG SONG & PHÉP CHIẾU VUÔNG GÓC
### Ứng dụng Chuyển đổi số trong Giáo dục & Giảng dạy Hình học không gian (SGK Toán 11 - Chương trình GDPT 2018)

![React](https://img.shields.io/badge/React-19.0-61dafb?logo=react)
![Three.js](https://img.shields.io/badge/Three.js-0.186-black?logo=three.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.x-38bdf8?logo=tailwindcss)
![Vite](https://img.shields.io/badge/Vite-8.x-646cff?logo=vite)
![License](https://img.shields.io/badge/License-Apache_2.0-green)

---

## 📖 1. Giới thiệu Dự án

Ứng dụng web mô phỏng thí nghiệm tương tác 3D phục vụ học tập và giảng dạy chuyên đề **Phép chiếu song song & Phép chiếu vuông góc** thuộc chương trình Hình học không gian lớp 11 (Chương trình Giáo dục phổ thông 2018).

Mô hình đưa kiến thức toán học trừu tượng thành trải nghiệm trực quan sinh động, cho phép học sinh và giáo viên trực tiếp thao tác thay đổi góc chiếu của nguồn sáng mặt trời, quan sát sự hình thành bóng đổ của các khối đa diện trên mặt phẳng hình chiếu $(P)$, kiểm chứng các định lý toán học về tính bảo toàn và biến dạng hình học.

---

## ✨ 2. Các Tính năng Nổi bật

### 📐 Hình học không gian
* **4 khối hình không gian chuẩn SGK Toán 11:** Khối trụ, Khối chóp tứ giác đều, Khối hộp chữ nhật, Khối lăng trụ tam giác.
* **Quy ước biểu diễn kỹ thuật TCVN / ISO:** Tự động phân tách nét liền đậm cho các cạnh thấy và nét đứt đều đặn cho các cạnh khuất theo đúng góc nhìn 3D.
* **Mặt phẳng hình chiếu $(P)$:** Thiết kế hình bình hành ngang đúng nguyên tắc vẽ hình học không gian trên mặt phẳng (hai cạnh trước - sau luôn nằm ngang $100\%$ trên màn hình).
* **Vật thể đặt sát mặt sàn:** Chân vật tiếp xúc trực tiếp với mặt nền, triệt tiêu hoàn toàn trạng thái lơ lửng, bóng nối liền với chân đế chuẩn vật lý thực tế.

### ☀️ Nguồn sáng & Hình bóng toán học chính xác tuyệt đối
* **Mô phỏng nguồn sáng mặt trời trên cao:** Đèn laser hình trụ bán kính lớn ($R = 1.10$, bán kính quỹ đạo $RL = 4.2$), độ cao đèn giữ nguyên cố định khi chuyển đổi các khối hình.
* **Dải góc chiếu liên tục:** Điều chỉnh góc nghiêng $\alpha \in [30^\circ, 150^\circ]$.
* **Phép chiếu vuông góc ($\alpha = 90^\circ$):** Bóng nằm trọn vẹn $100\%$ dưới đáy chân đế và bị thân vật thể che khuất hoàn toàn.
* **Thuật toán Convex Hull Andrew's Monotone Chain (Zero-GC):** Tính toán vết bóng thời gian thực với bộ đệm tĩnh tái sử dụng, không gây giật lag khung hình.

### 🎨 Giao diện Đồ họa Phẳng & Trải nghiệm Người dùng
* **Phong cách Flat Design hiện đại:** Bảng điều khiển dạng phẳng, viền đôi sắc nét (`border-2 border-slate-300`), không bóng mờ, nổi bật tinh tế.
* **Đồng bộ hóa 2 dòng công thái học:** Dòng 1 là thanh trượt Góc chiếu; Dòng 2 chia tỉ lệ 4:6 gồm ô chọn Khối 3D và ô thanh trượt Độ sáng.
* **Động cơ âm thanh Web Audio DSP phản hồi xúc giác:** Khởi động sớm triệt tiêu độ trễ (0ms), bộ nén Master Limiter chống rè loa khi bấm liên thanh, quản lý đơn âm sắc dứt khoát.
* **Hoạt động Offline 100%:** Ứng dụng Client-Side độc lập hoàn toàn, không phụ thuộc internet khi đang chạy, mạng yếu hay rớt mạng vẫn vận hành trơn tru.

---

## 🚀 3. Hướng dẫn Cài đặt & Chạy ứng dụng

### Yêu cầu hệ thống
* **Node.js:** Phiên bản 18 trở lên (khuyên dùng Node.js 20 hoặc 22 LTS).
* **Trình duyệt:** Bất kỳ trình duyệt hiện đại nào hỗ trợ WebGL (Chrome, Edge, Firefox, Safari, Brave,...).

### Cài đặt và Khởi chạy
```bash
# 1. Clone repository về máy tính
git clone https://github.com/username/mo-hinh-thi-nghiem-3d.git
cd mo-hinh-thi-nghiem-3d

# 2. Cài đặt các gói phụ thuộc
npm install

# 3. Khởi chạy máy chủ phát triển cục bộ (Local Dev Server)
npm run dev
```
Trình duyệt sẽ tự động mở hoặc bạn có thể truy cập tại: `http://localhost:3000/`.

### Đóng gói Triển khai (Build Production)
```bash
# Kiểm tra cú pháp và kiểu dữ liệu TypeScript
npm run lint

# Đóng gói sản phẩm xuất bản
npm run build

# Xem thử bản đóng gói production
npm run preview
```

---

## 👨‍💻 5. Tác giả & Liên hệ

* **Tác giả:** Nguyễn Trọng Bình
* **Email:** nguyentrongbinh309@gmail.com
* **Dự án:** Ứng dụng kỹ năng số - Mô hình thí nghiệm Hình học không gian 3D.

---

## 📄 6. Giấy phép

Dự án được phát hành theo giấy phép **Apache License 2.0**.
