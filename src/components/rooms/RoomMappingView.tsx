import React, { useState, useMemo } from 'react';
import {
  DoorOpen,
  Users,
  Sparkles,
  RotateCcw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Printer,
  ChevronDown,
  ChevronUp,
  X,
  CheckSquare,
  Square,
  Layers,
  GraduationCap,
  Building,
  Info,
  ArrowRight,
  ShieldCheck,
  CalendarCheck,
  SlidersHorizontal,
  ArrowRightLeft,
  UserX,
  UserCheck,
  ShieldAlert,
  Check,
  HelpCircle,
  Hash
} from 'lucide-react';
import { Room, Student, ClassItem, SchoolSetting, ExamSchedule } from '../../types';
import { StorageService } from '../../lib/storage';
import { PrintHeader } from '../common/PrintHeader';
import { triggerA4Print } from '../../lib/sessionHelper';

interface RoomMappingViewProps {
  rooms: Room[];
  students: Student[];
  classes: ClassItem[];
  schedules?: ExamSchedule[];
  settings: SchoolSetting;
  onRefresh: () => void;
  onNavigateToSchedule?: () => void;
  onNavigateToSchedules?: () => void;
}

export const RoomMappingView: React.FC<RoomMappingViewProps> = ({
  rooms,
  students,
  classes,
  schedules = [],
  settings,
  onRefresh,
  onNavigateToSchedule,
  onNavigateToSchedules
}) => {
  const navigateToScheduleHandler = onNavigateToSchedule || onNavigateToSchedules;

  // Tabs
  const [activeTab, setActiveTab] = useState<'ROOMS' | 'UNMAPPED' | 'AUDIT'>('ROOMS');

  // Filters for Main View
  const [searchTerm, setSearchTerm] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MAPPED' | 'UNMAPPED' | 'FULL' | 'PARTIAL' | 'EMPTY'>('ALL');
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);

  // Multi-Room Setup Wizard Modal State
  const [isMultiRoomModalOpen, setIsMultiRoomModalOpen] = useState(false);
  const [setupMode, setSetupMode] = useState<'ROMBEL' | 'CROSS_CLASS' | 'ALPHABETICAL'>('ROMBEL');
  const [selectedSetupRoomIds, setSelectedSetupRoomIds] = useState<string[]>([]);
  const [selectedSetupClassIds, setSelectedSetupClassIds] = useState<string[]>([]);

  // Manual Room Assignment Modal State
  const [selectedRoomForAssign, setSelectedRoomForAssign] = useState<Room | null>(null);
  const [modalSelectedIds, setModalSelectedIds] = useState<string[]>([]);
  const [modalClassFilter, setModalClassFilter] = useState<string>('ALL');
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [modalGenderFilter, setModalGenderFilter] = useState<'ALL' | 'L' | 'P'>('ALL');
  const [modalStatusFilter, setModalStatusFilter] = useState<'ALL' | 'UNMAPPED' | 'OTHER' | 'CURRENT'>('ALL');

  // Print DNR State
  const [printRoom, setPrintRoom] = useState<Room | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  // User Feedback Messages
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Lookup Maps
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const roomMap = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);

  // All available rooms (both mapped and unmapped, sorted by code)
  const activeRooms = useMemo(() => {
    return rooms
      .slice()
      .sort((a, b) => a.code.localeCompare(b.code, 'id', { numeric: true }));
  }, [rooms]);

  // Active students only
  const activeStudents = useMemo(() => {
    return students.filter((s) => s.status === 'AKTIF');
  }, [students]);

  // Total seat capacity
  const totalCapacity = useMemo(() => {
    return activeRooms.reduce((acc, r) => acc + (r.capacity || 0), 0);
  }, [activeRooms]);

  // Room students resolution: Room ID -> Student[]
  const roomStudentsMap = useMemo(() => {
    const map = new Map<string, Student[]>();
    activeRooms.forEach((r) => {
      const roomStudents = StorageService.getStudentsForRoom(r.id);
      map.set(r.id, roomStudents);
    });
    return map;
  }, [activeRooms, students]);

  // Counts of mapped vs unmapped rooms
  const mappedRoomsCount = useMemo(() => {
    return activeRooms.filter((r) => (roomStudentsMap.get(r.id) || []).length > 0).length;
  }, [activeRooms, roomStudentsMap]);

  const unmappedRoomsCount = activeRooms.length - mappedRoomsCount;

  // Set of all mapped student IDs
  const allMappedStudentIds = useMemo(() => {
    const set = new Set<string>();
    roomStudentsMap.forEach((stus) => {
      stus.forEach((s) => set.add(s.id));
    });
    return set;
  }, [roomStudentsMap]);

  const totalMappedStudents = allMappedStudentIds.size;
  const unmappedStudentsCount = Math.max(0, activeStudents.length - totalMappedStudents);
  const fillPercentage = activeStudents.length > 0 ? Math.round((totalMappedStudents / activeStudents.length) * 100) : 0;

  // Unmapped students list
  const unmappedStudents = useMemo(() => {
    return activeStudents.filter((s) => !allMappedStudentIds.has(s.id));
  }, [activeStudents, allMappedStudentIds]);

  // Real-time Collision Detector: checks if any student is assigned to more than 1 room
  const collisionIssues = useMemo(() => {
    const studentOccurrences = new Map<string, { roomCode: string; roomName: string }[]>();
    activeRooms.forEach((r) => {
      const stus = roomStudentsMap.get(r.id) || [];
      stus.forEach((s) => {
        const list = studentOccurrences.get(s.id) || [];
        list.push({ roomCode: r.code, roomName: r.name });
        studentOccurrences.set(s.id, list);
      });
    });

    const conflicts: { student: Student; rooms: { roomCode: string; roomName: string }[] }[] = [];
    studentOccurrences.forEach((roomList, sid) => {
      if (roomList.length > 1) {
        const stu = studentMap.get(sid);
        if (stu) conflicts.push({ student: stu, rooms: roomList });
      }
    });
    return conflicts;
  }, [activeRooms, roomStudentsMap, studentMap]);

  // Unique buildings
  const uniqueBuildings = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach((r) => {
      if (r.building) set.add(r.building);
    });
    return Array.from(set);
  }, [rooms]);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return activeRooms.filter((r) => {
      const matchSearch =
        r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.building.toLowerCase().includes(searchTerm.toLowerCase());
      const matchBuilding = buildingFilter === 'ALL' || r.building === buildingFilter;

      const stus = roomStudentsMap.get(r.id) || [];
      const isMapped = stus.length > 0;
      const isFull = stus.length >= r.capacity;
      const isEmpty = stus.length === 0;
      const isPartial = stus.length > 0 && stus.length < r.capacity;

      let matchStatus = true;
      if (statusFilter === 'MAPPED') matchStatus = isMapped;
      else if (statusFilter === 'UNMAPPED') matchStatus = !isMapped;
      else if (statusFilter === 'FULL') matchStatus = isFull;
      else if (statusFilter === 'EMPTY') matchStatus = isEmpty;
      else if (statusFilter === 'PARTIAL') matchStatus = isPartial;

      return matchSearch && matchBuilding && matchStatus;
    });
  }, [activeRooms, searchTerm, buildingFilter, statusFilter, roomStudentsMap]);

  // Open Multi-Room Setup Wizard
  const handleOpenMultiRoomSetup = () => {
    setSelectedSetupRoomIds(activeRooms.map((r) => r.id));
    setSelectedSetupClassIds(classes.map((c) => c.id));
    setSetupMode('ROMBEL');
    setIsMultiRoomModalOpen(true);
  };

  // Execute Multi-Room Setup Wizard
  const handleApplyMultiRoomSetup = () => {
    if (selectedSetupRoomIds.length === 0) {
      alert('Pilih setidaknya 1 ruang ujian aktif.');
      return;
    }
    if (selectedSetupClassIds.length === 0) {
      alert('Pilih setidaknya 1 rombel / kelas.');
      return;
    }

    const res = StorageService.setupAllRoomsMapping({
      mode: setupMode,
      roomIds: selectedSetupRoomIds,
      classIds: selectedSetupClassIds
    });

    setIsMultiRoomModalOpen(false);
    onRefresh();

    if (res.success) {
      setSuccessMessage(res.message);
    } else {
      setErrorMessage(res.message);
    }

    setTimeout(() => {
      setSuccessMessage(null);
      setErrorMessage(null);
    }, 5000);
  };

  // Auto-Repair collisions
  const handleAutoResolveConflicts = () => {
    const res = StorageService.validateAndCleanRoomMappings();
    onRefresh();
    if (res.fixedCount > 0) {
      setSuccessMessage(`Berhasil memperbaiki ${res.fixedCount} siswa yang terdaftar ganda. Seluruh ruang kini 100% bebas bentrok!`);
    } else {
      setSuccessMessage('Data pemetaan ruang sudah valid dan bebas dari bentrok.');
    }
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Move single student to another room (or unassign)
  const handleMoveStudent = (studentId: string, targetRoomId: string | null) => {
    const res = StorageService.moveStudentRoom(studentId, targetRoomId);
    onRefresh();
    if (res.success) {
      setSuccessMessage(res.message);
    } else {
      setErrorMessage(res.message);
    }
    setTimeout(() => {
      setSuccessMessage(null);
      setErrorMessage(null);
    }, 3500);
  };

  // Clear all mappings
  const handleClearAllMappings = () => {
    if (totalMappedStudents === 0) {
      alert('Belum ada pemetaan siswa di ruang ujian.');
      return;
    }
    if (
      window.confirm(
        'Yakin ingin mengosongkan SELURUH mapping siswa di semua ruang? Seluruh siswa akan dikembalikan ke status belum terpetakan.'
      )
    ) {
      const res = StorageService.clearRoomStudentMappings();
      onRefresh();
      setSuccessMessage(res.message);
      setTimeout(() => setSuccessMessage(null), 3500);
    }
  };

  // Open modal to assign students to a specific room
  const handleOpenAssignModal = (room: Room) => {
    setSelectedRoomForAssign(room);
    const existing = roomStudentsMap.get(room.id) || [];
    setModalSelectedIds(existing.map((s) => s.id));
    setModalClassFilter('ALL');
    setModalSearchTerm('');
    setModalGenderFilter('ALL');
    setModalStatusFilter('ALL');
  };

  // Save modal assignment
  const handleSaveModalAssignment = () => {
    if (!selectedRoomForAssign) return;
    const res = StorageService.saveRoomStudentMapping(selectedRoomForAssign.id, modalSelectedIds);
    setSelectedRoomForAssign(null);
    onRefresh();
    if (res.success) {
      setSuccessMessage(res.message);
    } else {
      setErrorMessage(res.message);
    }
    setTimeout(() => {
      setSuccessMessage(null);
      setErrorMessage(null);
    }, 4500);
  };

  // Clear single room
  const handleClearSingleRoom = (room: Room) => {
    if (window.confirm(`Kosongkan siswa dari ruang ${room.code} (${room.name})?`)) {
      const res = StorageService.clearRoomStudentMappings(room.id);
      onRefresh();
      setSuccessMessage(res.message);
      setTimeout(() => setSuccessMessage(null), 3500);
    }
  };

  // Print room DNR
  const handlePrintDNR = (room?: Room) => {
    setPrintRoom(room || null);
    setIsPrinting(true);
    setTimeout(() => {
      triggerA4Print();
      setIsPrinting(false);
    }, 500);
  };

  // Students available for the active modal with enhanced filtering
  const modalAvailableStudents = useMemo(() => {
    if (!selectedRoomForAssign) return [];
    return activeStudents.filter((stu) => {
      // Search
      if (modalSearchTerm.trim()) {
        const q = modalSearchTerm.toLowerCase();
        const matchName = stu.name.toLowerCase().includes(q);
        const matchNis = (stu.nis || '').toLowerCase().includes(q);
        const matchExam = (stu.examNumber || '').toLowerCase().includes(q);
        if (!matchName && !matchNis && !matchExam) return false;
      }

      // Class filter
      if (modalClassFilter !== 'ALL' && stu.classId !== modalClassFilter) {
        return false;
      }

      // Gender filter
      if (modalGenderFilter !== 'ALL' && stu.gender !== modalGenderFilter) {
        return false;
      }

      // Status filter
      if (modalStatusFilter === 'UNMAPPED' && (stu.roomId || modalSelectedIds.includes(stu.id))) {
        return false;
      }
      if (modalStatusFilter === 'OTHER' && (!stu.roomId || stu.roomId === selectedRoomForAssign.id)) {
        return false;
      }
      if (modalStatusFilter === 'CURRENT' && !modalSelectedIds.includes(stu.id)) {
        return false;
      }

      return true;
    });
  }, [activeStudents, selectedRoomForAssign, modalSearchTerm, modalClassFilter, modalGenderFilter, modalStatusFilter, modalSelectedIds]);

  // Statistics for the Multi-Room Setup Modal preview
  const setupPreviewStats = useMemo(() => {
    const selectedRooms = activeRooms.filter((r) => selectedSetupRoomIds.includes(r.id));
    const totalSelectedCapacity = selectedRooms.reduce((acc, r) => acc + (r.capacity || 0), 0);

    const eligibleStudents = activeStudents.filter((s) => selectedSetupClassIds.includes(s.classId));
    const totalEligibleStudents = eligibleStudents.length;

    const willFit = totalEligibleStudents <= totalSelectedCapacity;
    const remainingEmptySeats = Math.max(0, totalSelectedCapacity - totalEligibleStudents);
    const unplacedStudents = Math.max(0, totalEligibleStudents - totalSelectedCapacity);

    return {
      selectedRoomCount: selectedRooms.length,
      totalSelectedCapacity,
      totalEligibleStudents,
      willFit,
      remainingEmptySeats,
      unplacedStudents
    };
  }, [activeRooms, selectedSetupRoomIds, activeStudents, selectedSetupClassIds]);

  return (
    <div className="space-y-6">
      {/* Top Title & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <DoorOpen className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg md:text-xl font-bold text-slate-900">
              Mapping Siswa Ruang
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar seluruh ruangan yang tersedia (baik yang sudah atau belum dimapping).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="px-3 py-1.5 bg-slate-100 rounded-xl text-slate-700 font-medium border border-slate-200/60">
            Total Ruang: <strong className="text-slate-900 font-bold">{activeRooms.length}</strong>
          </div>
          <div className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Sudah Dimapping: <strong>{mappedRoomsCount}</strong>
          </div>
          <div className="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Belum Dimapping: <strong>{unmappedRoomsCount}</strong>
          </div>
        </div>
      </div>

      {/* Collision Alert Banner (Shows only if collisions are detected) */}
      {collisionIssues.length > 0 && (
        <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-rose-900">
                Peringatan: Ditemukan {collisionIssues.length} Siswa yang Terdaftar di Lebih dari Satu Ruangan!
              </h4>
              <p className="text-xs text-rose-700 mt-0.5">
                Sistem mendeteksi adanya data ganda. Klik tombol di samping untuk merapikan otomatis sehingga setiap siswa hanya berada di satu ruang ujian.
              </p>
            </div>
          </div>
          <button
            onClick={handleAutoResolveConflicts}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all shrink-0 cursor-pointer"
          >
            Perbaiki Bentrok Otomatis (1-Klik)
          </button>
        </div>
      )}

      {/* Feedback Messages */}
      {successMessage && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-sm font-medium animate-fadeIn shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-sm font-medium animate-fadeIn shadow-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('ROOMS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'ROOMS'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <DoorOpen className="w-4 h-4" />
          Pemetaan per Ruang ({activeRooms.length})
        </button>

        <button
          onClick={() => setActiveTab('UNMAPPED')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'UNMAPPED'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <UserX className="w-4 h-4" />
          Siswa Belum Terpetakan
          <span
            className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
              unmappedStudentsCount > 0
                ? activeTab === 'UNMAPPED'
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-amber-100 text-amber-800'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {unmappedStudentsCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'AUDIT'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Audit Bebas Bentrok
          {collisionIssues.length > 0 && (
            <span className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-black rounded-full animate-pulse">
              {collisionIssues.length} Bentrok
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: Pemetaan per Ruang */}
      {activeTab === 'ROOMS' && (
        <div className="space-y-4">
          {/* Toolbar Filters */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari ruang, kode, gedung..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={buildingFilter}
                  onChange={(e) => setBuildingFilter(e.target.value)}
                  className="py-2 px-2.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="ALL">Semua Gedung</option>
                  {uniqueBuildings.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="py-2 px-2.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white font-medium text-slate-700"
              >
                <option value="ALL">Semua Ruangan ({activeRooms.length})</option>
                <option value="MAPPED">Sudah Dimapping ({mappedRoomsCount})</option>
                <option value="UNMAPPED">Belum Dimapping ({unmappedRoomsCount})</option>
                <option value="FULL">Penuh (Kapasitas Tercapai)</option>
                <option value="PARTIAL">Terisi Sebagian</option>
                <option value="EMPTY">Masih Kosong</option>
              </select>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              {totalMappedStudents > 0 && (
                <button
                  onClick={handleClearAllMappings}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                  title="Kosongkan seluruh penataan siswa pada semua ruangan"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                  Reset Semua Mapping
                </button>
              )}
            </div>
          </div>

          {/* Room Cards Grid */}
          {filteredRooms.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs">
              <DoorOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">Tidak ada ruang ujian yang sesuai kriteria</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Pastikan Anda telah mendaftarkan Master Ruang berstatus Aktif di menu Master Ruang.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredRooms.map((room) => {
                const roomStudents = roomStudentsMap.get(room.id) || [];
                const capacity = room.capacity || 30;
                const isFull = roomStudents.length >= capacity;
                const isExpanded = expandedRoomId === room.id;

                // Class breakdown in this room
                const classCounts = new Map<string, number>();
                roomStudents.forEach((stu) => {
                  const cls = classMap.get(stu.classId);
                  const name = cls?.name || 'Tanpa Kelas';
                  classCounts.set(name, (classCounts.get(name) || 0) + 1);
                });

                return (
                  <div
                    key={room.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col overflow-hidden"
                  >
                    {/* Room Card Header */}
                    <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/70">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-blue-600 text-white font-mono text-[11px] font-bold rounded-md">
                            {room.code}
                          </span>
                          <h3 className="font-bold text-sm text-slate-800">{room.name}</h3>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                          <Building className="w-3 h-3 text-slate-400 shrink-0" />
                          {room.building} (Lantai {room.floor})
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        {roomStudents.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Sudah Dimapping
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Belum Dimapping
                          </span>
                        )}
                        <div className="text-[11px] font-semibold text-slate-500 mt-1">
                          {roomStudents.length} / {capacity} Meja
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar & Class Badges */}
                    <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        {/* Capacity visual bar */}
                        <div>
                          <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                            <span>Kapasitas Kursi Terisi</span>
                            <span className="font-semibold text-slate-700">
                              {Math.round((roomStudents.length / capacity) * 100)}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isFull
                                  ? 'bg-emerald-500'
                                  : roomStudents.length > 0
                                  ? 'bg-blue-600'
                                  : 'bg-transparent'
                              }`}
                              style={{ width: `${Math.min(100, (roomStudents.length / capacity) * 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Classes badge breakdown */}
                        <div>
                          <span className="text-[11px] font-medium text-slate-500 block mb-1">
                            Komposisi Rombel:
                          </span>
                          {classCounts.size === 0 ? (
                            <p className="text-xs text-slate-400 italic">Belum ada siswa yang dipetakan.</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {Array.from(classCounts.entries()).map(([clsName, count]) => (
                                <span
                                  key={clsName}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-medium border border-slate-200"
                                >
                                  <GraduationCap className="w-3 h-3 text-slate-500" />
                                  {clsName}: <strong className="text-slate-900">{count}</strong>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions Footer */}
                      <div className="pt-3 border-t border-slate-100 space-y-2">
                        <button
                          id={`btn-sesuaikan-siswa-${room.id}`}
                          onClick={() => handleOpenAssignModal(room)}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer"
                          title={`Sesuaikan siswa untuk ${room.name}`}
                        >
                          <Users className="w-4 h-4" />
                          Sesuaikan Siswa
                        </button>

                        <div className="flex items-center justify-between gap-2 pt-0.5 text-xs">
                          <button
                            onClick={() => handlePrintDNR(room)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-medium border border-slate-200 transition-colors cursor-pointer"
                            title="Cetak Daftar Nominasi Peserta Ruang (DNR)"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Cetak DNR
                          </button>

                          <div className="flex items-center gap-1.5">
                            {roomStudents.length > 0 && (
                              <button
                                onClick={() => handleClearSingleRoom(room)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Kosongkan siswa dari ruang ini"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => setExpandedRoomId(isExpanded ? null : room.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-medium border border-slate-200 transition-colors cursor-pointer"
                              title={isExpanded ? 'Tutup Daftar Meja' : 'Buka Daftar Meja Siswa'}
                            >
                              <span>{isExpanded ? 'Tutup Meja' : 'Lihat Meja'}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Student List Table with Individual Re-adjustment */}
                    {isExpanded && (
                      <div className="bg-slate-50 border-t border-slate-200 p-3 max-h-72 overflow-y-auto">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-800">
                            Daftar Nomor Meja Peserta ({roomStudents.length} Siswa)
                          </span>
                          <span className="text-[10px] text-slate-500">Berlaku untuk semua hari ujian</span>
                        </div>

                        {roomStudents.length === 0 ? (
                          <p className="text-xs text-slate-400 py-4 text-center">Ruangan ini belum terisi siswa.</p>
                        ) : (
                          <table className="w-full text-[11px] border-collapse bg-white rounded border border-slate-200">
                            <thead>
                              <tr className="bg-slate-100 text-slate-700">
                                <th className="p-1 border-b border-slate-200 text-center w-8">Meja</th>
                                <th className="p-1 border-b border-slate-200 text-center w-16">No. Ujian</th>
                                <th className="p-1 border-b border-slate-200 text-left">Nama Siswa</th>
                                <th className="p-1 border-b border-slate-200 text-center w-14">Kelas</th>
                                <th className="p-1 border-b border-slate-200 text-center w-28">Pindahkan Ke</th>
                                <th className="p-1 border-b border-slate-200 text-center w-8">Aksi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {roomStudents.map((stu, sIdx) => {
                                const cls = classMap.get(stu.classId);
                                return (
                                  <tr key={stu.id} className="hover:bg-blue-50/50 border-b border-slate-100">
                                    <td className="p-1 text-center font-bold text-blue-700 bg-blue-50/50 font-mono">
                                      {sIdx + 1}
                                    </td>
                                    <td className="p-1 text-center font-mono font-medium text-slate-600">
                                      {stu.examNumber || stu.nis}
                                    </td>
                                    <td className="p-1 font-medium text-slate-800 truncate max-w-[120px]">
                                      {stu.name}
                                    </td>
                                    <td className="p-1 text-center font-medium text-slate-600">
                                      {cls?.name || '-'}
                                    </td>
                                    <td className="p-1 text-center">
                                      <select
                                        defaultValue=""
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            handleMoveStudent(stu.id, e.target.value);
                                            e.target.value = '';
                                          }
                                        }}
                                        className="w-full text-[10px] py-0.5 px-1 bg-white border border-slate-300 rounded text-slate-700 focus:ring-1 focus:ring-blue-500"
                                      >
                                        <option value="" disabled>Pilih Ruang...</option>
                                        {activeRooms
                                          .filter((r) => r.id !== room.id)
                                          .map((otherRoom) => {
                                            const otherCount = (roomStudentsMap.get(otherRoom.id) || []).length;
                                            return (
                                              <option key={otherRoom.id} value={otherRoom.id}>
                                                {otherRoom.code} ({otherCount}/{otherRoom.capacity})
                                              </option>
                                            );
                                          })}
                                      </select>
                                    </td>
                                    <td className="p-1 text-center">
                                      <button
                                        onClick={() => handleMoveStudent(stu.id, null)}
                                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                        title="Keluarkan siswa dari ruang ini"
                                      >
                                        <UserX className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Siswa Belum Terpetakan */}
      {activeTab === 'UNMAPPED' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <UserX className="w-5 h-5 text-amber-600" />
                Daftar Siswa Belum Memiliki Ruang Ujian ({unmappedStudents.length} Siswa)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Siswa di bawah ini belum dialokasikan ke meja/ruang ujian manapun. Anda dapat memasukkannya langsung ke ruang yang masih memiliki sisa meja.
              </p>
            </div>

            {unmappedStudents.length > 0 && (
              <button
                onClick={handleOpenMultiRoomSetup}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
              >
                <Sparkles className="w-4 h-4 text-blue-200" />
                Alokasikan via Auto-Setup
              </button>
            )}
          </div>

          {unmappedStudents.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-800">Semua Siswa Telah Terpetakan!</h4>
              <p className="text-xs text-slate-500 mt-1">
                100% siswa aktif telah memiliki nomor meja dan ruang ujian yang tertib dan bebas bentrok.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                    <th className="p-3 text-center w-12">No</th>
                    <th className="p-3 text-center w-28">No. Peserta</th>
                    <th className="p-3 text-center w-24">NIS</th>
                    <th className="p-3">Nama Lengkap</th>
                    <th className="p-3 text-center w-12">L/P</th>
                    <th className="p-3 text-center w-28">Kelas</th>
                    <th className="p-3 text-center w-48">Masukkan ke Ruang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unmappedStudents.map((stu, idx) => {
                    const cls = classMap.get(stu.classId);
                    return (
                      <tr key={stu.id} className="hover:bg-slate-50">
                        <td className="p-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                        <td className="p-3 text-center font-mono font-medium text-slate-700">
                          {stu.examNumber || '-'}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-500">{stu.nis}</td>
                        <td className="p-3 font-semibold text-slate-800">{stu.name}</td>
                        <td className="p-3 text-center text-slate-500">{stu.gender}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium border border-slate-200">
                            {cls?.name || '-'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                handleMoveStudent(stu.id, e.target.value);
                                e.target.value = '';
                              }
                            }}
                            className="w-full text-xs py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                          >
                            <option value="" disabled>Pilih Ruang Ujian...</option>
                            {activeRooms.map((r) => {
                              const rCount = (roomStudentsMap.get(r.id) || []).length;
                              const isFull = rCount >= r.capacity;
                              return (
                                <option key={r.id} value={r.id} disabled={isFull}>
                                  {r.code} - {r.name} ({rCount}/{r.capacity} Meja) {isFull ? '• PENUH' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Audit Bebas Bentrok */}
      {activeTab === 'AUDIT' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  Pemeriksaan Audit Integritas Data Pemetaan Ruang
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Memastikan setiap siswa terdaftar di maksimal 1 ruangan dan nomor meja terurut teratur tanpa duplikasi atau bentrok.
                </p>
              </div>

              <button
                onClick={handleAutoResolveConflicts}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Jalankan Ulang Audit & Perbaikan
              </button>
            </div>

            {/* Collision Result Card */}
            <div className="mt-5">
              {collisionIssues.length === 0 ? (
                <div className="p-6 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-900 flex items-start gap-4">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm">Status Data: 100% Bersih & Bebas Bentrok</h4>
                    <p className="text-xs text-emerald-700 mt-1">
                      Tidak ditemukan satu pun siswa yang berada di dua ruang berbeda sekaligus. Seluruh nomor meja peserta bersifat independen dan siap digunakan untuk pencetakan DNR maupun kartu ujian.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                      <span className="text-xs font-bold">
                        Terdeteksi {collisionIssues.length} siswa bentrok (terdaftar ganda).
                      </span>
                    </div>
                    <button
                      onClick={handleAutoResolveConflicts}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow-xs transition-all cursor-pointer"
                    >
                      Perbaiki Otomatis Sekarang
                    </button>
                  </div>

                  <table className="w-full text-xs border-collapse border border-slate-200 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700">
                        <th className="p-2 border border-slate-200 text-center w-12">No</th>
                        <th className="p-2 border border-slate-200 text-left">Nama Siswa</th>
                        <th className="p-2 border border-slate-200 text-center w-24">NIS</th>
                        <th className="p-2 border border-slate-200 text-left">Ruangan Bentrok</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collisionIssues.map((issue, idx) => (
                        <tr key={issue.student.id} className="hover:bg-rose-50/50">
                          <td className="p-2 border border-slate-200 text-center">{idx + 1}</td>
                          <td className="p-2 border border-slate-200 font-medium text-slate-800">{issue.student.name}</td>
                          <td className="p-2 border border-slate-200 text-center font-mono">{issue.student.nis}</td>
                          <td className="p-2 border border-slate-200 text-rose-700 font-semibold">
                            {issue.rooms.map((r) => `${r.roomCode} (${r.roomName})`).join(' vs ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Room Summary Breakdown Table */}
            <div className="mt-6">
              <h4 className="font-bold text-xs text-slate-800 mb-3">Ringkasan Keterisian Seluruh Ruang Ujian:</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse border border-slate-200">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700">
                      <th className="p-2.5 border border-slate-200 text-center w-12">No</th>
                      <th className="p-2.5 border border-slate-200 text-center w-20">Kode</th>
                      <th className="p-2.5 border border-slate-200 text-left">Nama Ruangan</th>
                      <th className="p-2.5 border border-slate-200 text-center w-24">Kapasitas</th>
                      <th className="p-2.5 border border-slate-200 text-center w-24">Terisi</th>
                      <th className="p-2.5 border border-slate-200 text-center w-24">Sisa Meja</th>
                      <th className="p-2.5 border border-slate-200 text-center w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRooms.map((r, idx) => {
                      const count = (roomStudentsMap.get(r.id) || []).length;
                      const cap = r.capacity || 30;
                      const sisa = cap - count;
                      const isFull = count >= cap;
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/80">
                          <td className="p-2 border border-slate-200 text-center font-mono">{idx + 1}</td>
                          <td className="p-2 border border-slate-200 text-center font-mono font-bold text-blue-700">
                            {r.code}
                          </td>
                          <td className="p-2 border border-slate-200 font-medium text-slate-800">
                            {r.name} ({r.building})
                          </td>
                          <td className="p-2 border border-slate-200 text-center font-mono">{cap}</td>
                          <td className="p-2 border border-slate-200 text-center font-mono font-bold text-slate-900">
                            {count}
                          </td>
                          <td className="p-2 border border-slate-200 text-center font-mono text-slate-600">
                            {sisa > 0 ? sisa : 0}
                          </td>
                          <td className="p-2 border border-slate-200 text-center">
                            {isFull ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                                Penuh
                              </span>
                            ) : count > 0 ? (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-medium text-[10px]">
                                Tersedia {sisa} Meja
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">
                                Kosong
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Wizard Pengaturan Mapping Sekaligus (1-Kali Setup Seluruh Ruang) */}
      {isMultiRoomModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200 text-[11px] font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-blue-300" />
                  Alokasi Otomatis Bebas Bentrok
                </div>
                <h2 className="text-lg font-black text-white mt-1">
                  Atur Mapping Siswa Sekaligus (Seluruh Ruang)
                </h2>
                <p className="text-xs text-blue-200/80 mt-0.5">
                  Pengaturan ini dilakukan satu kali dan otomatis berlaku untuk seluruh hari ujian.
                </p>
              </div>

              <button
                onClick={() => setIsMultiRoomModalOpen(false)}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
              {/* Step 1: Distribution Method */}
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-2">
                  1. Pilih Strategi Distribusi Siswa ke Meja / Ruangan:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div
                    onClick={() => setSetupMode('ROMBEL')}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                      setupMode === 'ROMBEL'
                        ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-slate-900 text-xs">Urut Rombel</span>
                      {setupMode === 'ROMBEL' && <Check className="w-4 h-4 text-blue-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Siswa disusun berurutan per kelas (X-A, X-B..) mengisi ruang secara sekuensial.
                    </p>
                  </div>

                  <div
                    onClick={() => setSetupMode('CROSS_CLASS')}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                      setupMode === 'CROSS_CLASS'
                        ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-slate-900 text-xs">Silang Kelas</span>
                      {setupMode === 'CROSS_CLASS' && <Check className="w-4 h-4 text-blue-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Menyilangkan siswa antar-kelas pada meja bersebelahan untuk mencegah kecurangan.
                    </p>
                  </div>

                  <div
                    onClick={() => setSetupMode('ALPHABETICAL')}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                      setupMode === 'ALPHABETICAL'
                        ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-slate-900 text-xs">Urut No. Peserta</span>
                      {setupMode === 'ALPHABETICAL' && <Check className="w-4 h-4 text-blue-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Disusun merata berdasarkan nomor peserta ujian atau abjad nama lengkap.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2: Target Rooms Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-900">
                    2. Ruang Ujian yang Digunakan ({selectedSetupRoomIds.length} dari {activeRooms.length} Ruang):
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSelectedSetupRoomIds(activeRooms.map((r) => r.id))}
                      className="text-blue-600 hover:underline font-medium cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedSetupRoomIds([])}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      Hapus Pilihan
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {activeRooms.map((r) => {
                    const isChecked = selectedSetupRoomIds.includes(r.id);
                    return (
                      <label
                        key={r.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked ? 'bg-blue-50 border-blue-300 text-blue-900' : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSetupRoomIds([...selectedSetupRoomIds, r.id]);
                            } else {
                              setSelectedSetupRoomIds(selectedSetupRoomIds.filter((id) => id !== r.id));
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-mono font-bold">{r.code}</span>
                        <span className="truncate">({r.capacity} Meja)</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Target Classes Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-900">
                    3. Rombel / Kelas yang Diikutsertakan ({selectedSetupClassIds.length} dari {classes.length} Kelas):
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSelectedSetupClassIds(classes.map((c) => c.id))}
                      className="text-blue-600 hover:underline font-medium cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedSetupClassIds([])}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      Hapus Pilihan
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {classes.map((c) => {
                    const isChecked = selectedSetupClassIds.includes(c.id);
                    const stuCount = activeStudents.filter((s) => s.classId === c.id).length;
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked ? 'bg-blue-50 border-blue-300 text-blue-900' : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSetupClassIds([...selectedSetupClassIds, c.id]);
                            } else {
                              setSelectedSetupClassIds(selectedSetupClassIds.filter((id) => id !== c.id));
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-semibold">{c.name}</span>
                        <span className="text-[10px] text-slate-500">({stuCount} Siswa)</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Live Preview / Capacity Calculation */}
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-bold text-slate-900">Kalkulasi Kapasitas:</p>
                  <p className="text-xs text-slate-600">
                    Siswa Terpilih: <strong>{setupPreviewStats.totalEligibleStudents}</strong> orang • Total Kapasitas Meja: <strong>{setupPreviewStats.totalSelectedCapacity}</strong> kursi
                  </p>
                </div>

                <div>
                  {setupPreviewStats.willFit ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Kapasitas Cukup (Sisa {setupPreviewStats.remainingEmptySeats} Meja)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-900 font-bold rounded-lg text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      Kurang {setupPreviewStats.unplacedStudents} Meja
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                Data akan dipetakan secara tertib dan bebas bentrok.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMultiRoomModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleApplyMultiRoomSetup}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Terapkan Mapping Sekarang
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Sesuaikan Siswa Ruang Ini (Manual Single-Room Adjustment) */}
      {selectedRoomForAssign && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-blue-600 text-white font-mono text-xs font-bold rounded">
                    {selectedRoomForAssign.code}
                  </span>
                  <h2 className="text-lg font-black text-white">
                    Penyesuaian Siswa: {selectedRoomForAssign.name}
                  </h2>
                </div>
                <p className="text-xs text-blue-200 mt-1">
                  Kapasitas Ruang: <strong>{selectedRoomForAssign.capacity} Meja</strong> • Siswa Terpilih:{' '}
                  <strong className={modalSelectedIds.length > selectedRoomForAssign.capacity ? 'text-amber-300' : 'text-emerald-300'}>
                    {modalSelectedIds.length} Siswa
                  </strong>{' '}
                  (Berlaku untuk seluruh hari ujian)
                </p>
              </div>

              <button
                onClick={() => setSelectedRoomForAssign(null)}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Bar */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="relative w-44">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                    placeholder="Cari nama / NIS..."
                    className="w-full pl-8 pr-2 py-1.5 bg-white rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <select
                  value={modalClassFilter}
                  onChange={(e) => setModalClassFilter(e.target.value)}
                  className="py-1.5 px-2 bg-white rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Semua Kelas</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <select
                  value={modalStatusFilter}
                  onChange={(e) => setModalStatusFilter(e.target.value as any)}
                  className="py-1.5 px-2 bg-white rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Semua Status Ruang</option>
                  <option value="UNMAPPED">Belum Memiliki Ruang</option>
                  <option value="CURRENT">Sudah di Ruang Ini</option>
                  <option value="OTHER">Di Ruang Lain (Bisa Dipindahkan)</option>
                </select>
              </div>

              {/* Quick Select Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const availableIds = modalAvailableStudents.map((s) => s.id);
                    const merged = Array.from(new Set([...modalSelectedIds, ...availableIds]));
                    setModalSelectedIds(merged);
                  }}
                  className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-md border border-blue-200 transition-colors cursor-pointer"
                >
                  Pilih Semua yang Tampil
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const capacity = selectedRoomForAssign.capacity || 30;
                    const needed = Math.max(0, capacity - modalSelectedIds.length);
                    const unselected = modalAvailableStudents
                      .filter((s) => !modalSelectedIds.includes(s.id))
                      .slice(0, needed)
                      .map((s) => s.id);
                    setModalSelectedIds([...modalSelectedIds, ...unselected]);
                  }}
                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-md border border-emerald-200 transition-colors cursor-pointer"
                >
                  Isi Sesuai Kapasitas
                </button>
                <button
                  type="button"
                  onClick={() => setModalSelectedIds([])}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-md transition-colors cursor-pointer"
                >
                  Kosongkan
                </button>
              </div>
            </div>

            {/* Zero Collision Notice */}
            <div className="px-4 py-2 bg-blue-50/70 border-b border-blue-100 text-blue-800 text-[11px] flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>
                <strong>Jaminan Bebas Bentrok:</strong> Siswa yang dipilih dari ruang lain akan otomatis dipindahkan ke ruang ini dan dikeluarkan dari ruang lamanya.
              </span>
            </div>

            {/* Warning if over capacity */}
            {modalSelectedIds.length > selectedRoomForAssign.capacity && (
              <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Perhatian: Jumlah siswa terpilih ({modalSelectedIds.length}) melebihi kapasitas standar meja ({selectedRoomForAssign.capacity}).
                </span>
              </div>
            )}

            {/* Students List Table */}
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                    <th className="p-2 text-center w-10">Pilih</th>
                    <th className="p-2 text-center w-12">No. Meja</th>
                    <th className="p-2 text-center w-24">No. Peserta</th>
                    <th className="p-2 text-center w-20">NIS</th>
                    <th className="p-2 text-left">Nama Lengkap</th>
                    <th className="p-2 text-center w-10">L/P</th>
                    <th className="p-2 text-left w-24">Kelas</th>
                    <th className="p-2 text-center w-36">Status Ruang</th>
                  </tr>
                </thead>
                <tbody>
                  {modalAvailableStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-400 italic">
                        Tidak ada siswa yang sesuai kriteria pencarian/filter.
                      </td>
                    </tr>
                  ) : (
                    modalAvailableStudents.map((stu) => {
                      const isSelected = modalSelectedIds.includes(stu.id);
                      const seatNumber = isSelected ? modalSelectedIds.indexOf(stu.id) + 1 : null;
                      const cls = classMap.get(stu.classId);

                      // Check if this student is currently assigned to another room
                      let currentAssignedRoomName = null;
                      if (stu.roomId && stu.roomId !== selectedRoomForAssign.id) {
                        const otherRoom = roomMap.get(stu.roomId);
                        if (otherRoom) currentAssignedRoomName = otherRoom.code;
                      }

                      return (
                        <tr
                          key={stu.id}
                          onClick={() => {
                            if (isSelected) {
                              setModalSelectedIds(modalSelectedIds.filter((id) => id !== stu.id));
                            } else {
                              setModalSelectedIds([...modalSelectedIds, stu.id]);
                            }
                          }}
                          className={`cursor-pointer border-b border-slate-100 transition-colors ${
                            isSelected ? 'bg-blue-50/70 font-semibold' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="p-2 text-center">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600 inline-block" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 inline-block" />
                            )}
                          </td>
                          <td className="p-2 text-center font-mono font-bold text-blue-700">
                            {seatNumber ? `Meja ${seatNumber}` : '-'}
                          </td>
                          <td className="p-2 text-center font-mono text-slate-600">
                            {stu.examNumber || '-'}
                          </td>
                          <td className="p-2 text-center text-slate-500 font-mono">{stu.nis}</td>
                          <td className="p-2 text-slate-800">{stu.name}</td>
                          <td className="p-2 text-center text-slate-500">{stu.gender}</td>
                          <td className="p-2 text-slate-600">{cls?.name || '-'}</td>
                          <td className="p-2 text-center">
                            {isSelected ? (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-bold">
                                Ruang Ini (Meja {seatNumber})
                              </span>
                            ) : currentAssignedRoomName ? (
                              <span
                                className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-medium"
                                title="Siswa ini ada di ruang lain. Jika dicentang, akan dipindahkan ke sini."
                              >
                                Di {currentAssignedRoomName} (Pindah)
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Belum Ada Ruang</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                Total dipilih: <strong>{modalSelectedIds.length}</strong> siswa dari{' '}
                <strong>{selectedRoomForAssign.capacity}</strong> kapasitas meja.
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRoomForAssign(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveModalAssignment}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  Simpan Mapping Ruang
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable DNR (A4 Format) */}
      <div id="print-container" className="hidden print:block font-serif text-black p-4">
        {(printRoom ? [printRoom] : activeRooms).map((room) => {
          const roomStudents = roomStudentsMap.get(room.id) || [];
          return (
            <div key={room.id} className="mb-8 print-avoid-break">
              <PrintHeader
                settings={settings}
                documentTitle="DAFTAR NOMINASI PESERTA UJIAN PER RUANG (DNR)"
                documentSubtitle={`Tahun Pelajaran ${settings.academicYear} • Berlaku untuk Seluruh Hari Ujian`}
              />

              <div className="my-3 flex justify-between items-center text-xs border-b border-black pb-1.5">
                <div>
                  <p><strong>Ruang:</strong> {room.code} - {room.name} ({room.building})</p>
                  <p><strong>Kapasitas:</strong> {room.capacity} Meja</p>
                </div>
                <div className="text-right">
                  <p><strong>Total Peserta Terdaftar:</strong> {roomStudents.length} Siswa</p>
                  <p><strong>Status:</strong> Mapping Tetap (Semua Hari)</p>
                </div>
              </div>

              <table className="w-full border-collapse border border-black text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-black p-1 text-center w-8">No</th>
                    <th className="border border-black p-1 text-center w-12">Meja</th>
                    <th className="border border-black p-1 text-center w-28">No. Peserta</th>
                    <th className="border border-black p-1 text-center w-20">NIS</th>
                    <th className="border border-black p-1 text-left">Nama Lengkap Siswa</th>
                    <th className="border border-black p-1 text-center w-10">L/P</th>
                    <th className="border border-black p-1 text-center w-20">Kelas</th>
                    <th className="border border-black p-1 text-center w-24">Tanda Tangan</th>
                  </tr>
                </thead>
                <tbody>
                  {roomStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="border border-black p-4 text-center italic text-gray-500">
                        Belum ada peserta yang dialokasikan pada ruangan ini.
                      </td>
                    </tr>
                  ) : (
                    roomStudents.map((stu, idx) => {
                      const cls = classMap.get(stu.classId);
                      return (
                        <tr key={stu.id}>
                          <td className="border border-black p-1 text-center">{idx + 1}</td>
                          <td className="border border-black p-1 text-center font-bold font-mono">
                            {idx + 1}
                          </td>
                          <td className="border border-black p-1 text-center font-mono">
                            {stu.examNumber || '-'}
                          </td>
                          <td className="border border-black p-1 text-center font-mono">{stu.nis}</td>
                          <td className="border border-black p-1 font-medium">{stu.name}</td>
                          <td className="border border-black p-1 text-center">{stu.gender}</td>
                          <td className="border border-black p-1 text-center">{cls?.name || '-'}</td>
                          <td className="border border-black p-1 text-left pl-2 text-[10px] text-gray-400">
                            {idx + 1}...........
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              <div className="mt-4 flex justify-between text-xs pt-4">
                <div>
                  <p>Mengetahui,</p>
                  <p>Ketua Panitia Ujian</p>
                  <div className="h-12" />
                  <p className="font-bold underline">{settings.committeeHeadName || '................................'}</p>
                  <p>NIP. {settings.committeeHeadNip || '-'}</p>
                </div>
                <div className="text-right">
                  <p>{settings.city || 'Kota'}, {new Date().toLocaleDateString('id-ID')}</p>
                  <p>Kepala Sekolah</p>
                  <div className="h-12" />
                  <p className="font-bold underline">{settings.principalName || '................................'}</p>
                  <p>NIP. {settings.principalNip || '-'}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
