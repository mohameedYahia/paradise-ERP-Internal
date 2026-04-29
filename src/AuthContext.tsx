import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, doc, getDoc, collection, query, where, getDocs } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Employee, AppUser } from './types';

interface AuthContextType {
  user: User | null;
  profile: Employee | AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  isHR: boolean;
  isFinance: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isHR: false,
  isFinance: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Employee | AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        const userEmail = firebaseUser.email?.toLowerCase();
        
        // 1. Check users collection by email (Internal admin users)
        if (userEmail) {
          try {
            const userDoc = await getDoc(doc(db, 'users', userEmail));
            if (userDoc.exists()) {
              let employeeId = null;
              // Attempt to find associated employee record
              try {
                const empQuery = query(collection(db, 'employees'), where('email', '==', userEmail.trim()));
                const empSnap = await getDocs(empQuery);
                if (!empSnap.empty) {
                  employeeId = empSnap.docs[0].id;
                }
              } catch(e) {}
              
              setProfile({ id: userDoc.id, employeeId, ...userDoc.data() } as AppUser & { employeeId?: string | null });
              setLoading(false);
              return;
            }
          } catch(e) {
            console.warn('Silent skip: could not read users by email', e);
          }
        }

        // 2. Check employees collection by email
        if (userEmail) {
          try {
            const empQuery = query(collection(db, 'employees'), where('email', '==', userEmail.trim()));
            const empSnap = await getDocs(empQuery);
            if (!empSnap.empty) {
              const empDoc = empSnap.docs[0];
              setProfile({ id: empDoc.id, ...empDoc.data() } as Employee);
              setLoading(false);
              return;
            }
          } catch (e) {
            console.warn('Silent skip: could not read employees by email initially', e);
          }
        }

        // 3. Fallback to employees collection by UID
        try {
          const docRef = doc(db, 'employees', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            setProfile({ id: docSnap.id, ...docSnap.data() } as Employee);
            setLoading(false);
            return;
          }
        } catch (e) {
           console.warn('Silent skip: could not read employees by UID', e);
        }

        // 3. Fallback to default admin
        if (firebaseUser.email === 'yahia1671999@gmail.com' || firebaseUser.email === 'mohameed.yahia1@gmail.com') {
          setProfile({
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'Admin',
            role: 'Admin',
            status: 'Active',
            email: firebaseUser.email,
          } as any);
        } else {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const isAdmin = profile?.role === 'Admin' || user?.email?.toLowerCase() === 'yahia1671999@gmail.com' || user?.email?.toLowerCase() === 'mohameed.yahia1@gmail.com';
  const isHR = profile?.role === 'HR' || isAdmin;
  const isFinance = profile?.role === 'Finance' || isAdmin;

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isHR, isFinance }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
