import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, ShieldCheck, Mail, Lock, UserPlus } from 'lucide-react';
import { signInWithPopup, googleProvider, auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '../firebase';

export const Login: React.FC = () => {
  const [isLoginState, setIsLoginState] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setError('');
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      setError(error.message || 'حدث خطأ في تسجيل الدخول');
      console.error('Google Login failed', error);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      if (isLoginState) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message || 'فشلت العملية، تأكد من صحة بياناتك');
      console.error('Email Auth failed', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]" dir="rtl">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-3xl opacity-50" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-50 rounded-full blur-3xl opacity-50" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative max-w-md w-full mx-4"
      >
        <div className="bg-white rounded-[2rem] shadow-2xl shadow-blue-100/50 p-10 border border-white/20 backdrop-blur-sm">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200 rotate-3">
              <ShieldCheck className="w-10 h-10 text-white -rotate-3" />
            </div>
            <h1 className="text-4xl font-black text-gray-900 mb-3 tracking-tight">Salarix</h1>
            <p className="text-gray-500 font-medium">نظام إدارة الموارد والرواتب المتكامل</p>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  required
                  className="w-full pl-4 pr-12 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  placeholder="البريد الإلكتروني"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  dir="ltr"
                />
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  required
                  className="w-full pl-4 pr-12 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  placeholder="كلمة المرور"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                />
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-red-500 text-xs font-bold bg-red-50 p-3 rounded-lg overflow-hidden">
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : isLoginState ? (
                <>تسجيل الدخول <LogIn className="w-5 h-5" /></>
              ) : (
                <>إنشاء الحساب <UserPlus className="w-5 h-5" /></>
              )}
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => { setIsLoginState(!isLoginState); setError(''); }}
                className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors"
              >
                {isLoginState ? "ليس لديك حساب؟ قم بإنشاء حساب جديد" : "لديك حساب بالفعل؟ قم بتسجيل الدخول"}
              </button>
            </div>
          </form>

          <div className="space-y-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-4 text-gray-400 font-semibold tracking-wider">أو</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full group relative flex items-center justify-center gap-3 py-4 px-6 bg-white hover:bg-gray-50 text-gray-700 font-bold rounded-2xl border-2 border-gray-100 transition-all duration-300 hover:border-blue-200 hover:shadow-md active:scale-[0.98]"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" referrerPolicy="no-referrer" />
              <span>متابعة بواسطة جوجل</span>
            </button>
          </div>

          <p className="mt-8 text-center text-[10px] text-gray-400 font-medium">
            سيتم ربط حسابك بملف الموظف بناءً على بريدك الإلكتروني
            <br />
            &copy; {new Date().getFullYear()} Salarix System
          </p>
        </div>
      </motion.div>
    </div>
  );
};
