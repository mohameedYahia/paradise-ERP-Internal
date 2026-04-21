import React, { useState, useMemo } from 'react';
import { 
  Plane, 
  Settings, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Calendar,
  Search,
  Filter,
  DollarSign,
  Briefcase
} from 'lucide-react';
import { db, collection, setDoc, doc, deleteDoc } from '../../firebase';
import { useData } from '../../contexts/DataContext';
import { Mission, MissionType, Employee } from '../../types';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatCurrency } from '../../lib/utils';

export const Missions: React.FC = () => {
  const { employees, missions, missionTypes, projects } = useData();
  const [activeTab, setActiveTab] = useState<'missions' | 'types'>('missions');
  const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Mission Form State
  const [missionForm, setMissionForm] = useState<Omit<Mission, 'id'>>({
    employeeId: '',
    projectId: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    missionTypeId: '',
    status: 'Pending',
    notes: '',
    allowances: []
  });

  // Type Form State
  const [typeForm, setTypeForm] = useState<Omit<MissionType, 'id'>>({
    name: '',
    allowances: []
  });

  const handleAddMission = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = crypto.randomUUID();
    await setDoc(doc(db, 'missions', id), { ...missionForm, id });
    setIsMissionModalOpen(false);
    setMissionForm({
      employeeId: '',
      projectId: '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      missionTypeId: '',
      status: 'Pending',
      notes: '',
      allowances: []
    });
  };

  const handleUpdateStatus = async (id: string, status: Mission['status']) => {
    await setDoc(doc(db, 'missions', id), { status }, { merge: true });
  };

  const handleDeleteMission = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذه المأمورية؟')) {
      try {
        await deleteDoc(doc(db, 'missions', id));
      } catch (error: any) {
        alert('لا توجد صلاحية لحذف المأمورية: ' + error.message);
      }
    }
  };

  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = crypto.randomUUID();
    await setDoc(doc(db, 'missionTypes', id), { ...typeForm, id });
    setIsTypeModalOpen(false);
    setTypeForm({ name: '', allowances: [] });
  };

  const handleDeleteType = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا النوع؟')) {
      try {
        await deleteDoc(doc(db, 'missionTypes', id));
      } catch (error: any) {
        alert('لا توجد صلاحية لحذف النوع: ' + error.message);
      }
    }
  };

  const filteredMissions = useMemo(() => {
    return missions
      .filter(m => {
        const emp = employees.find(e => e.id === m.employeeId);
        const type = missionTypes.find(t => t.id === m.missionTypeId);
        const searchLower = searchTerm.toLowerCase();
        return (
          emp?.name.toLowerCase().includes(searchLower) ||
          emp?.employeeId.toLowerCase().includes(searchLower) ||
          type?.name.toLowerCase().includes(searchLower) ||
          (m.notes || '').toLowerCase().includes(searchLower)
        );
      })
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [missions, employees, missionTypes, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-50 rounded-[2rem] flex items-center justify-center text-blue-600">
            <Plane className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900">إدارة المأموريات (Business Trips)</h2>
            <p className="text-gray-400 font-bold">تسجيل ومتابعة المأموريات الخارجية والداخلية والبدلات</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsMissionModalOpen(true)}
            className="px-8 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            إضافة مأمورية
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100/50 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('missions')}
          className={cn(
            "px-8 py-3 rounded-xl text-sm font-black transition-all",
            activeTab === 'missions' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          سجلات المأموريات
        </button>
        <button 
          onClick={() => setActiveTab('types')}
          className={cn(
            "px-8 py-3 rounded-xl text-sm font-black transition-all",
            activeTab === 'types' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          أنواع وتكاليف المأموريات
        </button>
      </div>

      {activeTab === 'missions' && (
        <div className="space-y-4">
          <div className="flex gap-4">
             <div className="relative flex-1">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="بحث في المأموريات..."
                  className="w-full pr-12 pl-4 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-xs font-black text-gray-400 uppercase tracking-widest">
                  <th className="px-8 py-6">الموظف</th>
                  <th className="px-8 py-6">المشروع</th>
                  <th className="px-8 py-6">النوع</th>
                  <th className="px-8 py-6">الفترة</th>
                  <th className="px-8 py-6">الملاحظات</th>
                  <th className="px-8 py-6">الحالة</th>
                  <th className="px-8 py-6 text-left">العمليات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredMissions.map((m) => {
                  const emp = employees.find(e => e.id === m.employeeId);
                  const type = missionTypes.find(t => t.id === m.missionTypeId);
                  return (
                    <tr key={m.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center font-bold text-blue-600">
                             {emp?.name?.[0] || 'U'}
                          </div>
                          <div>
                             <p className="font-black text-gray-900">{emp?.name || 'موظف مجهول'}</p>
                             <p className="text-xs text-gray-400">#{emp?.employeeId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-sm font-bold text-blue-600">
                          {projects.find(p => p.id === m.projectId)?.name || '-'}
                        </p>
                      </td>
                      <td className="px-8 py-6 font-bold text-gray-600">
                         <div>
                            <p>{type?.name || 'غير محدد'}</p>
                            <p className="text-[10px] text-gray-400">
                               {m.allowances?.map(a => `${a.name} (${formatCurrency(a.amount)}${a.type === 'Daily' ? '/يوم' : ''})`).join(' + ') || '-'}
                            </p>
                         </div>
                      </td>
                      <td className="px-8 py-6">
                         <div className="flex items-center gap-2 text-sm font-bold text-gray-500">
                            <Calendar className="w-4 h-4 text-blue-400" />
                            {m.startDate} - {m.endDate}
                         </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-sm text-gray-500 font-medium max-w-[200px] truncate" title={m.notes}>
                          {m.notes || '-'}
                        </p>
                      </td>
                      <td className="px-8 py-6">
                         <span className={cn(
                           "px-3 py-1 rounded-lg text-xs font-black",
                           m.status === 'Approved' ? "bg-emerald-50 text-emerald-600" :
                           m.status === 'Rejected' ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"
                         )}>
                           {m.status === 'Approved' ? 'معتمدة' : m.status === 'Rejected' ? 'مرفوضة' : 'قيد الانتظار'}
                         </span>
                      </td>
                      <td className="px-8 py-6">
                         <div className="flex items-center justify-end gap-2">
                            {m.status === 'Pending' && (
                              <>
                                <button 
                                  onClick={() => handleUpdateStatus(m.id, 'Approved')}
                                  className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                                  title="اعتماد"
                                >
                                  <CheckCircle2 className="w-5 h-5" />
                                </button>
                                <button 
                                  onClick={() => handleUpdateStatus(m.id, 'Rejected')}
                                  className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                                  title="رفض"
                                >
                                  <XCircle className="w-5 h-5" />
                                </button>
                              </>
                            )}
                            <button 
                              onClick={() => handleDeleteMission(m.id)}
                              className="p-2 bg-gray-50 text-gray-400 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                         </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'types' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           <AnimatePresence>
            {missionTypes.map((type) => (
              <motion.div 
                layout
                key={type.id}
                className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative group"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                     <DollarSign className="w-7 h-7" />
                  </div>
                  <button 
                    onClick={() => handleDeleteType(type.id)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-2">{type.name}</h3>
                <div className="p-4 bg-gray-50 rounded-2xl space-y-2">
                   <p className="text-xs font-bold text-gray-400 mb-1 uppercase tracking-widest">البدلات المعرفة</p>
                   {type.allowances?.length > 0 ? (
                      <div className="space-y-1">
                        {type.allowances.map((a, i) => (
                          <div key={i} className="flex justify-between items-center text-sm">
                            <span className="text-gray-600 font-medium">{a.name}</span>
                            <span className="text-emerald-600 font-black">{formatCurrency(a.amount)}{a.type === 'Daily' ? '/يوم' : ''}</span>
                          </div>
                        ))}
                      </div>
                   ) : (
                      <p className="text-sm text-gray-400 italic">لا توجد بدلات معرفة</p>
                   )}
                </div>
              </motion.div>
            ))}
            <button 
              onClick={() => setIsTypeModalOpen(true)}
              className="border-2 border-dashed border-gray-200 rounded-[2.5rem] flex flex-col items-center justify-center py-12 gap-4 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all group p-8"
            >
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                 <Plus className="w-8 h-8" />
              </div>
              <p className="font-black">إضافة نوع مأمورية جديد</p>
            </button>
           </AnimatePresence>
        </div>
      )}

      {/* Mission Modal */}
      <AnimatePresence>
        {isMissionModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMissionModalOpen(false)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-2xl font-black text-gray-900">تسجيل مأمورية جديدة</h3>
              </div>
              <form onSubmit={handleAddMission} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">الموظف</label>
                    <select
                      required
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={missionForm.employeeId}
                      onChange={(e) => setMissionForm({ ...missionForm, employeeId: e.target.value })}
                    >
                      <option value="">اختر الموظف...</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.employeeId})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">المشروع المرتبط</label>
                    <select
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={missionForm.projectId}
                      onChange={(e) => setMissionForm({ ...missionForm, projectId: e.target.value })}
                    >
                      <option value="">غير مرتبط بمشروع...</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">نوع المأمورية</label>
                    <select
                      required
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={missionForm.missionTypeId}
                      onChange={(e) => {
                        const selectedType = missionTypes.find(t => t.id === e.target.value);
                        setMissionForm({ 
                          ...missionForm, 
                          missionTypeId: e.target.value,
                          allowances: selectedType?.allowances.map(a => ({ ...a })) || []
                        });
                      }}
                    >
                      <option value="">اختر النوع...</option>
                      {missionTypes.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} (
                            {t.allowances.map(a => `${a.name}: ${a.amount}`).join(' + ') || 'بدون بدلات'}
                          )
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Dynamic Mission Allowances */}
                  {missionForm.missionTypeId && (
                    <div className="space-y-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-black text-blue-900 leading-none">تفاصيل بدلات هذه المأمورية</label>
                        <button 
                          type="button"
                          onClick={() => setMissionForm({
                            ...missionForm,
                            allowances: [...missionForm.allowances, { id: crypto.randomUUID(), name: '', amount: 0, type: 'Daily' }]
                          })}
                          className="text-xs font-black text-blue-600 flex items-center gap-1 hover:text-blue-800 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          إضافة بدل مخصص
                        </button>
                      </div>
                      <div className="space-y-3">
                        {missionForm.allowances.map((allowance, idx) => (
                          <div key={allowance.id} className="grid grid-cols-12 gap-2 items-end bg-white p-2 rounded-xl shadow-sm border border-blue-100">
                            <div className="col-span-4">
                              <label className="text-[10px] font-bold text-gray-400 block mb-1">الاسم</label>
                              <input 
                                required
                                className="w-full px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                                value={allowance.name}
                                onChange={(e) => {
                                  const newAllowances = [...missionForm.allowances];
                                  newAllowances[idx].name = e.target.value;
                                  setMissionForm({ ...missionForm, allowances: newAllowances });
                                }}
                              />
                            </div>
                            <div className="col-span-3">
                              <label className="text-[10px] font-bold text-gray-400 block mb-1">المبلغ</label>
                              <input 
                                type="number"
                                required
                                className="w-full px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                                value={allowance.amount || 0}
                                onChange={(e) => {
                                  const newAllowances = [...missionForm.allowances];
                                  newAllowances[idx].amount = parseFloat(e.target.value) || 0;
                                  setMissionForm({ ...missionForm, allowances: newAllowances });
                                }}
                              />
                            </div>
                            <div className="col-span-3">
                              <label className="text-[10px] font-bold text-gray-400 block mb-1">التكرار</label>
                              <select 
                                className="w-full px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                                value={allowance.type}
                                onChange={(e) => {
                                  const newAllowances = [...missionForm.allowances];
                                  newAllowances[idx].type = e.target.value as any;
                                  setMissionForm({ ...missionForm, allowances: newAllowances });
                                }}
                              >
                                <option value="Daily">يومي</option>
                                <option value="Once">مرة واحدة</option>
                              </select>
                            </div>
                            <div className="col-span-2 flex justify-end">
                              <button 
                                type="button"
                                onClick={() => {
                                  const newAllowances = missionForm.allowances.filter((_, i) => i !== idx);
                                  setMissionForm({ ...missionForm, allowances: newAllowances });
                                }}
                                className="p-2 text-red-400 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-500 mr-2">من تاريخ</label>
                      <input 
                        type="date"
                        required
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                        value={missionForm.startDate}
                        onChange={(e) => setMissionForm({ ...missionForm, startDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-500 mr-2">إلى تاريخ</label>
                      <input 
                        type="date"
                        required
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                        value={missionForm.endDate}
                        onChange={(e) => setMissionForm({ ...missionForm, endDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">ملاحظات</label>
                    <textarea 
                      placeholder="وصف المأمورية أو الموقع..."
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24"
                      value={missionForm.notes}
                      onChange={(e) => setMissionForm({ ...missionForm, notes: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-200">
                    حفظ المأمورية
                  </button>
                  <button type="button" onClick={() => setIsMissionModalOpen(false)} className="flex-1 py-4 bg-gray-100 text-gray-600 font-black rounded-2xl">
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Type Modal */}
      <AnimatePresence>
        {isTypeModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsTypeModalOpen(false)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-2xl font-black text-gray-900">إضافة نوع مأمورية</h3>
              </div>
              <form onSubmit={handleAddType} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">اسم النوع</label>
                    <input 
                      required
                      placeholder="مثال: مأمورية خارجية، مأمورية داخلية"
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={typeForm.name}
                      onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                    />
                  </div>
                  
                  {/* Dynamic Allowance Definitions for Mission Type */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-bold text-gray-500 mr-2">البدلات الافتراضية</label>
                      <button 
                        type="button"
                        onClick={() => setTypeForm({
                          ...typeForm,
                          allowances: [...typeForm.allowances, { id: crypto.randomUUID(), name: '', amount: 0, type: 'Daily' }]
                        })}
                        className="text-xs font-black text-blue-600 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        إضافة بدل
                      </button>
                    </div>
                    <div className="space-y-2">
                       {typeForm.allowances.map((allowance, idx) => (
                         <div key={allowance.id} className="flex gap-2 items-center bg-gray-50 p-3 rounded-2xl border border-gray-100">
                           <input 
                             placeholder="الاسم"
                             className="flex-1 px-3 py-2 bg-white border border-gray-100 rounded-xl text-sm outline-none"
                             value={allowance.name}
                             onChange={(e) => {
                               const newAllowances = [...typeForm.allowances];
                               newAllowances[idx].name = e.target.value;
                               setTypeForm({ ...typeForm, allowances: newAllowances });
                             }}
                           />
                           <input 
                             type="number"
                             placeholder="المبلغ"
                             className="w-24 px-3 py-2 bg-white border border-gray-100 rounded-xl text-sm outline-none"
                             value={allowance.amount || 0}
                             onChange={(e) => {
                               const newAllowances = [...typeForm.allowances];
                               newAllowances[idx].amount = parseFloat(e.target.value) || 0;
                               setTypeForm({ ...typeForm, allowances: newAllowances });
                             }}
                           />
                           <select 
                             className="w-24 px-3 py-2 bg-white border border-gray-100 rounded-xl text-sm outline-none"
                             value={allowance.type}
                             onChange={(e) => {
                               const newAllowances = [...typeForm.allowances];
                               newAllowances[idx].type = e.target.value as any;
                               setTypeForm({ ...typeForm, allowances: newAllowances });
                             }}
                           >
                             <option value="Daily">يومي</option>
                             <option value="Once">مرة واحدة</option>
                           </select>
                           <button 
                             type="button"
                             onClick={() => {
                               const newAllowances = typeForm.allowances.filter((_, i) => i !== idx);
                               setTypeForm({ ...typeForm, allowances: newAllowances });
                             }}
                             className="text-red-400 hover:text-red-600"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </div>
                       ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-200">
                    حفظ النوع
                  </button>
                  <button type="button" onClick={() => setIsTypeModalOpen(false)} className="flex-1 py-4 bg-gray-100 text-gray-600 font-black rounded-2xl">
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
