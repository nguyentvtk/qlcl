-- ============================================================
-- SITE360 - Hệ thống Giám sát Công trường bằng Ảnh 360°
-- Schema PostgreSQL + PostGIS
-- ============================================================

-- Kích hoạt extension PostGIS để xử lý dữ liệu địa lý
CREATE EXTENSION IF NOT EXISTS postgis;
-- UUID generator để tạo ID ngẫu nhiên bảo mật hơn auto-increment
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- BẢNG 1: USERS - Quản lý người dùng hệ thống
-- ============================================================
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email       VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name   VARCHAR(255) NOT NULL,
    -- Vai trò toàn hệ thống: admin có thể tạo project, user chỉ được mời vào
    system_role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (system_role IN ('admin', 'user')),
    avatar_url  TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    last_login  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index email để tăng tốc đăng nhập
CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- BẢNG 2: PROJECTS - Quản lý đa dự án (Multi-tenancy)
-- ============================================================
CREATE TABLE projects (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    -- Tọa độ trung tâm công trường (dùng PostGIS Point, SRID 4326 = WGS84)
    center_location GEOMETRY(Point, 4326),
    -- Ngày bắt đầu và kết thúc dự án
    start_date  DATE,
    end_date    DATE,
    status      VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('planning', 'active', 'paused', 'completed', 'archived')),
    -- Màu đại diện cho project trên giao diện
    color_code  VARCHAR(7) DEFAULT '#3B82F6',
    -- Người tạo project
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index không gian để query tìm project gần một vị trí
CREATE INDEX idx_projects_location ON projects USING GIST(center_location);
CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_status ON projects(status);

-- ============================================================
-- BẢNG 3: PROJECT_MEMBERS - Phân quyền thành viên trong từng dự án (RBAC)
-- Tách ra bảng riêng để hỗ trợ Multi-tenancy: cùng 1 user có thể có quyền
-- khác nhau ở các project khác nhau
-- ============================================================
CREATE TABLE project_members (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Vai trò trong project: manager > member > viewer
    role        VARCHAR(30) NOT NULL DEFAULT 'viewer' CHECK (role IN ('project_manager', 'member', 'viewer')),
    invited_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Mỗi user chỉ có 1 vai trò trong 1 project
    UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);

-- ============================================================
-- BẢNG 4: ZONES - Khu vực trong công trường (phục vụ phân loại ảnh)
-- ============================================================
CREATE TABLE zones (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,   -- Ví dụ: "Tầng 1", "Khối A", "Sân ngoài"
    description TEXT,
    -- Đa giác ranh giới khu vực (tuỳ chọn, nếu có bản vẽ mặt bằng)
    boundary    GEOMETRY(Polygon, 4326),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, name)
);

CREATE INDEX idx_zones_project ON zones(project_id);
CREATE INDEX idx_zones_boundary ON zones USING GIST(boundary);

-- ============================================================
-- BẢNG 5: PHOTOS_360 - Lưu trữ ảnh 360° (Core table)
-- ============================================================
CREATE TABLE photos_360 (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    zone_id         UUID REFERENCES zones(id) ON DELETE SET NULL,
    -- Phase / Giai đoạn thi công (ví dụ: "Móng", "Thô", "Hoàn thiện")
    phase           VARCHAR(100),
    -- Đường dẫn file ảnh lưu trên server hoặc cloud storage
    file_url        TEXT NOT NULL,
    -- Tên file gốc để hiển thị
    original_filename VARCHAR(255) NOT NULL,
    -- Kích thước file (bytes)
    file_size       BIGINT,
    -- Chiều rộng và chiều cao ảnh (pixels)
    width           INTEGER,
    height          INTEGER,
    -- QUAN TRỌNG: Tọa độ GPS của điểm chụp (PostGIS Point, WGS84)
    -- Có thể lấy từ EXIF metadata của ảnh hoặc nhập tay
    geom            GEOMETRY(Point, 4326),
    -- Lưu riêng lat/lng để query nhanh khi không dùng PostGIS function
    latitude        DECIMAL(10, 8),
    longitude       DECIMAL(11, 8),
    -- Độ cao so với mực nước biển (metres)
    altitude        DECIMAL(8, 2),
    -- Hướng camera (0-360 độ, 0 = Bắc)
    heading         DECIMAL(5, 2),
    -- Thời điểm CHỤP ảnh (lấy từ EXIF, khác với thời điểm upload)
    captured_at     TIMESTAMPTZ,
    -- Thời điểm upload lên hệ thống
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Người upload
    uploaded_by     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    -- Ghi chú thêm
    notes           TEXT,
    -- Trạng thái xử lý ảnh (ảnh 360 cần thời gian xử lý)
    status          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('processing', 'active', 'archived')),
    -- Thumbnail URL (ảnh preview nhỏ)
    thumbnail_url   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index không gian PostGIS - QUAN TRỌNG để query bán kính hiệu quả
CREATE INDEX idx_photos_360_geom ON photos_360 USING GIST(geom);
CREATE INDEX idx_photos_360_project ON photos_360(project_id);
CREATE INDEX idx_photos_360_zone ON photos_360(zone_id);
-- Index thời gian để lọc theo ngày
CREATE INDEX idx_photos_360_captured_at ON photos_360(captured_at);
CREATE INDEX idx_photos_360_uploaded_by ON photos_360(uploaded_by);
-- Index tổ hợp cho query phân loại ảnh (project + zone + phase + ngày)
CREATE INDEX idx_photos_360_classification ON photos_360(project_id, zone_id, phase, captured_at);

-- ============================================================
-- BẢNG 6: PINS_REPORTS - Điểm báo cáo sự cố/tiến độ
-- Có thể gắn trực tiếp trên ảnh 360 (yaw/pitch) HOẶC trên bản đồ (lat/lng)
-- ============================================================
CREATE TABLE pins_reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    -- Ảnh 360 mà pin này được đặt trên đó (NULL nếu pin trên bản đồ)
    photo_id        UUID REFERENCES photos_360(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    -- Loại báo cáo
    type            VARCHAR(30) NOT NULL DEFAULT 'issue' CHECK (type IN ('issue', 'progress', 'safety', 'quality', 'rfi', 'note')),
    -- Mức độ ưu tiên
    priority        VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    -- Trạng thái xử lý
    status          VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'rejected')),

    -- === TỌA ĐỘ TRÊN ẢNH 360° (spherical coordinates) ===
    -- Yaw: góc ngang (-180 đến 180 độ), Pitch: góc dọc (-90 đến 90 độ)
    -- Chỉ có giá trị khi pin được đặt trên ảnh 360
    pin_yaw         DECIMAL(8, 4),   -- Góc ngang (azimuth)
    pin_pitch       DECIMAL(7, 4),   -- Góc dọc (elevation)

    -- === TỌA ĐỘ THỰC TẾ TRÊN BẢN ĐỒ (nếu pin trực tiếp trên map) ===
    -- Kế thừa từ ảnh nếu pin trên 360, hoặc nhập tay nếu pin trên bản đồ
    geom            GEOMETRY(Point, 4326),

    -- Ảnh đính kèm báo cáo (mảng URL)
    attachments     JSONB DEFAULT '[]',
    -- Người tạo pin
    created_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    -- Người được giao xử lý
    assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Deadline giải quyết
    due_date        DATE,
    -- Task liên quan (nếu có)
    task_id         UUID,   -- FK sẽ thêm sau khi tạo bảng tasks
    -- Ngày giải quyết thực tế
    resolved_at     TIMESTAMPTZ,
    resolved_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pins_reports_project ON pins_reports(project_id);
CREATE INDEX idx_pins_reports_photo ON pins_reports(photo_id);
CREATE INDEX idx_pins_reports_geom ON pins_reports USING GIST(geom);
CREATE INDEX idx_pins_reports_status ON pins_reports(status);
CREATE INDEX idx_pins_reports_created_by ON pins_reports(created_by);
CREATE INDEX idx_pins_reports_assigned ON pins_reports(assigned_to);

-- ============================================================
-- BẢNG 7: TASKS - Công việc phục vụ Kanban & Gantt Chart
-- ============================================================
CREATE TABLE tasks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    -- Trạng thái Kanban
    status          VARCHAR(20) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'review', 'done', 'blocked')),
    -- Mức độ ưu tiên
    priority        VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    -- === THÔNG TIN GANTT CHART ===
    -- Ngày bắt đầu và kết thúc dự kiến
    start_date      DATE,
    end_date        DATE,
    -- Tiến độ hoàn thành (0-100%)
    progress        INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    -- Dependencies: mảng UUID của các task phải hoàn thành trước task này
    -- Ví dụ: ["task-id-1", "task-id-2"]
    dependencies    JSONB DEFAULT '[]',
    -- Zone liên quan (task được giao cho khu vực nào)
    zone_id         UUID REFERENCES zones(id) ON DELETE SET NULL,
    -- Ảnh 360 minh chứng (link trực tiếp đến ảnh)
    photo_evidence  JSONB DEFAULT '[]',  -- Mảng photo_ids
    -- Người được giao việc
    assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    -- Thứ tự hiển thị trong cột Kanban
    kanban_order    INTEGER DEFAULT 0,
    -- Màu sắc trên Gantt chart
    color           VARCHAR(7) DEFAULT '#3B82F6',
    -- Tags/nhãn
    tags            JSONB DEFAULT '[]',
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_zone ON tasks(zone_id);
-- Index cho Gantt Chart query (lọc theo thời gian)
CREATE INDEX idx_tasks_dates ON tasks(start_date, end_date);
-- Index để sắp xếp Kanban theo thứ tự
CREATE INDEX idx_tasks_kanban_order ON tasks(project_id, status, kanban_order);

-- Thêm FK từ pins_reports sang tasks (sau khi tạo bảng tasks)
ALTER TABLE pins_reports
    ADD CONSTRAINT fk_pins_task FOREIGN KEY (task_id)
    REFERENCES tasks(id) ON DELETE SET NULL;

-- ============================================================
-- BẢNG 8: COMMENTS - Bình luận trên Pin/Task
-- ============================================================
CREATE TABLE comments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Polymorphic: comment có thể thuộc pin hoặc task
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('pin', 'task')),
    entity_id   UUID NOT NULL,
    content     TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    author_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    -- Cho phép reply comment
    parent_id   UUID REFERENCES comments(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_entity ON comments(entity_type, entity_id);
CREATE INDEX idx_comments_author ON comments(author_id);

-- ============================================================
-- BẢNG 9: ACTIVITY_LOGS - Nhật ký hoạt động để audit
-- ============================================================
CREATE TABLE activity_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action      VARCHAR(100) NOT NULL,  -- Ví dụ: 'photo.upload', 'task.status_change'
    entity_type VARCHAR(50),
    entity_id   UUID,
    -- Dữ liệu thay đổi (before/after)
    metadata    JSONB DEFAULT '{}',
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_project ON activity_logs(project_id);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);

-- ============================================================
-- BẢNG 10: REFRESH_TOKENS - Quản lý JWT Refresh Token
-- ============================================================
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,  -- Lưu hash, không lưu token gốc
    expires_at  TIMESTAMPTZ NOT NULL,
    is_revoked  BOOLEAN NOT NULL DEFAULT FALSE,
    user_agent  TEXT,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
-- Tự động dọn tokens hết hạn
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- ============================================================
-- VIEW HỮU ÍCH: Thống kê tổng quan project
-- ============================================================
CREATE VIEW project_stats AS
SELECT
    p.id AS project_id,
    p.name AS project_name,
    COUNT(DISTINCT ph.id) AS total_photos,
    COUNT(DISTINCT pr.id) FILTER (WHERE pr.status = 'open') AS open_issues,
    COUNT(DISTINCT pr.id) FILTER (WHERE pr.status = 'resolved') AS resolved_issues,
    COUNT(DISTINCT t.id) AS total_tasks,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'done') AS done_tasks,
    COUNT(DISTINCT pm.user_id) AS member_count,
    -- Tính % hoàn thành dựa trên tasks
    ROUND(
        CASE WHEN COUNT(t.id) = 0 THEN 0
        ELSE COUNT(t.id) FILTER (WHERE t.status = 'done') * 100.0 / COUNT(t.id)
        END, 1
    ) AS completion_percentage
FROM projects p
LEFT JOIN photos_360 ph ON ph.project_id = p.id AND ph.status = 'active'
LEFT JOIN pins_reports pr ON pr.project_id = p.id
LEFT JOIN tasks t ON t.project_id = p.id
LEFT JOIN project_members pm ON pm.project_id = p.id
GROUP BY p.id, p.name;

-- ============================================================
-- FUNCTION: Tự động cập nhật updated_at timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Áp dụng trigger cho tất cả bảng có cột updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_photos_360_updated_at BEFORE UPDATE ON photos_360 FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pins_reports_updated_at BEFORE UPDATE ON pins_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- DỮ LIỆU MẪU để test (chạy sau khi tạo schema)
-- ============================================================
-- Tài khoản admin mặc định (password: Admin@123456 - nhớ đổi!)
INSERT INTO users (email, password_hash, full_name, system_role) VALUES
('admin@site360.vn', '$2b$12$placeholder_hash_change_before_use', 'Quản trị viên', 'admin');
