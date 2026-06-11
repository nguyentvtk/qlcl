// ============================================================
// Định nghĩa TypeScript types cho toàn bộ ứng dụng
// ============================================================
import { Request } from 'express';

// ---- ENUMS ----
export type SystemRole = 'admin' | 'user';
export type ProjectRole = 'project_manager' | 'member' | 'viewer';
export type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed' | 'archived';
export type PhotoStatus = 'processing' | 'active' | 'archived';
export type TaskStatus = 'todo' | 'doing' | 'review' | 'done' | 'blocked';
export type PinType = 'issue' | 'progress' | 'safety' | 'quality' | 'rfi' | 'note';
export type PinStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'rejected';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

// ---- DATABASE MODELS ----
export interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  system_role: SystemRole;
  avatar_url?: string;
  is_active: boolean;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  center_location?: unknown; // PostGIS geometry
  start_date?: Date;
  end_date?: Date;
  status: ProjectStatus;
  color_code: string;
  owner_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  invited_by?: string;
  joined_at: Date;
}

export interface Photo360 {
  id: string;
  project_id: string;
  zone_id?: string;
  phase?: string;
  file_url: string;
  original_filename: string;
  file_size?: number;
  width?: number;
  height?: number;
  geom?: unknown;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  heading?: number;
  captured_at?: Date;
  uploaded_at: Date;
  uploaded_by: string;
  notes?: string;
  status: PhotoStatus;
  thumbnail_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface PinReport {
  id: string;
  project_id: string;
  photo_id?: string;
  title: string;
  description?: string;
  type: PinType;
  priority: Priority;
  status: PinStatus;
  pin_yaw?: number;
  pin_pitch?: number;
  geom?: unknown;
  attachments: string[];
  created_by: string;
  assigned_to?: string;
  due_date?: Date;
  task_id?: string;
  resolved_at?: Date;
  resolved_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  start_date?: Date;
  end_date?: Date;
  progress: number;
  dependencies: string[];
  zone_id?: string;
  photo_evidence: string[];
  assigned_to?: string;
  created_by: string;
  kanban_order: number;
  color: string;
  tags: string[];
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// ---- JWT PAYLOAD ----
export interface JWTPayload {
  userId: string;
  email: string;
  systemRole: SystemRole;
  iat?: number;
  exp?: number;
}

// ---- REQUEST EXTENSIONS ----
// Extend Express Request để thêm user info sau khi xác thực JWT
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    systemRole: SystemRole;
    projectRole?: ProjectRole;  // Role trong project cụ thể (được gán bởi RBAC middleware)
  };
}

// ---- API RESPONSE WRAPPERS ----
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ---- QUERY PARAMS ----
export interface PhotoQueryParams {
  projectId: string;
  zoneId?: string;
  phase?: string;
  startDate?: string;
  endDate?: string;
  lat?: number;
  lng?: number;
  radiusMeters?: number;
  page?: number;
  limit?: number;
}

export interface TaskQueryParams {
  projectId: string;
  status?: TaskStatus;
  assignedTo?: string;
  startDate?: string;
  endDate?: string;
}
