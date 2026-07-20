# Hướng Dẫn Triển Khai (Deployment Guide) - AC Xuân Tài Portfolio

Dự án này là một ứng dụng **Full-Stack** kết hợp giữa:
- **Frontend**: Sách giới thiệu, thông tin liên hệ, social network stats và các minigames giải trí (Minesweeper, Tetris, 2048, Pokemon Pikachu Game) được xây dựng bằng React + Vite + Tailwind CSS.
- **Backend (Node.js/TypeScript)**: Máy chủ Express (`server.ts`) chịu trách nhiệm thu thập chỉ số mạng xã hội tự động (Facebook, YouTube, TikTok) thông qua việc cào dữ liệu (scraping) / gọi API RapidAPI và ghi cache.

---

## Mục lục
1. [Giải đáp: Chỉ upload thư mục `dist` lên Host có được không?](#1-giải-đáp-chỉ-upload-thư-mục-dist-lên-host-có-được-không)
2. [Cách 1: Triển khai Full-stack trên VPS (Khuyên dùng)](#cách-2-triển-khai-full-stack-trên-vps-khuyên-dùng)
3. [Cách 2: Triển khai Dạng Tĩnh (Static) bằng cách chỉ dùng thư mục `dist`](#cách-3-triển-khai-dạng-tĩnh-static-bằng-cách-chỉ-dùng-thư-mục-dist)

---

## 1. Giải đáp: Chỉ upload thư mục `dist` lên Host có được không?

Khi bạn chạy lệnh `npm run build`, Vite sẽ biên dịch toàn bộ mã nguồn React ở phía Client thành các file tĩnh (HTML, JS, CSS) nằm trong thư mục `dist`.

### Những bất tiện/hạn chế nếu chỉ upload thư mục `dist`:

1. **Mất Máy Chủ Tự Động Lưu Trữ & Fetch Stats**:
   - Phân hệ backend (`server.ts`) viết bằng Node.js sẽ **không hoạt động**.
   - Chức năng tự động lấy số lượng người theo dõi thực tế trên Facebook, TikTok, YouTube qua API/Scrape phía Backend sẽ không chạy. Trang web sẽ phải lấy số liệu tĩnh từ các file lưu sẵn trong thư mục `public` (ví dụ `777.json`) hoặc chạy qua file PHP bổ trợ nếu máy chủ Hosting của bạn hỗ trợ PHP (như `public/social-stats.php`).
2. **Lỗi Reload Trang (SPA Client-Side Routing)**:
   - Nếu bạn có sử dụng cấu hình router riêng của React, việc tải lại trang thủ công ở bất kỳ đường dẫn phụ nào ngoài trang chủ (như `/contact`, `/game`) sẽ trả về lỗi **404 Not Found** từ Web Server (Apache/Nginx/Litespeed) do Client-side routing không được máy chủ tĩnh hiểu mặc định. Bạn sẽ cần cấu hình file `.htaccess` hoặc `nginx.conf` để rewrite mọi request về `index.html`.

---

## 2. Triển khai Full-stack trên VPS (Khuyên dùng)

Đây là giải pháp tốt nhất để kích hoạt trọn vẹn sức mạnh hệ thống của bạn, bao gồm cả tính năng cập nhật Stats tự động thời gian thực từ phía máy chủ Node.js.

### Bước 1: Chuẩn bị trên máy tính cá nhân
Đẩy mã nguồn lên nền tảng quản lý Git (như GitHub, GitLab) để dễ dàng kéo về VPS:
```bash
git init
git add .
git commit -m "Initialize project"
git remote add origin <url-repository-cua-ban>
git branch -M main
git push -u origin main
```

### Bước 2: Cấu hình trên VPS
Đăng nhập vào VPS thông qua SSH (Terminal):
```bash
ssh root@<IP_CỦA_VPS>
```

#### 1. Cài đặt Node.js & NPM:
Cài đặt Node.js phiên bản LTS bền vững (Khuyên dùng Node 18 hoặc 20 trở lên):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 2. Cài đặt Trình quản lý tiến trình PM2 (Để giữ Server chạy ngầm):
```bash
sudo npm install -y -g pm2
```

#### 3. Cài đặt Git và Clone dự án:
```bash
sudo apt-get install -y git
cd /var/www
git clone <url-repository-cua-ban> portfolio
cd portfolio
```

#### 4. Cài đặt các thư viện và Xây dựng ứng dụng (Build):
```bash
npm install
npm run build
```

#### 5. Cài đặt các biến môi trường (Environment Variables) nếu có:
Tạo hoặc cập nhật file cấu hình môi trường `.env` trên VPS:
```bash
nano .env
```
Nhập các thông tin cần thiết (Key API, Port hoặc các thông số khác), ví dụ:
```env
PORT=2000
NODE_ENV=production
# RapidAPI Keys nếu bạn muốn tự động lấy Stats mạng xã hội live:
RAPIDAPI_KEY=your_rapid_api_key_here
```
Sau đó bấm `Ctrl + O` để lưu và `Ctrl + X` để thoát.

---

### Bước 3: Khởi chạy ứng dụng bằng PM2

Chạy NodeJS Server thông qua PM2 để đảm bảo ứng dụng luôn chạy ngầm và tự khởi động lại nếu VPS bị reboot:
```bash
pm2 start dist/server.cjs --name "xuantai-portfolio"
```

Các lệnh PM2 hữu ích khác để quản lý ứng dụng trên VPS:
- Xem danh sách ứng dụng: `pm2 list`
- Xem log hoạt động: `pm2 logs xuantai-portfolio`
- Khởi động lại: `pm2 restart xuantai-portfolio`
- Dừng ứng dụng: `pm2 stop xuantai-portfolio`

Để PM2 tự động khởi chạy cùng hệ thống khi VPS khởi động lại:
```bash
pm2 startup
# Hãy copy câu lệnh sinh ra trên terminal và chạy nó
pm2 save
```

---

### Bước 4: Cấu hình Nginx làm Reverse Proxy để gắn Tên miền (Domain)

Để người dùng truy cập trực tiếp bằng tên miền của bạn (ví dụ: `acxuantai.com` hoặc `tài.vn`) thế cho địa chỉ cổng `http://IP:2000`:

#### 1. Cài đặt Nginx:
```bash
sudo apt install -y nginx
```

#### 2. Tạo tệp cấu hình cho trang web của bạn:
```bash
sudo nano /etc/nginx/sites-available/acxuantai
```

#### 3. Dán đoạn cấu hình sau vào (Đã cấu hình theo port 2000 và các tên miền):
```nginx
server {
    listen 80;
    server_name acxuantai.com www.acxuantai.com tài.vn xn--ti-yia.com www.tài.vn www.xn--ti-yia.com; # Hỗ trợ cả tên miền quốc tế và mã hóa tiếng Việt

    location / {
        proxy_pass http://127.0.0.1:2000; # Chuyển hướng các request về NodeJS App chạy trên Port 2000
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Cấu hình timeout cho API hoạt động mượt mà
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

#### 4. Kích hoạt cấu hình và tải lại Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/acxuantai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### Bước 5: Cài đặt SSL miễn phí (HTTPS) với Let's Encrypt

Bảo vệ kết nối bằng chứng chỉ HTTPS bảo mật cao cho cả hai tên miền:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d acxuantai.com -d www.acxuantai.com -d xn--ti-yia.com -d www.xn--ti-yia.com
```
*Lưu ý*: Với tên miền có dấu như `tài.vn`, khi thao tác thiết lập chứng chỉ SSL hoặc DNS, hãy luôn sử dụng định dạng tên miền mã hóa Punycode (bắt đầu bằng `xn--`, ví dụ: `xn--ti-yia.com`).

---

## 3. Triển khai Dạng Tĩnh (Static) bằng cách chỉ dùng thư mục `dist`

Nếu Hosting của bạn chỉ hỗ trợ lưu trữ tệp tĩnh (như Shared Hosting thông thường, Cpanel, GitHub Pages, Vercel), bạn có thể giải nén `dist` rồi upload lên. Tuy nhiên, hãy thực hiện các bước tối ưu sau:

### Điều chỉnh API sang chạy qua PHP (Nếu VPS/Hosting hỗ trợ PHP)
Vì backend NodeJS không hoạt động, các yêu cầu lấy chỉ số mạng xã hội sẽ bị hỏng nếu trỏ vào `/api/social-stats`.
Trong mã nguồn hiện tại, file `public/social-stats.php` đã được chuẩn bị sẵn kèm file `public/777.json`.
Bạn có thể cấu hình Nginx hoặc Apache để trỏ API tĩnh trực tiếp vào script PHP hoặc giữ nguyên cơ chế fallback mượt mà được tích hợp sẵn trong mã nguồn frontend (Chương trình sẽ tự động lấy dữ liệu từ `777.json` fallback khi cổng API chính không thể phản hồi).

### Khắc phục lỗi REFRESH trang (Lỗi 404):
Nếu bạn gặp vấn đề khi tải lại trang, hãy cấu hình tệp tin điều hướng:

#### Trên máy chủ Apache (Sử dụng tệp `.htaccess`):
Tạo file `.htaccess` đặt ở thư mục gốc của Host với nội dung:
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

#### Trên máy chủ Nginx (`nginx.conf`):
Thêm khối lệnh `try_files` vào tệp cấu hình của bạn:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```
