export type UserRole = 'HR' | 'Finance' | 'Admin' | 'Viewer';

export interface Allowance {
  id?: string;
  type: string;
  amount: number;
}

export interface AllowanceType {
  id: string;
  name: string;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: 'Active' | 'Inactive';
  createdAt: string;
}

export type AttendanceType = 'In' | 'Out';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  timestamp: string;
  type: AttendanceType;
  deviceId?: string;
  deviceName?: string;
  manual?: boolean;
  note?: string;
}

export interface AttendanceDevice {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  lastSync?: string;
  status: 'Online' | 'Offline' | 'Syncing';
}

export interface AttendanceShift {
  id: string;
  name: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  graceMinutes: number;
  workDays: number[]; // 0 (Sun) to 6 (Sat)
}

export interface AbsenceType {
  id: string;
  name: string;
  deductionRatio: number; // e.g., 1 for full day, 0.5 for half day
}

export interface AbsenceRecord {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  absenceTypeId: string;
  note?: string;
}

export interface MissionAllowance {
  id: string;
  name: string;
  amount: number;
  type: 'Daily' | 'Once';
}

export interface MissionType {
  id: string;
  name: string;
  allowanceAmount?: number;
  allowances: MissionAllowance[];
}

export interface Mission {
  id: string;
  employeeId: string;
  projectId?: string; // المأمورية متعلقة بمشروع
  startDate: string;
  endDate: string;
  missionTypeId: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  notes?: string;
  allowances?: MissionAllowance[];
}

export type EmployeeStatus = 'Active' | 'Inactive' | 'End of Service' | 'Leave';
export type PaymentMethod = 'Bank' | 'Cash'; // Bank: استلام بنك, Cash: استلام راتب

export interface Employee {
  id: string;
  employeeId: string; // الرقم الوظيفي
  name: string; // الإسم
  iqamaNumber: string; // رقم الإقامة
  officialEmployer: string; // صاحب العمل الرسمي
  professionAsPerIqama: string; // المهنة حسب الاقامة
  nationality: string; // الجنسية
  jobTitle: string; // الوظيفة
  joinDate: string; // بداية العمل
  lastDirectDate: string; // آخر مباشرة
  sectorManagement: string; // ادارة القطاع
  sectors: string; // القطاعات
  costCenterMain: string; // مركز التكلفة / رئيسي
  costCenterDept: string; // مركز التكلفة / قسم
  location: string; // الموقع
  bankAccount: string; // الايبــــــــــان
  bankCode: string; // كود البنك
  paymentMethod: PaymentMethod; // نوع استلام الراتب
  basicSalary: number; // الراتب الاساسي
  housingAllowance: number; // بدل سكن
  transportAllowance: number; // بدل نقل
  subsistenceAllowance: number; // بدل إعاشه
  otherAllowances: number; // بدلات اخرى
  mobileAllowance: number; // بدل جوال
  managementAllowance: number; // بدل ادارة
  dailyWorkHours: number; // عدد ساعات يوم العمل
  status: EmployeeStatus;
  allowances: Allowance[]; // Dynamic allowances from DDL
  role?: UserRole;
  email?: string;
  shiftId?: string;
  managerId?: string; // ID of the manager
  departmentId?: string; // ID of the administrative department
}

export interface Transaction {
  id: string;
  employeeId: string;
  month: string; // YYYY-MM
  actualWorkDays: number; // عدد الايام العمل الفعلي
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  subsistenceAllowance: number;
  otherAllowances: number;
  mobileAllowance: number;
  managementAllowance: number;
  missionAllowance?: number;
  otherIncome: number; // اضافة الشهر دخل آخر
  overtimeHours: number; // عدد ساعات العمل الاضافي
  overtimeValue: number; // قيمة عمل اضافي
  totalIncome: number; // مجموع الدخل
  socialInsurance: number; // تامينات اجتماعية
  salaryReceived: number; // استلام راتب
  loans: number; // سلف
  bankReceived: number; // استلام بنك
  otherDeductions: number; // اقتطاعات اخرى
  deductionHours: number; // عدد الساعات
  departureDelayDeduction: number; // خصم المغادرات والتاخير
  absenceDays: number; // عدد ايام الغياب
  absenceDeduction: number; // خصم الغياب
  totalDeductions: number; // مجموع الاقتطاعات
  netSalary: number; // صافي الراتب
  status: string; // الحالة
  salaryIncrease: number; // زيادة راتب
  notes: string; // ملاحظات
  dailyWorkHours: number; // عدد ساعات يوم العمل
  createdAt: any;
}

export type ProjectStatus = 'Active' | 'Completed' | 'On Hold';
export type TaskStatus = 'Pending' | 'In Progress' | 'Under Review' | 'Approved' | 'Rejected' | 'Testing' | 'Executed';
export type ProjectPhase = 'Analysis' | 'Design' | 'Development';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  managerId?: string; // person reviewing
  startDate: string;
  endDate: string;
  type: string; // Sick, Vacation, etc.
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Postponed';
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  parentProjectId?: string; // لدعم المشروعات الفرعية
  clientName: string;
  description?: string;
  details?: string;          // تفاصيل إضافية عن المشروع
  projectManagerId: string; // مدير المشروع
  teamLeaderId: string;      // قائد الفريق
  consultantTlId?: string;   // قائد فريق الاستشاريين
  developerTlId?: string;    // قائد فريق المطورين
  phases: string[];          // المراحل الديناميكية (e.g. ['Analysis', 'Design', ...])
  startDate?: string;
  endDate?: string;
  status: ProjectStatus;
  chat?: TaskChatMessage[];  // المحادثة العامة للمشروع
  createdAt: string;
}

export interface SubTask {
  id: string;
  title: string;
  status: 'Pending' | 'Completed';
  createdAt: string;
}

export interface TaskChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  mentions?: string[];       // قائمة IDs الموظفين الذين تمت الإشارة إليهم
  createdAt: string;
}

export interface ProjectTask {
  id: string;
  projectId: string;
  parentTaskId?: string; // لربط المهمات الفرعية بشجرة المهام الرئيسية
  title: string;
  description: string;
  phase: string;         // المرحلة (ديناميكية بناء على المشروع)
  subPhase?: string;     // e.g. 'Site Visit', 'CR', 'BUG'
  status: TaskStatus;
  creatorId: string;
  assignedToIds?: string[]; // Multiple assignees
  assignedToId?: string; // Legacy
  startDate?: string;    // بداية المهمة
  endDate?: string;      // نهاية المهمة
  estimatedHours?: number; // الوقت المقدر بالساعات
  subTasks?: SubTask[];    // المهمات الفرعية
  attachments?: { 
    name: string; 
    url: string; 
    uploadedBy: string; 
    timestamp: string;
    source: 'Firebase' | 'GoogleDrive';
    externalId?: string; 
  }[];
  comments?: TaskChatMessage[]; // تم استبدال TaskComment بـ TaskChatMessage
  workflowLog: WorkflowLog[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowLog {
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  userId: string;
  userName: string;
  timestamp: string;
  note?: string;
}

export interface AdministrativeDepartment {
  id: string;
  name: string;
  description?: string;
  managerId: string;
  parentDeptId?: string;
}

export interface PayrollRun {
  id: string;
  month: string;
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Locked';
  totalNet: number;
  employeeCount: number;
  updatedAt: any;
}

export interface PayrollAdjustment {
  label: string;
  amount: number;
}

export interface PayrollResult {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeName: string;
  iqamaNumber?: string;
  officialEmployer?: string;
  location?: string;
  paymentMethod?: PaymentMethod;
  bankAccount: string;
  bankCode?: string;

  // Financial fields
  basicSalary: number;
  housingAllowance: number;
  grossBase: number;
  totalIncome: number;
  overtimeValue: number;
  absenceDeduction: number;
  totalDeductions: number;
  salaryReceived: number;
  bankReceived: number;
  otherEarnings: number;
  bankExportAmount: number;
  cashExportAmount: number;
  netSalary: number;
  adjustments?: PayrollAdjustment[];
}
