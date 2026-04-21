import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Network, 
  Plus, 
  Trash2, 
  Users, 
  ChevronRight, 
  Briefcase,
  Building2,
  MoreVertical,
  Edit2,
  UserPlus,
  X,
  Search,
  Check
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { db, collection, addDoc, deleteDoc, doc, updateDoc } from '../../firebase';
import { AdministrativeDepartment, Employee } from '../../types';
import { cn } from '../../lib/utils';

export const AdminStructure: React.FC = () => {
  const { adminDepartments, employees } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<AdministrativeDepartment | null>(null);
  const [activeDeptForEmployees, setActiveDeptForEmployees] = useState<AdministrativeDepartment | null>(null);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');

  const [formData, setFormData] = useState<Partial<AdministrativeDepartment>>({
    name: '',
    description: '',
    managerId: '',
    parentDeptId: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDept) {
        await updateDoc(doc(db, 'adminDepartments', editingDept.id), formData);
      } else {
        await addDoc(collection(db, 'adminDepartments'), formData);
      }
      setIsModalOpen(false);
      setEditingDept(null);
      setFormData({ name: '', description: '', managerId: '', parentDeptId: '' });
    } catch (error) {
      console.error('Error saving department:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا القسم؟')) return;
    try {
      await deleteDoc(doc(db, 'adminDepartments', id));
      // Also clear departmentId from employees in this dept
      const deptEmployees = employees.filter(e => e.departmentId === id);
      for (const emp of deptEmployees) {
        await updateDoc(doc(db, 'employees', emp.id), { departmentId: null });
      }
    } catch (error) {
      console.error('Error deleting department:', error);
    }
  };

  const handleToggleEmployee = async (employeeId: string, currentDeptId?: string) => {
    if (!activeDeptForEmployees) return;
    try {
      const isCurrentlyIn = currentDeptId === activeDeptForEmployees.id;
      await updateDoc(doc(db, 'employees', employeeId), {
        departmentId: isCurrentlyIn ? null : activeDeptForEmployees.id
      });
    } catch (error) {
      console.error('Error toggling employee department:', error);
    }
  };

  const openEditModal = (dept: AdministrativeDepartment) => {
    setEditingDept(dept);
    setFormData(dept);
    setIsModalOpen(true);
  };

  const openEmployeeModal = (dept: AdministrativeDepartment) => {
    setActiveDeptForEmployees(dept);
    setIsEmployeeModalOpen(true);
  };

  // Build a tree structure for display
  const buildTree = (parentId?: string) => {
    return adminDepartments
      .filter(d => (parentId ? d.parentDeptId === parentId : !d.parentDeptId))
      .map(dept => (
        <div key={dept.id} className="space-y-4">
          <div className="flex items-center gap-4 group">
            <div className={cn(
              "flex-1 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-blue-200 relative",
              parentId && "mr-12"
            )}>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-gray-900">{dept.name}</h4>
                    <p className="text-sm text-gray-400 font-medium">{dept.description || 'لا يوجد وصف'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => openEmployeeModal(dept)}
                    title="إدارة الموظفين"
                    className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                  >
                    <UserPlus className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => openEditModal(dept)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleDelete(dept.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-gray-600">
                    المدير: {employees.find(e => e.id === dept.managerId)?.name || 'غير محدد'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-black text-blue-500 bg-blue-50 px-3 py-1 rounded-full">
                  <Briefcase className="w-3 h-3" />
                  {employees.filter(e => e.departmentId === dept.id).length} موظف
                </div>
              </div>

              {parentId && (
                <div className="absolute right-[-24px] top-1/2 -translate-y-1/2 w-6 h-px bg-gray-200" />
              )}
            </div>
          </div>
          <div className="mr-8 border-r-2 border-dashed border-gray-100 pr-8">
            {buildTree(dept.id)}
          </div>
        </div>
      ));
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black text-gray-900 mb-2">الهيكل الإداري</h1>
          <p className="text-gray-500 font-medium text-lg">إدارة الأقسام والوحدات التنظيمية والمسؤولين عنها</p>
        </div>
        <button 
          onClick={() => {
            setEditingDept(null);
            setFormData({ name: '', description: '', managerId: '', parentDeptId: '' });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-3 bg-blue-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all hover:scale-105 active:scale-95"
        >
          <Plus className="w-6 h-6" />
          إضافة قسم جديد
        </button>
      </div>

      <div className="space-y-8 bg-gray-50/50 p-8 rounded-[3rem] border border-gray-100 min-h-[600px]">
        {adminDepartments.length > 0 ? (
          buildTree()
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-gray-400 gap-4">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
              <Network className="w-10 h-10" />
            </div>
            <p className="text-xl font-bold">لم يتم تعريف أقسام إدارية بعد</p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="text-blue-600 font-black hover:underline"
            >
              ابدأ بإضافة أول قسم
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsModalOpen(false)} 
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="relative bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h3 className="text-2xl font-black text-gray-900">
                  {editingDept ? 'تعديل بيانات القسم' : 'إضافة قسم جديد'}
                </h3>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-black text-gray-500 mr-2">اسم القسم</label>
                    <input 
                      required
                      placeholder="مثال: قسم تطوير البرمجيات"
                      className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black text-gray-500 mr-2">الوصف</label>
                    <textarea 
                      placeholder="وصف مختصر لمهام القسم..."
                      className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all h-24 resize-none"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-black text-gray-500 mr-2">المدير المسؤول</label>
                      <select 
                        required
                        className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all"
                        value={formData.managerId}
                        onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                      >
                        <option value="">اختر مديراً...</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-black text-gray-500 mr-2">القسم الأعلى (اختياري)</label>
                      <select 
                        className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all"
                        value={formData.parentDeptId}
                        onChange={(e) => setFormData({ ...formData, parentDeptId: e.target.value })}
                      >
                        <option value="">لا يوجد (قسم رئيسي)</option>
                        {adminDepartments.filter(d => d.id !== editingDept?.id).map(dept => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="submit" 
                    className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95"
                  >
                    {editingDept ? 'تحديث البيانات' : 'حفظ القسم'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="flex-1 py-4 bg-gray-100 text-gray-600 font-black rounded-2xl hover:bg-gray-200 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isEmployeeModalOpen && activeDeptForEmployees && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEmployeeModalOpen(false)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-black text-gray-900">إدارة موظفي القسم</h3>
                  <p className="text-sm font-bold text-blue-600">{activeDeptForEmployees.name}</p>
                </div>
                <button onClick={() => setIsEmployeeModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X/></button>
              </div>
              
              <div className="p-6 border-b border-gray-50">
                <div className="relative">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input 
                    type="text"
                    placeholder="البحث عن موظف بالاسم أو الرقم الوظيفي..."
                    className="w-full pr-12 pl-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    value={employeeSearchTerm}
                    onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {employees
                  .filter(e => 
                    e.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) || 
                    e.employeeId.includes(employeeSearchTerm)
                  )
                  .map(emp => {
                    const isInThisDept = emp.departmentId === activeDeptForEmployees.id;
                    const isInOtherDept = emp.departmentId && emp.departmentId !== activeDeptForEmployees.id;
                    
                    return (
                      <button
                        key={emp.id}
                        onClick={() => handleToggleEmployee(emp.id, emp.departmentId)}
                        className={cn(
                          "w-full flex items-center justify-between p-4 rounded-2xl border transition-all",
                          isInThisDept 
                            ? "bg-blue-50 border-blue-200" 
                            : "bg-white border-gray-100 hover:border-gray-200"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center font-bold",
                            isInThisDept ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400"
                          )}>
                            {isInThisDept ? <Check className="w-6 h-6" /> : emp.name[0]}
                          </div>
                          <div className="text-right">
                            <p className="font-black text-gray-900">{emp.name}</p>
                            <p className="text-xs text-gray-500 font-bold">
                              رقم وظيفي: {emp.employeeId} 
                              {isInOtherDept && ` | ${adminDepartments.find(d => d.id === emp.departmentId)?.name}`}
                            </p>
                          </div>
                        </div>
                        {isInThisDept && (
                          <div className="text-xs font-black text-blue-600 bg-white px-3 py-1 rounded-full border border-blue-100 shadow-sm">
                            مضاف للقسم
                          </div>
                        )}
                      </button>
                    );
                  })}
              </div>

              <div className="p-8 border-t border-gray-50">
                <button 
                  onClick={() => setIsEmployeeModalOpen(false)}
                  className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
                >
                  تم
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
