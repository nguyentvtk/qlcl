# Site360 - Hướng dẫn Cài đặt và Chạy

## Yêu cầu hệ thống
- Node.js 20+ 
- Docker Desktop (cho môi trường production)
- PostgreSQL 16+ với PostGIS (hoặc dùng Docker)

---

## CÁCH 1: Chạy Local (Development)

### Bước 1: Cài đặt PostgreSQL + PostGIS
```bash
# macOS (Homebrew)
brew install postgresql@16 postgis

# Tạo database
createdb site360
psql site360 -c "CREATE EXTENSION postgis;"
psql site360 -c "CREATE EXTENSION \"uuid-ossp\";"

# Chạy schema
psql site360 < database/schema.sql
```

### Bước 2: Cấu hình Backend
```bash
cd backend
cp .env.example .env
# Chỉnh sửa .env với thông tin DB và JWT secrets

# Tạo JWT secrets ngẫu nhiên:
openssl rand -base64 64  # Copy vào JWT_ACCESS_SECRET
openssl rand -base64 64  # Copy vào JWT_REFRESH_SECRET

npm install
npm run dev
# Backend chạy tại: http://localhost:3001
```

### Bước 3: Cài đặt Frontend
```bash
cd frontend
npm install
npm run dev
# Frontend chạy tại: http://localhost:3000
```

---

## CÁCH 2: Docker Compose (Production-like)

### Bước 1: Tạo file .env
```bash
cp .env.example .env
# Chỉnh sửa các giá trị trong .env
```

### Bước 2: Tạo JWT Secrets
```bash
echo "JWT_ACCESS_SECRET=$(openssl rand -base64 64)" >> .env
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 64)" >> .env
```

### Bước 3: Chạy toàn bộ stack
```bash
docker-compose up -d

# Xem logs
docker-compose logs -f

# Kiểm tra trạng thái
docker-compose ps
```

### Bước 4: Kiểm tra
- Frontend: http://localhost (hoặc https://localhost)
- API Health: http://localhost/api/v1/... (qua Nginx)
- DB (dev only): localhost:5432

---

## SSL cho Production (Let's Encrypt)
```bash
# Cài certbot
apt install certbot python3-certbot-nginx

# Lấy certificate
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Cert sẽ lưu tại /etc/letsencrypt/live/yourdomain.com/
# Cập nhật nginx.conf trỏ đúng path
```

---

## Cấu trúc thư mục
```
Site360/
├── database/
│   └── schema.sql          # PostgreSQL + PostGIS schema
├── backend/
│   ├── src/
│   │   ├── config/database.ts   # Kết nối PostgreSQL
│   │   ├── middleware/auth.ts   # JWT + RBAC middleware
│   │   ├── routes/
│   │   │   ├── auth.ts          # Đăng nhập/đăng ký
│   │   │   ├── photos.ts        # Upload & quản lý ảnh 360°
│   │   │   ├── tasks.ts         # Kanban & Gantt API
│   │   │   └── pins.ts          # Pin báo cáo sự cố
│   │   └── services/
│   │       └── mediaStorage.ts  # Query theo bán kính GPS
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Photo360Viewer.tsx  # Viewer ảnh 360° + tạo pin
│   │   │   ├── SiteMap.tsx         # Bản đồ Leaflet
│   │   │   └── KanbanGanttWorkspace.tsx  # Kanban + Gantt
│   │   ├── services/api.ts         # Axios API client
│   │   └── types/index.ts          # TypeScript types
│   └── Dockerfile
├── nginx/
│   └── nginx.conf          # Reverse proxy + HTTPS + Security headers
├── docker-compose.yml
└── .env.example
```

---

## API Endpoints chính

### Auth
- `POST /api/v1/auth/register` - Đăng ký
- `POST /api/v1/auth/login` - Đăng nhập
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET  /api/v1/auth/me` - Thông tin user hiện tại

### Photos 360°
- `GET  /api/v1/projects/:id/photos` - Danh sách ảnh (có filter)
- `POST /api/v1/projects/:id/photos` - Upload ảnh (multipart/form-data)
- `GET  /api/v1/projects/:id/media/search?lat=&lng=&radius=50` - Tìm theo GPS bán kính
- `GET  /api/v1/projects/:id/media/tree` - Cây phân loại ảnh

### Tasks
- `GET  /api/v1/projects/:id/tasks?view=kanban` - Kanban view
- `GET  /api/v1/projects/:id/tasks/gantt` - Gantt data
- `POST /api/v1/projects/:id/tasks/reorder` - Cập nhật thứ tự kéo thả

### Pins/Reports
- `GET  /api/v1/projects/:id/pins` - Danh sách báo cáo
- `POST /api/v1/projects/:id/pins` - Tạo báo cáo sự cố
