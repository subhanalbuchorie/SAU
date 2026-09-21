import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sidebar,
  Header,
  DashboardView,
  StudentsView,
  ClassesView,
  RoomsView,
  SubjectsView,
  SupervisorsView,
  SettingsView,
  SchedulesView,
  RoomMappingView,
  ExamMinutesView,
  AttendanceView,
  MakeUpExamsView,
  ReportsView,
  AuditLogView,
  ArchitectureDocModal,
  Breadcrumbs
} from './components';
import { StorageService } from './lib/storage';
import {
  User,
  UserRole,
  Student,
  ClassItem,
  Room,
  Subject,
  Supervisor,
  ExamSchedule,
  ExamMinute,
  StudentAttendance,
  MakeUpExamRecord,
  SchoolSetting,
  AuditLog
} from './types';
import { Sparkles, Database, AlertTriangle, Lock, Eye, EyeOff, ShieldCheck, X } from 'lucide-react';

export default function App() {
  // Mode Default saat aplikasi dibuka berada di Akun Pengawas
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const defaultUser = StorageService.getCurrentUser();
    if (defaultUser.role !== 'PENGAWAS') {
      const users = StorageService.getUsers();
      const pengawas = users.find((u) => u.role === 'PENGAWAS') || {
        id: 'user-4',
        username: 'pengawas',
        fullName: 'Pengawas Ruang',
        role: 'PENGAWAS' as UserRole,
        isActive: true
      };
      StorageService.setCurrentUser(pengawas);
      return pengawas;
    }
    return defaultUser;
  });

  const [currentView, setCurrentView] = useState('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('exam_admin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);

  // Admin Password Verification Modal state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [pendingTargetRole, setPendingTargetRole] = useState<UserRole | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Toggle sidebar for both mobile drawer and desktop collapse
  const handleToggleSidebar = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsMobileSidebarOpen((prev) => !prev);
    } else {
      setIsDesktopSidebarCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('exam_admin_sidebar_collapsed', String(next));
        } catch {}
        return next;
      });
    }
  }, []);

  // Core Data State
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [minutes, setMinutes] = useState<ExamMinute[]>([]);
  const [attendances, setAttendances] = useState<StudentAttendance[]>([]);
  const [makeUpExams, setMakeUpExams] = useState<MakeUpExamRecord[]>([]);
  const [settings, setSettings] = useState<SchoolSetting>(StorageService.getSettings());
  const [logs, setLogs] = useState<AuditLog[]>([]);

  // Function to refresh all state from StorageService
  const refreshAllData = useCallback(() => {
    setStudents(StorageService.getStudents());
    setClasses(StorageService.getClasses());
    setRooms(StorageService.getRooms());
    setSubjects(StorageService.getSubjects());
    setSupervisors(StorageService.getSupervisors());
    setSchedules(StorageService.getSchedules());
    setMinutes(StorageService.getExamMinutes());
    setAttendances(StorageService.getStudentAttendances());
    setMakeUpExams(StorageService.getMakeUpExams());
    setSettings(StorageService.getSettings());
    setLogs(StorageService.getAuditLogs());
  }, []);

  // Initialize data on mount and listen to real-time storage updates
  useEffect(() => {
    StorageService.initStorage();
    refreshAllData();

    const handleStorageUpdate = () => {
      refreshAllData();
    };

    window.addEventListener('storage-updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('storage-updated', handleStorageUpdate);
    };
  }, [refreshAllData]);

  // Role switch handler
  const handleRoleChange = (role: UserRole) => {
    if (role === currentUser.role) return;

    // If switching from PENGAWAS to an Admin/Panitia/Operator role, require Admin Password
    if (role !== 'PENGAWAS' && currentUser.role === 'PENGAWAS') {
      setPendingTargetRole(role);
      setPasswordInput('');
      setPasswordError(null);
      setIsPasswordModalOpen(true);
      return;
    }

    // Direct switch (e.g. going back to PENGAWAS)
    const updated = StorageService.setCurrentUserRole(role);
    setCurrentUser(updated);

    // If supervisor tries to view admin-only settings or schedules, redirect to attendance
    if (role === 'PENGAWAS' && ['settings', 'audit', 'schedules'].includes(currentView)) {
      setCurrentView('attendance');
    }
  };

  const handleVerifyAdminPassword = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPassword = settings.adminPassword || 'admin123';
    if (passwordInput.trim() === correctPassword.trim()) {
      if (pendingTargetRole) {
        const updated = StorageService.setCurrentUserRole(pendingTargetRole);
        setCurrentUser(updated);
      }
      setIsPasswordModalOpen(false);
      setPasswordInput('');
      setPasswordError(null);
    } else {
      setPasswordError('Password admin salah! Silakan masukkan password yang tepat (diatur di Pengaturan Umum).');
    }
  };

  // Reset demo data handler
  const handleResetData = () => {
    if (window.confirm('Apakah Anda yakin ingin me-reset seluruh data ke data demo awal? Semua perubahan akan dikembalikan.')) {
      StorageService.resetToInitialData();
      refreshAllData();
      setCurrentView('dashboard');
    }
  };

  // Real-time conflict count across all schedules
  const conflictCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < schedules.length; i++) {
      for (let j = i + 1; j < schedules.length; j++) {
        const a = schedules[i];
        const b = schedules[j];
        if (a.date === b.date && a.roomId === b.roomId) {
          const overlap = a.startTime < b.endTime && a.endTime > b.startTime;
          if (overlap) count++;
        }
      }
    }
    return count;
  }, [schedules]);

  // Breadcrumb generation
  const breadcrumbItems = useMemo(() => {
    const viewLabels: Record<string, string> = {
      dashboard: 'Dashboard',
      schedules: 'Jadwal Ujian',
      students: 'Data Siswa',
      classes: 'Data Kelas',
      rooms: 'Data Ruang Ujian',
      subjects: 'Data Mata Pelajaran',
      supervisors: 'Data Pengawas',
      minutes: 'Berita Acara Ujian',
      attendance: 'Daftar Hadir',
      makeup: 'Daftar Siswa Susulan',
      reports: 'Laporan & Cetak',
      audit: 'Audit Log & Backup',
      settings: 'Pengaturan Sekolah'
    };

    if (currentView === 'dashboard') {
      return [{ label: 'Dashboard' }];
    }
    return [
      { label: 'Administrasi Ujian', onClick: () => setCurrentView('dashboard') },
      { label: viewLabels[currentView] || currentView }
    ];
  }, [currentView]);

  return (
    <div className="h-screen print:h-auto bg-slate-100 print:bg-white flex flex-col antialiased text-slate-800 overflow-hidden print:overflow-visible">
      {/* Top Application Header */}
      <Header
        currentUser={currentUser}
        onRoleChange={handleRoleChange}
        settings={settings}
        onToggleSidebar={handleToggleSidebar}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        conflictCount={conflictCount}
        onOpenDocModal={() => setIsDocModalOpen(true)}
      />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden print:overflow-visible print:block">
        {/* Navigation Sidebar */}
        <Sidebar
          currentView={currentView}
          onNavigate={(view) => {
            setCurrentView(view);
            setIsMobileSidebarOpen(false);
          }}
          userRole={currentUser.role}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          isCollapsed={isDesktopSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
          onOpenDocModal={() => setIsDocModalOpen(true)}
        />

        {/* Dynamic Content Viewport */}
        <main className="flex-1 overflow-y-auto print:overflow-visible p-4 md:p-6 lg:p-8 print:p-0 print:m-0 space-y-5 print:space-y-0">
          {/* Breadcrumbs & Quick Notification bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 no-print">
            <Breadcrumbs items={breadcrumbItems} />

            {/* Quick architectural badge */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsDocModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Desain Multi-Kelas / Multi-Mapel</span>
              </button>

              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-200/80 text-slate-700 text-xs font-mono">
                <Database className="w-3 h-3 text-slate-500" />
                PostgreSQL Ready
              </span>
            </div>
          </div>

          {/* Active View Router */}
          {currentView === 'dashboard' && (
            <DashboardView
              students={students}
              classes={classes}
              rooms={rooms}
              subjects={subjects}
              supervisors={supervisors}
              schedules={schedules}
              minutes={minutes}
              settings={settings}
              onNavigate={setCurrentView}
            />
          )}

          {currentView === 'room-mapping' && (
            <RoomMappingView
              rooms={rooms}
              students={students}
              classes={classes}
              settings={settings}
              onRefresh={refreshAllData}
              onNavigateToSchedules={() => setCurrentView('schedules')}
            />
          )}

          {currentView === 'schedules' && (
            <SchedulesView
              schedules={schedules}
              rooms={rooms}
              classes={classes}
              subjects={subjects}
              supervisors={supervisors}
              students={students}
              settings={settings}
              onRefresh={refreshAllData}
              onNavigateToRoomMapping={() => setCurrentView('room-mapping')}
            />
          )}

          {currentView === 'students' && (
            <StudentsView
              students={students}
              classes={classes}
              settings={settings}
              onRefresh={refreshAllData}
            />
          )}

          {currentView === 'classes' && (
            <ClassesView
              classes={classes}
              students={students}
              onRefresh={refreshAllData}
            />
          )}

          {currentView === 'rooms' && (
            <RoomsView
              rooms={rooms}
              schedules={schedules}
              onRefresh={refreshAllData}
              onNavigateToMapping={() => setCurrentView('room-mapping')}
            />
          )}

          {currentView === 'subjects' && (
            <SubjectsView
              subjects={subjects}
              onRefresh={refreshAllData}
            />
          )}

          {currentView === 'supervisors' && (
            <SupervisorsView
              supervisors={supervisors}
              schedules={schedules}
              onRefresh={refreshAllData}
            />
          )}

          {currentView === 'minutes' && (
            <ExamMinutesView
              minutes={minutes}
              schedules={schedules}
              rooms={rooms}
              classes={classes}
              subjects={subjects}
              supervisors={supervisors}
              students={students}
              attendances={attendances}
              settings={settings}
              onRefresh={refreshAllData}
            />
          )}

          {currentView === 'attendance' && (
            <AttendanceView
              schedules={schedules}
              rooms={rooms}
              classes={classes}
              subjects={subjects}
              supervisors={supervisors}
              students={students}
              attendances={attendances}
              settings={settings}
              onRefresh={refreshAllData}
            />
          )}

          {currentView === 'makeup' && (
            <MakeUpExamsView
              makeUpExams={makeUpExams}
              schedules={schedules}
              rooms={rooms}
              classes={classes}
              subjects={subjects}
              supervisors={supervisors}
              students={students}
              attendances={attendances}
              minutes={minutes}
              settings={settings}
              onRefresh={refreshAllData}
            />
          )}

          {currentView === 'reports' && (
            <ReportsView
              schedules={schedules}
              rooms={rooms}
              classes={classes}
              subjects={subjects}
              supervisors={supervisors}
              students={students}
              minutes={minutes}
              attendances={attendances}
              settings={settings}
            />
          )}

          {currentView === 'audit' && (
            <AuditLogView
              logs={logs}
              currentUser={currentUser}
              onRefresh={refreshAllData}
              onResetData={handleResetData}
            />
          )}

          {currentView === 'settings' && (
            <SettingsView
              settings={settings}
              students={students}
              classes={classes}
              onSaveSettings={(newSettings) => {
                StorageService.saveSettings(newSettings);
                refreshAllData();
              }}
              onRefresh={refreshAllData}
            />
          )}
        </main>
      </div>

      {/* Architecture & ERD Documentation Modal */}
      <ArchitectureDocModal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
      />

      {/* Admin Password Verification Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-indigo-700">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Verifikasi Sandi Administrator</h3>
                  <p className="text-[11px] text-slate-500">Konfirmasi hak akses ke mode Admin / Pengelola</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsPasswordModalOpen(false);
                  setPasswordError(null);
                  setPasswordInput('');
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleVerifyAdminPassword} className="mt-4 space-y-4">
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 leading-relaxed">
                Mode awal aplikasi adalah <strong>Akun Pengawas</strong>. Untuk beralih ke hak akses <strong>{pendingTargetRole || 'ADMIN'}</strong>, silakan masukkan password admin yang telah dikonfigurasi di Pengaturan Umum.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password Admin <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    placeholder="Masukkan password admin..."
                    autoFocus
                    required
                    className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-xs text-rose-600 mt-1.5 flex items-center gap-1 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {passwordError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsPasswordModalOpen(false);
                    setPasswordError(null);
                    setPasswordInput('');
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Buka Akses Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
