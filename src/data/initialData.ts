import {
  SchoolSetting,
  Room,
  ClassItem,
  Subject,
  Supervisor,
  Student,
  ExamSchedule,
  ExamMinute,
  StudentAttendance,
  User,
  AuditLog
} from '../types';

export const initialSchoolSetting: SchoolSetting = {
  id: 'school-1',
  schoolName: 'SEKOLAH / MADRASAH',
  npsn: '',
  nss: '',
  address: '',
  village: '',
  district: '',
  city: '',
  province: '',
  postalCode: '',
  email: '',
  phone: '',
  website: '',
  principalName: '',
  principalNip: '',
  committeeHeadName: '',
  committeeHeadNip: '',
  academicYear: '2025/2026',
  semester: 'Genap',
  examName: 'UJIAN SEKOLAH (US)',
  logoUrl: '',
  examStartDate: new Date().toISOString().split('T')[0],
  examEndDate: new Date().toISOString().split('T')[0],
  examNumberFormat: '{seq:3}/{kelas}/US/{tahun}',
  updatedAt: new Date().toISOString()
};

// Clean initial data - No dummy data
export const initialRooms: Room[] = [];
export const initialClasses: ClassItem[] = [];
export const initialSubjects: Subject[] = [];
export const initialSupervisors: Supervisor[] = [];
export const initialStudents: Student[] = [];
export const initialSchedules: ExamSchedule[] = [];
export const initialExamMinutes: ExamMinute[] = [];
export const initialStudentAttendances: StudentAttendance[] = [];

export const initialUsers: User[] = [
  {
    id: 'user-1',
    username: 'admin',
    fullName: 'Administrator Utama',
    role: 'ADMIN',
    isActive: true
  },
  {
    id: 'user-2',
    username: 'panitia',
    fullName: 'Ketua Panitia Ujian',
    role: 'PANITIA',
    isActive: true
  },
  {
    id: 'user-3',
    username: 'operator',
    fullName: 'Operator Data Ujian',
    role: 'OPERATOR',
    isActive: true
  },
  {
    id: 'user-4',
    username: 'pengawas',
    fullName: 'Pengawas Ruang',
    role: 'PENGAWAS',
    isActive: true
  }
];

export const initialAuditLogs: AuditLog[] = [
  {
    id: 'log-init',
    userId: 'user-1',
    username: 'admin',
    action: 'Inisialisasi Sistem',
    entity: 'System',
    details: 'Sistem administrasi ujian sekolah siap digunakan. Silakan impor atau masukkan data master.',
    timestamp: new Date().toISOString()
  }
];
