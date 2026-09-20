import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Users,
  CheckCircle2,
  X,
  DoorOpen,
  AlertTriangle,
  RotateCcw,
  CheckSquare,
  Square,
  Sparkles
} from 'lucide-react';
import { Student, Room, ClassItem, Subject } from '../../types';

interface StudentRoomSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  room?: Room;
  classItem?: ClassItem;
  subject?: Subject;
  studentsInClass: Student[];
  initialSelectedIds: string[];
  otherGroupsStudentCountInRoom: number;
  onSave: (selectedIds: string[]) => void;
}

export const StudentRoomSelectorModal: React.FC<StudentRoomSelectorModalProps> = ({
  isOpen,
  onClose,
  room,
  classItem,
  subject,
  studentsInClass,
  initialSelectedIds,
  otherGroupsStudentCountInRoom,
  onSave
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'L' | 'P'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SELECTED' | 'UNSELECTED'>('ALL');
  const [batchCount, setBatchCount] = useState<number>(10);

  // Initialize selected IDs when modal opens
  useEffect(() => {
    if (isOpen) {
      // If initialSelectedIds is empty, we default to whatever was passed (could be empty or all)
      setSelectedIds(initialSelectedIds || []);
      setSearchQuery('');
      setGenderFilter('ALL');
      setStatusFilter('ALL');
    }
  }, [isOpen, initialSelectedIds]);

  // Sort students in this class by attendance/exam number or name
  const sortedStudents = useMemo(() => {
    return studentsInClass.slice().sort((a, b) => {
      if (a.examNumber && b.examNumber) {
        return a.examNumber.localeCompare(b.examNumber, 'id', { numeric: true });
      }
      return a.name.localeCompare(b.name, 'id', { numeric: true });
    });
  }, [studentsInClass]);

  // Filtered students based on search and filters
  const filteredStudents = useMemo(() => {
    return sortedStudents.filter((stu) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = stu.name.toLowerCase().includes(q);
        const matchNis = (stu.nis || '').toLowerCase().includes(q);
        const matchNisn = (stu.nisn || '').toLowerCase().includes(q);
        const matchExam = (stu.examNumber || '').toLowerCase().includes(q);
        if (!matchName && !matchNis && !matchNisn && !matchExam) return false;
      }

      // Gender
      if (genderFilter !== 'ALL' && stu.gender !== genderFilter) {
        return false;
      }

      // Status
      const isSelected = selectedIds.includes(stu.id);
      if (statusFilter === 'SELECTED' && !isSelected) return false;
      if (statusFilter === 'UNSELECTED' && isSelected) return false;

      return true;
    });
  }, [sortedStudents, searchQuery, genderFilter, statusFilter, selectedIds]);

  if (!isOpen) return null;

  const roomCapacity = room?.capacity || 30;
  const currentTotalInRoom = otherGroupsStudentCountInRoom + selectedIds.length;
  const isOverCapacity = currentTotalInRoom > roomCapacity;
  const remainingRoomSeats = Math.max(0, roomCapacity - otherGroupsStudentCountInRoom);

  // Selection toggle handlers
  const handleToggleStudent = (studentId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(studentId)) {
        return prev.filter((id) => id !== studentId);
      } else {
        return [...prev, studentId];
      }
    });
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredStudents.map((s) => s.id);
    setSelectedIds((prev) => {
      const set = new Set([...prev, ...filteredIds]);
      return Array.from(set);
    });
  };

  const handleDeselectAllFiltered = () => {
    const filteredIdSet = new Set(filteredStudents.map((s) => s.id));
    setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
  };

  const handleSelectAllInClass = () => {
    setSelectedIds(sortedStudents.map((s) => s.id));
  };

  const handleClearAll = () => {
    setSelectedIds([]);
  };

  const handleSelectUpToRemainingSeats = () => {
    const needed = remainingRoomSeats;
    const candidates = sortedStudents.filter((s) => s.status === 'AKTIF');
    const picked = candidates.slice(0, needed).map((s) => s.id);
    setSelectedIds(picked);
  };

  const handleSelectBatch = (count: number) => {
    const candidates = sortedStudents.filter((s) => s.status === 'AKTIF');
    const picked = candidates.slice(0, count).map((s) => s.id);
    setSelectedIds(picked);
  };

  const handleSelectByGender = (gender: 'L' | 'P') => {
    const matched = sortedStudents
      .filter((s) => s.gender === gender && s.status === 'AKTIF')
      .map((s) => s.id);
    setSelectedIds(matched);
  };

  const handleApply = () => {
    onSave(selectedIds);
    onClose();
  };

  const allFilteredSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedIds.includes(s.id));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        {/* Header */}
        <div className="p-4 sm:px-6 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Users className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                Pilih Siswa Masuk Ruangan
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-100 border border-blue-400/20">
                  Fleksibel
                </span>
              </h3>
              <p className="text-xs text-blue-200 mt-0.5">
                Ruang: <strong className="text-white">{room?.code} - {room?.name}</strong> • Kelas:{' '}
                <strong className="text-white">{classItem?.name}</strong>{' '}
                {subject && `• Mapel: ${subject.name}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Capacity & Allocation Gauge Bar */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 sm:px-6 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-1.5">
                <DoorOpen className="w-4 h-4 text-slate-500" />
                <span className="text-slate-600">Kapasitas Ruang:</span>
                <strong className="text-slate-900">{roomCapacity} Kursi</strong>
              </div>
              <div className="h-4 w-px bg-slate-200 hidden sm:block" />
              <div>
                <span className="text-slate-600">Siswa Lain di Ruang Ini:</span>{' '}
                <strong className="text-slate-800">{otherGroupsStudentCountInRoom} Siswa</strong>
              </div>
              <div className="h-4 w-px bg-slate-200 hidden sm:block" />
              <div>
                <span className="text-slate-600">Sisa Kuota Ruang:</span>{' '}
                <strong className={remainingRoomSeats > 0 ? 'text-blue-700 font-bold' : 'text-slate-500'}>
                  {remainingRoomSeats} Kursi
                </strong>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-600">Siswa Dipilih dari Kelas Ini:</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  selectedIds.length > 0
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {selectedIds.length} Siswa
              </span>
            </div>
          </div>

          {/* Real-time Progress Bar */}
          <div>
            <div className="flex justify-between text-[11px] mb-1 font-medium">
              <span className="text-slate-500">
                Total Akumulasi Siswa di Ruangan Ini:
              </span>
              <span className={isOverCapacity ? 'text-rose-600 font-bold' : 'text-slate-700 font-semibold'}>
                {currentTotalInRoom} / {roomCapacity} Kursi ({Math.round((currentTotalInRoom / roomCapacity) * 100)}%)
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
              {/* Other groups portion */}
              {otherGroupsStudentCountInRoom > 0 && (
                <div
                  style={{
                    width: `${Math.min(100, (otherGroupsStudentCountInRoom / roomCapacity) * 100)}%`
                  }}
                  className="bg-slate-400 h-full transition-all"
                  title={`Siswa dari kelas lain: ${otherGroupsStudentCountInRoom}`}
                />
              )}
              {/* Currently selected in this group */}
              <div
                style={{
                  width: `${Math.min(
                    Math.max(0, 100 - (otherGroupsStudentCountInRoom / roomCapacity) * 100),
                    (selectedIds.length / roomCapacity) * 100
                  )}%`
                }}
                className={`h-full transition-all ${
                  isOverCapacity ? 'bg-rose-500' : 'bg-blue-600'
                }`}
                title={`Siswa dipilih dari kelas ini: ${selectedIds.length}`}
              />
            </div>
          </div>

          {isOverCapacity && (
            <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                Total siswa ({currentTotalInRoom}) melebihi daya tampung normal ruangan ({roomCapacity} kursi).
                Pastikan kursi tambahan telah disediakan.
              </span>
            </div>
          )}
        </div>

        {/* Search, Filters & Quick Tools */}
        <div className="p-3 sm:px-6 bg-white border-b border-slate-200 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            {/* Search Input */}
            <div className="sm:col-span-6 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama siswa, NIS, NISN, no ujian..."
                className="w-full pl-9 pr-8 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Gender */}
            <div className="sm:col-span-3">
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value as any)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Semua Gender (L &amp; P)</option>
                <option value="L">Laki-laki Saja (L)</option>
                <option value="P">Perempuan Saja (P)</option>
              </select>
            </div>

            {/* Filter Status Selection */}
            <div className="sm:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Semua Status ({sortedStudents.length})</option>
                <option value="SELECTED">Hanya Terpilih ({selectedIds.length})</option>
                <option value="UNSELECTED">
                  Belum Terpilih ({Math.max(0, sortedStudents.length - selectedIds.length)})
                </option>
              </select>
            </div>
          </div>

          {/* Quick Selection Tool Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
            <span className="text-[11px] font-semibold text-slate-500 mr-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-blue-600" />
              Opsi Cepat:
            </span>

            {/* Select all in class */}
            <button
              type="button"
              onClick={handleSelectAllInClass}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition-colors cursor-pointer"
            >
              Semua Siswa Kelas ({sortedStudents.length})
            </button>

            {/* Fill up to remaining room capacity */}
            {remainingRoomSeats > 0 && (
              <button
                type="button"
                onClick={handleSelectUpToRemainingSeats}
                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                title={`Pilih ${remainingRoomSeats} siswa pertama sesuai sisa kuota kursi`}
              >
                Isi Sisa Kuota Ruang ({remainingRoomSeats} Siswa)
              </button>
            )}

            {/* Preset count buttons & custom input */}
            <div className="flex items-center bg-slate-100 rounded p-0.5 border border-slate-200">
              <span className="text-[10px] text-slate-500 px-1.5">Pilih N:</span>
              {[5, 10, 15, 20].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setBatchCount(num);
                    handleSelectBatch(num);
                  }}
                  className={`px-1.5 py-0.5 text-[11px] font-medium rounded transition-colors ${
                    batchCount === num
                      ? 'bg-white text-blue-700 shadow-2xs font-bold'
                      : 'text-slate-700 hover:bg-white hover:text-blue-700'
                  }`}
                >
                  {num}
                </button>
              ))}
              <div className="flex items-center ml-1 pl-1 border-l border-slate-300">
                <input
                  type="number"
                  min="1"
                  max={sortedStudents.length || 100}
                  value={batchCount}
                  onChange={(e) => setBatchCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-11 px-1 py-0.5 text-[11px] bg-white border border-slate-300 rounded text-center"
                  title="Jumlah siswa kustom"
                />
                <button
                  type="button"
                  onClick={() => handleSelectBatch(batchCount)}
                  className="ml-1 px-1.5 py-0.5 text-[10px] bg-blue-600 hover:bg-blue-700 text-white rounded font-medium cursor-pointer"
                  title="Terapkan jumlah ini"
                >
                  Pilih
                </button>
              </div>
            </div>

            {/* Gender shortcuts */}
            <button
              type="button"
              onClick={() => handleSelectByGender('L')}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition-colors"
              title="Pilih seluruh siswa laki-laki"
            >
              Laki-laki
            </button>
            <button
              type="button"
              onClick={() => handleSelectByGender('P')}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition-colors"
              title="Pilih seluruh siswa perempuan"
            >
              Perempuan
            </button>

            {/* Deselect / Clear */}
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="px-2 py-1 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ml-auto cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Kosongkan Pilihan
              </button>
            )}
          </div>
        </div>

        {/* Main Student List Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:px-6">
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider text-[11px] sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={allFilteredSelected ? handleDeselectAllFiltered : handleSelectAllFiltered}
                      className="text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                      title={allFilteredSelected ? 'Batal pilih semua' : 'Pilih semua yang tampil'}
                    >
                      {allFilteredSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-2.5 px-2 w-10 text-center">No</th>
                  <th className="py-2.5 px-3">Nama Siswa</th>
                  <th className="py-2.5 px-3">No. Peserta Ujian</th>
                  <th className="py-2.5 px-3">NIS / NISN</th>
                  <th className="py-2.5 px-3 text-center w-16">L/P</th>
                  <th className="py-2.5 px-3 text-center w-28">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold text-slate-600">Tidak ada siswa yang sesuai kriteria.</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Coba sesuaikan kata kunci pencarian atau ubah filter di atas.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((stu, idx) => {
                    const isSelected = selectedIds.includes(stu.id);

                    return (
                      <tr
                        key={stu.id}
                        onClick={() => handleToggleStudent(stu.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50/70 hover:bg-blue-100/70'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleStudent(stu.id)}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-2 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                isSelected
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {stu.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-900 block leading-tight">
                                {stu.name}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {stu.major || classItem?.name}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-blue-900 text-xs">
                          {stu.examNumber || '-'}
                        </td>
                        <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                          {stu.nis || '-'}{stu.nisn ? ` / ${stu.nisn}` : ''}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              stu.gender === 'L'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-pink-100 text-pink-800'
                            }`}
                          >
                            {stu.gender}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {isSelected ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Masuk Ruang
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px] font-normal">
                              Belum Dipilih
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 text-right">
            Menampilkan {filteredStudents.length} dari total {sortedStudents.length} siswa kelas {classItem?.name}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs">
            <span className="text-slate-600">Total Terpilih:</span>{' '}
            <strong className="text-blue-900 font-bold text-sm">
              {selectedIds.length} Siswa
            </strong>{' '}
            <span className="text-slate-500">
              (Akumulasi ruang: {currentTotalInRoom} / {roomCapacity} kursi)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Terapkan Siswa Terpilih ({selectedIds.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
