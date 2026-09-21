import React, { useMemo, useEffect } from 'react';
import { Calendar, DoorOpen, Clock, Layers } from 'lucide-react';
import { ExamSchedule, Room, Subject } from '../../types';
import { getSessionLabel } from '../../lib/sessionHelper';

interface ExamScheduleSelectorProps {
  schedules: ExamSchedule[];
  rooms: Room[];
  subjects?: Subject[];
  selectedScheduleId: string;
  onSelectScheduleId: (id: string) => void;
  className?: string;
}

export const ExamScheduleSelector: React.FC<ExamScheduleSelectorProps> = ({
  schedules,
  rooms,
  subjects = [],
  selectedScheduleId,
  onSelectScheduleId,
  className = ''
}) => {
  const roomMap = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const scheduleMap = useMemo(() => new Map(schedules.map((s) => [s.id, s])), [schedules]);

  const activeSchedule = scheduleMap.get(selectedScheduleId) || schedules[0];

  // 1. Available Dates (unique, sorted ascending)
  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(schedules.map((s) => s.date).filter(Boolean)));
    return dates.sort();
  }, [schedules]);

  // Current selected date
  const selectedDate = activeSchedule?.date || availableDates[0] || '';

  // 2. Available Rooms on the selected date
  const availableRoomsOnDate = useMemo(() => {
    if (!selectedDate) return [];
    const roomIdsOnDate = Array.from(
      new Set(
        schedules
          .filter((s) => s.date === selectedDate)
          .map((s) => s.roomId)
      )
    );
    return roomIdsOnDate
      .map((rid) => roomMap.get(rid))
      .filter((r): r is Room => Boolean(r))
      .sort((a, b) => a.code.localeCompare(b.code, 'id', { numeric: true }));
  }, [selectedDate, schedules, roomMap]);

  // Current selected room
  const selectedRoomId = activeSchedule?.roomId || availableRoomsOnDate[0]?.id || '';

  // 3. Available Sessions on the selected date & room
  const availableSessions = useMemo(() => {
    if (!selectedDate || !selectedRoomId) return [];
    return schedules
      .filter((s) => s.date === selectedDate && s.roomId === selectedRoomId)
      .sort((a, b) => {
        if (a.session !== b.session) return a.session - b.session;
        return a.startTime.localeCompare(b.startTime);
      });
  }, [selectedDate, selectedRoomId, schedules]);

  // Handlers
  const handleDateChange = (newDate: string) => {
    const schedulesOnDate = schedules.filter((s) => s.date === newDate);
    if (schedulesOnDate.length === 0) return;

    // Check if current roomId exists on this new date
    const sameRoomSchedule = schedulesOnDate.find((s) => s.roomId === selectedRoomId);
    if (sameRoomSchedule) {
      onSelectScheduleId(sameRoomSchedule.id);
    } else {
      onSelectScheduleId(schedulesOnDate[0].id);
    }
  };

  const handleRoomChange = (newRoomId: string) => {
    const sessions = schedules.filter(
      (s) => s.date === selectedDate && s.roomId === newRoomId
    );
    if (sessions.length > 0) {
      onSelectScheduleId(sessions[0].id);
    }
  };

  const handleSessionChange = (newScheduleId: string) => {
    onSelectScheduleId(newScheduleId);
  };

  // Auto-sync if selectedScheduleId is invalid
  useEffect(() => {
    if (schedules.length > 0 && !scheduleMap.has(selectedScheduleId)) {
      onSelectScheduleId(schedules[0].id);
    }
  }, [schedules, selectedScheduleId, scheduleMap, onSelectScheduleId]);

  if (schedules.length === 0) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
        <Layers className="w-4 h-4 text-amber-600 shrink-0" />
        <span>Belum ada data jadwal ujian yang terdaftar. Silakan hubungi Administrator/Panitia untuk membuat jadwal.</span>
      </div>
    );
  }

  return (
    <div className={`bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-blue-600" />
          Tahapan Pemilihan: 1. Tanggal &rarr; 2. Ruang &rarr; 3. Sesi
        </span>
        {activeSchedule && (
          <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            Jadwal Aktif Terpilih
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Step 1: Pemilihan Tanggal */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
            <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
              1
            </span>
            <Calendar className="w-3.5 h-3.5 text-blue-600 ml-0.5" />
            Pemilihan Tanggal
          </label>
          <select
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {availableDates.map((date) => (
              <option key={date} value={date}>
                {date}
              </option>
            ))}
          </select>
        </div>

        {/* Step 2: Pemilihan Ruang */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
            <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
              2
            </span>
            <DoorOpen className="w-3.5 h-3.5 text-blue-600 ml-0.5" />
            Pemilihan Ruang
          </label>
          <select
            value={selectedRoomId}
            onChange={(e) => handleRoomChange(e.target.value)}
            disabled={availableRoomsOnDate.length === 0}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
          >
            {availableRoomsOnDate.length === 0 ? (
              <option value="">Tidak ada ruang pada tanggal ini</option>
            ) : (
              availableRoomsOnDate.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} - {r.name}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Step 3: Pemilihan Sesi */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
            <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
              3
            </span>
            <Clock className="w-3.5 h-3.5 text-blue-600 ml-0.5" />
            Pemilihan Sesi
          </label>
          <select
            value={activeSchedule?.id || ''}
            onChange={(e) => handleSessionChange(e.target.value)}
            disabled={availableSessions.length === 0}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
          >
            {availableSessions.length === 0 ? (
              <option value="">Tidak ada sesi pada ruang &amp; tanggal ini</option>
            ) : (
              availableSessions.map((s) => {
                const subNames = s.groups
                  .map((g) => subjectMap.get(g.subjectId)?.name || 'Mapel')
                  .filter(Boolean)
                  .join(' / ');
                return (
                  <option key={s.id} value={s.id}>
                    {getSessionLabel(s.session)} ({s.startTime} - {s.endTime}) {subNames ? `• ${subNames}` : ''}
                  </option>
                );
              })
            )}
          </select>
        </div>
      </div>
    </div>
  );
};
