import React, { useState, useMemo } from 'react';
import {
  FileBarChart2,
  Printer,
  Download,
  Calendar,
  DoorOpen,
  GraduationCap,
  Users,
  UserCheck,
  FileCheck,
  IdCard,
  Tag,
  ShieldAlert,
  ClipboardList,
  Filter,
  CheckCircle2,
  Check,
  Clock
} from 'lucide-react';
import {
  ExamSchedule,
  Room,
  ClassItem,
  Subject,
  Supervisor,
  Student,
  ExamMinute,
  StudentAttendance,
  SchoolSetting
} from '../../types';
import { ExcelService } from '../../lib/excel';
import { StorageService } from '../../lib/storage';
import { PrintHeader } from '../common/PrintHeader';
import { getSessionLabel, triggerA4Print } from '../../lib/sessionHelper';

interface ReportsViewProps {
  schedules: ExamSchedule[];
  rooms: Room[];
  classes: ClassItem[];
  subjects: Subject[];
  supervisors: Supervisor[];
  students: Student[];
  minutes: ExamMinute[];
  attendances: StudentAttendance[];
  settings: SchoolSetting;
}

export type ReportType =
  | 'JADWAL_TOTAL'
  | 'JADWAL_RUANG'
  | 'JADWAL_KELAS'
  | 'JADWAL_PENGAWAS'
  | 'REKAP_PENGAWAS'
  | 'DAFTAR_HADIR_SISWA'
  | 'DAFTAR_HADIR_PENGAWAS'
  | 'BERITA_ACARA'
  | 'REKAP_KETIDAKHADIRAN'
  | 'PEMBAGIAN_RUANG'
  | 'KARTU_PESERTA'
  | 'LABEL_MEJA'
  | 'PESERTA_PER_RUANG'
  | 'PAKTA_INTEGRITAS'
  | 'TATA_TERTIB';

export const ReportsView: React.FC<ReportsViewProps> = ({
  schedules,
  rooms,
  classes,
  subjects,
  supervisors,
  students,
  minutes,
  attendances,
  settings
}) => {
  const [activeReport, setActiveReport] = useState<ReportType>('JADWAL_TOTAL');
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>('ALL');
  const [selectedSession, setSelectedSession] = useState<string>('ALL');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>(schedules[0]?.id || '');

  // Lookup maps
  const roomMap = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const supervisorMap = useMemo(() => new Map(supervisors.map((s) => [s.id, s])), [supervisors]);
  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const scheduleMap = useMemo(() => new Map(schedules.map((s) => [s.id, s])), [schedules]);
  const minuteMap = useMemo(() => new Map(minutes.map((m) => [m.scheduleId, m])), [minutes]);

  // Unique Dates in schedules
  const uniqueDates = useMemo(() => {
    const dates = Array.from(new Set(schedules.map((s) => s.date))).filter(Boolean);
    return dates.sort();
  }, [schedules]);

  // Available sessions in schedules (filtered by date if selected)
  const availableSessions = useMemo(() => {
    const filtered = selectedDate !== 'ALL'
      ? schedules.filter((s) => s.date === selectedDate)
      : schedules;
    const sessSet = new Set<string>();
    filtered.forEach((s) => {
      if (s.session !== undefined && s.session !== null && String(s.session).trim() !== '') {
        sessSet.add(String(s.session));
      }
    });
    if (sessSet.size === 0) {
      schedules.forEach((s) => {
        if (s.session !== undefined && s.session !== null && String(s.session).trim() !== '') {
          sessSet.add(String(s.session));
        }
      });
    }
    if (sessSet.size === 0) {
      return ['1', '2', '3'];
    }
    return Array.from(sessSet).sort((a, b) => Number(a) - Number(b));
  }, [schedules, selectedDate]);

  // Active schedule for single-session reports (Daftar Hadir Siswa & Berita Acara)
  const activeSchedule = useMemo(() => {
    return scheduleMap.get(selectedScheduleId) || schedules[0];
  }, [selectedScheduleId, scheduleMap, schedules]);

  // Title and Subtitle dynamically formatted from General Settings
  const examTitleSuffix = (settings.examName || 'Ujian Sekolah').toUpperCase();
  const reportSubtitle = `Semester ${settings.semester || 'GENAP'} • Tahun Pelajaran ${settings.academicYear || '2025/2026'}`;

  // Students for active schedule (sorted by Alphabetical Name and Class)
  const activeScheduleStudents = useMemo(() => {
    if (!activeSchedule) return [];

    // Prioritize permanent room mapping
    const roomStudents = StorageService.getStudentsForRoom(activeSchedule.roomId);
    let candidateList: Student[] = [];

    if (roomStudents.length > 0) {
      candidateList = roomStudents;
    } else {
      const list: Student[] = [];
      const seen = new Set<string>();

      activeSchedule.groups.forEach((grp) => {
        if (grp.selectedStudentIds && grp.selectedStudentIds.length > 0) {
          grp.selectedStudentIds.forEach((sid) => {
            const s = studentMap.get(sid);
            if (s && !seen.has(s.id)) {
              seen.add(s.id);
              list.push(s);
            }
          });
        } else {
          const clsStudents = students.filter(
            (s) => s.classId === grp.classId && s.status === 'AKTIF'
          );
          const sliced = clsStudents.slice(0, grp.participantCount || undefined);
          sliced.forEach((s) => {
            if (!seen.has(s.id)) {
              seen.add(s.id);
              list.push(s);
            }
          });
        }
      });
      candidateList = list;
    }

    if (selectedClassId !== 'ALL') {
      candidateList = candidateList.filter((s) => s.classId === selectedClassId);
    }

    // Urutkan semua Daftar Nama Siswa berdasarkan Abjad Nama Lengkap dan Kelas
    return [...candidateList].sort((a, b) => {
      const nameComp = (a.name || '').localeCompare(b.name || '', 'id', { sensitivity: 'base' });
      if (nameComp !== 0) return nameComp;
      const clsA = classMap.get(a.classId)?.name || a.classId || '';
      const clsB = classMap.get(b.classId)?.name || b.classId || '';
      return clsA.localeCompare(clsB, 'id', { numeric: true });
    });
  }, [activeSchedule, students, studentMap, selectedClassId, classMap]);

  // Map of student attendance for active schedule
  const activeAttendanceMap = useMemo(() => {
    if (!activeSchedule) return new Map<string, StudentAttendance>();
    const map = new Map<string, StudentAttendance>();
    attendances
      .filter((a) => a.scheduleId === activeSchedule.id)
      .forEach((a) => map.set(a.studentId, a));
    return map;
  }, [activeSchedule, attendances]);

  // Existing minute for active schedule
  const activeMinute = useMemo(() => {
    if (!activeSchedule) return null;
    return minuteMap.get(activeSchedule.id) || null;
  }, [activeSchedule, minuteMap]);

  // Filtered and sorted student list respecting Room and Class filters and alphabetical order
  const filteredAndSortedStudents = useMemo(() => {
    let list: Student[] = students;

    if (selectedRoomId !== 'ALL') {
      const roomStudents = StorageService.getStudentsForRoom(selectedRoomId);
      if (roomStudents.length > 0) {
        list = roomStudents;
      } else {
        const roomSchedules = schedules.filter((s) => s.roomId === selectedRoomId);
        const sidSet = new Set<string>();
        roomSchedules.forEach((sch) => {
          sch.groups.forEach((g) => {
            if (g.selectedStudentIds && g.selectedStudentIds.length > 0) {
              g.selectedStudentIds.forEach((sid) => sidSet.add(sid));
            } else {
              students
                .filter((st) => st.classId === g.classId && st.status === 'AKTIF')
                .slice(0, g.participantCount || undefined)
                .forEach((st) => sidSet.add(st.id));
            }
          });
        });
        list = students.filter((st) => sidSet.has(st.id));
      }
    }

    if (selectedClassId !== 'ALL') {
      list = list.filter((s) => s.classId === selectedClassId);
    }

    return [...list].sort((a, b) => {
      const nameComp = (a.name || '').localeCompare(b.name || '', 'id', { sensitivity: 'base' });
      if (nameComp !== 0) return nameComp;
      const clsA = classMap.get(a.classId)?.name || a.classId || '';
      const clsB = classMap.get(b.classId)?.name || b.classId || '';
      return clsA.localeCompare(clsB, 'id', { numeric: true });
    });
  }, [students, selectedRoomId, selectedClassId, schedules, classMap]);

  const reportList = [
    { key: 'JADWAL_TOTAL' as ReportType, label: 'A. Jadwal Ujian Keseluruhan', icon: Calendar },
    { key: 'JADWAL_RUANG' as ReportType, label: 'B. Jadwal Ujian per Ruang', icon: DoorOpen },
    { key: 'JADWAL_KELAS' as ReportType, label: 'C. Jadwal Ujian per Kelas', icon: GraduationCap },
    { key: 'JADWAL_PENGAWAS' as ReportType, label: 'D. Jadwal Pengawas Ujian', icon: UserCheck },
    { key: 'REKAP_PENGAWAS' as ReportType, label: 'E. Rekap Kehadiran Pengawas', icon: UserCheck },
    { key: 'DAFTAR_HADIR_SISWA' as ReportType, label: 'F. Daftar Hadir Siswa', icon: ClipboardList },
    { key: 'DAFTAR_HADIR_PENGAWAS' as ReportType, label: 'G. Daftar Hadir Pengawas', icon: UserCheck },
    { key: 'BERITA_ACARA' as ReportType, label: 'H. Berita Acara Ujian', icon: FileCheck },
    { key: 'REKAP_KETIDAKHADIRAN' as ReportType, label: 'I. Rekap Ketidakhadiran Siswa per Hari', icon: ShieldAlert },
    { key: 'PEMBAGIAN_RUANG' as ReportType, label: 'J. Denah & Pembagian Ruang', icon: DoorOpen },
    { key: 'KARTU_PESERTA' as ReportType, label: 'K. Cetak Kartu Peserta', icon: IdCard },
    { key: 'LABEL_MEJA' as ReportType, label: 'L. Label Meja Peserta Ujian', icon: Tag },
    { key: 'PESERTA_PER_RUANG' as ReportType, label: 'M. Daftar Peserta per Ruang', icon: Users },
    { key: 'PAKTA_INTEGRITAS' as ReportType, label: 'N. Pakta Integritas Pengawas', icon: FileCheck },
    { key: 'TATA_TERTIB' as ReportType, label: 'O. Tata Tertib Peserta & Pengawas', icon: ShieldAlert }
  ];

  // Excel Export Handler for ALL 15 reports
  const handleExportExcel = () => {
    let data: any[] = [];
    const filename = `Laporan_${activeReport}_${new Date().toISOString().split('T')[0]}`;

    switch (activeReport) {
      case 'JADWAL_TOTAL':
        data = schedules.flatMap((sch, idx) => {
          const r = roomMap.get(sch.roomId);
          const supNames = sch.supervisors
            .map((s) => supervisorMap.get(s.supervisorId)?.name)
            .filter(Boolean)
            .join(', ');
          return sch.groups.map((grp) => ({
            No: idx + 1,
            Hari_Tanggal: sch.date,
            Sesi: sch.session,
            Waktu: `${sch.startTime} - ${sch.endTime}`,
            Ruang: r ? `${r.code} (${r.name})` : sch.roomId,
            Kelas: classMap.get(grp.classId)?.name || grp.classId,
            Mata_Pelajaran: subjectMap.get(grp.subjectId)?.name || grp.subjectId,
            Jumlah_Peserta: grp.participantCount,
            Pengawas_Ruang: supNames || '-'
          }));
        });
        break;

      case 'JADWAL_RUANG':
        data = schedules.flatMap((sch, idx) => {
          const r = roomMap.get(sch.roomId);
          return {
            No: idx + 1,
            Ruang: r ? `${r.code} - ${r.name}` : sch.roomId,
            Gedung: r?.building || '-',
            Tanggal: sch.date,
            Sesi: sch.session,
            Waktu: `${sch.startTime} - ${sch.endTime}`,
            Kelas_Mapel: sch.groups
              .map((g) => `${classMap.get(g.classId)?.name}: ${subjectMap.get(g.subjectId)?.name}`)
              .join(' | '),
            Total_Peserta: sch.groups.reduce((a, b) => a + b.participantCount, 0)
          };
        });
        break;

      case 'JADWAL_KELAS':
        data = schedules.flatMap((sch) => {
          const r = roomMap.get(sch.roomId);
          const supNames = sch.supervisors
            .map((s) => supervisorMap.get(s.supervisorId)?.name)
            .filter(Boolean)
            .join(', ');
          return sch.groups.map((grp) => ({
            Kelas: classMap.get(grp.classId)?.name || grp.classId,
            Hari_Tanggal: sch.date,
            Sesi: sch.session,
            Waktu: `${sch.startTime} - ${sch.endTime}`,
            Mata_Pelajaran: subjectMap.get(grp.subjectId)?.name || grp.subjectId,
            Ruang_Ujian: r ? `${r.code} (${r.name})` : sch.roomId,
            Pengawas: supNames || '-'
          }));
        });
        break;

      case 'JADWAL_PENGAWAS':
        data = schedules.flatMap((sch, idx) => {
          const r = roomMap.get(sch.roomId);
          return sch.supervisors.map((supAssign, sIdx) => {
            const sup = supervisorMap.get(supAssign.supervisorId);
            return {
              No: `${idx + 1}.${sIdx + 1}`,
              Hari_Tanggal: sch.date,
              Sesi: sch.session,
              Waktu: `${sch.startTime} - ${sch.endTime}`,
              Ruang: r ? `${r.code} (${r.name})` : sch.roomId,
              Nama_Pengawas: sup?.name || '-',
              NIP: sup?.nip || '-',
              Tipe_Pengawas: supAssign.order ? `Pengawas ${supAssign.order}` : 'Pengawas Ruang',
              Kelas_Mapel: sch.groups
                .map((g) => `${classMap.get(g.classId)?.name}: ${subjectMap.get(g.subjectId)?.name}`)
                .join(' | ')
            };
          });
        });
        break;

      case 'REKAP_PENGAWAS':
        data = supervisors
          .filter((sup) => {
            if (selectedRoomId === 'ALL') return true;
            return schedules.some(
              (s) =>
                s.roomId === selectedRoomId &&
                s.supervisors.some((sa) => sa.supervisorId === sup.id)
            );
          })
          .map((sup, idx) => {
            const duties = schedules.filter((s) => {
              const hasDuty = s.supervisors.some((sa) => sa.supervisorId === sup.id);
              if (!hasDuty) return false;
              if (selectedRoomId !== 'ALL') return s.roomId === selectedRoomId;
              if (selectedDate !== 'ALL') return s.date === selectedDate;
              return true;
            });
            const roomsAssigned = Array.from(
              new Set(duties.map((d) => roomMap.get(d.roomId)?.code).filter(Boolean))
            ).join(', ');
            return {
              No: idx + 1,
              Nama_Pengawas: sup.name,
              Jumlah_Sesi_Bertugas: `${duties.length} Sesi`,
              Ruang_Bertugas: roomsAssigned || '-',
              Keterangan: duties.length > 0 ? 'Aktif Bertugas' : 'Pengawas Cadangan'
            };
          });
        break;

      case 'DAFTAR_HADIR_SISWA':
        data = activeScheduleStudents.map((stu, idx) => {
          const att = activeAttendanceMap.get(stu.id);
          return {
            No: idx + 1,
            No_Peserta: stu.examNumber,
            NIS: stu.nis,
            NISN: stu.nisn || '-',
            Nama_Siswa: stu.name,
            Jenis_Kelamin: stu.gender,
            Kelas: classMap.get(stu.classId)?.name || '-',
            Status_Kehadiran: att?.status || 'Belum Diisi',
            Waktu_Presensi: att?.timestamp || '-'
          };
        });
        break;

      case 'DAFTAR_HADIR_PENGAWAS':
        data = schedules.flatMap((sch, idx) => {
          const r = roomMap.get(sch.roomId);
          return sch.supervisors.map((sa) => {
            const sup = supervisorMap.get(sa.supervisorId);
            return {
              No: idx + 1,
              Tanggal: sch.date,
              Sesi: sch.session,
              Ruang: r ? `${r.code} (${r.name})` : sch.roomId,
              Nama_Pengawas: sup?.name || '-',
              NIP: sup?.nip || '-',
              Jam_Hadir: `${sch.startTime} WIB`,
              Keterangan: 'Bertugas'
            };
          });
        });
        break;

      case 'BERITA_ACARA':
        data = schedules.map((sch, idx) => {
          const r = roomMap.get(sch.roomId);
          const min = minuteMap.get(sch.id);
          return {
            No: idx + 1,
            Hari_Tanggal: sch.date,
            Sesi: sch.session,
            Ruang: r ? `${r.code} (${r.name})` : sch.roomId,
            Jumlah_Terdaftar: min?.totalRegistered || sch.groups.reduce((a, b) => a + b.participantCount, 0),
            Jumlah_Hadir: min?.presentCount ?? '-',
            Jumlah_Tidak_Hadir: min?.absentCount ?? '-',
            Nomor_Tidak_Hadir: min?.absentStudentNumbers || '-',
            Status_Verifikasi: min?.verifiedBySupervisor ? 'Terverifikasi Pengawas' : 'Belum Diverifikasi',
            Catatan: min?.notes || 'Tertib dan aman'
          };
        });
        break;

      case 'REKAP_KETIDAKHADIRAN': {
        const targetDate = selectedDate !== 'ALL' ? selectedDate : (uniqueDates[0] || '');
        const displayedRooms = rooms.filter(
          (r) => selectedRoomId === 'ALL' || r.id === selectedRoomId
        );

        data = displayedRooms.map((room, idx) => {
          const targetSchedules = schedules.filter(
            (s) =>
              s.roomId === room.id &&
              (!targetDate || s.date === targetDate) &&
              (selectedSession === 'ALL' || String(s.session) === String(selectedSession))
          );
          const targetScheduleIds = new Set(targetSchedules.map((s) => s.id));
          const roomAttendances = attendances.filter((a) => targetScheduleIds.has(a.scheduleId));

          const permStudents = StorageService.getStudentsForRoom(room.id);
          let candidateStudents: Student[] = [];

          if (permStudents.length > 0) {
            if (targetSchedules.length > 0) {
              const scheduledClassIds = new Set(
                targetSchedules.flatMap((sch) => sch.groups.map((g) => g.classId))
              );
              const matchedPerm = permStudents.filter((s) => scheduledClassIds.has(s.classId));
              candidateStudents = matchedPerm.length > 0 ? matchedPerm : permStudents;
            } else if (selectedSession !== 'ALL') {
              candidateStudents = [];
            } else {
              candidateStudents = permStudents;
            }
          } else {
            const seen = new Set<string>();
            targetSchedules.forEach((sch) => {
              sch.groups.forEach((grp) => {
                if (grp.selectedStudentIds && grp.selectedStudentIds.length > 0) {
                  grp.selectedStudentIds.forEach((sid) => {
                    const st = studentMap.get(sid);
                    if (st && !seen.has(st.id)) {
                      seen.add(st.id);
                      candidateStudents.push(st);
                    }
                  });
                } else {
                  const clsStudents = students.filter(
                    (s) => s.classId === grp.classId && s.status === 'AKTIF'
                  );
                  clsStudents.slice(0, grp.participantCount || undefined).forEach((st) => {
                    if (!seen.has(st.id)) {
                      seen.add(st.id);
                      candidateStudents.push(st);
                    }
                  });
                }
              });
            });
          }

          if (selectedClassId !== 'ALL') {
            candidateStudents = candidateStudents.filter((s) => s.classId === selectedClassId);
          }

          // Sort Alphabetically
          candidateStudents.sort((a, b) => {
            const nameComp = (a.name || '').localeCompare(b.name || '', 'id', { sensitivity: 'base' });
            if (nameComp !== 0) return nameComp;
            const clsA = classMap.get(a.classId)?.name || a.classId || '';
            const clsB = classMap.get(b.classId)?.name || b.classId || '';
            return clsA.localeCompare(clsB, 'id', { numeric: true });
          });

          const studentAbsentAttendances = new Map<string, { status: string; notes?: string }[]>();
          roomAttendances.forEach((a) => {
            if (['Tidak Hadir', 'Sakit', 'Izin', 'Alpa'].includes(a.status)) {
              const list = studentAbsentAttendances.get(a.studentId) || [];
              list.push({ status: a.status, notes: a.notes });
              studentAbsentAttendances.set(a.studentId, list);
            }
          });

          const absentList: { student: Student; status: string; notes?: string }[] = [];
          candidateStudents.forEach((stu) => {
            const atts = studentAbsentAttendances.get(stu.id);
            if (atts && atts.length > 0) {
              const primary = atts[0];
              absentList.push({ student: stu, status: primary.status, notes: primary.notes });
            }
          });

          const seharusnya = candidateStudents.length;
          const tidakHadir = absentList.length;
          const hadir = Math.max(0, seharusnya - tidakHadir);
          const keterangan =
            absentList.length > 0
              ? absentList
                  .map(
                    (item, i) =>
                      `${i + 1}. ${item.student.name} (${classMap.get(item.student.classId)?.name || '-'} - ${item.status}${item.notes ? `: ${item.notes}` : ''})`
                  )
                  .join('; ')
              : seharusnya > 0
              ? 'Nihil / Hadir Semua'
              : '- (Tidak ada jadwal)';

          return {
            No: idx + 1,
            Ruang: room.code,
            Jumlah_Seharusnya: seharusnya,
            Jumlah_Hadir: hadir,
            Jumlah_Tidak_Hadir: tidakHadir,
            Keterangan: keterangan
          };
        });
        break;
      }

      case 'PEMBAGIAN_RUANG':
        data = rooms.map((rm, idx) => {
          const roomSchedules = schedules.filter((s) => s.roomId === rm.id);
          const classesInRoom = Array.from(
            new Set(
              roomSchedules.flatMap((s) =>
                s.groups.map((g) => classMap.get(g.classId)?.name).filter(Boolean)
              )
            )
          ).join(', ');
          return {
            No: idx + 1,
            Kode_Ruang: rm.code,
            Nama_Ruang: rm.name,
            Gedung_Lantai: rm.building,
            Kapasitas: rm.capacity,
            Sesi_Penggunaan: roomSchedules.length,
            Kelas_Menempati: classesInRoom || '-',
            Status: rm.status
          };
        });
        break;

      case 'KARTU_PESERTA':
      case 'LABEL_MEJA':
      case 'PESERTA_PER_RUANG':
        data = filteredAndSortedStudents.map((s, idx) => ({
          No: idx + 1,
          No_Peserta: s.examNumber,
          NIS: s.nis,
          NISN: s.nisn || '-',
          Nama: s.name,
          Jenis_Kelamin: s.gender,
          Kelas: classMap.get(s.classId)?.name || '-',
          Jurusan: s.major,
          Status: s.status
        }));
        break;

      default:
        data = students.map((s) => ({
          No_Peserta: s.examNumber,
          Nama: s.name,
          Kelas: classMap.get(s.classId)?.name || '-'
        }));
        break;
    }

    ExcelService.exportToExcel(data, filename);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div>
          <div className="flex items-center gap-2">
            <FileBarChart2 className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg md:text-xl font-bold text-slate-900">
              Laporan &amp; Dokumen Cetak Ujian Sekolah
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Format dokumen resmi standar dinas pendidikan lengkap dengan kop surat sekolah, logo, dan tanda tangan resmi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={() => triggerA4Print(`Laporan_${activeReport}`)}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Dokumen PDF (A4)</span>
          </button>
        </div>
      </div>

      {/* Report Selection Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 no-print">
        {reportList.map((rep) => {
          const Icon = rep.icon;
          const isActive = activeReport === rep.key;
          return (
            <button
              key={rep.key}
              onClick={() => setActiveReport(rep.key)}
              className={`p-2.5 rounded-lg border text-left text-xs transition-all flex items-start gap-2 cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon
                className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                  isActive ? 'text-white' : 'text-blue-600'
                }`}
              />
              <span className="font-medium line-clamp-2 leading-tight">
                {rep.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Dynamic Filter Toolbar for Selected Report */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 no-print text-xs">
        <div className="flex items-center gap-2 text-slate-700 font-semibold">
          <Filter className="w-4 h-4 text-blue-600" />
          <span>Filter Laporan:</span>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Room selector - always available */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 font-medium">Ruang:</span>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">-- Semua Ruang --</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} - {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Class selector - always available */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 font-medium">Kelas:</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">-- Semua Kelas --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.major})
                </option>
              ))}
            </select>
          </div>

          {/* Date selector */}
          {uniqueDates.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-600 font-medium">Tanggal:</span>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">-- Semua Tanggal --</option>
                {uniqueDates.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Session filter for Rekap Ketidakhadiran */}
          {activeReport === 'REKAP_KETIDAKHADIRAN' && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-600 font-medium">Sesi:</span>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">-- Semua Sesi --</option>
                {availableSessions.map((sess) => (
                  <option key={sess} value={String(sess)}>
                    Sesi {sess}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Schedule selector for single-session reports */}
          {(activeReport === 'DAFTAR_HADIR_SISWA' || activeReport === 'BERITA_ACARA') && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-600 font-medium">Sesi Ujian:</span>
              <select
                value={selectedScheduleId}
                onChange={(e) => setSelectedScheduleId(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium focus:ring-1 focus:ring-blue-500 max-w-[260px] truncate"
              >
                {schedules
                  .filter((sch) => selectedRoomId === 'ALL' || sch.roomId === selectedRoomId)
                  .filter((sch) => selectedDate === 'ALL' || sch.date === selectedDate)
                  .map((sch) => {
                    const r = roomMap.get(sch.roomId);
                    const cls = sch.groups.map((g) => classMap.get(g.classId)?.name).join('/');
                    const sub = sch.groups.map((g) => subjectMap.get(g.subjectId)?.name).join('/');
                    return (
                      <option key={sch.id} value={sch.id}>
                        {sch.date} - Sesi {sch.session} | {r?.code} | {cls} - {sub}
                      </option>
                    );
                  })}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Printable Document Sheet Preview */}
      <div className="print-page-a4 bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8 max-w-4xl mx-auto font-serif text-black min-h-[600px] print:border-none print:shadow-none print:p-0">
        
        {/* REPORT A: JADWAL KESELURUHAN */}
        {activeReport === 'JADWAL_TOTAL' && (
          <div>
            <PrintHeader
              settings={settings}
              documentTitle={`JADWAL KESELURUHAN PELAKSANAAN ${examTitleSuffix}`}
              documentSubtitle={reportSubtitle}
            />

            <table className="w-full border-collapse border border-black text-xs mt-4">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black p-1.5 text-center w-8">No</th>
                  <th className="border border-black p-1.5 text-center">Hari / Tanggal</th>
                  <th className="border border-black p-1.5 text-center">Sesi &amp; Waktu</th>
                  <th className="border border-black p-1.5 text-center">Ruang</th>
                  <th className="border border-black p-1.5 text-left">Kelas &amp; Mata Pelajaran</th>
                  <th className="border border-black p-1.5 text-center">Peserta</th>
                  <th className="border border-black p-1.5 text-left">Pengawas Ruang</th>
                </tr>
              </thead>
              <tbody>
                {schedules
                  .filter((s) => selectedDate === 'ALL' || s.date === selectedDate)
                  .filter((s) => selectedRoomId === 'ALL' || s.roomId === selectedRoomId)
                  .filter(
                    (s) =>
                      selectedClassId === 'ALL' || s.groups.some((g) => g.classId === selectedClassId)
                  )
                  .map((sch, idx) => {
                    const r = roomMap.get(sch.roomId);
                    const filteredGroups = sch.groups.filter(
                      (g) => selectedClassId === 'ALL' || g.classId === selectedClassId
                    );
                    const totalP = filteredGroups.reduce((a, b) => a + b.participantCount, 0);
                    const supNames = sch.supervisors
                      .map((sa) => supervisorMap.get(sa.supervisorId)?.name)
                      .filter(Boolean)
                      .join(', ');

                    return (
                      <tr key={sch.id}>
                        <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                        <td className="border border-black p-1.5 text-center font-medium">
                          {sch.date}
                        </td>
                        <td className="border border-black p-1.5 text-center">
                          {getSessionLabel(sch.session)} ({sch.startTime}-{sch.endTime})
                        </td>
                        <td className="border border-black p-1.5 text-center font-bold">
                          {r?.code} ({r?.name})
                        </td>
                        <td className="border border-black p-1.5">
                          {filteredGroups.map((grp) => {
                            const cls = classMap.get(grp.classId);
                            const sub = subjectMap.get(grp.subjectId);
                            return (
                              <div key={grp.id} className="text-[11px] leading-tight">
                                <strong>{cls?.name}</strong>: {sub?.name} ({grp.participantCount} siswa)
                              </div>
                            );
                          })}
                        </td>
                        <td className="border border-black p-1.5 text-center font-bold">
                          {totalP}
                        </td>
                        <td className="border border-black p-1.5 text-[11px]">
                          {supNames || '-'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* REPORT B: JADWAL PER RUANG */}
        {activeReport === 'JADWAL_RUANG' && (
          <div>
            <PrintHeader
              settings={settings}
              documentTitle={`REKAPITULASI JADWAL UJIAN PER RUANG - ${examTitleSuffix}`}
              documentSubtitle={reportSubtitle}
            />
            <div className="space-y-6 mt-4">
              {rooms
                .filter((r) => selectedRoomId === 'ALL' || r.id === selectedRoomId)
                .map((room) => {
                  const roomSchedules = schedules
                    .filter((s) => s.roomId === room.id)
                    .filter((s) => selectedDate === 'ALL' || s.date === selectedDate)
                    .filter(
                      (s) =>
                        selectedClassId === 'ALL' ||
                        s.groups.some((g) => g.classId === selectedClassId)
                    );
                  return (
                    <div key={room.id} className="border border-black p-3 rounded print-avoid-break">
                      <div className="flex justify-between font-bold border-b border-black pb-1 mb-2 text-xs">
                        <span>
                          Ruang: {room.code} - {room.name} ({room.building})
                        </span>
                        <span>Kapasitas: {room.capacity} Meja</span>
                      </div>

                      <table className="w-full border-collapse border border-black text-xs">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="border border-black p-1 text-center w-8">No</th>
                            <th className="border border-black p-1 text-center">Tanggal</th>
                            <th className="border border-black p-1 text-center">Waktu / Sesi</th>
                            <th className="border border-black p-1 text-left">Kelompok Kelas &amp; Mapel</th>
                            <th className="border border-black p-1 text-left">Pengawas</th>
                            <th className="border border-black p-1 text-center">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roomSchedules.map((sch, i) => {
                            const supNames = sch.supervisors
                              .map((sa) => supervisorMap.get(sa.supervisorId)?.name)
                              .filter(Boolean)
                              .join(', ');
                            const filteredGroups = sch.groups.filter(
                              (g) => selectedClassId === 'ALL' || g.classId === selectedClassId
                            );
                            return (
                              <tr key={sch.id}>
                                <td className="border border-black p-1 text-center">{i + 1}</td>
                                <td className="border border-black p-1 text-center">{sch.date}</td>
                                <td className="border border-black p-1 text-center">
                                  {sch.startTime} - {sch.endTime} ({getSessionLabel(sch.session)})
                                </td>
                                <td className="border border-black p-1">
                                  {filteredGroups
                                    .map(
                                      (g) =>
                                        `${classMap.get(g.classId)?.name}: ${
                                          subjectMap.get(g.subjectId)?.name
                                        }`
                                    )
                                    .join(' | ')}
                                </td>
                                <td className="border border-black p-1 text-[11px]">{supNames || '-'}</td>
                                <td className="border border-black p-1 text-center font-bold">
                                  {filteredGroups.reduce((a, b) => a + b.participantCount, 0)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* REPORT C: JADWAL PER KELAS */}
        {activeReport === 'JADWAL_KELAS' && (
          <div>
            <PrintHeader
              settings={settings}
              documentTitle={`JADWAL PELAKSANAAN UJIAN PER KELAS - ${examTitleSuffix}`}
              documentSubtitle={reportSubtitle}
            />
            <div className="space-y-6 mt-4">
              {classes
                .filter((c) => selectedClassId === 'ALL' || c.id === selectedClassId)
                .map((cls) => {
                  const classSchedules = schedules
                    .filter((s) => s.groups.some((g) => g.classId === cls.id))
                    .filter((s) => selectedRoomId === 'ALL' || s.roomId === selectedRoomId)
                    .filter((s) => selectedDate === 'ALL' || s.date === selectedDate);
                  return (
                    <div key={cls.id} className="border border-black p-3 rounded print-avoid-break">
                      <div className="flex justify-between font-bold border-b border-black pb-1 mb-2 text-xs">
                        <span>
                          Kelas: {cls.name} (Jurusan: {cls.major} - Tingkat {cls.grade})
                        </span>
                        <span>Jumlah Ujian: {classSchedules.length} Sesi</span>
                      </div>

                      <table className="w-full border-collapse border border-black text-xs">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="border border-black p-1 text-center w-8">No</th>
                            <th className="border border-black p-1 text-center">Hari / Tanggal</th>
                            <th className="border border-black p-1 text-center">Waktu &amp; Sesi</th>
                            <th className="border border-black p-1 text-left">Mata Pelajaran</th>
                            <th className="border border-black p-1 text-center">Ruang Ujian</th>
                            <th className="border border-black p-1 text-left">Pengawas Ruang</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classSchedules.map((sch, i) => {
                            const r = roomMap.get(sch.roomId);
                            const grp = sch.groups.find((g) => g.classId === cls.id);
                            const sub = grp ? subjectMap.get(grp.subjectId) : null;
                            const supNames = sch.supervisors
                              .map((sa) => supervisorMap.get(sa.supervisorId)?.name)
                              .filter(Boolean)
                              .join(', ');
                            return (
                              <tr key={sch.id}>
                                <td className="border border-black p-1 text-center">{i + 1}</td>
                                <td className="border border-black p-1 text-center font-medium">
                                  {sch.date}
                                </td>
                                <td className="border border-black p-1 text-center">
                                  {sch.startTime} - {sch.endTime} ({getSessionLabel(sch.session)})
                                </td>
                                <td className="border border-black p-1 font-semibold">
                                  {sub?.name || '-'}
                                </td>
                                <td className="border border-black p-1 text-center font-bold">
                                  {r?.code} ({r?.name})
                                </td>
                                <td className="border border-black p-1 text-[11px]">{supNames || '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* REPORT D: JADWAL PENGAWAS UJIAN */}
        {activeReport === 'JADWAL_PENGAWAS' && (
          <div>
            <PrintHeader
              settings={settings}
              documentTitle={`JADWAL TUGAS PENGAWAS RUANG - ${examTitleSuffix}`}
              documentSubtitle={reportSubtitle}
            />

            <table className="w-full border-collapse border border-black text-xs mt-4">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black p-1.5 text-center w-8">No</th>
                  <th className="border border-black p-1.5 text-center">Hari / Tanggal</th>
                  <th className="border border-black p-1.5 text-center">Sesi &amp; Waktu</th>
                  <th className="border border-black p-1.5 text-center">Ruang</th>
                  <th className="border border-black p-1.5 text-left">Nama Pengawas</th>
                  <th className="border border-black p-1.5 text-center">NIP / NUPTK</th>
                  <th className="border border-black p-1.5 text-left">Mata Pelajaran &amp; Kelas</th>
                </tr>
              </thead>
              <tbody>
                {schedules
                  .filter((s) => selectedDate === 'ALL' || s.date === selectedDate)
                  .filter((s) => selectedRoomId === 'ALL' || s.roomId === selectedRoomId)
                  .flatMap((sch, sIdx) => {
                    const r = roomMap.get(sch.roomId);
                    const classMapel = sch.groups
                      .map(
                        (g) => `${classMap.get(g.classId)?.name}: ${subjectMap.get(g.subjectId)?.name}`
                      )
                      .join(' | ');

                    return sch.supervisors.map((sa, idx) => {
                      const sup = supervisorMap.get(sa.supervisorId);
                      return (
                        <tr key={`${sch.id}-${sa.supervisorId}-${idx}`}>
                          <td className="border border-black p-1.5 text-center">
                            {sIdx + 1}.{idx + 1}
                          </td>
                          <td className="border border-black p-1.5 text-center font-medium">
                            {sch.date}
                          </td>
                          <td className="border border-black p-1.5 text-center">
                            {getSessionLabel(sch.session)} ({sch.startTime}-{sch.endTime})
                          </td>
                          <td className="border border-black p-1.5 text-center font-bold">
                            {r?.code} ({r?.name})
                          </td>
                          <td className="border border-black p-1.5 font-bold">{sup?.name || '-'}</td>
                          <td className="border border-black p-1.5 text-center font-mono">
                            {sup?.nip || '-'}
                          </td>
                          <td className="border border-black p-1.5 text-[11px]">{classMapel}</td>
                        </tr>
                      );
                    });
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* REPORT E: REKAP KEHADIRAN PENGAWAS */}
        {activeReport === 'REKAP_PENGAWAS' && (
          <div>
            <PrintHeader
              settings={settings}
              documentTitle={`REKAP KEHADIRAN PENGAWAS - ${examTitleSuffix}`}
              documentSubtitle={reportSubtitle}
            />

            <table className="w-full border-collapse border border-black text-xs mt-4">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black p-2 text-center w-10">No</th>
                  <th className="border border-black p-2 text-left">Nama Pengawas</th>
                  <th className="border border-black p-2 text-center w-36">Jumlah Sesi Bertugas</th>
                  <th className="border border-black p-2 text-left">Ruang Bertugas</th>
                  <th className="border border-black p-2 text-center w-40">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {supervisors
                  .filter((sup) => {
                    if (selectedRoomId === 'ALL') return true;
                    return schedules.some(
                      (s) =>
                        s.roomId === selectedRoomId &&
                        s.supervisors.some((sa) => sa.supervisorId === sup.id)
                    );
                  })
                  .map((sup, idx) => {
                    const duties = schedules.filter((s) => {
                      const hasDuty = s.supervisors.some((sa) => sa.supervisorId === sup.id);
                      if (!hasDuty) return false;
                      if (selectedRoomId !== 'ALL') return s.roomId === selectedRoomId;
                      if (selectedDate !== 'ALL') return s.date === selectedDate;
                      return true;
                    });
                    const roomCodes = Array.from(
                      new Set(duties.map((d) => roomMap.get(d.roomId)?.code).filter(Boolean))
                    ).join(', ');

                    return (
                      <tr key={sup.id}>
                        <td className="border border-black p-2 text-center">{idx + 1}</td>
                        <td className="border border-black p-2 font-bold">{sup.name}</td>
                        <td className="border border-black p-2 text-center font-bold">
                          {duties.length} Sesi
                        </td>
                        <td className="border border-black p-2">{roomCodes || '-'}</td>
                        <td className="border border-black p-2 text-center">
                          {duties.length > 0 ? (
                            <span className="font-semibold text-emerald-800">Aktif Bertugas</span>
                          ) : (
                            <span className="text-slate-500 italic">Pengawas Cadangan</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* REPORT F: DAFTAR HADIR SISWA */}
        {activeReport === 'DAFTAR_HADIR_SISWA' && (
          <div>
            <PrintHeader
              settings={settings}
              documentTitle={`DAFTAR HADIR PESERTA ${examTitleSuffix}`}
              documentSubtitle={reportSubtitle}
            />

            {/* Session Information Table */}
            {activeSchedule && (
              <div className="border border-black p-2.5 rounded text-xs mb-3 space-y-1">
                <div className="grid grid-cols-2 gap-x-4">
                  <p>
                    <strong>Hari / Tanggal:</strong> {activeSchedule.date}
                  </p>
                  <p>
                    <strong>Ruang Ujian:</strong>{' '}
                    {roomMap.get(activeSchedule.roomId)?.code} (
                    {roomMap.get(activeSchedule.roomId)?.name})
                  </p>
                  <p>
                    <strong>Waktu / Sesi:</strong> {activeSchedule.startTime} - {activeSchedule.endTime}{' '}
                    ({getSessionLabel(activeSchedule.session)})
                  </p>
                  <p>
                    <strong>Kelas:</strong>{' '}
                    {activeSchedule.groups
                      .map((g) => classMap.get(g.classId)?.name)
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  <p>
                    <strong>Mata Pelajaran:</strong>{' '}
                    {activeSchedule.groups
                      .map((g) => subjectMap.get(g.subjectId)?.name)
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  <p>
                    <strong>Jumlah Peserta:</strong> {activeScheduleStudents.length} Siswa
                  </p>
                </div>
              </div>
            )}

            <table className="w-full border-collapse border border-black text-xs">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black p-1.5 text-center w-8">No</th>
                  <th className="border border-black p-1.5 text-center w-28">No. Peserta</th>
                  <th className="border border-black p-1.5 text-center w-20">NIS</th>
                  <th className="border border-black p-1.5 text-left">Nama Lengkap Siswa</th>
                  <th className="border border-black p-1.5 text-center w-10">L/P</th>
                  <th className="border border-black p-1.5 text-center w-20">Kelas</th>
                  <th className="border border-black p-1.5 text-center w-36" colSpan={2}>
                    Tanda Tangan Siswa
                  </th>
                  <th className="border border-black p-1.5 text-center w-20">Ket</th>
                </tr>
              </thead>
              <tbody>
                {activeScheduleStudents.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="border border-black p-4 text-center text-gray-500 italic">
                      Tidak ada peserta pada sesi ujian ini.
                    </td>
                  </tr>
                ) : (
                  activeScheduleStudents.map((stu, idx) => {
                    const att = activeAttendanceMap.get(stu.id);
                    const isEven = (idx + 1) % 2 === 0;
                    return (
                      <tr key={stu.id}>
                        <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                        <td className="border border-black p-1.5 text-center font-mono font-bold">
                          {stu.examNumber}
                        </td>
                        <td className="border border-black p-1.5 text-center font-mono">{stu.nis}</td>
                        <td className="border border-black p-1.5 font-medium">{stu.name}</td>
                        <td className="border border-black p-1.5 text-center">{stu.gender}</td>
                        <td className="border border-black p-1.5 text-center">
                          {classMap.get(stu.classId)?.name}
                        </td>
                        <td className="border border-black p-1 text-left w-18 h-7 text-[10px] pl-1.5 align-middle">
                          {!isEven ? `${idx + 1}. .........` : ''}
                        </td>
                        <td className="border border-black p-1 text-left w-18 h-7 text-[10px] pl-1.5 align-middle">
                          {isEven ? `${idx + 1}. .........` : ''}
                        </td>
                        <td className="border border-black p-1 text-center font-semibold text-[10px]">
                          {att ? att.status : 'Hadir'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* REPORT G: DAFTAR HADIR PENGAWAS */}
        {activeReport === 'DAFTAR_HADIR_PENGAWAS' && (
          <div>
            <PrintHeader
              settings={settings}
              documentTitle={`DAFTAR HADIR PENGAWAS RUANG - ${examTitleSuffix}`}
              documentSubtitle={reportSubtitle}
            />

            <table className="w-full border-collapse border border-black text-xs mt-4">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black p-1.5 text-center w-8">No</th>
                  <th className="border border-black p-1.5 text-center">Hari / Tanggal</th>
                  <th className="border border-black p-1.5 text-center">Sesi &amp; Waktu</th>
                  <th className="border border-black p-1.5 text-center">Ruang</th>
                  <th className="border border-black p-1.5 text-left">Nama Pengawas Ruang</th>
                  <th className="border border-black p-1.5 text-center">NIP / NUPTK</th>
                  <th className="border border-black p-1.5 text-center">Jam Hadir</th>
                  <th className="border border-black p-1.5 text-center w-28">Tanda Tangan</th>
                  <th className="border border-black p-1.5 text-center">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {schedules
                  .filter((s) => selectedDate === 'ALL' || s.date === selectedDate)
                  .filter((s) => selectedRoomId === 'ALL' || s.roomId === selectedRoomId)
                  .flatMap((sch, sIdx) => {
                    const r = roomMap.get(sch.roomId);
                    return sch.supervisors.map((sa, idx) => {
                      const sup = supervisorMap.get(sa.supervisorId);
                      return (
                        <tr key={`${sch.id}-${sa.supervisorId}-${idx}`}>
                          <td className="border border-black p-1.5 text-center">
                            {sIdx + 1}.{idx + 1}
                          </td>
                          <td className="border border-black p-1.5 text-center font-medium">
                            {sch.date}
                          </td>
                          <td className="border border-black p-1.5 text-center">
                            {getSessionLabel(sch.session)} ({sch.startTime}-{sch.endTime})
                          </td>
                          <td className="border border-black p-1.5 text-center font-bold">
                            {r?.code} ({r?.name})
                          </td>
                          <td className="border border-black p-1.5 font-bold">{sup?.name || '-'}</td>
                          <td className="border border-black p-1.5 text-center font-mono">
                            {sup?.nip || '-'}
                          </td>
                          <td className="border border-black p-1.5 text-center font-mono">
                            {sch.startTime}
                          </td>
                          <td className="border border-black p-1.5 text-center">
                            <div className="h-6"></div>
                          </td>
                          <td className="border border-black p-1.5 text-center text-[10px]">Bertugas</td>
                        </tr>
                      );
                    });
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* REPORT H: BERITA ACARA UJIAN */}
        {activeReport === 'BERITA_ACARA' && activeSchedule && (
          <div className="space-y-4">
            <PrintHeader
              settings={settings}
              documentTitle={`BERITA ACARA PELAKSANAAN ${examTitleSuffix}`}
              documentSubtitle={reportSubtitle}
            />

            <div className="text-xs leading-relaxed space-y-3 text-justify">
              <p>
                Pada hari ini, <strong>{activeSchedule.date}</strong>, telah diselenggarakan{' '}
                <strong>{settings.examName || 'Ujian Sekolah'}</strong> {reportSubtitle} di{' '}
                <strong>{settings.schoolName}</strong> untuk:
              </p>

              <table className="w-full text-xs">
                <tbody>
                  <tr>
                    <td className="w-36 py-1">Mata Pelajaran</td>
                    <td className="py-1">
                      :{' '}
                      <strong>
                        {activeSchedule.groups
                          .map((g) => subjectMap.get(g.subjectId)?.name)
                          .filter(Boolean)
                          .join(', ')}
                      </strong>
                    </td>
                  </tr>
                  <tr>
                    <td className="w-36 py-1">Tingkat / Kelas</td>
                    <td className="py-1">
                      :{' '}
                      {activeSchedule.groups
                        .map((g) => classMap.get(g.classId)?.name)
                        .filter(Boolean)
                        .join(', ')}
                    </td>
                  </tr>
                  <tr>
                    <td className="w-36 py-1">Ruang Ujian</td>
                    <td className="py-1">
                      : {roomMap.get(activeSchedule.roomId)?.code} -{' '}
                      {roomMap.get(activeSchedule.roomId)?.name}
                    </td>
                  </tr>
                  <tr>
                    <td className="w-36 py-1">Sesi &amp; Waktu</td>
                    <td className="py-1">
                      : {getSessionLabel(activeSchedule.session)} (Pukul {activeSchedule.startTime} s.d{' '}
                      {activeSchedule.endTime} WIB)
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="border border-black p-3 rounded space-y-2 mt-2">
                <p className="font-bold border-b border-black pb-1">
                  I. Rekapitulasi Kehadiran Peserta Ujian:
                </p>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="border border-black p-2 rounded">
                    <span>Jumlah Terdaftar:</span>
                    <p className="text-base font-bold">
                      {activeMinute?.totalRegistered ??
                        activeSchedule.groups.reduce((a, b) => a + b.participantCount, 0)}{' '}
                      Siswa
                    </p>
                  </div>
                  <div className="border border-black p-2 rounded">
                    <span>Jumlah Hadir:</span>
                    <p className="text-base font-bold text-emerald-700">
                      {activeMinute?.presentCount ?? activeScheduleStudents.length} Siswa
                    </p>
                  </div>
                  <div className="border border-black p-2 rounded">
                    <span>Jumlah Tidak Hadir:</span>
                    <p className="text-base font-bold text-rose-700">
                      {activeMinute?.absentCount ?? 0} Siswa
                    </p>
                  </div>
                </div>

                <div className="pt-2 text-xs">
                  <p>
                    <strong>Nomor Peserta Siswa Tidak Hadir:</strong>{' '}
                    <span className="font-mono">
                      {activeMinute?.absentStudentNumbers || 'Nihil / Seluruh Peserta Hadir Lengkap'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="border border-black p-3 rounded space-y-1">
                <p className="font-bold border-b border-black pb-1">
                  II. Catatan Khusus Selama Pelaksanaan Ujian:
                </p>
                <p className="italic pt-1">
                  {activeMinute?.notes ||
                    'Ujian berjalan dengan tertib, aman, lancar, dan kondusif. Sampul lembar soal dan LJK dibuka dalam keadaan tertutup dan tersegel rapi disaksikan peserta ujian.'}
                </p>
              </div>

              {/* Status Verifikasi Pengawas */}
              <div className="flex items-center gap-2 pt-1 font-semibold">
                <span>Status Verifikasi:</span>
                {activeMinute?.verifiedBySupervisor ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <Check className="w-4 h-4" /> Telah Diverifikasi &amp; Disetujui Pengawas Ruang
                  </span>
                ) : (
                  <span className="text-amber-700 font-medium">
                    Menunggu Verifikasi Pengawas Ruang
                  </span>
                )}
              </div>
            </div>

            {/* Signature section specific to Berita Acara (2 Pengawas + Kepala Sekolah) */}
            <div className="mt-8 pt-4 border-t border-black text-xs">
              <p className="font-semibold mb-3">Pengawas Ruang yang bertugas:</p>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p>1. Pengawas Ruang 1:</p>
                  <p className="font-bold mt-1">
                    {supervisorMap.get(activeSchedule.supervisors[0]?.supervisorId)?.name || '__________________________'}
                  </p>
                  <p>
                    NIP.{' '}
                    {supervisorMap.get(activeSchedule.supervisors[0]?.supervisorId)?.nip || '__________________________'}
                  </p>
                  <div className="h-10 mt-1">TTD: .......................................</div>
                </div>

                <div>
                  <p>2. Pengawas Ruang 2:</p>
                  <p className="font-bold mt-1">
                    {supervisorMap.get(activeSchedule.supervisors[1]?.supervisorId)?.name || '__________________________'}
                  </p>
                  <p>
                    NIP.{' '}
                    {supervisorMap.get(activeSchedule.supervisors[1]?.supervisorId)?.nip || '__________________________'}
                  </p>
                  <div className="h-10 mt-1">TTD: .......................................</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REPORT I: REKAP KETIDAKHADIRAN */}
        {activeReport === 'REKAP_KETIDAKHADIRAN' && (() => {
          const targetDate = selectedDate !== 'ALL' ? selectedDate : (uniqueDates[0] || '');
          const displayedRooms = rooms.filter(
            (r) => selectedRoomId === 'ALL' || r.id === selectedRoomId
          );

          let grandTotalSeharusnya = 0;
          let grandTotalHadir = 0;
          let grandTotalTidakHadir = 0;

          const rows = displayedRooms.map((room, idx) => {
            const targetSchedules = schedules.filter(
              (s) =>
                s.roomId === room.id &&
                (!targetDate || s.date === targetDate) &&
                (selectedSession === 'ALL' || String(s.session) === String(selectedSession))
            );
            const targetScheduleIds = new Set(targetSchedules.map((s) => s.id));
            const roomAttendances = attendances.filter((a) => targetScheduleIds.has(a.scheduleId));

            const permStudents = StorageService.getStudentsForRoom(room.id);
            let candidateStudents: Student[] = [];

            if (permStudents.length > 0) {
              if (targetSchedules.length > 0) {
                const scheduledClassIds = new Set(
                  targetSchedules.flatMap((sch) => sch.groups.map((g) => g.classId))
                );
                const matchedPerm = permStudents.filter((s) => scheduledClassIds.has(s.classId));
                candidateStudents = matchedPerm.length > 0 ? matchedPerm : permStudents;
              } else if (selectedSession !== 'ALL') {
                candidateStudents = [];
              } else {
                candidateStudents = permStudents;
              }
            } else {
              const seen = new Set<string>();
              targetSchedules.forEach((sch) => {
                sch.groups.forEach((grp) => {
                  if (grp.selectedStudentIds && grp.selectedStudentIds.length > 0) {
                    grp.selectedStudentIds.forEach((sid) => {
                      const st = studentMap.get(sid);
                      if (st && !seen.has(st.id)) {
                        seen.add(st.id);
                        candidateStudents.push(st);
                      }
                    });
                  } else {
                    const clsStudents = students.filter(
                      (s) => s.classId === grp.classId && s.status === 'AKTIF'
                    );
                    clsStudents.slice(0, grp.participantCount || undefined).forEach((st) => {
                      if (!seen.has(st.id)) {
                        seen.add(st.id);
                        candidateStudents.push(st);
                      }
                    });
                  }
                });
              });
            }

            if (selectedClassId !== 'ALL') {
              candidateStudents = candidateStudents.filter((s) => s.classId === selectedClassId);
            }

            // Urutkan semua Daftar Nama Siswa berdasarkan Abjad Nama Lengkap dan Kelas
            candidateStudents.sort((a, b) => {
              const nameComp = (a.name || '').localeCompare(b.name || '', 'id', { sensitivity: 'base' });
              if (nameComp !== 0) return nameComp;
              const clsA = classMap.get(a.classId)?.name || a.classId || '';
              const clsB = classMap.get(b.classId)?.name || b.classId || '';
              return clsA.localeCompare(clsB, 'id', { numeric: true });
            });

            const studentAbsentAttendances = new Map<string, { status: string; notes?: string }[]>();
            roomAttendances.forEach((a) => {
              if (['Tidak Hadir', 'Sakit', 'Izin', 'Alpa'].includes(a.status)) {
                const list = studentAbsentAttendances.get(a.studentId) || [];
                list.push({ status: a.status, notes: a.notes });
                studentAbsentAttendances.set(a.studentId, list);
              }
            });

            const absentList: { student: Student; status: string; notes?: string }[] = [];
            candidateStudents.forEach((stu) => {
              const atts = studentAbsentAttendances.get(stu.id);
              if (atts && atts.length > 0) {
                const primary = atts[0];
                absentList.push({ student: stu, status: primary.status, notes: primary.notes });
              }
            });

            const seharusnya = candidateStudents.length;
            const tidakHadir = absentList.length;
            const hadir = Math.max(0, seharusnya - tidakHadir);

            grandTotalSeharusnya += seharusnya;
            grandTotalHadir += hadir;
            grandTotalTidakHadir += tidakHadir;

            const keterangan =
              absentList.length > 0
                ? absentList
                    .map(
                      (item, i) =>
                        `${i + 1}. ${item.student.name} (${classMap.get(item.student.classId)?.name || '-'} - ${item.status}${item.notes ? `: ${item.notes}` : ''})`
                    )
                    .join('; ')
                : seharusnya > 0
                ? 'Nihil (Hadir Semua)'
                : '- (Tidak ada jadwal)';

            return {
              no: idx + 1,
              room,
              seharusnya,
              hadir,
              tidakHadir,
              absentList,
              keterangan
            };
          });

          return (
            <div>
              <PrintHeader
                settings={settings}
                documentTitle={`REKAPITULASI KETIDAKHADIRAN SISWA PER HARI - ${examTitleSuffix}`}
                documentSubtitle={`${reportSubtitle}${targetDate ? ` • Tanggal: ${targetDate}` : ''}${selectedSession !== 'ALL' ? ` • Sesi: ${selectedSession}` : ''}`}
              />

              <table className="w-full border-collapse border border-black text-xs mt-4">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-black p-2 text-center align-middle w-10">
                      No
                    </th>
                    <th className="border border-black p-2 text-center align-middle w-14">
                      Ruang
                    </th>
                    <th className="border border-black p-2 text-center align-middle w-20 leading-tight">
                      <div>Jumlah</div>
                      <div>Seharusnya</div>
                    </th>
                    <th className="border border-black p-2 text-center align-middle w-16 leading-tight">
                      <div>Jumlah</div>
                      <div>Hadir</div>
                    </th>
                    <th className="border border-black p-2 text-center align-middle w-28 leading-tight">
                      <div>Jumlah</div>
                      <div>Tidak Hadir</div>
                    </th>
                    <th className="border border-black p-2 text-center align-middle w-auto leading-tight">
                      <div>Keterangan</div>
                      <div className="text-[11px] font-normal text-slate-700">(Siswa Tidak Hadir)</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="border border-black p-4 text-center text-gray-500 italic">
                        Tidak ada ruang yang sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.room.id}>
                        <td className="border border-black p-2 text-center whitespace-nowrap">{row.no}</td>
                        <td className="border border-black p-2 text-center font-bold whitespace-nowrap" title={row.room.name}>
                          {row.room.code}
                        </td>
                        <td className="border border-black p-2 text-center font-semibold whitespace-nowrap">
                          {row.seharusnya}
                        </td>
                        <td className="border border-black p-2 text-center font-bold text-emerald-800 whitespace-nowrap">
                          {row.hadir}
                        </td>
                        <td className="border border-black p-2 text-center font-bold text-rose-800 whitespace-nowrap">
                          {row.tidakHadir}
                        </td>
                        <td className="border border-black p-2 text-[11px] leading-relaxed break-words">
                          {row.absentList.length > 0 ? (
                            <span className="text-rose-900 font-medium">{row.keterangan}</span>
                          ) : (
                            <span className="text-slate-500 italic">{row.keterangan}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold">
                    <td colSpan={2} className="border border-black p-2 text-center uppercase tracking-wider whitespace-nowrap">
                      Total Keseluruhan
                    </td>
                    <td className="border border-black p-2 text-center whitespace-nowrap">
                      {grandTotalSeharusnya}
                    </td>
                    <td className="border border-black p-2 text-center text-emerald-800 whitespace-nowrap">
                      {grandTotalHadir}
                    </td>
                    <td className="border border-black p-2 text-center text-rose-800 whitespace-nowrap">
                      {grandTotalTidakHadir}
                    </td>
                    <td className="border border-black p-2 text-xs">
                      {grandTotalSeharusnya > 0 ? (
                        <span>
                          Tingkat Kehadiran:{' '}
                          {((grandTotalHadir / grandTotalSeharusnya) * 100).toFixed(1)}%
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })()}

        {/* REPORT J: DENAH & PEMBAGIAN RUANG */}
        {activeReport === 'PEMBAGIAN_RUANG' && (
          <div>
            <PrintHeader
              settings={settings}
              documentTitle={`DENAH DAN PEMBAGIAN RUANG - ${examTitleSuffix}`}
              documentSubtitle={reportSubtitle}
            />

            <div className="grid grid-cols-3 gap-3 my-4 text-xs font-serif text-center">
              <div className="border border-black p-2 rounded">
                <span>Total Ruang Ujian</span>
                <p className="text-base font-bold">{rooms.length} Ruang</p>
              </div>
              <div className="border border-black p-2 rounded">
                <span>Total Kapasitas Meja</span>
                <p className="text-base font-bold">
                  {rooms.reduce((a, b) => a + b.capacity, 0)} Meja
                </p>
              </div>
              <div className="border border-black p-2 rounded">
                <span>Total Siswa Terdaftar</span>
                <p className="text-base font-bold">{students.length} Siswa</p>
              </div>
            </div>

            <table className="w-full border-collapse border border-black text-xs">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black p-1.5 text-center w-8">No</th>
                  <th className="border border-black p-1.5 text-center">Kode Ruang</th>
                  <th className="border border-black p-1.5 text-left">Nama Ruangan</th>
                  <th className="border border-black p-1.5 text-center">Gedung / Lantai</th>
                  <th className="border border-black p-1.5 text-center">Kapasitas</th>
                  <th className="border border-black p-1.5 text-center">Sesi Ujian</th>
                  <th className="border border-black p-1.5 text-left">Kelas yang Menempati</th>
                </tr>
              </thead>
              <tbody>
                {rooms
                  .filter((r) => selectedRoomId === 'ALL' || r.id === selectedRoomId)
                  .map((rm, idx) => {
                    const rmSchedules = schedules.filter((s) => s.roomId === rm.id);
                    const classesAssigned = Array.from(
                      new Set(
                        rmSchedules.flatMap((s) =>
                          s.groups.map((g) => classMap.get(g.classId)?.name).filter(Boolean)
                        )
                      )
                    ).join(', ');

                    return (
                      <tr key={rm.id}>
                        <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                        <td className="border border-black p-1.5 text-center font-bold font-mono">
                          {rm.code}
                        </td>
                        <td className="border border-black p-1.5 font-medium">{rm.name}</td>
                        <td className="border border-black p-1.5 text-center">{rm.building}</td>
                        <td className="border border-black p-1.5 text-center font-bold">
                          {rm.capacity} Meja
                        </td>
                        <td className="border border-black p-1.5 text-center font-semibold">
                          {rmSchedules.length} Sesi
                        </td>
                        <td className="border border-black p-1.5 text-[11px]">{classesAssigned || '-'}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* REPORT K: CETAK KARTU PESERTA */}
        {activeReport === 'KARTU_PESERTA' && (
          <div>
            <PrintHeader
              settings={settings}
              documentTitle={`KARTU PESERTA ${examTitleSuffix}`}
              documentSubtitle={reportSubtitle}
            />

            <div className="grid grid-cols-2 gap-4 mt-4">
              {filteredAndSortedStudents
                .slice(0, 32)
                .map((stu) => {
                  const cardLogo =
                    settings.logoUrl ||
                    (typeof window !== 'undefined' ? localStorage.getItem('aus_school_logo') : null);
                  const cls = classMap.get(stu.classId);

                  return (
                    <div
                      key={stu.id}
                      className="border-2 border-black rounded-lg p-3 text-xs bg-white space-y-2 print-avoid-break"
                    >
                      <div className="border-b border-black pb-1.5 flex items-center justify-between gap-2">
                        {cardLogo ? (
                          <div className="w-10 h-10 shrink-0 flex items-center justify-center overflow-hidden">
                            <img
                              src={cardLogo}
                              alt="Logo"
                              className="max-w-full max-h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 border border-black rounded flex flex-col items-center justify-center text-[7px] font-bold text-center shrink-0">
                            <span>LOGO</span>
                          </div>
                        )}
                        <div className="flex-1 text-center">
                          <p className="font-bold text-[10px] uppercase tracking-wide">
                            {settings.schoolName}
                          </p>
                          <p className="font-black text-xs uppercase text-blue-900">
                            KARTU PESERTA {settings.examName || 'UJIAN'}
                          </p>
                          <p className="text-[9px] text-gray-700">TP {settings.academicYear}</p>
                        </div>
                        <div className="w-10 h-10 shrink-0" />
                      </div>

                      <div className="flex gap-2.5 pt-1">
                        <div className="w-16 h-20 border border-black rounded flex flex-col items-center justify-center text-[9px] text-gray-500 shrink-0">
                          <span>Foto</span>
                          <span>2 x 3</span>
                        </div>

                        <div className="flex-1 space-y-0.5 text-[11px]">
                          <p>
                            <span className="inline-block w-20 font-semibold">No. Peserta</span>:{' '}
                            <strong className="font-mono">{stu.examNumber}</strong>
                          </p>
                          <p>
                            <span className="inline-block w-20 font-semibold">Nama Siswa</span>:{' '}
                            <strong>{stu.name}</strong>
                          </p>
                          <p>
                            <span className="inline-block w-20 font-semibold">NIS / NISN</span>:{' '}
                            {stu.nis} / {stu.nisn || '-'}
                          </p>
                          <p>
                            <span className="inline-block w-20 font-semibold">Kelas</span>:{' '}
                            {cls?.name} ({stu.major})
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-black pt-1 flex justify-between items-end text-[9px]">
                        <div>
                          <p className="font-medium">Ruang: Sesuai Jadwal / Mapping</p>
                          <p className="text-gray-500">Harap dibawa selama ujian</p>
                        </div>
                        <div className="text-center w-28">
                          <p>Kepala Sekolah,</p>
                          <div className="h-6"></div>
                          <p className="font-bold underline">{settings.principalName}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* REPORT L: LABEL MEJA UJIAN */}
        {activeReport === 'LABEL_MEJA' && (
          <div>
            <PrintHeader
              settings={settings}
              documentTitle={`LABEL MEJA PESERTA ${examTitleSuffix}`}
              documentSubtitle={reportSubtitle}
            />
            <div className="grid grid-cols-2 gap-4 mt-6">
              {filteredAndSortedStudents
                .slice(0, 32)
                .map((stu) => (
                  <div
                    key={stu.id}
                    className="border-2 border-black p-3 text-center rounded-lg space-y-1 bg-slate-50 print-avoid-break"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider">
                      {settings.schoolName}
                    </p>
                    <div className="border-t border-b border-black py-1">
                      <p className="text-base font-black font-mono tracking-widest text-blue-900">
                        {stu.examNumber}
                      </p>
                    </div>
                    <p className="text-xs font-bold uppercase truncate">{stu.name}</p>
                    <p className="text-[10px] text-gray-700">
                      Kelas: {classMap.get(stu.classId)?.name} | NIS: {stu.nis}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* REPORT M: DAFTAR PESERTA PER RUANG */}
        {activeReport === 'PESERTA_PER_RUANG' && (
          <div>
            <PrintHeader
              settings={settings}
              documentTitle={`DAFTAR NOMINASI PESERTA PER RUANG - ${examTitleSuffix}`}
              documentSubtitle={reportSubtitle}
            />

            <div className="space-y-6 mt-4">
              {rooms
                .filter((r) => selectedRoomId === 'ALL' || r.id === selectedRoomId)
                .map((room) => {
                  const permStudents = StorageService.getStudentsForRoom(room.id);
                  let roomStudents: Student[] = [];

                  if (permStudents.length > 0) {
                    roomStudents = permStudents;
                  } else {
                    const roomSchedules = schedules.filter((s) => s.roomId === room.id);
                    const studentIdsInRoom = new Set<string>();
                    roomSchedules.forEach((sch) => {
                      sch.groups.forEach((grp) => {
                        if (grp.selectedStudentIds && grp.selectedStudentIds.length > 0) {
                          grp.selectedStudentIds.forEach((sid) => studentIdsInRoom.add(sid));
                        } else {
                          students
                            .filter((s) => s.classId === grp.classId && s.status === 'AKTIF')
                            .slice(0, grp.participantCount || undefined)
                            .forEach((s) => studentIdsInRoom.add(s.id));
                        }
                      });
                    });
                    roomStudents = Array.from(studentIdsInRoom)
                      .map((sid) => studentMap.get(sid))
                      .filter(Boolean) as Student[];
                  }

                  if (selectedClassId !== 'ALL') {
                    roomStudents = roomStudents.filter((s) => s.classId === selectedClassId);
                  }

                  // Urutkan semua Daftar Nama Siswa berdasarkan Abjad Nama Lengkap dan Kelas
                  roomStudents.sort((a, b) => {
                    const nameComp = (a.name || '').localeCompare(b.name || '', 'id', {
                      sensitivity: 'base'
                    });
                    if (nameComp !== 0) return nameComp;
                    const clsA = classMap.get(a.classId)?.name || a.classId || '';
                    const clsB = classMap.get(b.classId)?.name || b.classId || '';
                    return clsA.localeCompare(clsB, 'id', { numeric: true });
                  });

                  return (
                    <div key={room.id} className="border border-black p-3 rounded print-avoid-break">
                      <div className="flex justify-between font-bold border-b border-black pb-1 mb-2 text-xs">
                        <span>
                          Ruang: {room.code} - {room.name} ({room.building})
                        </span>
                        <span>Total Peserta: {roomStudents.length} Siswa</span>
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
                            <th className="border border-black p-1 text-center w-20">Keterangan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roomStudents.length === 0 ? (
                            <tr>
                              <td
                                colSpan={8}
                                className="border border-black p-3 text-center text-gray-500 italic"
                              >
                                Belum ada peserta terjadwal di ruang ini.
                              </td>
                            </tr>
                          ) : (
                            roomStudents.map((stu, i) => (
                              <tr key={stu.id}>
                                <td className="border border-black p-1 text-center">{i + 1}</td>
                                <td className="border border-black p-1 text-center font-bold">
                                  {i + 1}
                                </td>
                                <td className="border border-black p-1 text-center font-mono font-bold">
                                  {stu.examNumber}
                                </td>
                                <td className="border border-black p-1 text-center font-mono">
                                  {stu.nis}
                                </td>
                                <td className="border border-black p-1 font-medium">{stu.name}</td>
                                <td className="border border-black p-1 text-center">{stu.gender}</td>
                                <td className="border border-black p-1 text-center">
                                  {classMap.get(stu.classId)?.name}
                                </td>
                                <td className="border border-black p-1 text-center text-[10px]">
                                  Peserta Utama
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* REPORT N: PAKTA INTEGRITAS PENGAWAS */}
        {activeReport === 'PAKTA_INTEGRITAS' && (
          <div className="space-y-4">
            <PrintHeader
              settings={settings}
              documentTitle={`PAKTA INTEGRITAS PENGAWAS RUANG - ${examTitleSuffix}`}
              documentSubtitle={reportSubtitle}
            />

            <div className="text-xs leading-relaxed space-y-3">
              <p>Saya yang bertanda tangan di bawah ini:</p>
              <table className="w-full text-xs">
                <tbody>
                  <tr>
                    <td className="w-32 py-1">Nama Lengkap</td>
                    <td className="py-1">: ________________________________________</td>
                  </tr>
                  <tr>
                    <td className="py-1">NIP / NUPTK</td>
                    <td className="py-1">: ________________________________________</td>
                  </tr>
                  <tr>
                    <td className="py-1">Unit Kerja / Asal</td>
                    <td className="py-1">: {settings.schoolName}</td>
                  </tr>
                </tbody>
              </table>

              <p>Dengan ini menyatakan bahwa saya:</p>
              <ol className="list-decimal list-inside space-y-1.5 pl-2">
                <li>
                  Sanggup mematuhi dan melaksanakan seluruh tata tertib pengawas ujian dengan penuh integritas, jujur, dan bertanggung jawab.
                </li>
                <li>
                  Menjaga kerahasiaan dan keamanan dokumen ujian, baik soal maupun lembar jawaban peserta.
                </li>
                <li>
                  Tidak membantu atau membiarkan peserta ujian melakukan kecurangan dalam bentuk apapun.
                </li>
                <li>
                  Hadir di lokasi ujian sekurang-kurangnya 30 menit sebelum ujian dimulai.
                </li>
              </ol>

              <p className="pt-2">
                Pernyataan ini saya buat dengan sesungguhnya dan tanpa paksaan dari pihak manapun. Apabila saya melanggar pakta integritas ini, saya bersedia menerima sanksi sesuai dengan peraturan perundang-undangan yang berlaku.
              </p>
            </div>
          </div>
        )}

        {/* REPORT O: TATA TERTIB */}
        {activeReport === 'TATA_TERTIB' && (
          <div className="space-y-4">
            <PrintHeader
              settings={settings}
              documentTitle={`TATA TERTIB PESERTA & PENGAWAS - ${examTitleSuffix}`}
              documentSubtitle={reportSubtitle}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-justify">
              <div className="border border-black p-3 rounded">
                <h4 className="font-bold text-center border-b border-black pb-1 mb-2 uppercase">
                  Tata Tertib Peserta Ujian
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-[11px]">
                  <li>Hadir di ruang ujian 15 menit sebelum ujian dimulai.</li>
                  <li>Membawa kartu peserta ujian dan alat tulis yang sah.</li>
                  <li>Dilarang membawa HP, catatan, atau kalkulator ke ruang ujian kecuali diizinkan.</li>
                  <li>Mengisi daftar hadir yang telah disediakan pengawas.</li>
                  <li>Dilarang bekerja sama atau mencontek selama ujian berlangsung.</li>
                  <li>Meninggalkan ruangan hanya dengan izin pengawas ruang.</li>
                </ol>
              </div>

              <div className="border border-black p-3 rounded">
                <h4 className="font-bold text-center border-b border-black pb-1 mb-2 uppercase">
                  Tata Tertib Pengawas Ruang
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-[11px]">
                  <li>Hadir di ruang panitia 30 menit sebelum ujian dimulai.</li>
                  <li>Memeriksa kebersihan ruang dan kesesuaian nomor meja peserta.</li>
                  <li>Mengedarkan daftar hadir kepada peserta ujian.</li>
                  <li>Membacakan tata tertib peserta sebelum lembar soal dibuka.</li>
                  <li>Menjaga ketertiban dan tidak merokok atau memainkan gawai di ruang ujian.</li>
                  <li>Mengisi dan menandatangani Berita Acara Ujian secara lengkap.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Signatures for Official Documents (except Berita Acara which has its own signatures) */}
        {activeReport !== 'BERITA_ACARA' && (
          <div className="mt-12 flex justify-between text-xs font-serif pt-6 border-t border-gray-300 print-avoid-break">
            <div className="text-center w-56">
              <p className="invisible">Keterangan</p>
              <p className="font-semibold">Ketua Panitia Ujian,</p>
              <div className="h-16"></div>
              <p className="font-bold underline">{settings.committeeHeadName}</p>
              <p>NIP. {settings.committeeHeadNip}</p>
            </div>

            <div className="text-center w-56">
              <p>{settings.city || 'Kota'}, {new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</p>
              <p className="font-semibold">Kepala Sekolah,</p>
              <div className="h-16"></div>
              <p className="font-bold underline">{settings.principalName}</p>
              <p>NIP. {settings.principalNip}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
