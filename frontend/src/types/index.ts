// ============================================================
// Frontend TypeScript Types - Mirror của Backend types
// ============================================================

export type SystemRole = 'admin' | 'user';
export type ProjectRole = 'project_manager' | 'member' | 'viewer';
export type TaskStatus = 'todo' | 'doing' | 'review' | 'done' | 'blocked';
export type PinType = 'issue' | 'progress' | 'safety' | 'quality' | 'rfi' | 'note';
export type PinStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'rejected';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface User {
  id: string;
  email: string;
  full_name: string;
  system_role: SystemRole;
  avatar_url?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  color_code: string;
  start_date?: string;
  end_date?: string;
  completion_percentage?: number;
}

export interface Photo360 {
  id: string;
  project_id: string;
  zone_id?: string;
  zone_name?: string;
  phase?: string;
  file_url: string;
  thumbnail_url?: string;
  original_filename: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  heading?: number;
  captured_at?: string;
  uploader_name?: string;
  notes?: string;
  pin_count?: number;
  coordinates?: { lat: number; lng: number } | null;
  pins?: PinReport[];
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
  coordinates?: { lat: number; lng: number } | null;
  creator_name?: string;
  assignee_name?: string;
  assignee_avatar?: string;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  start_date?: string;
  end_date?: string;
  progress: number;
  dependencies: string[];
  zone_id?: string;
  zone_name?: string;
  assigned_to?: string;
  assignee_name?: string;
  assignee_avatar?: string;
  kanban_order: number;
  color: string;
  tags: string[];
  photo_evidence: string[];
  duration_days?: number;
  pin_count?: number;
  created_at: string;
}

export interface KanbanColumns {
  todo: Task[];
  doing: Task[];
  review: Task[];
  done: Task[];
  blocked: Task[];
}

// Màu sắc cho từng loại Pin
export const PIN_TYPE_COLORS: Record<PinType, string> = {
  issue:    '#ef4444',  // Đỏ
  safety:   '#f97316',  // Cam - an toàn lao động
  quality:  '#eab308',  // Vàng - chất lượng
  progress: '#22c55e',  // Xanh lá - tiến độ
  rfi:      '#3b82f6',  // Xanh dương - yêu cầu thông tin
  note:     '#6b7280',  // Xám - ghi chú
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low:      '#6b7280',
  medium:   '#3b82f6',
  high:     '#f97316',
  critical: '#ef4444',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo:    'Cần làm',
  doing:   'Đang làm',
  review:  'Đang kiểm tra',
  done:    'Hoàn thành',
  blocked: 'Bị chặn',
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  todo:    'bg-gray-100 text-gray-700',
  doing:   'bg-blue-100 text-blue-700',
  review:  'bg-yellow-100 text-yellow-700',
  done:    'bg-green-100 text-green-700',
  blocked: 'bg-red-100 text-red-700',
};
