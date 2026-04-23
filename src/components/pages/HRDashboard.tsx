import React, { useMemo } from 'react';
import { Users, FileText, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { cn } from '../../lib/utils';

export const HRDashboard: React.FC = () => {
  const { employees, missions } = useData();

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.status === 'Active').length;
  const activeMissions = missions.filter(m => m.status === 'Approved').length;
  const todayMissions = missions.filter(m => {
    const today = new Date().toISOString().split('T')[0];
    return m.startDate <= today && m.endDate >= today && m.status === 'Approved';
  }).length;

  const stats = useMemo(() => [
    { label: 'إجمالي الموظفين', value: totalEmployees, icon: Users, color: 'blue' },
    { label: 'الموظفين النشطين', value: activeEmployees, icon: ShieldCheck, color: 'emerald' },
    { label: 'المأموريات الكلية', value: activeMissions, icon: FileText, color: 'indigo' },
    { label: 'مأموريات اليوم', value: todayMissions, icon: CheckCircle2, color: 'orange' },
  ], [totalEmployees, activeEmployees, activeMissions, todayMissions]);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-4 bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
        <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
          <Users className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-gray-900">لوحة تحكم الموارد البشرية</h1>
          <p className="text-gray-500 font-medium">نظرة عامة على الموظفين والإجازات</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center",
                stat.color === 'blue' ? "bg-blue-50 text-blue-600" :
                stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                stat.color === 'indigo' ? "bg-indigo-50 text-indigo-600" :
                "bg-orange-50 text-orange-600"
              )}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
            <p className="text-sm font-bold text-gray-500 mb-1">{stat.label}</p>
            <h3 className="text-2xl font-black text-gray-900">{stat.value}</h3>
          </div>
        ))}
      </div>
      
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
        <h3 className="text-xl font-black text-gray-900 mb-6">المأموريات النشطة اليوم</h3>
        {todayMissions > 0 ? (
          <div className="space-y-4">
            {missions.filter(m => {
              const today = new Date().toISOString().split('T')[0];
              return m.startDate <= today && m.endDate >= today && m.status === 'Approved';
            }).map((m) => {
              const emp = employees.find(e => e.id === m.employeeId);
              return (
                <div key={m.id} className="flex items-center gap-4 p-4 border border-gray-100 rounded-2xl bg-gray-50">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold">
                    {emp?.name?.[0] || 'U'}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{emp?.name || 'غير معروف'}</h4>
                    <p className="text-sm text-gray-500">إلى {m.endDate}</p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">لا توجد مأموريات نشطة اليوم</p>
        )}
      </div>
    </div>
  );
};
