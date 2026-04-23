import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Calendar, 
  User,
  Layout,
  ArrowUpRight,
  ExternalLink,
  MessageCircle,
  Paperclip,
  Check,
  Plane,
  ListTodo,
  MessageSquare
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../AuthContext';
import { db, doc, updateDoc, arrayUnion, storage, ref, uploadBytes, getDownloadURL } from '../../firebase';
import { ProjectTask, TaskStatus, WorkflowLog, TaskChatMessage } from '../../types';
import { cn } from '../../lib/utils';

export const MyTasks: React.FC = () => {
  const { projectTasks, projects, employees } = useData();
  const { profile, user } = useAuth();

  const myTasks = useMemo(() => {
    if (!profile && !user) return [];
    
    // Attempt to find the employee record associated with the current user's email
    // This is vital because profile.id could be the email (if from 'users' collection)
    // while tasks are assigned using the employee document ID.
    const myEmployeeRecord = employees.find(e => e.email?.toLowerCase() === user?.email?.toLowerCase());
    const validIds = [profile?.id, myEmployeeRecord?.id].filter(Boolean);
    
    return projectTasks.filter(t => 
      validIds.includes(t.assignedToId) || 
      (t.assignedToIds && t.assignedToIds.some(id => validIds.includes(id)))
    );
  }, [projectTasks, profile, user, employees]);

  const stats = useMemo(() => ({
    total: myTasks.length,
    pending: myTasks.filter(t => t.status === 'Pending').length,
    inProgress: myTasks.filter(t => t.status === 'In Progress').length,
    completed: myTasks.filter(t => t.status === 'Approved' || t.status === 'Executed').length,
  }), [myTasks]);

  const handleStatusUpdate = async (taskId: string, newStatus: TaskStatus) => {
    if (!user || !profile) return;
    const task = projectTasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Check dependency: cannot close a task if it has open sub-tasks
    if (newStatus === 'Approved' || newStatus === 'Executed') {
      const childTasks = projectTasks.filter(t => t.parentTaskId === taskId);
      const hasOpenChildren = childTasks.some(child => child.status !== 'Approved' && child.status !== 'Executed' && child.status !== 'Rejected');
      if (hasOpenChildren) {
        alert('لا يمكن إغلاق هذه المهمة بسبب وجود مهام فرعية لم يتم استكمالها بعد.');
        return;
      }
    }

    const log: WorkflowLog = {
      fromStatus: task.status,
      toStatus: newStatus,
      userId: user.uid,
      userName: profile.name || user.displayName || 'User',
      timestamp: new Date().toISOString(),
      note: 'Updated from My Tasks'
    };

    try {
      await updateDoc(doc(db, 'projectTasks', taskId), {
        status: newStatus,
        workflowLog: arrayUnion(log),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const handleToggleSubTask = async (taskId: string, subTaskId: string) => {
    const task = projectTasks.find(t => t.id === taskId);
    if (!task || !task.subTasks) return;
    
    const updatedSubTasks = task.subTasks.map(st => 
      st.id === subTaskId ? { ...st, status: st.status === 'Completed' ? 'Pending' : 'Completed' } : st
    );

    try {
      await updateDoc(doc(db, 'projectTasks', taskId), {
        subTasks: updatedSubTasks,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating subtask:', error);
    }
  };

  const [uploadingFile, setUploadingFile] = React.useState(false);

  const handleFileUpload = async (taskId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !profile) return;
    
    // Limits checked on backend now, we can allow up to 1GB
    if (file.size > 1024 * 1024 * 1024) {
      alert("حجم الملف كبير جداً (أكبر من 1 جيجابايت). يرجى الترفيع مباشرة للدرايف واستخدام زر 'إضافة رابط'");
      e.target.value = '';
      return;
    }

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMsg = 'Failed to upload to Google Drive';
        try {
          const err = await response.json();
          errorMsg = err.error || errorMsg;
        } catch(e) {
          errorMsg = response.statusText || 'Server returned invalid format. File might be too large for the proxy limit.';
        }
        throw new Error(errorMsg);
      }

      let data;
      try {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch (jsonErr) {
          console.error("Failed to parse JSON on 200 OK. Original response text:", text.substring(0, 500));
          throw new Error("Server returned an invalid response format (not JSON). Check console for details.");
        }
      } catch (err: any) {
        throw new Error(err.message || "Server returned an invalid response. The connection might have been interrupted or the file is too large.");
      }

      const newAttachment = {
        name: file.name,
        url: data.url,
        uploadedBy: profile.name || user.displayName || 'User',
        timestamp: new Date().toISOString(),
        source: 'GoogleDrive',
      };
        
      await updateDoc(doc(db, 'projectTasks', taskId), {
        attachments: arrayUnion(newAttachment),
        updatedAt: new Date().toISOString()
      });
        
      setUploadingFile(false);
    } catch (error: any) {
      console.error('Upload Error:', error);
      alert('حدث خطأ أثناء الرفع: ' + error.message);
      setUploadingFile(false);
    } finally {
      e.target.value = '';
    }
  };

  const handleAddLinkAttachment = async (taskId: string) => {
    const url = prompt('أدخل رابط الملف الخارجي (مثال: Google Drive Link):');
    if (!url) return;
    const name = prompt('أدخل اسم الملف:') || 'مرفق خارجي';

    const newAttachment = {
      name,
      url,
      uploadedBy: profile?.name || user?.displayName || 'User',
      timestamp: new Date().toISOString(),
      source: 'ExternalLink',
    };

    try {
      await updateDoc(doc(db, 'projectTasks', taskId), {
        attachments: arrayUnion(newAttachment),
        updatedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Add Link Error:', error);
      alert('حدث خطأ أثناء إضافة الرابط: ' + error.message);
    }
  };

  const handleSendChatMessage = async (taskId: string, text: string) => {
    if (!text.trim() || !user || !profile) return;
    
    const mentions = text.match(/@(\w+)/g)?.map(m => m.slice(1)) || [];

    const newMessage: TaskChatMessage = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      userId: user.uid,
      userName: profile.name || user.displayName || 'User',
      text,
      mentions,
      createdAt: new Date().toISOString()
    };

    try {
      await updateDoc(doc(db, 'projectTasks', taskId), {
        comments: arrayUnion(newMessage),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <User className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-xl font-black">يُرجى تسجيل الدخول لعرض مهامك</h2>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex justify-between items-center bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-emerald-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-emerald-200">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-gray-900 leading-tight">مهامي الشخصية</h1>
            <p className="text-gray-500 font-medium text-lg">أهلاً {profile.name}، لديك {stats.pending + stats.inProgress} مهام نشطة اليوم</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="إجمالي المهام" value={stats.total} icon={<Layout/>} color="gray" />
        <StatCard title="بانتظار البدء" value={stats.pending} icon={<Clock/>} color="orange" />
        <StatCard title="قيد التنفيذ" value={stats.inProgress} icon={<Clock/>} color="blue" />
        <StatCard title="مكتملة / مقبولة" value={stats.completed} icon={<CheckCircle2/>} color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-2xl font-black text-gray-900 px-4">قائمة المهام</h3>
          {myTasks.length === 0 ? (
            <div className="bg-white p-20 rounded-[3rem] border border-dashed border-gray-200 text-center">
               <p className="text-gray-400 font-bold italic">لا توجد مهام موجهة إليك حالياً</p>
            </div>
          ) : (
            myTasks.map(t => (
              <motion.div 
                key={t.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group overflow-hidden"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-2">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      t.status === 'Pending' ? "bg-orange-50 text-orange-600" :
                      t.status === 'In Progress' ? "bg-blue-50 text-blue-600" :
                      "bg-emerald-50 text-emerald-600"
                    )}>
                      {t.status}
                    </span>
                    <span className="px-3 py-1 bg-gray-50 text-gray-500 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {t.phase}
                    </span>
                  </div>
                  <div className="text-right text-xs font-black text-blue-600">
                    {projects.find(p => p.id === t.projectId)?.name}
                  </div>
                </div>

                <h4 className="text-xl font-black text-gray-900 mb-2 text-right">{t.title}</h4>
                <p className="text-sm text-gray-500 font-medium mb-6 text-right line-clamp-3">{t.description}</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-y border-gray-50 mb-6">
                  <DetailItem icon={<Calendar className="w-3 h-3"/>} label="تاريخ البدء" value={t.startDate || 'غير محدد'} />
                  <DetailItem icon={<Calendar className="w-3 h-3"/>} label="تاريخ التسليم" value={t.endDate || 'غير محدد'} />
                  <DetailItem icon={<Clock className="w-3 h-3"/>} label="ساعات تقديرية" value={`${t.estimatedHours || 0} ساعة`} />
                  <DetailItem icon={<AlertCircle className="w-3 h-3"/>} label="الحالة الفرعية" value={t.subPhase || 'General'} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    {t.status === 'Pending' && (
                      <ActionButton onClick={() => handleStatusUpdate(t.id, 'In Progress')} label="بدء التنفيذ" color="blue" />
                    )}
                    {t.status === 'In Progress' && (
                      <ActionButton onClick={() => handleStatusUpdate(t.id, 'Under Review')} label="إرسال للمراجعة" color="emerald" />
                    )}
                    {t.status === 'Under Review' && (
                      <span className="text-xs font-black text-orange-500 px-4 py-2 border border-orange-200 bg-orange-50 rounded-xl">جاري المراجعة...</span>
                    )}
                  </div>
                  <div className="flex gap-4">
                     {t.subTasks && t.subTasks.length > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 rounded-full">
                           <ListTodo className="w-3 h-3 text-emerald-500" />
                           <span className="text-[10px] font-black text-gray-500">
                              {t.subTasks.filter(st => st.status === 'Completed').length} / {t.subTasks.length}
                           </span>
                        </div>
                     )}
                     <div className="flex gap-3">
                        <button 
                           onClick={() => {
                             const el = document.getElementById(`chat-section-${t.id}`);
                             if (el) el.classList.toggle('hidden');
                           }}
                           className="p-2 text-gray-400 hover:text-blue-600 transition-colors relative focus:outline-none"
                        >
                           <MessageCircle className="w-5 h-5"/>
                           {t.comments && t.comments.length > 0 && (
                              <span className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">
                                 {t.comments.length}
                              </span>
                           )}
                        </button>
                        <button 
                          onClick={() => {
                             const el = document.getElementById(`attachments-section-${t.id}`);
                             if (el) el.classList.toggle('hidden');
                          }}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors focus:outline-none relative"
                        >
                          <Paperclip className="w-5 h-5"/>
                          {t.attachments && t.attachments.length > 0 && (
                            <span className="absolute -top-1 -left-1 w-4 h-4 bg-blue-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">
                               {t.attachments.length}
                            </span>
                          )}
                        </button>
                     </div>
                  </div>
                </div>

                {/* Always rendered sections, controllable by clicking icons or available if in progress */}
                <div className="mt-6 space-y-4">
                  {(t.subTasks && t.subTasks.length > 0) || projectTasks.filter(ct => ct.parentTaskId === t.id).length > 0 ? (
                    <div className="space-y-4 pt-4 border-t border-gray-50">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">المهمات الفرعية المرتبطة</p>
                       <div className="grid grid-cols-1 gap-2">
                          {/* Legacy simple subtasks */}
                          {t.subTasks?.map(st => (
                             <button 
                                key={st.id}
                                onClick={() => handleToggleSubTask(t.id, st.id)}
                                className="flex items-center justify-between p-3 bg-gray-50/50 rounded-xl hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-gray-100"
                             >
                                <div className={cn(
                                   "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                                   st.status === 'Completed' ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300"
                                )}>
                                   {st.status === 'Completed' && <Check className="w-3 h-3" />}
                                </div>
                                <span className={cn(
                                   "text-right text-xs font-bold font-sans flex-1 ml-4 line-clamp-2",
                                   st.status === 'Completed' ? "text-gray-400 line-through" : "text-gray-700"
                                )}>{st.title}</span>
                             </button>
                          ))}
                          {/* New Full task childs */}
                          {projectTasks.filter(ct => ct.parentTaskId === t.id).map(ct => (
                             <div key={ct.id} className="p-3 bg-blue-50/30 rounded-xl flex items-center justify-between border border-blue-50">
                               <div className="flex gap-2 items-center">
                                  <ListTodo className="w-4 h-4 text-blue-500" />
                                  <span className="text-right text-xs font-bold text-gray-800 font-sans">{ct.title}</span>
                               </div>
                               <span className={cn(
                                 "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter",
                                 ct.status === 'Approved' ? "bg-emerald-100 text-emerald-700" :
                                 ct.status === 'Rejected' ? "bg-red-100 text-red-700" :
                                 ct.status === 'Under Review' ? "bg-orange-100 text-orange-700" : 
                                 ct.status === 'In Progress' ? "bg-blue-100 text-blue-700" : "bg-white text-gray-500"
                               )}>
                                  {ct.status}
                               </span>
                             </div>
                          ))}
                       </div>
                    </div>
                  ) : null}

                  {/* Attachments Section */}
                  <div id={`attachments-section-${t.id}`} className={cn("space-y-3 pt-4 border-t border-gray-50", t.status === 'In Progress' ? "block" : "hidden")}>
                      <div className="flex justify-between items-center bg-blue-50/50 p-2 rounded-xl border border-blue-50 text-right">
                         <div className="flex gap-2 items-center">
                            <Paperclip className="w-4 h-4 text-blue-600" />
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest whitespace-nowrap">المرفقات</span>
                         </div>
                         <div className="flex gap-2">
                            <button
                              onClick={() => handleAddLinkAttachment(t.id)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold text-xs bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
                            >
                              إضافة رابط
                            </button>
                            <input 
                              type="file" 
                              id={`file-upload-mytasks-${t.id}`} 
                              className="hidden" 
                              onChange={(e) => handleFileUpload(t.id, e)} 
                            />
                            <label 
                              htmlFor={`file-upload-mytasks-${t.id}`}
                              className={cn(
                                 "flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition-all",
                                 uploadingFile 
                                   ? "bg-gray-200 text-gray-500 cursor-not-allowed" 
                                   : "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200"
                              )}
                            >
                              {uploadingFile ? (
                                <><span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span> جاري الرفع...</>
                              ) : (
                                <>رفع ملف</>
                              )}
                            </label>
                         </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                         {t.attachments?.map((att, idx) => (
                            <a 
                              key={idx} 
                              href={att.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all"
                            >
                               <div className="flex flex-col flex-1 truncate text-right">
                                  <p className="font-bold text-xs text-gray-800 truncate">{att.name}</p>
                                  <div className="flex justify-end gap-1 text-[9px] text-gray-400 mt-0.5">
                                    <span>{new Date(att.timestamp).toLocaleDateString('ar-EG')}</span>
                                    <span>•</span>
                                    <span className="truncate">{att.uploadedBy}</span>
                                  </div>
                               </div>
                               <ExternalLink className="w-3 h-3 text-gray-300 mr-2" />
                            </a>
                         ))}
                      </div>
                  </div>

                  {/* Chat Section */}
                  <div id={`chat-section-${t.id}`} className={cn("space-y-3 pt-4 border-t border-gray-50", t.status === 'In Progress' ? "block" : "hidden")}>
                     <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">المحادثات والتعليقات</p>
                     <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {t.comments?.map((c, idx) => (
                           <div key={idx} className={cn(
                             "p-3 rounded-xl border text-right max-w-[85%]",
                             c.userId === user?.uid 
                               ? "bg-indigo-50 border-indigo-100 mr-auto" 
                               : "bg-white border-gray-100 ml-auto"
                           )}>
                              <p className="text-[10px] font-black text-indigo-600 mb-0.5">{c.userName}</p>
                              <p className="text-xs font-medium text-gray-700">{c.text}</p>
                           </div>
                        ))}
                        {(!t.comments || t.comments.length === 0) && (
                          <div className="text-center py-4 text-xs font-bold text-gray-400 italic">
                             لا توجد تعليقات حتى الآن.
                          </div>
                        )}
                     </div>
                     <div className="flex gap-2">
                       <input 
                           className="flex-1 bg-white px-4 py-2 rounded-xl border border-gray-200 outline-none focus:border-indigo-500 text-xs font-bold text-right font-sans transition-all"
                           placeholder="أضف تعليقاً... واضغط Enter"
                           onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                 handleSendChatMessage(t.id, (e.target as HTMLInputElement).value);
                                 (e.target as HTMLInputElement).value = '';
                              }
                           }}
                       />
                     </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        <div className="space-y-6">
          <h3 className="text-2xl font-black text-gray-900 px-4">إحصائيات الأداء</h3>
          <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm space-y-6">
             <div>
                <div className="flex justify-between items-center mb-2">
                   <span className="text-xs font-black text-gray-500">نسبة الإنجاز</span>
                   <span className="text-xs font-black text-emerald-600">%{Math.round((stats.completed / (stats.total || 1)) * 100)}</span>
                </div>
                <div className="w-full h-3 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                   <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(stats.completed / (stats.total || 1)) * 100}%` }}
                    className="h-full bg-emerald-500 shadow-lg shadow-emerald-100"
                   />
                </div>
             </div>

             <div className="space-y-3">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">تنبيهات هامة</p>
                <AlertItem label="مهام متأخرة" count={0} color="red" />
                <AlertItem label="بانتظار ردك" count={stats.pending} color="orange" />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string, value: number, icon: React.ReactNode, color: string }> = ({ title, value, icon, color }) => (
  <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center justify-between">
    <div>
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{title}</p>
      <p className="text-3xl font-black text-gray-900">{value}</p>
    </div>
    <div className={cn(
      "w-12 h-12 rounded-2xl flex items-center justify-center",
      color === 'orange' ? "bg-orange-50 text-orange-600" :
      color === 'blue' ? "bg-blue-50 text-blue-600" :
      color === 'emerald' ? "bg-emerald-50 text-emerald-600" : "bg-gray-50 text-gray-600"
    )}>
      {icon}
    </div>
  </div>
);

const DetailItem: React.FC<{ icon: React.ReactNode, label: string, value: string }> = ({ icon, label, value }) => (
  <div className="text-right">
    <div className="flex items-center justify-end gap-1 text-[9px] font-black text-gray-400 uppercase tracking-tighter mb-0.5">
      {label}
      {icon}
    </div>
    <div className="text-[11px] font-black text-gray-700">{value}</div>
  </div>
);

const ActionButton: React.FC<{ onClick: () => void, label: string, color: 'blue' | 'emerald' }> = ({ onClick, label, color }) => (
  <button 
    onClick={onClick}
    className={cn(
      "px-6 py-2.5 rounded-xl font-black text-xs transition-all shadow-sm active:scale-95",
      color === 'blue' ? "bg-blue-600 text-white shadow-blue-100 hover:bg-blue-700" : "bg-emerald-600 text-white shadow-emerald-100 hover:bg-emerald-700"
    )}
  >
    {label}
  </button>
);

const AlertItem: React.FC<{ label: string, count: number, color: 'red' | 'orange' }> = ({ label, count, color }) => (
  <div className={cn(
    "flex items-center justify-between p-4 rounded-2xl border",
    color === 'red' ? "bg-red-50 border-red-100 text-red-600" : "bg-orange-50 border-orange-100 text-orange-600"
  )}>
    <span className="text-xs font-black">{label}</span>
    <span className="w-6 h-6 bg-white rounded-lg flex items-center justify-center text-xs font-black shadow-sm">{count}</span>
  </div>
);
