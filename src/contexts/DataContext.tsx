import React, { createContext, useContext, useEffect, useState } from 'react';
import { db, collection, doc, onSnapshot, OperationType, auth, FirestoreErrorInfo, query, where } from '../firebase';
import { 
  Employee, 
  Transaction, 
  PayrollRun, 
  AllowanceType, 
  AppUser, 
  AttendanceRecord, 
  AttendanceDevice, 
  AttendanceShift,
  AbsenceType,
  AbsenceRecord,
  MissionType,
  Mission,
  Project,
  ProjectTask,
  AdministrativeDepartment,
  LeaveRequest
} from '../types';
import { useAuth } from '../AuthContext';

interface DataContextType {
  employees: Employee[];
  transactions: Transaction[];
  payrollRuns: PayrollRun[];
  allowanceTypes: AllowanceType[];
  appUsers: AppUser[];
  attendanceRecords: AttendanceRecord[];
  attendanceDevices: AttendanceDevice[];
  attendanceShifts: AttendanceShift[];
  absenceTypes: AbsenceType[];
  absenceRecords: AbsenceRecord[];
  missionTypes: MissionType[];
  missions: Mission[];
  projects: Project[];
  projectTasks: ProjectTask[];
  adminDepartments: AdministrativeDepartment[];
  leaveRequests: LeaveRequest[];
  loading: boolean;
  error: FirestoreErrorInfo | null;
}

const DataContext = createContext<DataContextType>({
  employees: [],
  transactions: [],
  payrollRuns: [],
  allowanceTypes: [],
  appUsers: [],
  attendanceRecords: [],
  attendanceDevices: [],
  attendanceShifts: [],
  absenceTypes: [],
  absenceRecords: [],
  missionTypes: [],
  missions: [],
  projects: [],
  projectTasks: [],
  adminDepartments: [],
  leaveRequests: [],
  loading: true,
  error: null,
});

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [allowanceTypes, setAllowanceTypes] = useState<AllowanceType[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceDevices, setAttendanceDevices] = useState<AttendanceDevice[]>([]);
  const [attendanceShifts, setAttendanceShifts] = useState<AttendanceShift[]>([]);
  const [absenceTypes, setAbsenceTypes] = useState<AbsenceType[]>([]);
  const [absenceRecords, setAbsenceRecords] = useState<AbsenceRecord[]>([]);
  const [missionTypes, setMissionTypes] = useState<MissionType[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [adminDepartments, setAdminDepartments] = useState<AdministrativeDepartment[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreErrorInfo | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const handleLocalError = (err: unknown, op: OperationType, path: string) => {
      // Ignore permission errors for users if we're not admin (though we guard the snapshot now)
      if (path === 'users' && !isAdmin) return;

      try {
        const errInfo: FirestoreErrorInfo = {
          error: err instanceof Error ? err.message : String(err),
          authInfo: {
            userId: auth.currentUser?.uid,
            email: auth.currentUser?.email,
            emailVerified: auth.currentUser?.emailVerified,
            isAnonymous: auth.currentUser?.isAnonymous,
            tenantId: auth.currentUser?.tenantId,
            providerInfo: auth.currentUser?.providerData.map(provider => ({
              providerId: provider.providerId,
              displayName: provider.displayName,
              email: provider.email,
              photoUrl: provider.photoURL
            })) || []
          },
          operationType: op,
          path
        };
        setError(errInfo);
      } catch (e) {
        console.error('Failed to handle firestore error:', e);
      }
    };

    // Determine roles
    const hrOrAdmin = isAdmin || profile?.role === 'HR';
    const financeOrAdmin = isAdmin || profile?.role === 'Finance' || profile?.role === 'HR'; // Finance or HR or Admin
    const isBasicUser = !hrOrAdmin && !financeOrAdmin;
    const actualEmployeeId = (profile as any)?.employeeId || (profile?.role ? null : profile?.id) || user?.uid;

    let unsubEmployees = () => {};
    if (hrOrAdmin || financeOrAdmin) {
      unsubEmployees = onSnapshot(collection(db, 'employees'), (snap) => {
        setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
      }, (err) => handleLocalError(err, OperationType.LIST, 'employees'));
    } else if (user?.email) {
      unsubEmployees = onSnapshot(query(collection(db, 'employees'), where('email', '==', user.email.trim())), (snap) => {
        setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
      }, (err) => handleLocalError(err, OperationType.LIST, 'employees'));
    }

    let unsubTransactions = () => {};
    if (financeOrAdmin || hrOrAdmin) {
      unsubTransactions = onSnapshot(collection(db, 'transactions'), (snap) => {
        setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      }, (err) => handleLocalError(err, OperationType.LIST, 'transactions'));
    } else if (actualEmployeeId) {
      unsubTransactions = onSnapshot(query(collection(db, 'transactions'), where('employeeId', '==', actualEmployeeId)), (snap) => {
        setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      }, (err) => handleLocalError(err, OperationType.LIST, 'transactions'));
    }

    let unsubPayrollRuns = () => {};
    if (financeOrAdmin) {
      unsubPayrollRuns = onSnapshot(collection(db, 'payrollRuns'), (snap) => {
        setPayrollRuns(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollRun)));
      }, (err) => handleLocalError(err, OperationType.LIST, 'payrollRuns'));
    }

    const unsubAllowanceTypes = onSnapshot(collection(db, 'allowanceTypes'), (snap) => {
      setAllowanceTypes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AllowanceType)));
    }, (err) => handleLocalError(err, OperationType.LIST, 'allowanceTypes'));

    // Users can only be read by Admin
    let unsubUsers = () => {};
    if (isAdmin) {
      unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
        setAppUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
      }, (err) => handleLocalError(err, OperationType.LIST, 'users'));
    }

    // Projects and tasks
    const unsubProjects = onSnapshot(collection(db, 'projects'), (snap) => {
        setProjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    }, (err) => handleLocalError(err, OperationType.LIST, 'projects'));

    let unsubProjectTasks = () => {};
    if (profile?.id) {
        unsubProjectTasks = onSnapshot(collection(db, 'projectTasks'), (snap) => {
            setProjectTasks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectTask)));
        }, (err) => handleLocalError(err, OperationType.LIST, 'projectTasks'));
    }

    let unsubMissions = () => {};
    if (hrOrAdmin) {
        unsubMissions = onSnapshot(collection(db, 'missions'), (snap) => {
            setMissions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Mission)));
        }, (err) => handleLocalError(err, OperationType.LIST, 'missions'));
    } else if (actualEmployeeId) {
        unsubMissions = onSnapshot(query(collection(db, 'missions'), where('employeeId', '==', actualEmployeeId)), (snap) => {
            setMissions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Mission)));
        }, (err) => handleLocalError(err, OperationType.LIST, 'missions'));
    }

    let unsubAbsenceRecords = () => {};
    if (hrOrAdmin) {
        unsubAbsenceRecords = onSnapshot(collection(db, 'absenceRecords'), (snap) => {
            setAbsenceRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AbsenceRecord)));
        }, (err) => handleLocalError(err, OperationType.LIST, 'absenceRecords'));
    } else if (actualEmployeeId) {
        unsubAbsenceRecords = onSnapshot(query(collection(db, 'absenceRecords'), where('employeeId', '==', actualEmployeeId)), (snap) => {
            setAbsenceRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AbsenceRecord)));
        }, (err) => handleLocalError(err, OperationType.LIST, 'absenceRecords'));
    }

    let unsubLeaveRequests = () => {};
    if (hrOrAdmin) {
        unsubLeaveRequests = onSnapshot(collection(db, 'leaveRequests'), (snap) => {
            setLeaveRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest)));
        }, (err) => handleLocalError(err, OperationType.LIST, 'leaveRequests'));
    } else if (actualEmployeeId) {
        unsubLeaveRequests = onSnapshot(query(collection(db, 'leaveRequests'), where('employeeId', '==', actualEmployeeId)), (snap) => {
            setLeaveRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest)));
        }, (err) => handleLocalError(err, OperationType.LIST, 'leaveRequests'));
    }

    let unsubAttendanceRecords = () => {};
    if (hrOrAdmin) {
        unsubAttendanceRecords = onSnapshot(collection(db, 'attendanceRecords'), (snap) => {
            setAttendanceRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord)));
        }, (err) => handleLocalError(err, OperationType.LIST, 'attendanceRecords'));
    } else if (actualEmployeeId) {
        unsubAttendanceRecords = onSnapshot(query(collection(db, 'attendanceRecords'), where('employeeId', '==', actualEmployeeId)), (snap) => {
            setAttendanceRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord)));
        }, (err) => handleLocalError(err, OperationType.LIST, 'attendanceRecords'));
    }


    const unsubAttendanceDevices = onSnapshot(collection(db, 'attendanceDevices'), (snap) => {
      setAttendanceDevices(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceDevice)));
    }, (err) => handleLocalError(err, OperationType.LIST, 'attendanceDevices'));

    const unsubAttendanceShifts = onSnapshot(collection(db, 'attendanceShifts'), (snap) => {
      setAttendanceShifts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceShift)));
    }, (err) => handleLocalError(err, OperationType.LIST, 'attendanceShifts'));

    const unsubAbsenceTypes = onSnapshot(collection(db, 'absenceTypes'), (snap) => {
      setAbsenceTypes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AbsenceType)));
    }, (err) => handleLocalError(err, OperationType.LIST, 'absenceTypes'));

    const unsubMissionTypes = onSnapshot(collection(db, 'missionTypes'), (snap) => {
      setMissionTypes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MissionType)));
    }, (err) => handleLocalError(err, OperationType.LIST, 'missionTypes'));

    const unsubAdminDepartments = onSnapshot(collection(db, 'adminDepartments'), (snap) => {
      setAdminDepartments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdministrativeDepartment)));
    }, (err) => handleLocalError(err, OperationType.LIST, 'adminDepartments'));

    const timer = setTimeout(() => setLoading(false), 2000);

    return () => {
      unsubEmployees();
      unsubTransactions();
      unsubPayrollRuns();
      unsubAllowanceTypes();
      unsubUsers();
      unsubAttendanceRecords();
      unsubAttendanceDevices();
      unsubAttendanceShifts();
      unsubAbsenceTypes();
      unsubAbsenceRecords();
      unsubMissionTypes();
      unsubMissions();
      unsubProjects();
      unsubProjectTasks();
      unsubLeaveRequests();
      unsubAdminDepartments();
      clearTimeout(timer);
    };
  }, [user, isAdmin]);

  if (error) {
    throw new Error(JSON.stringify(error));
  }

  return (
    <DataContext.Provider value={{ 
      employees, 
      transactions, 
      payrollRuns, 
      allowanceTypes, 
      appUsers, 
      attendanceRecords,
      attendanceDevices,
      attendanceShifts,
      absenceTypes,
      absenceRecords,
      missionTypes,
      missions,
      projects,
      projectTasks,
      adminDepartments,
      leaveRequests,
      loading, 
      error 
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);
