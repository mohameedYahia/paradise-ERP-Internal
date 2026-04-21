import React, { useState, useMemo } from 'react';
import { 
  Fingerprint, 
  Settings, 
  RefreshCw, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Calendar,
  Search,
  Filter,
  Monitor,
  Activity,
  FileBarChart,
  CalendarDays,
  Plane
} from 'lucide-react';
import { db, collection, setDoc, doc, deleteDoc, updateDoc } from '../../firebase';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../AuthContext';
import { 
  AttendanceRecord, 
  AttendanceDevice, 
  Employee, 
  AttendanceShift, 
  Mission, 
  AbsenceRecord, 
  AbsenceType as AbsenceTypeModel,
  LeaveRequest
} from '../../types';
import { format, isSameDay, startOfDay, parse, isAfter, addMinutes, getDay, isWithinInterval, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

export const Attendance: React.FC = () => {
  const { user } = useAuth();
  const { 
    employees, 
    attendanceRecords, 
    attendanceDevices, 
    attendanceShifts,
    missions,
    absenceRecords,
    absenceTypes,
    leaveRequests 
  } = useData();
  const [activeTab, setActiveTab] = useState<'records' | 'reports' | 'absence-records' | 'shifts' | 'devices' | 'absence-types' | 'leave-requests'>('records');
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isAbsenceTypeModalOpen, setIsAbsenceTypeModalOpen] = useState(false);
  const [isLeaveRequestModalOpen, setIsLeaveRequestModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportMonth, setReportMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [reportType, setReportType] = useState<'daily' | 'monthly'>('daily');

  // Shift Form State
  const [shiftForm, setShiftForm] = useState<Omit<AttendanceShift, 'id'>>({
    name: '',
    startTime: '08:00',
    endTime: '17:00',
    graceMinutes: 15,
    workDays: [0, 1, 2, 3, 4] // Sun-Thu by default
  });

  // Leave Request Form State
  const [leaveRequestForm, setLeaveRequestForm] = useState<Partial<LeaveRequest>>({
    employeeId: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    type: 'Vacation',
    reason: '',
    status: 'Pending'
  });

  // Absence Type Form State
  const [absenceTypeForm, setAbsenceTypeForm] = useState<Omit<AbsenceTypeModel, 'id'>>({
    name: '',
    deductionRatio: 1
  });

  // Absence Record Form State
  const [absenceRecordForm, setAbsenceRecordForm] = useState<Omit<AbsenceRecord, 'id'>>({
    employeeId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    absenceTypeId: '',
    note: ''
  });

  const [isAbsenceRecordModalOpen, setIsAbsenceRecordModalOpen] = useState(false);

  // Manual Form State
  const [manualForm, setManualForm] = useState({
    employeeId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
    type: 'In' as 'In' | 'Out',
    note: ''
  });

  // Device Form State
  const [deviceForm, setDeviceForm] = useState<Omit<AttendanceDevice, 'id'>>({
    name: '',
    ipAddress: '',
    port: 4370,
    status: 'Offline'
  });

  const handleAddLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = crypto.randomUUID();
    const newRequest: LeaveRequest = {
      ...(leaveRequestForm as LeaveRequest),
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    try {
      await setDoc(doc(db, 'leaveRequests', id), newRequest);
      setIsLeaveRequestModalOpen(false);
      setLeaveRequestForm({
        employeeId: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        type: 'Vacation',
        reason: '',
        status: 'Pending'
      });
    } catch (error) {
       console.error('Error adding leave request', error);
    }
  };

  const handleUpdateLeaveRequestStatus = async (id: string, newStatus: LeaveRequest['status'], reviewNote: string = '') => {
    try {
      await updateDoc(doc(db, 'leaveRequests', id), {
        status: newStatus,
        managerId: user?.uid || '',
        reviewNote,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating leave request status', error);
    }
  };

  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = crypto.randomUUID();
    await setDoc(doc(db, 'attendanceShifts', id), { ...shiftForm, id });
    setIsShiftModalOpen(false);
    setShiftForm({ name: '', startTime: '08:00', endTime: '17:00', graceMinutes: 15, workDays: [0, 1, 2, 3, 4] });
  };

  const handleAddAbsenceType = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = crypto.randomUUID();
    await setDoc(doc(db, 'absenceTypes', id), { ...absenceTypeForm, id });
    setIsAbsenceTypeModalOpen(false);
    setAbsenceTypeForm({ name: '', deductionRatio: 1 });
  };

  const handleAddAbsenceRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = crypto.randomUUID();
    await setDoc(doc(db, 'absenceRecords', id), { ...absenceRecordForm, id });
    setIsAbsenceRecordModalOpen(false);
    setAbsenceRecordForm({
      employeeId: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      absenceTypeId: '',
      note: ''
    });
  };

  const handleDeleteShift = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الجدول؟')) {
      await deleteDoc(doc(db, 'attendanceShifts', id));
    }
  };

  const calculateReport = useMemo(() => {
    const targetDate = new Date(reportDate);
    const targetDateStr = format(targetDate, 'yyyy-MM-dd');
    const dayOfWeek = getDay(targetDate);
    
    return employees.map(emp => {
      const shift = attendanceShifts.find(s => s.id === emp.shiftId) || attendanceShifts[0];
      const isWorkDay = shift?.workDays.includes(dayOfWeek);
      
      const dayRecords = attendanceRecords.filter(r => 
        r.employeeId === emp.id && 
        isSameDay(new Date(r.timestamp), targetDate)
      ).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const firstIn = dayRecords.find(r => r.type === 'In');
      const lastOut = [...dayRecords].reverse().find(r => r.type === 'Out');

      // Check missions (ماموريات)
      const isMission = missions.some(m => 
        m.employeeId === emp.id && 
        m.status === 'Approved' &&
        targetDateStr >= m.startDate && 
        targetDateStr <= m.endDate
      );

      // Check custom absence records
      const customAbsence = absenceRecords.find(a => 
        a.employeeId === emp.id && 
        a.date === targetDateStr
      );
      const absenceType = customAbsence ? absenceTypes.find(at => at.id === customAbsence.absenceTypeId) : null;

      // Check approved leave requests
      const isLeave = leaveRequests.find(lr => 
        lr.employeeId === emp.id && 
        lr.status === 'Approved' && 
        targetDateStr >= lr.startDate && 
        targetDateStr <= lr.endDate
      );

      let delayMinutes = 0;
      let status: 'Present' | 'Absent' | 'Off' | 'Mission' | string = 'Absent';

      if (firstIn) {
        status = 'Present';
        if (shift) {
          const shiftStart = parse(shift.startTime, 'HH:mm', targetDate);
          const graceThreshold = addMinutes(shiftStart, shift.graceMinutes);
          const actualIn = new Date(firstIn.timestamp);
          
          if (isAfter(actualIn, graceThreshold)) {
            delayMinutes = Math.floor((actualIn.getTime() - shiftStart.getTime()) / (1000 * 60));
          }
        }
      } else if (isMission) {
        status = 'Mission';
      } else if (isLeave) {
        status = isLeave.type === 'Vacation' ? 'إجازة اعتيادية' : 
                 isLeave.type === 'Sick' ? 'إجازة مرضية' : 
                 isLeave.type === 'Unpaid' ? 'بدون مرتب' : 
                 isLeave.type === 'Permission' ? 'تصريح' : 'أخرى';
      } else if (absenceType) {
        status = absenceType.name;
      } else if (!isWorkDay) {
        status = 'Off';
      }

      return {
        ...emp,
        firstIn,
        lastOut,
        delayMinutes,
        status,
        shiftName: shift?.name || 'بدون جدول'
      };
    });
  }, [employees, attendanceRecords, attendanceShifts, reportDate, missions, absenceRecords, absenceTypes, leaveRequests]);

  const monthlyReport = useMemo(() => {
    return employees.map(emp => {
      const shift = attendanceShifts.find(s => s.id === emp.shiftId) || attendanceShifts[0];
      const monthRecords = attendanceRecords.filter(r => 
        r.employeeId === emp.id && 
        r.timestamp.startsWith(reportMonth)
      );

      const monthMissions = missions.filter(m => 
        m.employeeId === emp.id && 
        m.status === 'Approved' &&
        (m.startDate.startsWith(reportMonth) || m.endDate.startsWith(reportMonth))
      );

      const monthLeaves = leaveRequests.filter(l => 
        l.employeeId === emp.id && 
        l.status === 'Approved' &&
        (l.startDate.startsWith(reportMonth) || l.endDate.startsWith(reportMonth))
      );

      // Group records by day
      const daysInMonth = monthRecords.reduce((acc, r) => {
        const day = r.timestamp.split('T')[0];
        if (!acc[day]) acc[day] = [];
        acc[day].push(r);
        return acc;
      }, {} as Record<string, AttendanceRecord[]>);

      let totalDelay = 0;
      let presentDays = 0;
      let lateDays = 0;
      let missionDays = 0;
      let absentDays = 0;
      let leaveDays = 0;

      // Iterating through all days of the month would be more accurate for "total absent"
      // but let's stick to the records present + missions first, then potentially count others.
      // Actually, to correctly count absences, we need to iterate through month days.
      
      const year = parseInt(reportMonth.split('-')[0]);
      const month = parseInt(reportMonth.split('-')[1]);
      const lastDay = new Date(year, month, 0).getDate();

      for (let d = 1; d <= lastDay; d++) {
        const dateStr = `${reportMonth}-${String(d).padStart(2, '0')}`;
        const targetDate = new Date(dateStr);
        const dayOfWeek = getDay(targetDate);
        const isWorkDay = shift?.workDays.includes(dayOfWeek);

        if (!isWorkDay) continue;

        const records = daysInMonth[dateStr] || [];
        const sorted = records.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const firstIn = sorted.find(r => r.type === 'In');

        const isMission = monthMissions.some(m => dateStr >= m.startDate && dateStr <= m.endDate);
        const isLeave = monthLeaves.some(l => dateStr >= l.startDate && dateStr <= l.endDate);
        const customAbsence = absenceRecords.find(a => a.employeeId === emp.id && a.date === dateStr);

        if (firstIn) {
          presentDays++;
          if (shift) {
            const shiftStart = parse(shift.startTime, 'HH:mm', targetDate);
            const actualIn = new Date(firstIn.timestamp);
            const graceThreshold = addMinutes(shiftStart, shift.graceMinutes);
            
            if (isAfter(actualIn, graceThreshold)) {
              totalDelay += Math.floor((actualIn.getTime() - shiftStart.getTime()) / (1000 * 60));
              lateDays++;
            }
          }
        } else if (isMission) {
          missionDays++;
        } else if (isLeave) {
          leaveDays++;
        } else if (customAbsence) {
          const type = absenceTypes.find(at => at.id === customAbsence.absenceTypeId);
          if (type && type.deductionRatio > 0) {
            absentDays += type.deductionRatio;
          }
        } else {
          absentDays++;
        }
      }

      return {
        ...emp,
        presentDays,
        lateDays,
        missionDays,
        leaveDays,
        absentDays,
        totalDelay,
        shiftName: shift?.name || 'بدون جدول'
      };
    });
  }, [employees, attendanceRecords, attendanceShifts, reportMonth, missions, absenceRecords, absenceTypes, leaveRequests]);

  const handleAddManualRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = crypto.randomUUID();
    const timestamp = new Date(`${manualForm.date}T${manualForm.time}:00`).toISOString();
    
    const record: AttendanceRecord = {
      id,
      employeeId: manualForm.employeeId,
      timestamp,
      type: manualForm.type,
      manual: true,
      note: manualForm.note,
      deviceName: 'إضافة يدوية'
    };

    await setDoc(doc(db, 'attendanceRecords', id), record);
    setIsManualModalOpen(false);
    setManualForm({
      employeeId: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      time: format(new Date(), 'HH:mm'),
      type: 'In',
      note: ''
    });
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = crypto.randomUUID();
    await setDoc(doc(db, 'attendanceDevices', id), deviceForm);
    setIsDeviceModalOpen(false);
    setDeviceForm({ name: '', ipAddress: '', port: 4370, status: 'Offline' });
  };

  const handleSync = async (device: AttendanceDevice) => {
    setIsSyncing(true);
    // Simulate API call to device IP
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update last sync
    await setDoc(doc(db, 'attendanceDevices', device.id), {
      ...device,
      lastSync: new Promise(resolve => resolve(new Date().toISOString())),
      status: 'Online'
    }, { merge: true });

    // Mock: Add a new record
    const mockRecord: AttendanceRecord = {
      id: crypto.randomUUID(),
      employeeId: employees[0]?.id || 'mock-id',
      timestamp: new Date().toISOString(),
      type: 'In',
      deviceId: device.id,
      deviceName: device.name
    };
    await setDoc(doc(db, 'attendanceRecords', mockRecord.id), mockRecord);
    
    setIsSyncing(false);
  };

  const filteredRecords = useMemo(() => {
    return attendanceRecords
      .filter(record => {
        const employee = employees.find(e => e.id === record.employeeId);
        const searchLower = searchTerm.toLowerCase();
        return (
          employee?.name.toLowerCase().includes(searchLower) ||
          employee?.employeeId.toLowerCase().includes(searchLower) ||
          record.type.toLowerCase().includes(searchLower) ||
          (record.deviceName || '').toLowerCase().includes(searchLower)
        );
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [attendanceRecords, employees, searchTerm]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = attendanceRecords.filter(r => r.timestamp.startsWith(today));
    const presentIds = new Set(todayRecords.map(r => r.employeeId));
    
    return {
      total: employees.length,
      present: presentIds.size,
      absent: employees.length - presentIds.size,
      onlineDevices: attendanceDevices.filter(d => d.status === 'Online').length
    };
  }, [employees, attendanceRecords, attendanceDevices]);

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الموظفين', value: stats.total, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'حضور اليوم', value: stats.present, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'غياب اليوم', value: stats.absent, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'أجهزة متصلة', value: stats.onlineDevices, icon: Monitor, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", stat.bg, stat.color)}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400">{stat.label}</p>
              <p className="text-2xl font-black text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1 bg-gray-100/50 rounded-2xl w-fit">
        {[
          { id: 'records', label: 'سجلات الحضور', icon: Clock },
          { id: 'reports', label: 'تقارير التأخير والغياب', icon: FileBarChart },
          { id: 'leave-requests', label: 'طلبات الإجازة والتصريح', icon: Plane },
          { id: 'absence-records', label: 'تسجيل الغيابات المسبقة', icon: Calendar },
          { id: 'shifts', label: 'مواعيد الدوام', icon: CalendarDays },
          { id: 'absence-types', label: 'أنواع الغيابات', icon: Filter },
          { id: 'devices', label: 'أجهزة البصمة (IP)', icon: Monitor },
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2",
              activeTab === tab.id ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'records' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
             <div className="relative flex-1 max-w-md w-full">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="بحث في السجلات..."
                  className="w-full pr-12 pl-4 py-3 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
             <div className="flex gap-2">
                <button className="p-3 bg-white border border-gray-100 rounded-xl text-gray-500 hover:bg-gray-50 flex items-center gap-2 font-bold shadow-sm">
                  <Filter className="w-5 h-5" />
                  <span>تصفية</span>
                </button>
                <button 
                  onClick={() => setIsManualModalOpen(true)}
                  className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center gap-2 font-bold shadow-sm"
                >
                  <Plus className="w-5 h-5" />
                  <span>إضافة يدوي</span>
                </button>
             </div>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100 text-xs font-black text-gray-400 uppercase tracking-wider">
                    <th className="px-8 py-5">الموظف</th>
                    <th className="px-8 py-5">التاريخ</th>
                    <th className="px-8 py-5">الوقت</th>
                    <th className="px-8 py-5">النوع</th>
                    <th className="px-8 py-5">المصدر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredRecords.map((record) => {
                    const employee = employees.find(e => e.id === record.employeeId);
                    return (
                      <tr key={record.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 font-black">
                              {employee?.name?.[0] || 'U'}
                            </div>
                            <div>
                               <p className="font-black text-gray-900">{employee?.name || 'موظف مجهول'}</p>
                               <p className="text-xs text-gray-400">{employee?.employeeId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5 font-bold text-gray-600">
                          {format(new Date(record.timestamp), 'yyyy/MM/dd', { locale: ar })}
                        </td>
                        <td className="px-8 py-5 font-bold text-gray-600">
                          {format(new Date(record.timestamp), 'HH:mm:ss')}
                        </td>
                        <td className="px-8 py-5">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-black",
                            record.type === 'In' ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"
                          )}>
                            {record.type === 'In' ? 'دخول' : 'خروج'}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                           <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                              <Fingerprint className="w-3 h-3" />
                              {record.deviceName || 'جهاز خارجي'}
                           </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
             <div className="flex items-center gap-6">
                <div className="flex items-center gap-4">
                  <FileBarChart className="w-8 h-8 text-blue-600" />
                  <div>
                    <h3 className="text-xl font-black text-gray-900">تقارير الحضور</h3>
                    <p className="text-sm font-bold text-gray-400">حساب التأخير والغياب</p>
                  </div>
                </div>

                <div className="flex p-1 bg-gray-100 rounded-xl">
                  <button 
                    onClick={() => setReportType('daily')}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-xs font-black transition-all",
                      reportType === 'daily' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"
                    )}
                  >
                    يومي
                  </button>
                  <button 
                    onClick={() => setReportType('monthly')}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-xs font-black transition-all",
                      reportType === 'monthly' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"
                    )}
                  >
                    شهري
                  </button>
                </div>
             </div>
             
             {reportType === 'daily' ? (
                <input 
                  type="date"
                  className="px-6 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                />
             ) : (
                <input 
                  type="month"
                  className="px-6 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(e.target.value)}
                />
             )}
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100 text-xs font-black text-gray-400 uppercase tracking-wider">
                    <th className="px-8 py-5">الموظف</th>
                    {reportType === 'daily' ? (
                      <>
                        <th className="px-8 py-5">الحالة</th>
                        <th className="px-8 py-5">وقت الحضـور</th>
                        <th className="px-8 py-5">وقت الانصراف</th>
                        <th className="px-8 py-5">التأخير (دقيقة)</th>
                      </>
                    ) : (
                      <>
                        <th className="px-8 py-5">أيام الحضور</th>
                        <th className="px-8 py-5">إجمالي التأخير (د)</th>
                        <th className="px-8 py-5">أيام المأموريات</th>
                        <th className="px-8 py-5">الإجازات والتصاريح</th>
                        <th className="px-8 py-5">أيام الغياب</th>
                      </>
                    )}
                    <th className="px-8 py-5">الجدول</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {reportType === 'daily' ? (
                    calculateReport.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-8 py-5 text-sm">
                           <p className="font-black text-gray-900">{row.name}</p>
                           <p className="text-[10px] text-gray-400">{row.employeeId}</p>
                        </td>
                        <td className="px-8 py-5">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-black",
                            row.status === 'Present' ? "bg-emerald-50 text-emerald-600" : 
                            row.status === 'Mission' ? "bg-purple-50 text-purple-600" :
                            row.status.includes('إجازة') || row.status === 'تصريح' ? "bg-blue-50 text-blue-600" :
                            row.status === 'Absent' ? "bg-red-50 text-red-600" : 
                            "bg-gray-100 text-gray-500"
                          )}>
                            {row.status === 'Present' ? 'حاضر' : 
                             row.status === 'Mission' ? 'مأمورية' :
                             row.status === 'Absent' ? 'غائب' : row.status === 'Off' ? 'خارج العمل' : row.status}
                          </span>
                        </td>
                        <td className="px-8 py-5 font-bold text-gray-600">
                          {row.firstIn ? format(new Date(row.firstIn.timestamp), 'HH:mm:ss') : '-'}
                        </td>
                        <td className="px-8 py-5 font-bold text-gray-600">
                          {row.lastOut ? format(new Date(row.lastOut.timestamp), 'HH:mm:ss') : '-'}
                        </td>
                        <td className="px-8 py-5">
                           <span className={cn(
                             "font-black",
                             row.delayMinutes > 0 ? "text-red-600" : "text-emerald-600"
                           )}>
                              {row.delayMinutes > 0 ? `${row.delayMinutes} د` : '0'}
                           </span>
                        </td>
                        <td className="px-8 py-5 text-sm font-bold text-gray-400">
                          {row.shiftName}
                        </td>
                      </tr>
                    ))
                  ) : (
                    monthlyReport.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-8 py-5 text-sm">
                           <p className="font-black text-gray-900">{row.name}</p>
                           <p className="text-[10px] text-gray-400">{row.employeeId}</p>
                        </td>
                        <td className="px-8 py-5 font-bold text-gray-600">{row.presentDays} يوم</td>
                        <td className="px-8 py-5 font-black text-red-600">{row.totalDelay} دقيقة</td>
                        <td className="px-8 py-5 font-bold text-purple-600">{row.missionDays} يوم</td>
                        <td className="px-8 py-5 font-bold text-blue-600">{row.leaveDays} يوم</td>
                        <td className="px-8 py-5 font-bold text-red-500">{row.absentDays} يوم</td>
                        <td className="px-8 py-5 text-sm font-bold text-gray-400">{row.shiftName}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'leave-requests' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
             <div>
               <h3 className="text-xl font-black text-gray-900">طلبات الإجازة والتصريح</h3>
               <p className="text-sm font-bold text-gray-400">إدارة طلبات إجازات الموظفين واعتمادها يدوياً</p>
             </div>
             <button 
               onClick={() => setIsLeaveRequestModalOpen(true)}
               className="px-6 py-3 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2"
             >
               <Plus className="w-5 h-5" /> إنشاء طلب إجازة
             </button>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full text-right block md:table">
                 <thead className="hidden md:table-header-group">
                   <tr className="bg-gray-50/50 border-b border-gray-100 text-xs font-black text-gray-400 uppercase tracking-wider">
                     <th className="px-8 py-5">الموظف</th>
                     <th className="px-8 py-5">المدة / التاريخ</th>
                     <th className="px-8 py-5">نوع الإجازة / السبب</th>
                     <th className="px-8 py-5">حالة الطلب</th>
                     <th className="px-8 py-5 text-center">الرد</th>
                   </tr>
                 </thead>
                 <tbody className="block md:table-row-group divide-y divide-gray-50">
                   {leaveRequests.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(request => {
                     const emp = employees.find(e => e.id === request.employeeId);
                     return (
                       <tr key={request.id} className="block md:table-row hover:bg-gray-50/50 transition-colors p-4 md:p-0">
                         <td className="md:px-8 md:py-5 flex md:table-cell flex-col mb-2 md:mb-0">
                            <span className="md:hidden text-xs font-black text-gray-400 mb-1">الموظف</span>
                            <span className="font-black text-gray-900">{emp?.name || 'مجهول'}</span>
                         </td>
                         <td className="md:px-8 md:py-5 flex md:table-cell flex-col mb-2 md:mb-0">
                            <span className="md:hidden text-xs font-black text-gray-400 mb-1">المدة</span>
                            <span className="font-bold text-gray-600">{request.startDate} - {request.endDate}</span>
                         </td>
                         <td className="md:px-8 md:py-5 flex md:table-cell flex-col mb-2 md:mb-0">
                            <span className="md:hidden text-xs font-black text-gray-400 mb-1">النوع/السبب</span>
                            <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg w-fit text-sm">
                              {request.type === 'Vacation' ? 'إجازة اعتيادية' : 
                               request.type === 'Sick' ? 'إجازة مرضية' : 
                               request.type === 'Unpaid' ? 'بدون مرتب' : 
                               request.type === 'Permission' ? 'تصريح مغادرة/تأخير' : 'أخرى'}
                            </span>
                            <p className="text-sm font-medium text-gray-500 mt-1">{request.reason}</p>
                         </td>
                         <td className="md:px-8 md:py-5 flex md:table-cell flex-col mb-4 md:mb-0">
                            <span className="md:hidden text-xs font-black text-gray-400 mb-1">الحالة</span>
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-black w-fit",
                              request.status === 'Pending' ? "bg-orange-50 text-orange-600" :
                              request.status === 'Approved' ? "bg-emerald-50 text-emerald-600" :
                              request.status === 'Postponed' ? "bg-blue-50 text-blue-600" :
                              "bg-red-50 text-red-600"
                            )}>
                              {request.status === 'Pending' ? 'قيد المراجعة' :
                               request.status === 'Approved' ? 'تمت الموافقة' :
                               request.status === 'Postponed' ? 'تم التأجيل' : 'مرفوض'}
                            </span>
                         </td>
                         <td className="md:px-8 md:py-5 text-center">
                            {request.status === 'Pending' ? (
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => {
                                  const note = prompt('ملاحظة للاعتماد (اختياري):', '');
                                  if (note !== null) handleUpdateLeaveRequestStatus(request.id, 'Approved', note);
                                }} className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg font-black text-xs transition">موافقة</button>
                                <button onClick={() => {
                                  const note = prompt('سبب التأجيل (مطلوب):', '');
                                  if (note) handleUpdateLeaveRequestStatus(request.id, 'Postponed', note);
                                }} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-black text-xs transition">تأجيل</button>
                                <button onClick={() => {
                                  const note = prompt('سبب الرفض (مطلوب):', '');
                                  if (note) handleUpdateLeaveRequestStatus(request.id, 'Rejected', note);
                                }} className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-black text-xs transition">رفض</button>
                              </div>
                            ) : (
                               <div className="text-xs font-medium text-gray-400">
                                 {request.reviewNote && <p className="mt-1">"{request.reviewNote}"</p>}
                               </div>
                            )}
                         </td>
                       </tr>
                     );
                   })}
                   {leaveRequests.length === 0 && (
                     <tr className="block md:table-row">
                        <td colSpan={5} className="text-center p-8 text-gray-400 font-bold block md:table-cell">
                           لا توجد طلبات إجازة حالياً.
                        </td>
                     </tr>
                   )}
                 </tbody>
               </table>
            </div>
          </div>
        </div>
      )}

       {activeTab === 'absence-records' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
             <div>
               <h3 className="text-xl font-black text-gray-900">تسجيل الغيابات</h3>
               <p className="text-sm font-bold text-gray-400">سجل الغيابات المسبقة والأعذار</p>
             </div>
             <button 
               onClick={() => setIsAbsenceRecordModalOpen(true)}
               className="px-6 py-3 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
             >
               تسجيل غياب
             </button>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-xs font-black text-gray-400 uppercase tracking-wider">
                  <th className="px-8 py-5">الموظف</th>
                  <th className="px-8 py-5">التاريخ</th>
                  <th className="px-8 py-5">النوع</th>
                  <th className="px-8 py-5">العمليات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {absenceRecords.sort((a,b) => b.date.localeCompare(a.date)).map((record) => {
                  const emp = employees.find(e => e.id === record.employeeId);
                  const type = absenceTypes.find(t => t.id === record.absenceTypeId);
                  return (
                    <tr key={record.id}>
                      <td className="px-8 py-5 font-black text-gray-900">{emp?.name}</td>
                      <td className="px-8 py-5 font-bold text-gray-600">{record.date}</td>
                      <td className="px-8 py-5">
                         <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-black">
                            {type?.name}
                         </span>
                      </td>
                      <td className="px-8 py-5">
                        <button 
                          onClick={async () => {
                            if (confirm('هل أنت متأكد من حذف هذا السجل؟')) {
                              await deleteDoc(doc(db, 'absenceRecords', record.id));
                            }
                          }}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'shifts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           <AnimatePresence>
            {attendanceShifts.map((shift) => (
              <motion.div 
                layout
                key={shift.id}
                className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm relative group overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/30 rounded-full -translate-y-16 translate-x-16 -z-0" />
                
                <div className="relative z-10 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                      <CalendarDays className="w-6 h-6" />
                    </div>
                    <button 
                      onClick={() => handleDeleteShift(shift.id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div>
                     <h3 className="text-lg font-black text-gray-900">{shift.name}</h3>
                     <div className="flex items-center gap-3 mt-2">
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-black">
                           {shift.startTime} - {shift.endTime}
                        </span>
                        <span className="text-xs font-bold text-gray-400">
                           فترة سماح: {shift.graceMinutes} دقيقة
                        </span>
                     </div>
                  </div>

                  <div className="flex flex-wrap gap-1 pt-4 border-t border-gray-50">
                    {['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'].map((day, i) => (
                      <div 
                        key={i}
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black transition-all",
                          shift.workDays.includes(i) ? "bg-emerald-600 text-white shadow-sm shadow-emerald-200" : "bg-gray-50 text-gray-300"
                        )}
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}

            <button 
              onClick={() => setIsShiftModalOpen(true)}
              className="border-2 border-dashed border-gray-200 rounded-[2.5rem] flex flex-col items-center justify-center py-12 gap-4 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all group p-6"
            >
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                 <Plus className="w-8 h-8" />
              </div>
              <p className="font-black">إضافة جدول دوام جديد</p>
            </button>
           </AnimatePresence>
        </div>
      )}

      {activeTab === 'absence-types' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           <AnimatePresence>
            {absenceTypes.map((type) => (
              <motion.div 
                layout
                key={type.id}
                className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm relative group overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50/30 rounded-full -translate-y-16 translate-x-16 -z-0" />
                
                <div className="relative z-10 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors">
                      <Filter className="w-6 h-6" />
                    </div>
                    <button 
                      onClick={async () => {
                        if (confirm('هل أنت متأكد من حذف هذا النوع؟')) {
                          await deleteDoc(doc(db, 'absenceTypes', type.id));
                        }
                      }}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div>
                     <h3 className="text-lg font-black text-gray-900">{type.name}</h3>
                     <p className="text-sm font-bold text-gray-400">نسبة الخصم من اليوم: {type.deductionRatio * 100}%</p>
                  </div>
                </div>
              </motion.div>
            ))}

            <button 
              onClick={() => setIsAbsenceTypeModalOpen(true)}
              className="border-2 border-dashed border-gray-200 rounded-[2.5rem] flex flex-col items-center justify-center py-12 gap-4 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all group p-6"
            >
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                 <Plus className="w-8 h-8" />
              </div>
              <p className="font-black">إضافة نوع غياب جديد</p>
            </button>
           </AnimatePresence>
        </div>
      )}

      {activeTab === 'devices' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           <AnimatePresence>
            {attendanceDevices.map((device) => (
              <motion.div 
                layout
                key={device.id}
                className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm relative group overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/30 rounded-full -translate-y-16 translate-x-16 -z-0" />
                
                <div className="relative z-10 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      <Monitor className="w-6 h-6" />
                    </div>
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase",
                      device.status === 'Online' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                    )}>
                      {device.status}
                    </div>
                  </div>

                  <div>
                     <h3 className="text-lg font-black text-gray-900">{device.name}</h3>
                     <p className="text-sm font-mono text-gray-400">{device.ipAddress}:{device.port}</p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                    <div className="text-[10px] font-bold text-gray-400">
                       آخر مزامنة: {device.lastSync ? format(new Date(device.lastSync), 'HH:mm') : 'لم تتم بعد'}
                    </div>
                    <button 
                      onClick={() => handleSync(device)}
                      disabled={isSyncing}
                      className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={cn("w-5 h-5", isSyncing && "animate-spin")} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}

            <button 
              onClick={() => setIsDeviceModalOpen(true)}
              className="border-2 border-dashed border-gray-200 rounded-[2.5rem] flex flex-col items-center justify-center py-12 gap-4 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all group p-6"
            >
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                 <Plus className="w-8 h-8" />
              </div>
              <p className="font-black">إضافة جهاز بصمة جديد</p>
            </button>
           </AnimatePresence>
        </div>
      )}

      {/* Shift Modal */}
      <AnimatePresence>
        {isShiftModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShiftModalOpen(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                   <CalendarDays className="w-6 h-6 text-blue-600" />
                   إعداد جدول دوام
                </h3>
              </div>
              <form onSubmit={handleAddShift} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">اسم الجدول</label>
                    <input 
                      required
                      placeholder="مثال: الدوام الصباحي"
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={shiftForm.name}
                      onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-500 mr-2">وقت الحضور</label>
                      <input 
                        type="time"
                        required
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                        value={shiftForm.startTime}
                        onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-500 mr-2">وقت الانصراف</label>
                      <input 
                        type="time"
                        required
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                        value={shiftForm.endTime}
                        onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">فترة السماح (بالدقائق)</label>
                    <input 
                      type="number"
                      required
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={shiftForm.graceMinutes || 0}
                      onChange={(e) => setShiftForm({ ...shiftForm, graceMinutes: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">أيام العمل</label>
                    <div className="flex flex-wrap gap-2">
                      {['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'].map((day, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            const newDays = shiftForm.workDays.includes(i)
                              ? shiftForm.workDays.filter(d => d !== i)
                              : [...shiftForm.workDays, i];
                            setShiftForm({ ...shiftForm, workDays: newDays });
                          }}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-black transition-all border-2",
                            shiftForm.workDays.includes(i)
                              ? "bg-blue-50 border-blue-500 text-blue-600 shadow-sm"
                              : "bg-white border-gray-100 text-gray-400 hover:border-gray-200"
                          )}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-200">
                    حفظ الجدول
                  </button>
                  <button type="button" onClick={() => setIsShiftModalOpen(false)} className="flex-1 py-4 bg-gray-100 text-gray-600 font-black rounded-2xl">
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Entry Modal */}
      <AnimatePresence>
        {isManualModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsManualModalOpen(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                   <Plus className="w-6 h-6 text-blue-600" />
                   إضافة سجل يدوي
                </h3>
              </div>
              <form onSubmit={handleAddManualRecord} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">الموظف</label>
                    <select
                      required
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={manualForm.employeeId}
                      onChange={(e) => setManualForm({ ...manualForm, employeeId: e.target.value })}
                    >
                      <option value="">اختر الموظف...</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.employeeId})</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-500 mr-2">التاريخ</label>
                      <input 
                        type="date"
                        required
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                        value={manualForm.date}
                        onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-500 mr-2">الوقت</label>
                      <input 
                        type="time"
                        required
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                        value={manualForm.time}
                        onChange={(e) => setManualForm({ ...manualForm, time: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">النوع</label>
                    <div className="flex gap-4">
                      {(['In', 'Out'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setManualForm({ ...manualForm, type: t })}
                          className={cn(
                            "flex-1 py-3 rounded-2xl font-black transition-all border-2",
                            manualForm.type === t 
                              ? (t === 'In' ? "bg-emerald-50 border-emerald-500 text-emerald-600" : "bg-orange-50 border-orange-500 text-orange-600")
                              : "bg-white border-gray-100 text-gray-400 hover:border-gray-200"
                          )}
                        >
                          {t === 'In' ? 'دخول' : 'خروج'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">ملاحظة</label>
                    <textarea 
                      placeholder="سبب الإضافة اليدوية..."
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24"
                      value={manualForm.note}
                      onChange={(e) => setManualForm({ ...manualForm, note: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-200">
                    إضافة السجل
                  </button>
                  <button type="button" onClick={() => setIsManualModalOpen(false)} className="flex-1 py-4 bg-gray-100 text-gray-600 font-black rounded-2xl">
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Absence Record Modal */}
      <AnimatePresence>
        {isAbsenceRecordModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAbsenceRecordModalOpen(false)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8">
              <h3 className="text-2xl font-black text-gray-900 mb-6">تسجيل غياب يدوي</h3>
              <form onSubmit={handleAddAbsenceRecord} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-500 mr-2">الموظف</label>
                  <select
                    required
                    className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                    value={absenceRecordForm.employeeId}
                    onChange={(e) => setAbsenceRecordForm({ ...absenceRecordForm, employeeId: e.target.value })}
                  >
                    <option value="">اختر الموظف...</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.employeeId})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-500 mr-2">التاريخ</label>
                  <input 
                    type="date"
                    required
                    className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 font-medium"
                    value={absenceRecordForm.date}
                    onChange={(e) => setAbsenceRecordForm({ ...absenceRecordForm, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-500 mr-2">نوع الغياب</label>
                  <select
                    required
                    className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                    value={absenceRecordForm.absenceTypeId}
                    onChange={(e) => setAbsenceRecordForm({ ...absenceRecordForm, absenceTypeId: e.target.value })}
                  >
                    <option value="">اختر النوع...</option>
                    {absenceTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name} (خصم {t.deductionRatio * 100}%)</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl">حفظ</button>
                  <button type="button" onClick={() => setIsAbsenceRecordModalOpen(false)} className="flex-1 py-4 bg-gray-100 text-gray-600 font-black rounded-2xl">إلغاء</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Device Modal */}
      <AnimatePresence>
        {isDeviceModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeviceModalOpen(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                   <Settings className="w-6 h-6 text-blue-600" />
                   إعداد جهاز البصمة
                </h3>
              </div>
              <form onSubmit={handleAddDevice} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">اسم الجهاز</label>
                    <input 
                      required
                      placeholder="مثال: بصمة الموقع الرئيسي"
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={deviceForm.name}
                      onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="space-y-2 flex-1">
                      <label className="text-sm font-bold text-gray-500 mr-2">عنوان IP</label>
                      <input 
                        required
                        placeholder="192.168.1.100"
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        value={deviceForm.ipAddress}
                        onChange={(e) => setDeviceForm({ ...deviceForm, ipAddress: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 w-32">
                      <label className="text-sm font-bold text-gray-500 mr-2">المنفذ</label>
                      <input 
                        type="number"
                        required
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        value={deviceForm.port || 0}
                        onChange={(e) => setDeviceForm({ ...deviceForm, port: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-2x border border-blue-100">
                   <p className="text-[10px] text-blue-700 font-bold leading-relaxed">
                      * ملاحظة: يجب أن يفتخر الجهاز ببروتوكول ZKTeco/TCP وأن يكون المنفذ مفتوحاً في شبكتك المحلية. 
                      التطبيق سيحاول الاتصال بهذا العنوان لاستيراد السجلات.
                   </p>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-200">
                    حفظ الجهاز
                  </button>
                  <button type="button" onClick={() => setIsDeviceModalOpen(false)} className="flex-1 py-4 bg-gray-100 text-gray-600 font-black rounded-2xl">
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Absence Type Modal */}
      <AnimatePresence>
        {isAbsenceTypeModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAbsenceTypeModalOpen(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                   <Filter className="w-6 h-6 text-blue-600" />
                   إعداد نوع غياب
                </h3>
              </div>
              <form onSubmit={handleAddAbsenceType} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">اسم النوع</label>
                    <input 
                      required
                      placeholder="مثال: غياب بعذر، غياب بدون عذر"
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={absenceTypeForm.name}
                      onChange={(e) => setAbsenceTypeForm({ ...absenceTypeForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">نسبة الخصم (من يوم واحد)</label>
                    <select
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={absenceTypeForm.deductionRatio}
                      onChange={(e) => setAbsenceTypeForm({ ...absenceTypeForm, deductionRatio: parseFloat(e.target.value) })}
                    >
                      <option value="1">يوم كامل (100%)</option>
                      <option value="0.5">نصف يوم (50%)</option>
                      <option value="0.25">ربع يوم (25%)</option>
                      <option value="0">بدون خصم (0%)</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-200">
                    حفظ النوع
                  </button>
                  <button type="button" onClick={() => setIsAbsenceTypeModalOpen(false)} className="flex-1 py-4 bg-gray-100 text-gray-600 font-black rounded-2xl">
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Leave Request Modal */}
      <AnimatePresence>
        {isLeaveRequestModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLeaveRequestModalOpen(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                   <Plane className="w-6 h-6 text-blue-600" />
                   تقديم طلب إجازة / تصريح
                </h3>
              </div>
              <form onSubmit={handleAddLeaveRequest} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">الموظف</label>
                    <select
                      required
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={leaveRequestForm.employeeId}
                      onChange={(e) => setLeaveRequestForm({ ...leaveRequestForm, employeeId: e.target.value })}
                    >
                      <option value="">اختر الموظف...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                       <label className="text-sm font-bold text-gray-500 mr-2">من تاريخ</label>
                       <input 
                         type="date"
                         required
                         className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                         value={leaveRequestForm.startDate}
                         onChange={(e) => setLeaveRequestForm({ ...leaveRequestForm, startDate: e.target.value })}
                       />
                     </div>
                     <div className="space-y-2">
                       <label className="text-sm font-bold text-gray-500 mr-2">إلى تاريخ</label>
                       <input 
                         type="date"
                         required
                         className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                         value={leaveRequestForm.endDate}
                         onChange={(e) => setLeaveRequestForm({ ...leaveRequestForm, endDate: e.target.value })}
                       />
                     </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">نوع الإجازة / التصريح</label>
                    <select
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={leaveRequestForm.type}
                      onChange={(e) => setLeaveRequestForm({ ...leaveRequestForm, type: e.target.value })}
                    >
                      <option value="Vacation">إجازة اعتيادية</option>
                      <option value="Sick">إجازة مرضية</option>
                      <option value="Unpaid">إجازة بدون مرتب</option>
                      <option value="Permission">تصريح مغادرة / تأخير</option>
                      <option value="Other">أخرى</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">السبب / الملاحظات</label>
                    <textarea 
                      required
                      placeholder="اذكر سبب الإجازة أو تفاصيل التصريح..."
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                      value={leaveRequestForm.reason}
                      onChange={(e) => setLeaveRequestForm({ ...leaveRequestForm, reason: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-200">
                    تقديم الطلب
                  </button>
                  <button type="button" onClick={() => setIsLeaveRequestModalOpen(false)} className="flex-1 py-4 bg-gray-100 text-gray-600 font-black rounded-2xl">
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
