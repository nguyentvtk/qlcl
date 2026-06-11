// ============================================================
// KanbanGanttWorkspace.tsx - Workspace tích hợp Kanban + Gantt Chart
// Sử dụng @hello-pangea/dnd cho kéo thả Kanban
// Gantt Chart được render bằng SVG thuần (không cần thư viện ngoài)
// ============================================================
import React, { useState, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
  LayoutGrid, BarChart2, Plus, User, Calendar, Clock,
  AlertCircle, ChevronDown, ChevronRight, Link2, Camera,
} from 'lucide-react';
import { format, parseISO, differenceInDays, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Task, TaskStatus, KanbanColumns, Priority,
  TASK_STATUS_LABELS, TASK_STATUS_COLORS, PRIORITY_COLORS,
} from '../types';

type ViewMode = 'kanban' | 'gantt';

interface Props {
  tasks: Task[];
  columns: KanbanColumns;
  projectId: string;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onTaskCreate: (data: Partial<Task>) => void;
  onTaskClick?: (task: Task) => void;
  onReorder: (updates: Array<{ id: string; status: TaskStatus; kanban_order: number }>) => Promise<void>;
}

// ============================================================
// KANBAN: Card component cho từng task
// ============================================================
const KanbanCard: React.FC<{
  task: Task;
  index: number;
  onClick: (task: Task) => void;
}> = ({ task, index, onClick }) => (
  <Draggable draggableId={task.id} index={index}>
    {(provided, snapshot) => (
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
        onClick={() => onClick(task)}
        className={`bg-white rounded-xl border border-gray-200 p-3 mb-2 cursor-pointer
          hover:shadow-md hover:border-blue-200 transition-all select-none
          ${snapshot.isDragging ? 'shadow-xl rotate-1 border-blue-300 ring-2 ring-blue-200' : ''}`}
      >
        {/* Priority indicator */}
        <div
          className="w-full h-0.5 rounded-full mb-2"
          style={{ background: PRIORITY_COLORS[task.priority] }}
        />

        <p className="text-sm font-medium text-gray-800 line-clamp-2 mb-2">{task.title}</p>

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {task.tags.slice(0, 2).map(tag => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer metadata */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            {/* Assignee avatar */}
            {task.assignee_name ? (
              <div
                className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold"
                title={task.assignee_name}
              >
                {task.assignee_name.charAt(0).toUpperCase()}
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                <User size={12} className="text-gray-400" />
              </div>
            )}

            {/* Số pins liên quan */}
            {(task.pin_count ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-orange-600">
                <AlertCircle size={12} />
                {task.pin_count}
              </span>
            )}

            {/* Ảnh minh chứng */}
            {task.photo_evidence?.length > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-blue-600">
                <Camera size={12} />
                {task.photo_evidence.length}
              </span>
            )}
          </div>

          {/* Due date */}
          {task.end_date && (
            <span className={`text-xs flex items-center gap-0.5 ${
              new Date(task.end_date) < new Date() && task.status !== 'done'
                ? 'text-red-500 font-medium'
                : 'text-gray-400'
            }`}>
              <Calendar size={11} />
              {format(parseISO(task.end_date), 'dd/MM', { locale: vi })}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {task.progress > 0 && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-400 mb-0.5">
              <span>Tiến độ</span>
              <span>{task.progress}%</span>
            </div>
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${task.progress}%`, background: task.color }}
              />
            </div>
          </div>
        )}
      </div>
    )}
  </Draggable>
);

// ============================================================
// KANBAN: Column component
// ============================================================
const KanbanColumn: React.FC<{
  status: TaskStatus;
  tasks: Task[];
  onAddTask: (status: TaskStatus) => void;
  onTaskClick: (task: Task) => void;
}> = ({ status, tasks, onAddTask, onTaskClick }) => {
  const colorMap: Record<TaskStatus, string> = {
    todo:    'border-t-gray-400',
    doing:   'border-t-blue-500',
    review:  'border-t-yellow-400',
    done:    'border-t-green-500',
    blocked: 'border-t-red-500',
  };

  return (
    <div className={`flex flex-col bg-gray-50 rounded-xl border-t-4 ${colorMap[status]} min-w-[260px] max-w-[300px] flex-shrink-0`}>
      {/* Column header */}
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TASK_STATUS_COLORS[status]}`}>
            {TASK_STATUS_LABELS[status]}
          </span>
          <span className="text-xs text-gray-400 font-medium bg-gray-200 px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => onAddTask(status)}
          className="p-1 rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 px-2 pb-2 min-h-[120px] transition-colors ${
              snapshot.isDraggingOver ? 'bg-blue-50/50' : ''
            }`}
          >
            {tasks.map((task, index) => (
              <KanbanCard key={task.id} task={task} index={index} onClick={onTaskClick} />
            ))}
            {provided.placeholder}

            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="text-center py-8 text-gray-300 text-sm">
                Kéo task vào đây
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
};

// ============================================================
// GANTT CHART: Render bằng CSS Grid (không cần thư viện)
// ============================================================
const GanttChart: React.FC<{ tasks: Task[]; onTaskClick: (task: Task) => void }> = ({
  tasks, onTaskClick,
}) => {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const today = new Date();

  // Tính khoảng thời gian hiển thị (từ task sớm nhất đến task trễ nhất, + buffer 1 tuần)
  const { chartStart, totalDays } = useMemo(() => {
    const validTasks = tasks.filter(t => t.start_date && t.end_date);
    if (validTasks.length === 0) {
      return { chartStart: startOfMonth(today), totalDays: 30 };
    }
    const start = new Date(Math.min(...validTasks.map(t => new Date(t.start_date!).getTime())));
    const end = new Date(Math.max(...validTasks.map(t => new Date(t.end_date!).getTime())));
    const chartStart = addDays(start, -3);
    const totalDays = differenceInDays(addDays(end, 7), chartStart);
    return { chartStart, totalDays: Math.max(totalDays, 30) };
  }, [tasks]);

  const DAY_WIDTH = 28; // pixels mỗi ngày
  const ROW_HEIGHT = 44;
  const LABEL_WIDTH = 220;
  const totalWidth = totalDays * DAY_WIDTH;

  // Tạo danh sách cột ngày (hiển thị nhãn tuần/tháng)
  const dayColumns = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => addDays(chartStart, i));
  }, [chartStart, totalDays]);

  // Nhóm ngày theo tuần để hiển thị header
  const weekGroups = useMemo(() => {
    const groups: Array<{ label: string; start: number; width: number }> = [];
    let currentWeek = '';
    let weekStart = 0;

    dayColumns.forEach((day, i) => {
      const weekLabel = format(day, "'T'w/yyyy", { locale: vi });
      if (weekLabel !== currentWeek) {
        if (currentWeek) groups.push({ label: currentWeek, start: weekStart, width: (i - weekStart) * DAY_WIDTH });
        currentWeek = weekLabel;
        weekStart = i;
      }
      if (i === dayColumns.length - 1) {
        groups.push({ label: currentWeek, start: weekStart, width: (i - weekStart + 1) * DAY_WIDTH });
      }
    });
    return groups;
  }, [dayColumns]);

  // Tính vị trí bar cho từng task
  const getTaskBar = (task: Task) => {
    if (!task.start_date || !task.end_date) return null;
    const start = differenceInDays(parseISO(task.start_date), chartStart);
    const duration = differenceInDays(parseISO(task.end_date), parseISO(task.start_date)) + 1;
    return { left: start * DAY_WIDTH, width: Math.max(duration * DAY_WIDTH, 20) };
  };

  // Vị trí đường kẻ "Hôm nay"
  const todayOffset = differenceInDays(today, chartStart) * DAY_WIDTH;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white rounded-xl border border-gray-200">
      {/* Header: tên task + timeline */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {/* Cột tên task */}
        <div
          className="flex-shrink-0 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200"
          style={{ width: LABEL_WIDTH }}
        >
          Tên công việc
        </div>

        {/* Timeline header */}
        <div className="overflow-x-auto flex-1 relative" style={{ minWidth: 0 }}>
          <div style={{ width: totalWidth, position: 'relative' }}>
            {/* Hàng tuần */}
            <div className="flex h-6 relative">
              {weekGroups.map((wg, i) => (
                <div
                  key={i}
                  className="absolute border-l border-gray-200 text-xs text-gray-500 px-1 pt-1 font-medium overflow-hidden"
                  style={{ left: wg.start * DAY_WIDTH, width: wg.width }}
                >
                  {wg.label}
                </div>
              ))}
            </div>

            {/* Hàng ngày */}
            <div className="flex h-6">
              {dayColumns.map((day, i) => (
                <div
                  key={i}
                  className={`flex-shrink-0 border-l border-gray-100 flex items-center justify-center text-xs ${
                    day.getDay() === 0 || day.getDay() === 6
                      ? 'bg-gray-50 text-gray-400'
                      : 'text-gray-500'
                  }`}
                  style={{ width: DAY_WIDTH }}
                >
                  {format(day, 'd')}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Body: rows */}
      <div className="flex flex-1 overflow-hidden">
        {/* Cột nhãn task */}
        <div className="flex-shrink-0 overflow-y-auto border-r border-gray-200" style={{ width: LABEL_WIDTH }}>
          {tasks.map(task => (
            <div
              key={task.id}
              className="flex items-center gap-2 px-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
              style={{ height: ROW_HEIGHT }}
              onClick={() => onTaskClick(task)}
            >
              <div
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ background: task.color }}
              />
              <span className="text-xs text-gray-700 truncate font-medium">{task.title}</span>

              {/* Hiển thị dependencies icon */}
              {task.dependencies.length > 0 && (
                <Link2 size={10} className="text-gray-400 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* Timeline bars */}
        <div className="flex-1 overflow-auto relative">
          <div style={{ width: totalWidth, position: 'relative' }}>
            {/* Đường kẻ "Hôm nay" */}
            {todayOffset >= 0 && todayOffset <= totalWidth && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10 pointer-events-none"
                style={{ left: todayOffset }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-red-400 text-white text-xs px-1 rounded whitespace-nowrap">
                  Hôm nay
                </div>
              </div>
            )}

            {tasks.map(task => {
              const bar = getTaskBar(task);
              const isOverdue = task.end_date && new Date(task.end_date) < today && task.status !== 'done';

              return (
                <div
                  key={task.id}
                  className="relative border-b border-gray-100 flex items-center"
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Weekend columns */}
                  {dayColumns.map((day, i) =>
                    day.getDay() === 0 || day.getDay() === 6 ? (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 bg-gray-50/70"
                        style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
                      />
                    ) : null
                  )}

                  {/* Gantt bar */}
                  {bar && (
                    <div
                      className={`absolute h-7 rounded-lg cursor-pointer flex items-center px-2 shadow-sm
                        hover:opacity-90 hover:shadow-md transition-all group`}
                      style={{
                        left: bar.left,
                        width: bar.width,
                        background: isOverdue
                          ? `repeating-linear-gradient(45deg, ${task.color}, ${task.color} 8px, ${task.color}cc 8px, ${task.color}cc 16px)`
                          : task.color,
                        opacity: task.status === 'done' ? 0.7 : 1,
                      }}
                      onClick={() => onTaskClick(task)}
                    >
                      {/* Progress overlay */}
                      {task.progress > 0 && task.progress < 100 && (
                        <div
                          className="absolute left-0 top-0 bottom-0 bg-white/25 rounded-l-lg"
                          style={{ width: `${task.progress}%` }}
                        />
                      )}

                      <span className="text-white text-xs font-medium truncate z-10 relative drop-shadow">
                        {bar.width > 60 ? task.title : ''}
                      </span>

                      {/* Tooltip khi hover */}
                      <div className="absolute -top-14 left-0 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 invisible group-hover:visible whitespace-nowrap z-50 shadow-xl">
                        <p className="font-semibold">{task.title}</p>
                        <p className="text-gray-300">
                          {task.start_date && format(parseISO(task.start_date), 'dd/MM/yyyy')}
                          {' → '}
                          {task.end_date && format(parseISO(task.end_date), 'dd/MM/yyyy')}
                        </p>
                        <p className="text-gray-300">Tiến độ: {task.progress}%</p>
                      </div>
                    </div>
                  )}

                  {/* Chưa có ngày */}
                  {!bar && (
                    <div className="absolute left-2 text-xs text-gray-300 italic">
                      Chưa lên lịch
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// MAIN COMPONENT: KanbanGanttWorkspace
// ============================================================
const KanbanGanttWorkspace: React.FC<Props> = ({
  tasks, columns, projectId,
  onTaskUpdate, onTaskCreate, onTaskClick, onReorder,
}) => {
  const [view, setView] = useState<ViewMode>('kanban');
  const [isUpdating, setIsUpdating] = useState(false);

  // Xử lý khi kéo thả Kanban
  const handleDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination) return;

    const sourceCol = result.source.droppableId as TaskStatus;
    const destCol = result.destination.droppableId as TaskStatus;
    const taskId = result.draggableId;

    if (sourceCol === destCol && result.source.index === result.destination.index) return;

    // Cập nhật local state ngay lập tức (optimistic update)
    const newColumns = { ...columns };

    // Lấy task từ cột nguồn
    const sourceTasks = [...newColumns[sourceCol]];
    const [movedTask] = sourceTasks.splice(result.source.index, 1);

    if (sourceCol !== destCol) {
      // Di chuyển sang cột khác
      const destTasks = [...newColumns[destCol]];
      destTasks.splice(result.destination.index, 0, { ...movedTask, status: destCol });
      newColumns[sourceCol] = sourceTasks;
      newColumns[destCol] = destTasks;
    } else {
      // Sắp xếp lại trong cùng cột
      sourceTasks.splice(result.destination.index, 0, movedTask);
      newColumns[sourceCol] = sourceTasks;
    }

    // Xây dựng danh sách cập nhật để gửi lên API
    const updates = [
      ...newColumns[destCol].map((t, i) => ({
        id: t.id, status: destCol, kanban_order: i,
      })),
    ];

    if (sourceCol !== destCol) {
      updates.push(
        ...newColumns[sourceCol].map((t, i) => ({
          id: t.id, status: sourceCol, kanban_order: i,
        }))
      );
    }

    setIsUpdating(true);
    try {
      await onReorder(updates);
    } finally {
      setIsUpdating(false);
    }
  }, [columns, onReorder]);

  // Thống kê nhanh
  const stats = useMemo(() => ({
    total: tasks.length,
    done: columns.done.length,
    overdue: tasks.filter(t => t.end_date && new Date(t.end_date) < new Date() && t.status !== 'done').length,
    progress: tasks.length ? Math.round(columns.done.length * 100 / tasks.length) : 0,
  }), [tasks, columns]);

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* ---- Header với toggle view ---- */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-6">
          {/* Thống kê */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">
              <b className="text-gray-800">{stats.total}</b> công việc
            </span>
            <span className="text-green-600">
              <b>{stats.done}</b> hoàn thành ({stats.progress}%)
            </span>
            {stats.overdue > 0 && (
              <span className="text-red-500 font-medium">
                ⚠ {stats.overdue} quá hạn
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Kanban / Gantt */}
          <div className="flex bg-gray-200 rounded-xl p-0.5">
            <button
              onClick={() => setView('kanban')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                view === 'kanban' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <LayoutGrid size={16} />
              Kanban
            </button>
            <button
              onClick={() => setView('gantt')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                view === 'gantt' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <BarChart2 size={16} />
              Gantt
            </button>
          </div>

          {/* Nút thêm task */}
          <button
            onClick={() => onTaskCreate({ status: 'todo' })}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-1.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={16} />
            Thêm task
          </button>
        </div>
      </div>

      {/* ---- Content ---- */}
      <div className="flex-1 overflow-hidden relative">
        {/* Overlay loading khi đang update */}
        {isUpdating && (
          <div className="absolute inset-0 bg-white/40 z-50 flex items-center justify-center">
            <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* KANBAN VIEW */}
        {view === 'kanban' && (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-4 p-4 h-full overflow-x-auto">
              {(Object.keys(columns) as TaskStatus[]).map(status => (
                <KanbanColumn
                  key={status}
                  status={status}
                  tasks={columns[status]}
                  onAddTask={(s) => onTaskCreate({ status: s })}
                  onTaskClick={onTaskClick || (() => {})}
                />
              ))}
            </div>
          </DragDropContext>
        )}

        {/* GANTT VIEW */}
        {view === 'gantt' && (
          <div className="p-4 h-full">
            <GanttChart
              tasks={tasks}
              onTaskClick={onTaskClick || (() => {})}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default KanbanGanttWorkspace;
