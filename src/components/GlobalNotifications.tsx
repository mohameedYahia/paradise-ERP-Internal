import React, { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquare, Bell, X } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../AuthContext';
import { TaskChatMessage } from '../types';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
}

export const GlobalNotifications: React.FC = () => {
  const { projects, projectTasks } = useData();
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const seenMessages = useRef<Set<string>>(new Set());
  const initialLoadTime = useRef<number>(Date.now());

  const myEmpId = (profile as any)?.employeeId || profile?.id;

  useEffect(() => {
    if (!user) return;

    let newNotifications: NotificationItem[] = [];

    // Helper to process messages
    const processMessages = (messages: TaskChatMessage[], titlePrefix: string, isTaskMessage: boolean) => {
      messages.forEach(msg => {
        if (!seenMessages.current.has(msg.id)) {
          seenMessages.current.add(msg.id);

          const isRecent = new Date(msg.createdAt).getTime() > initialLoadTime.current - 10000;
          if (isRecent && msg.userId !== user.uid) {
            // Check rules:
            // 1. Any message on a project
            // 2. Or a message on a task that mentions the user
            let shouldNotify = false;
            
            if (!isTaskMessage) {
              shouldNotify = true; // Project message
            } else if (isTaskMessage && (msg.mentions?.includes(myEmpId) || msg.mentions?.includes(user.uid))) {
              shouldNotify = true; // Task message with mention
            }

            if (shouldNotify) {
              newNotifications.push({
                id: msg.id + Math.random().toString(),
                title: titlePrefix + ' - ' + msg.userName,
                message: msg.text,
                timestamp: new Date()
              });
            }
          }
        }
      });
    };

    // 1. Process Project Chats
    projects.forEach(p => {
      if (p.chat) {
        processMessages(p.chat, `مشروع: ${p.name}`, false);
      }
    });

    // 2. Process Task Comments
    projectTasks.forEach(t => {
      if (t.comments) {
        processMessages(t.comments, `مهمة: ${t.title}`, true);
      }
    });

    if (newNotifications.length > 0) {
      setNotifications(prev => [...prev, ...newNotifications].slice(-5)); // Keep max 5

      try {
        const audio = new Audio('data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq');
        audio.play().catch(e => console.log("Audio play blocked by browser:", e));
      } catch (err) {}
    }

  }, [projects, projectTasks, user, myEmpId]);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Auto-remove after 6 seconds
  useEffect(() => {
    if (notifications.length > 0) {
      const timer = setTimeout(() => {
        setNotifications(prev => prev.slice(1));
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [notifications]);

  return (
    <div className="fixed bottom-6 left-6 z-[100] flex flex-col-reverse gap-3 pointer-events-none w-80">
      <AnimatePresence>
        {notifications.map((notif) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-2xl p-4 border border-gray-100 pointer-events-auto flex gap-3 overflow-hidden"
            layout
          >
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex shrink-0 items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h4 className="text-sm font-black text-gray-900 truncate">{notif.title}</h4>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                {notif.message}
              </p>
            </div>
            <button
              onClick={() => removeNotification(notif.id)}
              className="text-gray-300 hover:text-gray-500 transition-colors self-start shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
