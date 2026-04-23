import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Shield, 
  UserCheck, 
  UserX, 
  Trash2, 
  Mail,
  ShieldAlert,
  Edit,
  Settings,
  X as CloseIcon
} from 'lucide-react';
import { db, collection, setDoc, doc, deleteDoc, OperationType, handleFirestoreError } from '../../firebase';
import { useData } from '../../contexts/DataContext';
import { AppUser, UserRole, PermissionConfig, ScreenActionConfig } from '../../types';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const AVAILABLE_SCREENS = [
  { id: 'dashboard_ops', name: 'لوحة تحكم التشغيل' },
  { id: 'my-tasks', name: 'مهامي الشخصية' },
  { id: 'operations', name: 'إدارة العمليات' },
  { id: 'dashboard_hr', name: 'لوحة تحكم الموارد البشرية' },
  { id: 'adminStructure', name: 'الهيكل الإداري' },
  { id: 'employees', name: 'الموظفين' },
  { id: 'orgChart', name: 'الهيكل التنظيمي' },
  { id: 'attendance', name: 'الحضور والانصراف' },
  { id: 'missions', name: 'المهام والإجازات' },
  { id: 'dashboard_payroll', name: 'لوحة تحكم الرواتب' },
  { id: 'allowanceTypes', name: 'أنواع البدلات' },
  { id: 'transactions', name: 'الحركات الشهرية' },
  { id: 'payroll', name: 'مسيرات الرواتب' },
  { id: 'settlements', name: 'تصفية البيانات والتسويات' },
  { id: 'users', name: 'إدارة المستخدمين' }
];

export const UsersManagement: React.FC = () => {
  const { appUsers: users, adminDepartments } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, show: boolean }>({ id: '', show: false });
  const [showAdvancedPerms, setShowAdvancedPerms] = useState(false);

  const [formData, setFormData] = useState<Omit<AppUser, 'id' | 'createdAt'>>({
    email: '',
    name: '',
    role: 'Viewer',
    status: 'Active',
    permissions: {
      screens: {},
      departments: []
    }
  });

  const openAddModal = () => {
    setEditingUserId(null);
    setFormData({
      email: '', name: '', role: 'Viewer', status: 'Active', permissions: { screens: {}, departments: [] }
    });
    setShowAdvancedPerms(false);
    setIsModalOpen(true);
  };

  const openEditModal = (u: AppUser) => {
    setEditingUserId(u.id);
    setFormData({
      email: u.email,
      name: u.name,
      role: u.role,
      status: u.status,
      permissions: u.permissions || { screens: {}, departments: [] }
    });
    setShowAdvancedPerms(false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email.trim()) return;

    const id = editingUserId || formData.email.toLowerCase();
    
    await setDoc(doc(db, 'users', id), {
      ...formData,
      email: formData.email.toLowerCase(),
      createdAt: editingUserId ? (users.find(u => u.id === id)?.createdAt || new Date().toISOString()) : new Date().toISOString()
    });

    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'users', id));
    setDeleteConfirm({ id: '', show: false });
  };

  const toggleScreenPerm = (screenId: string, perm: keyof ScreenActionConfig) => {
    setFormData(prev => {
      const screens = { ...prev.permissions?.screens };
      if (!screens[screenId]) screens[screenId] = { view: false, create: false, edit: false, delete: false, export: false };
      screens[screenId] = { ...screens[screenId], [perm]: !screens[screenId][perm] };
      return { ...prev, permissions: { ...prev.permissions, screens } };
    });
  };

  const toggleDepartment = (deptId: string) => {
    setFormData(prev => {
      const perms = prev.permissions || { departments: [] };
      const selected = perms.departments || [];
      const newSelected = selected.includes(deptId) 
        ? selected.filter(id => id !== deptId)
        : [...selected, deptId];
      return { ...prev, permissions: { ...perms, departments: newSelected } };
    });
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      ((u.name || '').toLowerCase()).includes((searchTerm || '').toLowerCase()) ||
      ((u.email || '').toLowerCase()).includes((searchTerm || '').toLowerCase())
    );
  }, [users, searchTerm]);

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'Admin': return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'HR': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'Finance': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="البحث عن مستخدم بالاسم أو البريد..."
            className="w-full pr-12 pl-4 py-3 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={openAddModal}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-200"
        >
          <Plus className="w-5 h-5" />
          <span>إضافة مستخدم جديد</span>
        </button>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map((u) => (
          <motion.div 
            layout
            key={u.id}
            className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group relative"
          >
            <div className="flex justify-between items-start mb-6">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl",
                    u.role === 'Admin' ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"
                  )}>
                    {(u.name || 'U')[0].toUpperCase()}
                  </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => openEditModal(u)}
                  className="p-2 text-blue-400 hover:bg-blue-50 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                  title="تعديل المستخدم"
                >
                  <Edit className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setDeleteConfirm({ id: u.id, show: true })}
                  className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black text-gray-900">{u.name}</h3>
                <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
                  <Mail className="w-3 h-3" />
                  {u.email}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-black border",
                  getRoleBadgeColor(u.role)
                )}>
                  {u.role === 'Admin' ? 'مدير نظام' : u.role === 'HR' ? 'موارد بشرية' : u.role === 'Finance' ? 'مالية' : 'مشاهد'}
                </span>
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-black border",
                  u.status === 'Active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                )}>
                  {u.status === 'Active' ? 'نشط' : 'معطل'}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Add/Edit User Modal */}
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
              className={cn("relative bg-white w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]", showAdvancedPerms ? "max-w-4xl rounded-2xl" : "max-w-md rounded-[2.5rem]")}
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
                <h3 className="text-xl font-black text-gray-900">{editingUserId ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-colors">
                  <CloseIcon className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="flex flex-col md:flex-row flex-1 overflow-hidden">
                <div className="p-6 space-y-6 w-full md:w-96 shrink-0 overflow-y-auto border-l border-gray-100 bg-white">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-500 mr-2">الاسم الكامل</label>
                      <input 
                        required
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-800"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-500 mr-2">البريد الإلكتروني</label>
                      <input 
                        type="email"
                        required
                        readOnly={!!editingUserId} // Don't allow email change for existing
                        className={cn("w-full px-5 py-3 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-800", editingUserId ? "bg-gray-100 text-gray-500" : "bg-gray-50")}
                        value={formData.email || ''}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-500 mr-2">مجموعة الصلاحيات العامة (الرتبة)</label>
                      <select 
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-800"
                        value={formData.role}
                        onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})}
                      >
                        <option value="Viewer">مشاهد</option>
                        <option value="HR">موارد بشرية</option>
                        <option value="Finance">مالية</option>
                        <option value="Admin">مدير نظام</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-500 mr-2">حالة الحساب</label>
                      <select 
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-800"
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                      >
                        <option value="Active">نشط</option>
                        <option value="Inactive">معطل</option>
                      </select>
                    </div>
                  </div>

                  {!showAdvancedPerms && (
                    <button 
                      type="button"
                      onClick={() => setShowAdvancedPerms(true)}
                      className="w-full mt-6 py-3 border-2 border-dashed border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-2xl font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      خيارات الصلاحيات المتقدمة
                    </button>
                  )}

                  <div className="pt-6 mt-6 border-t border-gray-100">
                    <button 
                      type="submit"
                      className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-200"
                    >
                      {editingUserId ? 'حفظ التعديلات' : 'إضافة المستخدم'}
                    </button>
                  </div>
                </div>

                {/* Advanced Permissions Panel */}
                {showAdvancedPerms && (
                  <div className="flex-1 bg-gray-50 p-6 overflow-y-auto min-w-[500px]">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-xl font-black text-gray-800 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-blue-600" />
                        الصلاحيات المخصصة
                      </h4>
                    </div>

                    {/* Department Level Permissions */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
                      <h5 className="font-bold text-gray-800 mb-4 text-sm">أذونات الإدارات (Departments Access)</h5>
                      <p className="text-xs text-gray-500 mb-4">في حال عدم تحديد أي إدارة، يعتبر المستخدم مفوضاً لرؤية كافة الإدارات.</p>
                      <div className="flex flex-wrap gap-2">
                        {adminDepartments.map(dept => {
                          const isSelected = formData.permissions?.departments?.includes(dept.id);
                          return (
                            <button
                              key={dept.id}
                              type="button"
                              onClick={() => toggleDepartment(dept.id)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                                isSelected ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-gray-200 text-gray-500 hover:border-blue-300"
                              )}
                            >
                              {dept.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Screen Actions Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      <table className="w-full text-right text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 font-bold text-gray-600 border-b border-gray-100">الشاشة</th>
                            <th className="px-2 py-3 font-bold text-gray-500 border-b border-gray-100 text-center">عرض</th>
                            <th className="px-2 py-3 font-bold text-gray-500 border-b border-gray-100 text-center">إضافة</th>
                            <th className="px-2 py-3 font-bold text-gray-500 border-b border-gray-100 text-center">تعديل</th>
                            <th className="px-2 py-3 font-bold text-gray-500 border-b border-gray-100 text-center">حذف</th>
                            <th className="px-2 py-3 font-bold text-gray-500 border-b border-gray-100 text-center">تصدير</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {AVAILABLE_SCREENS.map(screen => {
                            const config = formData.permissions?.screens?.[screen.id] || { view: false, create: false, edit: false, delete: false, export: false };
                            return (
                              <tr key={screen.id} className="hover:bg-gray-50/50">
                                <td className="px-4 py-3 font-bold text-gray-800">{screen.name}</td>
                                {(Object.keys(config) as Array<keyof ScreenActionConfig>).map(action => (
                                  <td key={action} className="px-2 py-3 text-center">
                                    <input 
                                      type="checkbox"
                                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                      checked={config[action]}
                                      onChange={() => toggleScreenPerm(screen.id, action)}
                                    />
                                  </td>
                                ))}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal... */}
      <AnimatePresence>
        {deleteConfirm.show && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm({ id: '', show: false })}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center"
            >
              <div className="w-20 h-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <ShieldAlert className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">سحب الصلاحيات</h3>
              <p className="text-gray-500 font-medium mb-8">
                هل أنت متأكد من حذف هذا المستخدم؟ سيفقد القدرة على الوصول للنظام فوراً.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => handleDelete(deleteConfirm.id)}
                  className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-red-200"
                >
                  نعم، احذف
                </button>
                <button 
                  onClick={() => setDeleteConfirm({ id: '', show: false })}
                  className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-black rounded-2xl transition-all"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
