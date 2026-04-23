import React, { useMemo } from 'react';
import { Briefcase, ListTodo, CheckCircle2, Clock } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { cn } from '../../lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

export const OperationsDashboard: React.FC = () => {
  const { projects, projectTasks } = useData();

  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status === 'Active').length;
  
  const totalTasks = projectTasks.length;
  const completedTasks = projectTasks.filter(t => t.status === 'Executed' || t.status === 'Approved').length;

  const stats = useMemo(() => [
    { label: 'إجمالي المشاريع', value: totalProjects, icon: Briefcase, color: 'blue' },
    { label: 'المشاريع النشطة', value: activeProjects, icon: Clock, color: 'indigo' },
    { label: 'إجمالي المهام', value: totalTasks, icon: ListTodo, color: 'orange' },
    { label: 'المهام المنجزة', value: completedTasks, icon: CheckCircle2, color: 'green' },
  ], [totalProjects, activeProjects, totalTasks, completedTasks]);

  const taskStatusData = useMemo(() => {
    const statuses = ['Pending', 'In Progress', 'Under Review', 'Approved', 'Executed', 'Rejected'];
    return statuses.map(status => ({
      name: status === 'Pending' ? 'قيد الانتظار' :
            status === 'In Progress' ? 'قيد التنفيذ' :
            status === 'Under Review' ? 'قيد المراجعة' :
            status === 'Approved' ? 'مقبولة' :
            status === 'Executed' ? 'منفذة' : 'مرفوضة',
      count: projectTasks.filter(t => t.status === status).length
    }));
  }, [projectTasks]);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-4 bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
          <Briefcase className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-gray-900">لوحة تحكم التشغيل</h1>
          <p className="text-gray-500 font-medium">نظرة عامة على المشاريع والمهام</p>
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
                stat.color === 'green' ? "bg-emerald-50 text-emerald-600" :
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

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 h-[400px]">
        <h3 className="text-xl font-black text-gray-900 mb-6">حالة المهام</h3>
        <ResponsiveContainer width="100%" height="80%">
          <BarChart data={taskStatusData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} />
            <Tooltip 
              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            />
            <Bar dataKey="count" fill="#4f46e5" radius={[8, 8, 0, 0]} barSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
