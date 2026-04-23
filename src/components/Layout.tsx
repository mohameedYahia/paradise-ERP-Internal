import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  LayoutDashboard, 
  Receipt, 
  History, 
  LogOut, 
  ChevronRight, 
  Menu, 
  X,
  Settings,
  ShieldCheck,
  FileText,
  Fingerprint,
  Link,
  Briefcase,
  Network,
  CheckCircle2,
  ChevronDown,
  Wallet
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { auth, signOut } from '../firebase';
import { cn } from '../lib/utils';

// Pages
import { Dashboard } from './pages/Dashboard';
import { OperationsDashboard } from './pages/OperationsDashboard';
import { HRDashboard } from './pages/HRDashboard';
import { EmployeesList } from './pages/EmployeesList';
import { PayrollRuns } from './pages/PayrollRuns';
import { Transactions } from './pages/Transactions';
import { AllowanceTypes } from './pages/AllowanceTypes';
import { UsersManagement } from './pages/UsersManagement';
import { Settlements } from './pages/Settlements';
import { Attendance } from './pages/Attendance';
import { Missions } from './pages/Missions';
import { OrgChart } from './pages/OrgChart';
import { Operations } from './pages/Operations';
import { AdminStructure } from './pages/AdminStructure';
import { MyTasks } from './pages/MyTasks';

export const Layout: React.FC = () => {
  const { user, profile, isAdmin, isHR, isFinance } = useAuth();
  const [activeModule, setActiveModule] = useState<'operations' | 'hr' | 'payroll' | 'admin'>('operations');
  const [activeTab, setActiveTab] = useState('dashboard_ops');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isModuleDropdownOpen, setIsModuleDropdownOpen] = useState(false);

  const { canView, isSuperAdmin } = usePermissions();

  const modules = [
    { id: 'operations', label: 'إدارة التشغيل', icon: Briefcase, color: 'text-indigo-600', bg: 'bg-indigo-50', show: canView('dashboard_ops') || canView('my-tasks') || canView('operations') },
    { id: 'hr', label: 'الموارد البشرية', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50', show: canView('dashboard_hr') || canView('employees') || canView('attendance') || canView('missions') || canView('adminStructure') },
    { id: 'payroll', label: 'الرواتب', icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-50', show: canView('dashboard_payroll') || canView('payroll') || canView('transactions') || canView('allowanceTypes') || canView('settlements') },
  ];

  // We add Admin module if user is admin or has 'view' permissions to 'users'
  if (isSuperAdmin || canView('users')) {
    modules.push({ id: 'admin', label: 'إدارة النظام', icon: Settings, color: 'text-gray-600', bg: 'bg-gray-50', show: true });
  }

  // Filter out completely hidden modules
  const visibleModules = modules.filter(m => m.show);

  // Auto fallback to first available module if active is not visible
  useEffect(() => {
     if (visibleModules.length > 0 && !visibleModules.find(m => m.id === activeModule)) {
         setActiveModule(visibleModules[0].id as any);
     }
  }, [visibleModules, activeModule]);

  // Define tabs per module
  const moduleTabs = {
    operations: [
      { id: 'dashboard_ops', label: 'لوحة التحكم', icon: LayoutDashboard, show: canView('dashboard_ops') },
      { id: 'my-tasks', label: 'مهامي الشخصية', icon: CheckCircle2, show: canView('my-tasks') },
      { id: 'operations', label: 'إدارة العمليات', icon: Network, show: canView('operations') },
    ],
    hr: [
      { id: 'dashboard_hr', label: 'لوحة التحكم', icon: LayoutDashboard, show: canView('dashboard_hr') },
      { id: 'admin-structure', label: 'الهيكل الإداري', icon: Network, show: canView('adminStructure') },
      { id: 'employees', label: 'الموظفين', icon: Users, show: canView('employees') },
      { id: 'org-chart', label: 'الهيكل التنظيمي', icon: Link, show: canView('orgChart') },
      { id: 'attendance', label: 'الحضور والانصراف', icon: Fingerprint, show: canView('attendance') },
      { id: 'missions', label: 'المأموريات', icon: FileText, show: canView('missions') },
    ],
    payroll: [
      { id: 'dashboard_payroll', label: 'لوحة التحكم', icon: LayoutDashboard, show: canView('dashboard_payroll') },
      { id: 'allowance-types', label: 'أنواع البدلات', icon: Settings, show: canView('allowanceTypes') },
      { id: 'transactions', label: 'الحركات الشهرية', icon: History, show: canView('transactions') },
      { id: 'payroll', label: 'مسير الرواتب', icon: Receipt, show: canView('payroll') },
      { id: 'settlements', label: 'تصفية البيانات', icon: ShieldCheck, show: canView('settlements') },
    ],
    admin: [
      { id: 'users', label: 'المستخدمين والصلاحيات', icon: ShieldCheck, show: canView('users') },
    ]
  };

  const handleLogout = () => signOut(auth);

  const renderPage = () => {
    switch (activeTab) {
      // Operations
      case 'dashboard_ops': return <OperationsDashboard />;
      case 'my-tasks': return <MyTasks />;
      case 'operations': return <Operations />;
      // HR
      case 'dashboard_hr': return <HRDashboard />;
      case 'admin-structure': return <AdminStructure />;
      case 'employees': return <EmployeesList />;
      case 'org-chart': return <OrgChart />;
      case 'attendance': return <Attendance />;
      case 'missions': return <Missions />;
      // Payroll
      case 'dashboard_payroll': return <Dashboard />; // The current dashboard acts as Payroll dashboard
      case 'allowance-types': return <AllowanceTypes />;
      case 'transactions': return <Transactions />;
      case 'payroll': return <PayrollRuns />;
      case 'settlements': return <Settlements />;
      // Admin
      case 'users': return <UsersManagement />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex" dir="rtl">
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 right-0 z-50 bg-white border-l border-gray-100 transition-all duration-300 shadow-xl shadow-blue-900/5",
          isSidebarOpen ? "w-72" : "w-20"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-24 flex items-center px-6 border-b border-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 shrink-0">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              {isSidebarOpen && (
                <span className="text-2xl font-black text-gray-900 tracking-tight">Salarix</span>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-8 space-y-6 overflow-y-auto">
            {/* Module Switcher */}
            {isSidebarOpen ? (
              <div className="relative">
                <button
                  onClick={() => setIsModuleDropdownOpen(!isModuleDropdownOpen)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-2xl hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", visibleModules.find(m => m.id === activeModule)?.bg || 'bg-gray-100')}>
                      {visibleModules.find(m => m.id === activeModule)?.icon && React.createElement(visibleModules.find(m => m.id === activeModule)!.icon, { className: cn("w-5 h-5", visibleModules.find(m => m.id === activeModule)?.color) })}
                    </div>
                    <span className="font-black text-gray-900 text-sm">
                      {visibleModules.find(m => m.id === activeModule)?.label || 'اختر النظام'}
                    </span>
                  </div>
                  <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", isModuleDropdownOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {isModuleDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden p-2 space-y-1"
                    >
                      {visibleModules.map(mod => (
                        <button
                          key={mod.id}
                          onClick={() => {
                            setActiveModule(mod.id as any);
                            const visibleTabs = moduleTabs[mod.id as keyof typeof moduleTabs].filter(t => t.show);
                            if (visibleTabs.length > 0) setActiveTab(visibleTabs[0].id);
                            setIsModuleDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-right",
                            activeModule === mod.id ? mod.bg : "hover:bg-gray-50"
                          )}
                        >
                          <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", mod.bg)}>
                            <mod.icon className={cn("w-4 h-4", mod.color)} />
                          </div>
                          <span className={cn(
                            "font-bold text-sm",
                            activeModule === mod.id ? mod.color : "text-gray-600"
                          )}>{mod.label}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
               <div className="flex flex-col gap-2 relative">
                 {visibleModules.map(mod => (
                    <button
                      key={mod.id}
                      onClick={() => {
                        setActiveModule(mod.id as any);
                        const visibleTabs = moduleTabs[mod.id as keyof typeof moduleTabs].filter(t => t.show);
                        if (visibleTabs.length > 0) setActiveTab(visibleTabs[0].id);
                      }}
                      className={cn(
                        "w-12 h-12 mx-auto rounded-xl flex items-center justify-center shrink-0 transition-all",
                        activeModule === mod.id ? mod.bg : "hover:bg-gray-50"
                      )}
                      title={mod.label}
                    >
                      <mod.icon className={cn("w-6 h-6", activeModule === mod.id ? mod.color : "text-gray-400")} />
                    </button>
                 ))}
                 <div className="h-px bg-gray-100 w-8 mx-auto my-2" />
               </div>
            )}

            {/* Current Module Tabs */}
            <div className="space-y-2">
              {isSidebarOpen && (
                 <div className="px-4 text-xs font-black text-gray-400 uppercase tracking-widest mb-4">قوائم النظام</div>
              )}
              {moduleTabs[activeModule].filter(item => item.show).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 group relative",
                    activeTab === item.id 
                      ? "bg-blue-50 text-blue-600 font-bold" 
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  )}
                  title={!isSidebarOpen ? item.label : undefined}
                >
                  <item.icon className={cn(
                    "w-6 h-6 shrink-0 transition-transform duration-200",
                    activeTab === item.id ? "scale-110" : "group-hover:scale-110"
                  )} />
                  {isSidebarOpen && <span className="text-sm font-bold">{item.label}</span>}
                  {activeTab === item.id && isSidebarOpen && (
                    <motion.div 
                      layoutId="active-pill"
                      className="absolute left-2 w-1.5 h-6 bg-blue-600 rounded-full"
                    />
                  )}
                </button>
              ))}
            </div>
          </nav>

          {/* User Profile & Logout */}
          <div className="p-4 border-t border-gray-50">
            {isSidebarOpen && (
              <div className="mb-4 p-4 bg-gray-50 rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                  {user?.displayName?.[0] || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{user?.displayName}</p>
                  <p className="text-xs text-gray-500 font-medium">{profile?.role || 'User'}</p>
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className={cn(
                "w-full flex items-center gap-4 p-4 text-red-500 hover:bg-red-50 rounded-2xl transition-colors font-bold",
                !isSidebarOpen && "justify-center"
              )}
            >
              <LogOut className="w-6 h-6 shrink-0" />
              {isSidebarOpen && <span>تسجيل الخروج</span>}
            </button>
          </div>
        </div>

        {/* Toggle Button */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -left-4 top-10 w-8 h-8 bg-white border border-gray-100 rounded-full flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors z-[60]"
        >
          <ChevronRight className={cn("w-4 h-4 text-gray-400 transition-transform", isSidebarOpen ? "rotate-0" : "rotate-180")} />
        </button>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300 min-h-screen",
        isSidebarOpen ? "mr-72" : "mr-20"
      )}>
        <header className="h-24 bg-white/80 backdrop-blur-md sticky top-0 z-40 px-8 flex items-center justify-between border-b border-gray-100">
          <h2 className="text-2xl font-black text-gray-900">
            {moduleTabs[activeModule].find(i => i.id === activeTab)?.label}
          </h2>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-bold text-gray-900">{new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <span className="text-xs text-gray-400 font-medium">مرحباً بك في نظام Salarix</span>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};
