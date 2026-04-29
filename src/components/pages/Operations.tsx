import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Briefcase, 
  Plus, 
  Search, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Trash2,
  FileText,
  MessageSquare,
  Upload,
  User,
  ArrowRight,
  Filter,
  Layers,
  Code,
  Smartphone,
  Globe,
  Monitor,
  Check,
  X,
  Send,
  ExternalLink,
  AtSign,
  ListTodo,
  Paperclip,
  ShieldCheck,
  ChevronDown,
  Lock,
  Plane
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../AuthContext';
import { db, collection, addDoc, deleteDoc, doc, updateDoc, arrayUnion, storage, ref, uploadBytes, getDownloadURL } from '../../firebase';
import { Project, ProjectTask, ProjectStatus, TaskStatus, ProjectPhase, WorkflowLog, Employee, SubTask, TaskChatMessage } from '../../types';
import { cn } from '../../lib/utils';
import { ChatInputWithMentions } from '../ChatInputWithMentions';

export const Operations: React.FC = () => {
  const { projects, projectTasks, employees, missions } = useData();
  const { user, profile } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isTaskDetailsOpen, setIsTaskDetailsOpen] = useState(false);
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [isProjectChatOpen, setIsProjectChatOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [subTaskTitle, setSubTaskTitle] = useState('');
  
  const handleFileUpload = async (taskId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
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
        uploadedBy: profile?.name || user?.displayName || 'User',
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

  const [projectForm, setProjectForm] = useState<Partial<Project>>({
    name: '',
    parentProjectId: '',
    clientName: '',
    description: '',
    details: '',
    projectManagerId: '',
    teamLeaderId: '',
    consultantTlId: '',
    developerTlId: '',
    phases: ['Analysis', 'Design', 'Development'],
    status: 'Active',
    startDate: '',
    endDate: ''
  });

  const [taskForm, setTaskForm] = useState<Partial<ProjectTask>>({
    title: '',
    description: '',
    phase: '',
    subPhase: 'General',
    status: 'Pending',
    assignedToId: '',
    startDate: '',
    endDate: '',
    estimatedHours: 0,
    parentTaskId: undefined
  });

  const [newPhaseInput, setNewPhaseInput] = useState('');

  const selectedProject = useMemo(() => 
    projects.find(p => p.id === selectedProjectId), 
  [projects, selectedProjectId]);

  const viewingTask = useMemo(() => 
    projectTasks.find(t => t.id === viewingTaskId),
  [projectTasks, viewingTaskId]);

  const isPM = useMemo(() => 
    profile && selectedProject && (profile.id === selectedProject.projectManagerId || profile.role === 'Admin'),
  [profile, selectedProject]);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.clientName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [projects, searchTerm]);

  const projectSpecificTasks = useMemo(() => {
    return projectTasks.filter(t => t.projectId === selectedProjectId);
  }, [projectTasks, selectedProjectId]);

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newProject = {
        ...projectForm,
        createdAt: new Date().toISOString()
      };
      
      if (!newProject.parentProjectId) {
         delete newProject.parentProjectId;
      }
      
      await addDoc(collection(db, 'projects'), newProject);
      setIsProjectModalOpen(false);
      setProjectForm({
        name: '',
        parentProjectId: '',
        clientName: '',
        description: '',
        projectManagerId: '',
        teamLeaderId: '',
        consultantTlId: '',
        developerTlId: '',
        phases: ['Analysis', 'Design', 'Development'],
        status: 'Active',
        startDate: '',
        endDate: ''
      });
    } catch (error) {
      console.error('Error adding project:', error);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !user) return;
    try {
      const newTask: Partial<ProjectTask> = {
        ...taskForm,
        projectId: selectedProjectId,
        creatorId: user.uid,
        status: 'Pending',
        workflowLog: [{
          fromStatus: 'Pending',
          toStatus: 'Pending',
          userId: user.uid,
          userName: profile?.name || user.displayName || 'User',
          timestamp: new Date().toISOString(),
          note: 'Task Created'
        }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      if (newTask.parentTaskId === undefined) {
        delete newTask.parentTaskId;
      }
      
      await addDoc(collection(db, 'projectTasks'), newTask);
      setIsTaskModalOpen(false);
      setTaskForm({ 
        title: '', 
        description: '', 
        phase: '', 
        subPhase: 'General',
        assignedToId: '',
        startDate: '',
        endDate: '',
        estimatedHours: 0,
        parentTaskId: undefined
      });
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskStatus, note?: string) => {
    if (!user) return;
    const task = projectTasks.find(t => t.id === taskId);
    if (!task) return;

    // Check dependency: cannot close a task if it has open sub-tasks
    if (newStatus === 'Approved' || newStatus === 'Executed') {
      const childTasks = projectTasks.filter(t => t.parentTaskId === taskId);
      const hasOpenChildren = childTasks.some(child => child.status !== 'Approved' && child.status !== 'Executed' && child.status !== 'Rejected');
      if (hasOpenChildren) {
        alert('لا يمكن إغلاق هذه المهمة أو الموافقة عليها لوجود مهام فرعية (Sub-tasks) بداخلها لم يتم إغلاقها ومراجعتها بعد.');
        return;
      }
    }

    const log: WorkflowLog = {
      fromStatus: task.status,
      toStatus: newStatus,
      userId: user.uid,
      userName: profile?.name || user.displayName || 'User',
      timestamp: new Date().toISOString(),
      note: note || ''
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

  const handleUpdateProjectStatus = async (projectId: string, newStatus: ProjectStatus) => {
    if (!isPM) {
      alert('عذراً، مدير المشروع فقط هو من يمكنه تغيير حالة المشروع');
      return;
    }
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating project status:', error);
    }
  };

  const handleUpdateProjectDetails = async (projectId: string, field: string, value: any) => {
    if (!isPM) {
      alert('عذراً، مدير المشروع فقط هو من يمكنه تعديل بيانات المشروع');
      return;
    }
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        [field]: value,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating project details:', error);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المشروع نهائياً؟')) return;
    try {
      await deleteDoc(doc(db, 'projects', projectId));
      setSelectedProjectId(null);
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const handleAddSubTask = async (taskId: string, title: string) => {
    if (!title.trim()) return;
    const subTask: SubTask = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      title,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };
    try {
      await updateDoc(doc(db, 'projectTasks', taskId), {
        subTasks: arrayUnion(subTask),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error adding subtask:', error);
      alert('حدث خطأ أثناء إضافة المهمة الفرعية: ' + error);
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
      console.error('Error toggling subtask:', error);
    }
  };

  const handleSendChatMessage = async (targetId: string, type: 'task' | 'project', text: string) => {
    if (!text.trim() || !user) return;
    
    // Simple mention detection
    const mentions = employees
      .filter(e => text.includes(`@${e.name}`))
      .map(e => e.id);

    const message: TaskChatMessage = {
      id: crypto.randomUUID(),
      userId: user.uid,
      userName: profile?.name || user?.displayName || 'User',
      text,
      mentions,
      createdAt: new Date().toISOString()
    };

    try {
      const collectionName = type === 'task' ? 'projectTasks' : 'projects';
      const docRef = doc(db, collectionName, targetId);
      
      // We store chat as an array in the document for simplicity in this version
      // but a sub-collection is strictly preferred for enterprise apps
      await updateDoc(docRef, {
        [type === 'task' ? 'comments' : 'chat']: arrayUnion(message)
      });
      setChatMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="space-y-8 pb-32">
      <div className="flex justify-between items-center bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-blue-200">
            <Briefcase className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-gray-900 leading-tight">قسم العمليات</h1>
            <p className="text-gray-500 font-medium text-lg">إدارة مشاريع السوفتوير والمخططات الزمنية وفريق العمل</p>
          </div>
        </div>
        <button 
          onClick={() => setIsProjectModalOpen(true)}
          className="bg-blue-600 text-white px-8 py-5 rounded-[1.5rem] font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-3 hover:scale-105 active:scale-95"
        >
          <Plus className="w-6 h-6" />
          فتح مشروع جديد
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Project List Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="relative">
            <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text"
              placeholder="البحث عن مشروع..."
              className="w-full pr-14 pl-6 py-5 bg-white border border-gray-100 rounded-[2rem] shadow-sm outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
            {filteredProjects.filter(p => !p.parentProjectId).map(parentProj => (
              <div key={parentProj.id} className="space-y-2">
                <button
                  onClick={() => setSelectedProjectId(parentProj.id)}
                  className={cn(
                    "w-full text-right p-6 rounded-[2.5rem] border transition-all relative group",
                    selectedProjectId === parentProj.id 
                      ? "bg-blue-600 border-blue-600 shadow-xl shadow-blue-100" 
                      : "bg-white border-gray-100 hover:border-blue-200"
                  )}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                      selectedProjectId === parentProj.id ? "bg-white/20 text-white" : "bg-blue-50 text-blue-600"
                    )}>
                      <Globe className="w-6 h-6" />
                    </div>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      selectedProjectId === parentProj.id ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-600"
                    )}>
                      {parentProj.status}
                    </span>
                  </div>
                  <h3 className={cn(
                    "text-xl font-black mb-1",
                    selectedProjectId === parentProj.id ? "text-white" : "text-gray-900"
                  )}>{parentProj.name}</h3>
                  <p className={cn(
                    "text-sm font-bold opacity-70 mb-4",
                    selectedProjectId === parentProj.id ? "text-white" : "text-gray-400"
                  )}>{parentProj.clientName}</p>
                  
                  {selectedProjectId === parentProj.id && (
                    <motion.div 
                      layoutId="active-indicator"
                      className="absolute left-6 top-1/2 -translate-y-1/2"
                    >
                      <ChevronRight className="w-6 h-6 text-white" />
                    </motion.div>
                  )}
                </button>
                
                {/* Visual rendering of Sub-projects associated with this parent project */}
                {filteredProjects.filter(sub => sub.parentProjectId === parentProj.id).map(subProj => (
                  <button
                    key={subProj.id}
                    onClick={() => setSelectedProjectId(subProj.id)}
                    className={cn(
                      "w-[92%] mr-auto block text-right p-4 rounded-[2rem] border transition-all relative group",
                      selectedProjectId === subProj.id 
                        ? "bg-blue-500 border-blue-500 shadow-xl shadow-blue-100" 
                        : "bg-gray-50 border-gray-100 hover:border-blue-200"
                    )}
                  >
                    <div className="flex justify-between items-center mb-2">
                       <span className={cn(
                         "text-[10px] font-black px-2 py-0.5 rounded-md",
                         selectedProjectId === subProj.id ? "bg-white/20 text-white" : "bg-white text-gray-500 shadow-sm"
                       )}>مشروع فرعي</span>
                       <span className={cn(
                         "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                         selectedProjectId === subProj.id ? "bg-emerald-400/20 text-white" : "bg-emerald-100 text-emerald-600"
                       )}>
                         {subProj.status}
                       </span>
                    </div>
                    <h3 className={cn(
                      "text-sm font-black mb-1",
                      selectedProjectId === subProj.id ? "text-white" : "text-gray-900"
                    )}>{subProj.name}</h3>
                    {selectedProjectId === subProj.id && (
                      <ChevronRight className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white" />
                    )}
                  </button>
                ))}
              </div>
            ))}
            
            {/* Display orphan subprojects (their parent was deleted or not matching search context) */}
            {filteredProjects.filter(p => p.parentProjectId && !filteredProjects.find(parent => parent.id === p.parentProjectId)).map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedProjectId(p.id)}
                className={cn(
                  "w-full text-right p-6 rounded-[2.5rem] border border-dashed transition-all relative group",
                  selectedProjectId === p.id 
                    ? "bg-gray-800 border-gray-800 shadow-xl shadow-gray-200" 
                    : "bg-gray-50 border-gray-200 hover:border-gray-300"
                )}
              >
                  <div className="flex justify-between items-start mb-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      selectedProjectId === p.id ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"
                    )}>
                      {p.status}
                    </span>
                    <span className={cn(
                        "text-xs font-black",
                        selectedProjectId === p.id ? "text-gray-300" : "text-gray-400"
                      )}>مشروع فرعي يتيم</span>
                  </div>
                  <h3 className={cn(
                    "text-xl font-black mb-1",
                    selectedProjectId === p.id ? "text-white" : "text-gray-900"
                  )}>{p.name}</h3>
                  <p className={cn(
                    "text-sm font-bold opacity-70 mb-4",
                    selectedProjectId === p.id ? "text-white" : "text-gray-400"
                  )}>{p.clientName}</p>
                </button>
            ))}
          </div>
        </div>

        {/* Project View Content */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            {selectedProject ? (
              <motion.div
                key={selectedProject.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                {/* Project Header */}
                <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-2 h-full bg-blue-600" />
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <div className="flex items-center gap-2 text-blue-600 font-black text-sm uppercase tracking-widest mb-2">
                        <Layers className="w-4 h-4" />
                        تفاصيل المشروع
                      </div>
                      <h2 className="text-4xl font-black text-gray-900 mb-2">{selectedProject.name}</h2>
                      <div className="flex items-center gap-4 text-gray-400 font-bold">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {selectedProject.clientName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          أُنشئ في {new Date(selectedProject.createdAt).toLocaleDateString('ar-EG')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                         onClick={() => setIsProjectChatOpen(true)}
                         className="p-4 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 transition-all flex items-center gap-2 font-black"
                      >
                        <MessageSquare className="w-6 h-6" />
                        محادثة المشروع
                      </button>
                      <button 
                        onClick={() => handleDeleteProject(selectedProject.id)}
                        className="p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-all hover:scale-105"
                      >
                        <Trash2 className="w-6 h-6" />
                      </button>
                    </div>
                  </div>

                  <div className="p-8 bg-blue-50/20 rounded-[2.5rem] border border-blue-50 mb-8">
                     <div className="flex items-center gap-2 text-sm font-black text-blue-500 mb-4">
                        <FileText className="w-4 h-4"/>
                        وصف وتفاصيل إضافية
                     </div>
                     {isPM ? (
                       <textarea 
                          className="w-full bg-transparent p-0 border-none outline-none focus:ring-0 text-gray-600 font-medium leading-relaxed text-right mb-6 resize-none min-h-[60px]"
                          defaultValue={selectedProject.description || ''}
                          onBlur={(e) => handleUpdateProjectDetails(selectedProject.id, 'description', e.target.value)}
                          placeholder="أضف وصفاً للمشروع..."
                       />
                     ) : (
                       <p className="text-gray-600 font-medium leading-relaxed text-right mb-6">
                          {selectedProject.description || 'لا يوجد وصف متاح'}
                       </p>
                     )}
                     
                     {isPM ? (
                       <div className="space-y-4">
                          <label className="text-xs font-black text-gray-400 block">تفاصيل إضافية (للمدراء فقط)</label>
                          <textarea 
                             className="w-full bg-white p-6 rounded-3xl border border-blue-100 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700 text-right min-h-[120px]"
                             placeholder="أضف تفاصيل إستراتيجية أو تعليمات للمدراء..."
                             defaultValue={selectedProject.details}
                             onBlur={(e) => handleUpdateProjectDetails(selectedProject.id, 'details', e.target.value)}
                          />
                       </div>
                     ) : selectedProject.details && (
                       <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm">
                          <p className="text-gray-500 italic text-sm text-right">{selectedProject.details}</p>
                       </div>
                     )}
                  </div>

                  {/* Linked Missions Section */}
                  <div className="mb-10">
                     <div className="flex items-center justify-between mb-6 px-4">
                        <div className="flex items-center gap-2">
                           <Plane className="w-5 h-5 text-blue-600" />
                           <h3 className="text-xl font-black text-gray-900 font-sans">المأموريات المرتبطة بالمشروع</h3>
                        </div>
                        <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-xs font-black">
                           {(missions.filter(m => m.projectId === selectedProject.id)).length} مأمورية
                        </span>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(missions.filter(m => m.projectId === selectedProject.id)).map(mission => {
                           const emp = employees.find(e => e.id === mission.employeeId);
                           return (
                              <div key={mission.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4">
                                 <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500">
                                    <User className="w-6 h-6" />
                                 </div>
                                 <div className="flex-1 min-w-0 text-right">
                                    <p className="text-sm font-black text-gray-900 truncate font-sans">{emp?.name || 'موظف مجهول'}</p>
                                    <p className="text-[10px] font-bold text-gray-400 font-sans">
                                       {mission.startDate} إلى {mission.endDate}
                                    </p>
                                 </div>
                              </div>
                           );
                        })}
                        {(missions.filter(m => m.projectId === selectedProject.id)).length === 0 && (
                           <p className="col-span-full text-center py-10 text-gray-300 italic text-sm font-sans bg-gray-50/50 rounded-3xl border border-dashed border-gray-100">
                              لا توجد مأموريات مربوطة حالياً
                           </p>
                        )}
                     </div>
                   </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-gray-50 rounded-[2rem] border border-gray-100">
                    <div>
                      <p className="text-[10px] text-gray-400 font-black mb-1 uppercase tracking-widest">مدير المشروع</p>
                      <div className="flex items-center gap-1">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        {isPM ? (
                          <select 
                             className="bg-transparent text-gray-700 font-bold outline-none cursor-pointer p-0 text-sm w-full"
                             value={selectedProject.projectManagerId}
                             onChange={(e) => handleUpdateProjectDetails(selectedProject.id, 'projectManagerId', e.target.value)}
                          >
                             <option value="" disabled>اختر مديراً</option>
                             {employees.map(emp => (
                               <option key={emp.id} value={emp.id}>{emp.name}</option>
                             ))}
                          </select>
                        ) : (
                          <p className="font-bold text-gray-700">{employees.find(e => e.id === selectedProject.projectManagerId)?.name || '-'}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-black mb-1 uppercase tracking-widest">قائد الفريق</p>
                      {isPM ? (
                        <select 
                           className="bg-transparent text-gray-700 font-bold outline-none cursor-pointer p-0 text-sm w-full"
                           value={selectedProject.teamLeaderId}
                           onChange={(e) => handleUpdateProjectDetails(selectedProject.id, 'teamLeaderId', e.target.value)}
                        >
                           <option value="" disabled>اختر قائداً للفريق</option>
                           {employees.map(emp => (
                             <option key={emp.id} value={emp.id}>{emp.name}</option>
                           ))}
                        </select>
                      ) : (
                        <p className="font-bold text-gray-700">{employees.find(e => e.id === selectedProject.teamLeaderId)?.name || '-'}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-black mb-1 uppercase tracking-widest">المخطط الزمني</p>
                      {isPM ? (
                        <div className="flex items-center gap-1 text-sm font-bold text-blue-600">
                           <input type="date" className="bg-transparent outline-none cursor-pointer w-24 text-[11px]" value={selectedProject.startDate || ''} onChange={(e) => handleUpdateProjectDetails(selectedProject.id, 'startDate', e.target.value)} />
                           <span>-</span>
                           <input type="date" className="bg-transparent outline-none cursor-pointer w-24 text-[11px]" value={selectedProject.endDate || ''} onChange={(e) => handleUpdateProjectDetails(selectedProject.id, 'endDate', e.target.value)} />
                        </div>
                      ) : (
                        <p className="font-bold text-blue-600 text-sm">
                          {selectedProject.startDate ? new Date(selectedProject.startDate).toLocaleDateString('ar-EG') : '؟'} - {selectedProject.endDate ? new Date(selectedProject.endDate).toLocaleDateString('ar-EG') : '؟'}
                        </p>
                      )}
                    </div>
                    <div className="relative group">
                      <p className="text-[10px] text-gray-400 font-black mb-1 uppercase tracking-widest">الحالة</p>
                      {isPM ? (
                        <select 
                           className="bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black outline-none px-2 py-1 appearance-none cursor-pointer"
                           value={selectedProject.status}
                           onChange={(e) => handleUpdateProjectStatus(selectedProject.id, e.target.value as ProjectStatus)}
                        >
                           <option value="Active">Active</option>
                           <option value="Completed">Completed</option>
                           <option value="On Hold">On Hold</option>
                        </select>
                      ) : (
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black">{selectedProject.status}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Task Workflow Area */}
                <div className="space-y-6">
                  <div className="flex justify-between items-center px-4">
                    <div className="flex items-center gap-4 overflow-x-auto pb-2 no-scrollbar">
                      <h3 className="text-2xl font-black text-gray-900 whitespace-nowrap">سير العمل</h3>
                      <div className="flex gap-2">
                        {selectedProject.phases?.map(p => (
                          <span key={p} className="px-4 py-1.5 rounded-full text-xs font-black bg-gray-100 text-gray-600 whitespace-nowrap">
                            {p}
                          </span>
                        )) || <span className="text-gray-400 text-sm font-medium italic">لم يتم تعريف مراحل</span>}
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setTaskForm({ ...taskForm, phase: selectedProject.phases?.[0] || '' });
                        setIsTaskModalOpen(true);
                      }}
                      className="bg-white border border-gray-100 px-6 py-3 rounded-2xl font-black text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-2 shadow-sm whitespace-nowrap"
                    >
                      <Plus className="w-5 h-5" />
                      إضافة مهمة
                    </button>
                  </div>

                  <div className="flex gap-6 overflow-x-auto pb-8 snap-x custom-scrollbar">
                    {selectedProject.phases?.map(phaseName => (
                      <div key={phaseName} className="min-w-[320px] max-w-[320px] snap-center space-y-4">
                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Layers className="w-5 h-5 text-blue-600" />
                            <span className="font-black text-gray-900">{phaseName}</span>
                          </div>
                          <span className="text-xs font-black text-gray-400 bg-white px-2 py-0.5 rounded-lg border border-gray-100">
                            {projectSpecificTasks.filter(t => t.phase === phaseName && !t.parentTaskId).length}
                          </span>
                        </div>
                        <TaskList 
                          tasks={projectSpecificTasks.filter(t => t.phase === phaseName && !t.parentTaskId)} 
                          onStatusUpdate={handleUpdateTaskStatus}
                          employees={employees}
                          onViewDetails={(id) => {
                             setViewingTaskId(id);
                             setIsTaskDetailsOpen(true);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center py-40 text-gray-300 gap-6 bg-white rounded-[3rem] border border-gray-50 shadow-sm border-dashed border-2">
                <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center shadow-inner">
                  <Briefcase className="w-12 h-12" />
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black mb-2">اختر مشروعاً لمعاينته</p>
                  <p className="text-gray-400 font-medium">ابدأ بإختيار أحد المشاريع من القائمة الجانبية أو أضف مشروعاً جديداً</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Project Creation Modal */}
      <AnimatePresence>
        {isProjectModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsProjectModalOpen(false)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden">
              <div className="p-10 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="text-3xl font-black text-gray-900">فتح مشروع جديد</h3>
                <button onClick={() => setIsProjectModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors"><X/></button>
              </div>
              <form onSubmit={handleAddProject} className="p-10 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2 col-span-2">
                    <label className="text-sm font-black text-gray-500 mr-2">اسم المشروع</label>
                    <input required className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={projectForm.name} onChange={(e) => setProjectForm({...projectForm, name: e.target.value})} placeholder="مثال: نظام إدارة الموارد الحكومي" />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <label className="text-sm font-black text-gray-500 mr-2">مشروع رئيسي (اختياري)</label>
                    <select
                      className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700"
                      value={projectForm.parentProjectId || ''}
                      onChange={(e) => setProjectForm({...projectForm, parentProjectId: e.target.value})}
                    >
                      <option value="">لا يوجد (مشروع رئيسي)</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-gray-400 font-bold px-2">استخدم هذا الحقل لتصنيف هذا المشروع كمشروع فرعي (Sub-project) تحت مشروع آخر.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black text-gray-500 mr-2">تاريخ البداية</label>
                    <input type="date" className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm" value={projectForm.startDate} onChange={(e) => setProjectForm({...projectForm, startDate: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black text-gray-500 mr-2">تاريخ النهاية</label>
                    <input type="date" className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm" value={projectForm.endDate} onChange={(e) => setProjectForm({...projectForm, endDate: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-4 p-6 bg-blue-50/30 rounded-3xl border border-blue-100">
                   <div className="flex justify-between items-center">
                      <label className="text-sm font-black text-gray-700">مراحل المشروع (ديناميكية)</label>
                      <div className="flex gap-2">
                        <input 
                          className="px-4 py-2 text-xs bg-white border border-blue-100 rounded-xl outline-none" 
                          placeholder="مرحلة جديدة..."
                          value={newPhaseInput}
                          onChange={(e) => setNewPhaseInput(e.target.value)}
                        />
                        <button 
                          type="button"
                          onClick={() => {
                            if (!newPhaseInput) return;
                            setProjectForm({ ...projectForm, phases: [...(projectForm.phases || []), newPhaseInput] });
                            setNewPhaseInput('');
                          }}
                          className="p-2 bg-blue-600 text-white rounded-xl"
                        ><Plus className="w-4 h-4"/></button>
                      </div>
                   </div>
                   <div className="flex flex-wrap gap-2">
                      {projectForm.phases?.map((p, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-blue-100 text-xs font-bold text-blue-700 shadow-sm">
                          {p}
                          <button onClick={() => setProjectForm({ ...projectForm, phases: projectForm.phases?.filter((_, i) => i !== idx) })} className="text-red-400 hover:text-red-600"><X className="w-3 h-3"/></button>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-black text-gray-500 mr-2">اسم العميل</label>
                    <input required className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={projectForm.clientName} onChange={(e) => setProjectForm({...projectForm, clientName: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black text-gray-500 mr-2">مدير المشروع</label>
                    <select required className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={projectForm.projectManagerId} onChange={(e) => setProjectForm({...projectForm, projectManagerId: e.target.value})}>
                      <option value="">اختر...</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-black text-gray-500 mr-2">قائد الفريق الرئيسي</label>
                    <select required className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={projectForm.teamLeaderId} onChange={(e) => setProjectForm({...projectForm, teamLeaderId: e.target.value})}>
                      <option value="">اختر...</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black text-gray-500 mr-2">قائد الاستشاريين</label>
                    <select className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={projectForm.consultantTlId} onChange={(e) => setProjectForm({...projectForm, consultantTlId: e.target.value})}>
                      <option value="">اختر...</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                </div>
                  <div className="space-y-4">
                    <label className="text-sm font-black text-gray-500 mr-2 text-right block">وصف مختصر</label>
                    <textarea className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-right" value={projectForm.description} onChange={(e) => setProjectForm({...projectForm, description: e.target.value})} placeholder="وصف عام للمشروع ونطاق العمل..." />
                  </div>

                  <div className="space-y-4">
                    <label className="text-sm font-black text-gray-500 mr-2 text-right block">تفاصيل إضافية (خاصة بالمدراء)</label>
                    <textarea className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-right" value={projectForm.details} onChange={(e) => setProjectForm({...projectForm, details: e.target.value})} placeholder="ملاحظات تفصيلية أو قيود فنية..." />
                  </div>

                  <div className="pt-4">
                    <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-lg hover:bg-blue-700 hover:shadow-xl hover:-translate-y-1 transition-all">حفظ المشروع الجديد</button>
                  </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Creation Modal */}
      <AnimatePresence>
        {isTaskModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsTaskModalOpen(false)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden">
               <div className="p-8 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                  <h3 className="text-2xl font-black text-gray-900">إضافة مهمة جديدة</h3>
               </div>
               <form onSubmit={handleAddTask} className="p-8 space-y-4 max-h-[70vh] overflow-y-auto">
                  <div className="space-y-2">
                    <label className="text-sm font-black text-gray-500 text-right block">عنوان المهمة</label>
                    <input required className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-right font-bold" value={taskForm.title} onChange={(e) => setTaskForm({...taskForm, title: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-black text-gray-500 text-right block">المرحلة</label>
                      <select required className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-right font-bold" value={taskForm.phase} onChange={(e) => setTaskForm({...taskForm, phase: e.target.value})}>
                        <option value="">اختر المرحلة...</option>
                        {selectedProject.phases?.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-sm font-black text-gray-500 text-right block">التوجيه (Assign To) - يمكن اختيار أكثر من شخص</label>
                       
                       <div className="flex flex-wrap gap-2 mb-2">
                         {taskForm.assignedToIds?.map(id => {
                            const emp = employees.find(e => e.id === id);
                            if (!emp) return null;
                            return (
                              <span key={id} className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                                {emp.name}
                                <button type="button" onClick={() => setTaskForm({...taskForm, assignedToIds: taskForm.assignedToIds?.filter(i => i !== id)})} className="text-blue-500 hover:text-blue-700 mx-1">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            );
                         })}
                       </div>
                       
                       <select 
                          className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-right font-bold" 
                          value="" 
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val && !taskForm.assignedToIds?.includes(val)) {
                              setTaskForm({...taskForm, assignedToIds: [...(taskForm.assignedToIds || []), val]});
                            }
                          }}
                       >
                          <option value="">إضافة شخص للقائمة...</option>
                          {employees.filter(e => !taskForm.assignedToIds?.includes(e.id)).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                       </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-black text-gray-500 text-right block">البداية</label>
                      <input type="date" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none font-bold text-xs" value={taskForm.startDate} onChange={(e) => setTaskForm({...taskForm, startDate: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-black text-gray-500 text-right block">النهاية</label>
                      <input type="date" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none font-bold text-xs" value={taskForm.endDate} onChange={(e) => setTaskForm({...taskForm, endDate: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-black text-gray-500 text-right block">ساعات (Est)</label>
                      <input type="number" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none font-bold text-sm" value={taskForm.estimatedHours} onChange={(e) => setTaskForm({...taskForm, estimatedHours: Number(e.target.value)})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black text-gray-500 text-right block">الوصف</label>
                    <textarea className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none h-24 resize-none text-right font-bold" value={taskForm.description} onChange={(e) => setTaskForm({...taskForm, description: e.target.value})} />
                  </div>
                  <button type="submit" className="w-full py-4 bg-blue-600 text-white font-black rounded-xl">إنشاء المهمة وتوجيهها</button>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTaskDetailsOpen && viewingTask && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 font-sans">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsTaskDetailsOpen(false)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white w-full max-w-5xl h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col font-sans">
               <div className="p-8 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100 font-sans">
                        <Layers className="w-6 h-6" />
                     </div>
                     <div>
                        {viewingTask.parentTaskId && projectTasks.find(t => t.id === viewingTask.parentTaskId) && (
                           <button 
                             onClick={() => setViewingTaskId(viewingTask.parentTaskId!)}
                             className="flex items-center gap-1 text-xs font-black text-blue-600 mb-1 hover:text-blue-800 transition-colors"
                           >
                              <ChevronRight className="w-3 h-3"/>
                              العودة للمهمة: {projectTasks.find(t => t.id === viewingTask.parentTaskId)?.title}
                           </button>
                        )}
                        <h3 className="text-2xl font-black text-gray-900 font-sans">{viewingTask.title}</h3>
                        <p className="text-xs font-bold text-gray-400 font-sans">{viewingTask.phase} » {viewingTask.subPhase}</p>
                     </div>
                  </div>
                  <button onClick={() => setIsTaskDetailsOpen(false)} className="p-3 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 transition-all"><X /></button>
               </div>

               <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-x divide-x-reverse divide-gray-100 font-sans" dir="rtl">
                  {/* Details Sidebar */}
                  <div className="w-full md:w-80 p-8 space-y-8 bg-gray-50/50 overflow-y-auto custom-scrollbar border-l border-gray-100 font-sans">
                     <div className="space-y-6">
                        <div className="space-y-2">
                           <div className="flex items-center gap-2 text-xs font-black text-gray-500 uppercase tracking-widest"><User className="w-4 h-4"/> المسؤولين</div>
                           <div className="flex flex-wrap gap-2">
                             {(viewingTask.assignedToIds || [viewingTask.assignedToId]).filter(Boolean).map(id => {
                               const emp = employees.find(e => e.id === id);
                               if(!emp) return null;
                               return <span key={id} className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">{emp.name}</span>;
                             })}
                             {(!viewingTask.assignedToIds?.length && !viewingTask.assignedToId) && <span className="text-gray-400 font-medium text-sm">غير محدد</span>}
                           </div>
                        </div>
                        <DetailBlock icon={<Clock className="w-4 h-4"/>} label="المخطط الزمني" value={`${viewingTask.startDate || '؟'} - ${viewingTask.endDate || '؟'}`} />
                        <DetailBlock icon={<CheckCircle2 className="w-4 h-4"/>} label="الحالة" value={viewingTask.status} color="blue" />
                        <DetailBlock icon={<Clock className="w-4 h-4"/>} label="جهد تقديري" value={`${viewingTask.estimatedHours || 0} ساعة`} />
                        
                        <div className="pt-6 border-t border-gray-100 space-y-3">
                           <div className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">تحديث الإنجاز</div>
                           {viewingTask.status === 'Pending' && (
                             <button 
                               onClick={() => handleUpdateTaskStatus(viewingTask.id, 'In Progress', 'Began working')}
                               className="w-full py-3 bg-white text-blue-600 border border-blue-200 text-xs font-black rounded-xl hover:bg-blue-50 transition-colors"
                             >
                               بدء العمل
                             </button>
                           )}
                           {viewingTask.status === 'In Progress' && (
                             <button 
                               onClick={() => handleUpdateTaskStatus(viewingTask.id, 'Under Review', 'Ready for Review')}
                               className="w-full py-3 bg-blue-50 text-blue-600 border border-blue-100 text-xs font-black rounded-xl hover:bg-blue-100 transition-colors"
                             >
                               إرسال للمراجعة
                             </button>
                           )}
                           {viewingTask.status === 'Under Review' && (
                             <div className="flex flex-col gap-2">
                               <button onClick={() => handleUpdateTaskStatus(viewingTask.id, 'Approved', 'Approved')} className="w-full py-3 bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-black rounded-xl hover:bg-emerald-100 flex items-center justify-center gap-2"><Check className="w-4 h-4"/> قبول وإنجاز</button>
                               <button onClick={() => handleUpdateTaskStatus(viewingTask.id, 'Rejected', 'Needs more work')} className="w-full py-3 bg-red-50 border border-red-100 text-red-600 text-xs font-black rounded-xl hover:bg-red-100 flex items-center justify-center gap-2"><X className="w-4 h-4"/> رفض وإرجاع</button>
                             </div>
                           )}
                           {viewingTask.status === 'Rejected' && (
                             <button 
                               onClick={() => handleUpdateTaskStatus(viewingTask.id, 'In Progress', 'Resuming work')}
                               className="w-full py-3 bg-orange-50 text-orange-600 border border-orange-100 text-xs font-black rounded-xl hover:bg-orange-100 transition-colors"
                             >
                               إعادة العمل (تحديث بعد الرفض)
                             </button>
                           )}
                           {viewingTask.status === 'Approved' && (
                              <button 
                                onClick={() => handleUpdateTaskStatus(viewingTask.id, 'Executed', 'Executed')}
                                className="w-full py-3 bg-indigo-50 text-indigo-600 border border-indigo-100 text-xs font-black rounded-xl hover:bg-indigo-100"
                              >
                                تم التنفيذ نهائياً
                              </button>
                           )}
                        </div>
                     </div>
                  </div>

                  {/* Main Task Content */}
                  <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-10">
                     <section className="space-y-3">
                        <h4 className="text-lg font-black text-gray-900 flex items-center gap-2">
                           <FileText className="w-5 h-5 text-blue-600" />
                           وصف المهمة
                        </h4>
                        <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 text-gray-600 font-medium leading-relaxed font-sans">
                           {viewingTask.description}
                        </div>
                     </section>

                     <section className="space-y-4">
                        <div className="flex justify-between items-center px-2 font-sans">
                           <h4 className="text-lg font-black text-gray-900 flex items-center gap-2 mb-0">
                              <ListTodo className="w-5 h-5 text-emerald-600" />
                              المهمات الفرعية (Sub-tasks)
                           </h4>
                           <button 
                             className="text-xs font-black text-white bg-emerald-600 px-4 py-2 rounded-xl hover:bg-emerald-700 transition shadow-sm font-sans"
                             onClick={() => {
                               setTaskForm({
                                 title: '',
                                 description: '',
                                 phase: viewingTask.phase,
                                 subPhase: viewingTask.subPhase,
                                 assignedToIds: viewingTask.assignedToIds || (viewingTask.assignedToId ? [viewingTask.assignedToId] : []),
                                 status: 'Pending',
                                 startDate: '',
                                 endDate: '',
                                 estimatedHours: 0,
                                 parentTaskId: viewingTask.id
                               });
                               setIsTaskModalOpen(true);
                             }}
                           >
                             + إضافة مهمة فرعية كاملة
                           </button>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                           {/* Legacy SubTasks Display (Fallback) */}
                           {viewingTask.subTasks && viewingTask.subTasks.length > 0 && viewingTask.subTasks.map(st => (
                              <div key={st.id} className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl group hover:border-emerald-200 transition-all font-sans opacity-70">
                                 <button 
                                   onClick={() => handleToggleSubTask(viewingTask.id, st.id)}
                                   className={cn(
                                     "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all min-w-[1.5rem]",
                                     st.status === 'Completed' ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-200"
                                   )}
                                 >
                                    {st.status === 'Completed' && <Check className="w-4 h-4 font-sans" />}
                                 </button>
                                 <span className={cn(
                                   "font-bold text-sm font-sans flex-1",
                                   st.status === 'Completed' ? "text-gray-400 line-through" : "text-gray-700 font-sans"
                                 )}>
                                    {st.title} <span className="text-[10px] text-orange-400 border border-orange-200 bg-orange-50 px-2 py-0.5 rounded-full mr-2">نظام قديم</span>
                                 </span>
                              </div>
                           ))}

                           {/* New ProjectTask SubTasks */}
                           {projectTasks.filter(t => t.parentTaskId === viewingTask.id).map(childTask => (
                              <div 
                                key={childTask.id} 
                                onClick={() => setViewingTaskId(childTask.id)}
                                className="flex flex-col gap-2 p-4 bg-white border border-gray-200 hover:border-blue-300 rounded-2xl cursor-pointer transition-all shadow-sm font-sans"
                              >
                                 <div className="flex items-center justify-between">
                                    <h5 className="font-black text-gray-900 text-sm flex-1">{childTask.title}</h5>
                                    <span className={cn(
                                      "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter",
                                      childTask.status === 'Approved' ? "bg-emerald-50 text-emerald-600" :
                                      childTask.status === 'Rejected' ? "bg-red-50 text-red-600" :
                                      childTask.status === 'Under Review' ? "bg-orange-50 text-orange-600" : 
                                      childTask.status === 'In Progress' ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-500"
                                    )}>
                                       {childTask.status}
                                    </span>
                                 </div>
                                 <div className="flex items-center justify-between mt-1">
                                    <p className="text-xs font-bold text-gray-500 line-clamp-1">{childTask.description || 'لا يوجد وصف'}</p>
                                    <div className="flex items-center gap-3 shrink-0 mr-4">
                                       <span className="flex items-center gap-1 text-[10px] text-gray-400 font-bold"><MessageSquare className="w-3 h-3 text-indigo-400"/> {childTask.comments?.length || 0}</span>
                                       <span className="flex items-center gap-1 text-[10px] text-gray-400 font-bold"><Paperclip className="w-3 h-3 text-blue-400"/> {childTask.attachments?.length || 0}</span>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-50">
                                   <div className="flex items-center gap-2 flex-1">
                                     <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                                        <User className="w-3 h-3 text-gray-400" />
                                     </div>
                                     <p className="text-[10px] font-black text-gray-600">
                                        {employees.find(e => e.id === childTask.assignedToId)?.name || 'غير موجه'}
                                     </p>
                                   </div>
                                   {/* Quick Actions */}
                                   <div className="flex items-center gap-1">
                                     {childTask.status === 'Pending' && (
                                       <button onClick={(e) => { e.stopPropagation(); handleUpdateTaskStatus(childTask.id, 'In Progress', 'Began working'); }} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black hover:bg-blue-100">بدء العمل</button>
                                     )}
                                     {childTask.status === 'In Progress' && (
                                       <button onClick={(e) => { e.stopPropagation(); handleUpdateTaskStatus(childTask.id, 'Under Review', 'Ready'); }} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black hover:bg-indigo-100">تسليم</button>
                                     )}
                                     {childTask.status === 'Under Review' && (
                                       <>
                                         <button onClick={(e) => { e.stopPropagation(); handleUpdateTaskStatus(childTask.id, 'Approved', 'Approved'); }} className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black hover:bg-emerald-100">قبول</button>
                                         <button onClick={(e) => { e.stopPropagation(); handleUpdateTaskStatus(childTask.id, 'Rejected', 'Needs work'); }} className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-black hover:bg-red-100">رفض</button>
                                       </>
                                     )}
                                     {childTask.status === 'Rejected' && (
                                       <button onClick={(e) => { e.stopPropagation(); handleUpdateTaskStatus(childTask.id, 'In Progress', 'Update'); }} className="px-3 py-1 bg-orange-50 text-orange-600 rounded-lg text-[10px] font-black hover:bg-orange-100">إعادة العمل</button>
                                     )}
                                   </div>
                                 </div>
                              </div>
                           ))}

                           {(!viewingTask.subTasks?.length && projectTasks.filter(t => t.parentTaskId === viewingTask.id).length === 0) && (
                              <p className="text-sm text-gray-400 italic px-6 font-sans">لا توجد مهمات فرعية</p>
                           )}
                        </div>
                     </section>

                     {/* Attachments Section */}
                     <section className="space-y-4">
                        <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                           <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2 font-sans">
                              <Paperclip className="w-5 h-5 text-blue-600" />
                              المرفقات (مزامنة مع Google Drive)
                           </h4>
                           <div className="flex gap-2">
                              <button
                                onClick={() => handleAddLinkAttachment(viewingTask.id)}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
                              >
                                <ExternalLink className="w-4 h-4" /> إضافة رابط
                              </button>
                              <input 
                                type="file" 
                                id={`file-upload-${viewingTask.id}`} 
                                className="hidden" 
                                onChange={(e) => handleFileUpload(viewingTask.id, e)} 
                              />
                              <label 
                                htmlFor={`file-upload-${viewingTask.id}`}
                                className={cn(
                                   "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm cursor-pointer transition-all",
                                   uploadingFile 
                                     ? "bg-gray-200 text-gray-500 cursor-not-allowed" 
                                     : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 hover:-translate-y-0.5"
                                )}
                              >
                                {uploadingFile ? (
                                  <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span> جاري الرفع...</>
                                ) : (
                                  <><Upload className="w-4 h-4" /> رفع ملف</>
                                )}
                              </label>
                           </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {viewingTask.attachments?.map((att, idx) => (
                              <a 
                                key={idx} 
                                href={att.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl group hover:border-blue-300 hover:shadow-md transition-all font-sans"
                              >
                                 <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <FileText className="w-6 h-6" />
                                 </div>
                                 <div className="flex-1 overflow-hidden">
                                    <p className="font-bold text-sm text-gray-800 truncate">{att.name}</p>
                                    <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1">
                                      <span>{att.uploadedBy}</span>
                                      <span>•</span>
                                      <span>{new Date(att.timestamp).toLocaleDateString('ar-EG')}</span>
                                    </div>
                                 </div>
                                 <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-blue-500" />
                              </a>
                           )) || <p className="col-span-full text-sm text-gray-400 italic px-6 font-sans">لا توجد مرفقات لهذه المهمة</p>}
                        </div>
                     </section>

                     {/* Task Chat */}
                     <section className="space-y-4">
                        <h4 className="text-lg font-black text-gray-900 flex items-center gap-2 font-sans">
                           <MessageSquare className="w-5 h-5 text-indigo-600" />
                           المحادثة والتبادل الفني
                        </h4>
                        <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 space-y-6 font-sans">
                           <div className="space-y-4 max-h-[300px] overflow-y-auto no-scrollbar scroll-smooth">
                              {viewingTask.comments?.map((msg, idx) => (
                                 <div key={idx} className={cn(
                                   "flex flex-col gap-1",
                                   msg.userId === user?.uid ? "items-end" : "items-start"
                                 )}>
                                    <div className="flex items-center gap-2 px-2">
                                       <span className="text-[10px] font-black text-gray-400 font-sans">{msg.userName}</span>
                                       <span className="text-[9px] font-bold text-gray-300 font-sans">{new Date(msg.createdAt).toLocaleTimeString('ar-EG')}</span>
                                    </div>
                                    <div className={cn(
                                       "p-4 rounded-2xl max-w-[80%] text-sm font-bold shadow-sm font-sans",
                                       msg.userId === user?.uid ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white text-gray-700 border border-gray-100 rounded-tl-none font-sans"
                                    )}>
                                       {msg.text.split(' ').map((word, i) => (
                                          word.startsWith('@') ? <span key={i} className="text-yellow-300 font-black font-sans">{word} </span> : <span key={i}>{word} </span>
                                       ))}
                                    </div>
                                 </div>
                              )) || <p className="text-xs text-gray-400 text-center py-4 font-sans">ابدأ المحادثة حول هذه المهمة...</p>}
                           </div>

                           <div className="flex gap-2 relative">
                              <ChatInputWithMentions 
                                employees={employees}
                                className="flex-1 bg-white px-6 py-4 rounded-2xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm font-sans"
                                placeholder="اكتب تعليقك... استخدم @ لعمل منشن"
                                value={chatMessage}
                                onChange={setChatMessage}
                                onSend={() => handleSendChatMessage(viewingTask.id, 'task', chatMessage)}
                              />
                              <button 
                                onClick={() => handleSendChatMessage(viewingTask.id, 'task', chatMessage)}
                                className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all shrink-0"
                              >
                                 <Send className="w-5 h-5 font-sans" />
                              </button>
                           </div>
                        </div>
                     </section>
                  </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Project General Chat Modal */}
      <AnimatePresence>
         {isProjectChatOpen && selectedProject && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsProjectChatOpen(false)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" />
               <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden font-sans">
                  <div className="p-8 border-b border-gray-100 bg-emerald-50 flex justify-between items-center shrink-0">
                     <div className="flex items-center gap-4">
                        <MessageSquare className="w-8 h-8 text-emerald-600" />
                        <div>
                           <h3 className="text-2xl font-black text-gray-900 font-sans">محادثة المشروع العامة</h3>
                           <p className="text-xs font-bold text-gray-500 font-sans">{selectedProject.name}</p>
                        </div>
                     </div>
                     <button onClick={() => setIsProjectChatOpen(false)} className="p-3 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 transition-all font-sans"><X /></button>
                  </div>
                  <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto no-scrollbar scroll-smooth font-sans">
                     {selectedProject.chat?.map((msg, idx) => (
                        <div key={idx} className={cn(
                           "flex flex-col gap-1",
                           msg.userId === user?.uid ? "items-end" : "items-start"
                        )}>
                           <div className="flex items-center gap-2 px-2">
                              <span className="text-[10px] font-black text-gray-400 font-sans">{msg.userName}</span>
                              <span className="text-[9px] font-bold text-gray-300 font-sans">{new Date(msg.createdAt).toLocaleTimeString('ar-EG')}</span>
                           </div>
                           <div className={cn(
                              "p-4 rounded-2xl text-sm font-bold shadow-sm max-w-[85%] font-sans",
                              msg.userId === user?.uid ? "bg-emerald-600 text-white rounded-tr-none" : "bg-gray-50 text-gray-700 border border-gray-100 rounded-tl-none font-sans"
                           )}>
                              {msg.text}
                           </div>
                        </div>
                     )) || <p className="text-sm text-gray-400 text-center py-10 italic font-sans">لا توجد رسائل عامة بعد. ابدأ النقاش مع الفريق!</p>}
                  </div>
                  <div className="p-8 border-t border-gray-100 bg-gray-50 flex gap-2 font-sans font-sans">
                     <ChatInputWithMentions 
                       employees={employees}
                       className="flex-1 bg-white px-6 py-4 rounded-2xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500 font-bold font-sans"
                       placeholder="اكتب رسالتك العامة للفريق..."
                       value={chatMessage}
                       onChange={setChatMessage}
                       onSend={() => handleSendChatMessage(selectedProject.id, 'project', chatMessage)}
                     />
                     <button 
                       onClick={() => handleSendChatMessage(selectedProject.id, 'project', chatMessage)}
                       className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all shrink-0"
                     >
                        <Send className="w-5 h-5 font-sans" />
                     </button>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
      </div>
    );
  };

const DetailBlock: React.FC<{ icon: React.ReactNode, label: string, value: string, color?: string }> = ({ icon, label, value, color }) => (
  <div className="text-right">
    <div className="flex items-center justify-end gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
       {label}
       {icon}
    </div>
    <div className={cn(
       "text-sm font-black",
       color === 'blue' ? "text-blue-600" : "text-gray-900"
    )}>{value}</div>
  </div>
);

const TaskList: React.FC<{ 
  tasks: ProjectTask[], 
  onStatusUpdate: (id: string, s: TaskStatus, note?: string) => void,
  employees: Employee[],
  onViewDetails: (id: string) => void
}> = ({ tasks, onStatusUpdate, employees, onViewDetails }) => {
  if (tasks.length === 0) return <div className="text-center py-8 text-gray-300 italic text-sm">لا توجد مهام في هذه المرحلة</div>;

  return (
    <div className="space-y-3">
      {tasks.map(t => (
        <div 
          key={t.id} 
          onClick={() => onViewDetails(t.id)}
          className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group relative cursor-pointer"
        >
          <div className="flex justify-between items-start mb-3">
             <span className={cn(
               "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tighter",
               t.status === 'Approved' ? "bg-emerald-50 text-emerald-600" :
               t.status === 'Rejected' ? "bg-red-50 text-red-600" :
               t.status === 'Under Review' ? "bg-orange-50 text-orange-600" : 
               t.status === 'In Progress' ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-400"
             )}>
                {t.status}
             </span>
             <div className="flex flex-col items-end">
               <span className="text-[10px] font-bold text-gray-400">{t.subPhase}</span>
               {t.estimatedHours ? (
                 <span className="text-[9px] font-black text-blue-500 bg-blue-50 px-2 rounded-full mt-1">
                   {t.estimatedHours} س
                 </span>
               ) : null}
             </div>
          </div>
          <h4 className="font-black text-gray-900 mb-1 text-right">{t.title}</h4>
          <p className="text-xs text-gray-400 font-medium mb-4 line-clamp-2 text-right">{t.description}</p>
          
          <div className="flex items-center justify-between py-3 border-t border-gray-50">
             <div className="flex items-center gap-2">
               <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                  <User className="w-3 h-3 text-gray-400" />
               </div>
               <p className="text-[10px] font-black text-gray-700">
                  {t.assignedToIds && t.assignedToIds.length > 0 
                     ? employees.find(e => e.id === t.assignedToIds![0])?.name + (t.assignedToIds.length > 1 ? ` (+${t.assignedToIds.length - 1})` : '')
                     : employees.find(e => e.id === t.assignedToId)?.name || 'غير موجه'
                  }
               </p>
             </div>
             <div className="flex items-center gap-1 text-gray-300">
                <Clock className="w-3 h-3" />
                <span className="text-[9px] font-bold">
                  {t.startDate ? new Date(t.startDate).toLocaleDateString('ar-EG') : '؟'}
                </span>
             </div>
          </div>

          <div className="flex flex-col gap-2 pt-3">
             <div className="flex items-center justify-between mb-1 px-1">
                <div className="flex items-center gap-1.5">
                   {/* Here we only show old simple subtasks length in the card preview if we can't contextually fetch full subtasks length. We pass it via props or check context but simple subtasks is fine for preview or we just don't show full subtask count if we don't have projectTasks. Let's just safely show old subTasks count. */}
                   <ListTodo className="w-3 h-3 text-emerald-500" />
                   <span className="text-[10px] font-black text-gray-400">
                      {t.subTasks?.length || 0} فرعية
                   </span>
                </div>
                <div className="flex items-center gap-1.5">
                   <MessageSquare className="w-3 h-3 text-indigo-400" />
                   <span className="text-[10px] font-black text-gray-400">{t.comments?.length || 0}</span>
                </div>
             </div>
             {t.status === 'Pending' && (
               <button 
                 onClick={() => onStatusUpdate(t.id, 'In Progress', 'Began working')}
                 className="w-full py-2 bg-gray-50 text-gray-600 text-[10px] font-black rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
               >
                 بدء العمل
               </button>
             )}
             {t.status === 'In Progress' && (
               <button 
                 onClick={() => onStatusUpdate(t.id, 'Under Review', 'Ready for Review')}
                 className="w-full py-2 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg hover:bg-blue-100 transition-colors"
               >
                 إرسال للمراجعة
               </button>
             )}
             {t.status === 'Under Review' && (
               <div className="grid grid-cols-2 gap-2">
                 <button onClick={() => onStatusUpdate(t.id, 'Approved', 'Approved by lead')} className="py-2 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-lg hover:bg-emerald-100 flex items-center justify-center gap-1"><Check className="w-3 h-3"/> قبول</button>
                 <button onClick={() => onStatusUpdate(t.id, 'Rejected', 'Needs more work')} className="py-2 bg-red-50 text-red-600 text-[10px] font-black rounded-lg hover:bg-red-100 flex items-center justify-center gap-1"><X className="w-3 h-3"/> رفض</button>
               </div>
             )}
             {t.status === 'Approved' && (
                <button 
                  onClick={() => onStatusUpdate(t.id, 'Executed', 'Executed')}
                  className="w-full py-2 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg hover:bg-indigo-100"
                >
                  تم التنفيذ
                </button>
             )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Operations;