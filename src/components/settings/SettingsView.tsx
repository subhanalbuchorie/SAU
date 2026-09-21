import React, { useState, useEffect } from 'react';
import {
  Save,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Sparkles,
  Building,
  User,
  Calendar,
  FileText,
  Trash2,
  Database,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { SchoolSetting, Student, ClassItem } from '../../types';
import { StorageService } from '../../lib/storage';

// Helper to resize & compress image so it is lightweight, crisp, and never exceeds limits
function compressImage(file: File, maxWidth = 200, maxHeight = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(width, 1);
        canvas.height = Math.max(height, 1);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        // Use PNG for logos to maintain crisp borders and transparency
        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Gagal memproses file gambar'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
}

interface SettingsViewProps {
  settings: SchoolSetting;
  onSaveSettings?: (settings: SchoolSetting) => void;
  students?: Student[];
  classes?: ClassItem[];
  onReloadStudents?: () => void;
  onRefresh?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  students: studentsProp,
  classes: classesProp,
  onReloadStudents,
  onRefresh
}) => {
  const [formData, setFormData] = useState<SchoolSetting>(() => {
    const backupLogo = typeof window !== 'undefined' ? localStorage.getItem('aus_school_logo') : null;
    return {
      ...settings,
      logoUrl: settings.logoUrl || backupLogo || ''
    };
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [genMessage, setGenMessage] = useState<string | null>(null);

  // Sync state when settings prop updates
  useEffect(() => {
    const backupLogo = typeof window !== 'undefined' ? localStorage.getItem('aus_school_logo') : null;
    setFormData((prev) => ({
      ...settings,
      logoUrl: settings.logoUrl || prev.logoUrl || backupLogo || ''
    }));
  }, [settings]);

  const students = studentsProp || StorageService.getStudents();
  const classes = classesProp || StorageService.getClasses();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImage(file);
        const updated = { ...formData, logoUrl: compressedBase64 };
        setFormData(updated);

        // Save immediately to local backup storage and StorageService
        try {
          localStorage.setItem('aus_school_logo', compressedBase64);
        } catch (err) {
          console.warn('Local storage backup full:', err);
        }

        StorageService.saveSettings(updated);
        if (onSaveSettings) {
          onSaveSettings(updated);
        }
        onRefresh?.();

        setSuccessMessage('Logo sekolah berhasil diunggah dan disimpan!');
        setTimeout(() => setSuccessMessage(null), 3500);
      } catch (err) {
        console.error('Failed to compress logo', err);
      }
    }
  };

  const handleRemoveLogo = () => {
    const updated = { ...formData, logoUrl: '' };
    setFormData(updated);
    try {
      localStorage.removeItem('aus_school_logo');
    } catch {}

    StorageService.saveSettings(updated);
    if (onSaveSettings) {
      onSaveSettings(updated);
    }
    onRefresh?.();

    setSuccessMessage('Logo sekolah berhasil dihapus.');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const backupLogo = typeof window !== 'undefined' ? localStorage.getItem('aus_school_logo') : null;
    const finalSettings = {
      ...formData,
      logoUrl: formData.logoUrl || backupLogo || ''
    };

    StorageService.saveSettings(finalSettings);
    if (onSaveSettings) {
      onSaveSettings(finalSettings);
    }
    onRefresh?.();

    setSuccessMessage('Pengaturan umum sekolah berhasil disimpan.');
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const [showConfirmGen, setShowConfirmGen] = useState(false);
  const [showConfirmClearAll, setShowConfirmClearAll] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handlePurgeDummy = async () => {
    setIsClearing(true);
    try {
      StorageService.purgeDummyData();
      if (onReloadStudents) onReloadStudents();
      onRefresh?.();
      setSuccessMessage('Sisa data dummy berhasil dibersihkan dari database & penyimpanan lokal!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } finally {
      setIsClearing(false);
    }
  };

  const handleClearAllDatabase = async () => {
    setIsClearing(true);
    try {
      await StorageService.clearAllDatabaseData();
      if (onReloadStudents) onReloadStudents();
      onRefresh?.();
      setShowConfirmClearAll(false);
      setSuccessMessage('Seluruh data siswa, kelas, ruang, pengawas, mapel, dan jadwal berhasil dikosongkan!');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsClearing(false);
    }
  };

  const handleGenerateExamNumbers = () => {
    StorageService.generateExamNumbers(formData.examNumberFormat, students, classes);
    if (onReloadStudents) {
      onReloadStudents();
    } else {
      onRefresh?.();
    }
    setShowConfirmGen(false);
    setGenMessage(`Berhasil me-generate nomor peserta untuk ${students.length} siswa aktif!`);
    setTimeout(() => setGenMessage(null), 4500);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg md:text-xl font-bold text-slate-900">
            Pengaturan Umum Sekolah
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Identitas sekolah dan konfigurasi ujian yang otomatis digunakan pada kop surat, berita acara, daftar hadir, dan dokumen cetak.
          </p>
        </div>

        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
        >
          <Save className="w-4 h-4" />
          Simpan Pengaturan
        </button>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {successMessage}
        </div>
      )}

      {genMessage && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          {genMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identitas Sekolah */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Building className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">
              Identitas Satuan Pendidikan
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nama Sekolah <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="schoolName"
                value={formData.schoolName}
                onChange={handleChange}
                required
                className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                NPSN <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="npsn"
                value={formData.npsn}
                onChange={handleChange}
                required
                className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                NSS (Nomor Statistik Sekolah)
              </label>
              <input
                type="text"
                name="nss"
                value={formData.nss || ''}
                onChange={handleChange}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Alamat Jalan <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
                className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Desa / Kelurahan
              </label>
              <input
                type="text"
                name="village"
                value={formData.village || ''}
                onChange={handleChange}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kecamatan
              </label>
              <input
                type="text"
                name="district"
                value={formData.district || ''}
                onChange={handleChange}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kabupaten / Kota <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                required
                className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Provinsi <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="province"
                value={formData.province}
                onChange={handleChange}
                required
                className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kode Pos
              </label>
              <input
                type="text"
                name="postalCode"
                value={formData.postalCode || ''}
                onChange={handleChange}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email Sekolah <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nomor Telepon <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Website
              </label>
              <input
                type="text"
                name="website"
                value={formData.website || ''}
                onChange={handleChange}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Logo Upload Section */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4">
            <div className="w-16 h-16 rounded border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
              {formData.logoUrl ? (
                <img
                  src={formData.logoUrl}
                  alt="Logo Sekolah"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <ImageIcon className="w-6 h-6 text-slate-400" />
              )}
            </div>

            <div className="flex-1 min-w-[240px] space-y-2">
              <label className="block text-xs font-medium text-slate-700">
                Upload Logo Sekolah (PNG / JPG / WebP)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md text-xs font-medium transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Pilih File Logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
                {formData.logoUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-xs font-medium transition-colors cursor-pointer"
                    title="Hapus Logo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Logo</span>
                  </button>
                )}
                <span className="text-[11px] text-slate-500">
                  Kompresi otomatis optimal untuk kop surat &amp; cetak PDF.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Pimpinan & Panitia Ujian */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <User className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-800">
              Pimpinan &amp; Panitia Pelaksana
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nama Kepala Sekolah <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="principalName"
                value={formData.principalName}
                onChange={handleChange}
                required
                className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                NIP Kepala Sekolah <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="principalNip"
                value={formData.principalNip}
                onChange={handleChange}
                required
                className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nama Ketua Panitia Ujian <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="committeeHeadName"
                value={formData.committeeHeadName}
                onChange={handleChange}
                required
                className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                NIP Ketua Panitia Ujian <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="committeeHeadNip"
                value={formData.committeeHeadNip}
                onChange={handleChange}
                required
                className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Pelaksanaan Ujian */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-800">
              Pelaksanaan &amp; Parameter Ujian
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nama Ujian <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="examName"
                value={formData.examName}
                onChange={handleChange}
                required
                className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tahun Pelajaran <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="academicYear"
                value={formData.academicYear}
                onChange={handleChange}
                required
                placeholder="2026/2027"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Semester <span className="text-rose-500">*</span>
              </label>
              <select
                name="semester"
                value={formData.semester}
                onChange={handleChange}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
              >
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tanggal Mulai Ujian
              </label>
              <input
                type="date"
                name="examStartDate"
                value={formData.examStartDate}
                onChange={handleChange}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tanggal Selesai Ujian
              </label>
              <input
                type="date"
                name="examEndDate"
                value={formData.examEndDate}
                onChange={handleChange}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Format Nomor Peserta Ujian */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <FileText className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-800">
              Pengaturan Format Nomor Peserta Ujian
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Format Template Nomor Peserta
              </label>
              <input
                type="text"
                name="examNumberFormat"
                value={formData.examNumberFormat}
                onChange={handleChange}
                placeholder="{seq:3}/{kelas}/US/{tahun}"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs font-mono focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Variabel yang didukung:{' '}
                <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">
                  {'{seq:3}'}
                </code>{' '}
                (nomor urut 001),{' '}
                <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">
                  {'{kelas}'}
                </code>{' '}
                (kode kelas),{' '}
                <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">
                  {'{tahun}'}
                </code>
                . Contoh: 001/XII-TKJ/US/2026.
              </p>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowConfirmGen(true)}
                className="w-full px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generate Nomor Semua Siswa
              </button>
            </div>
          </div>
        </div>

        {/* Confirmation Modal */}
        {showConfirmGen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Konfirmasi Generate Nomor Peserta</h3>
                  <p className="text-xs text-slate-500">Proses akan memperbarui nomor peserta seluruh siswa aktif.</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs space-y-1.5 my-3">
                <div className="flex justify-between text-slate-600">
                  <span>Format:</span>
                  <span className="font-mono font-bold text-slate-900">{formData.examNumberFormat || '{seq:3}/{kelas}/US/{tahun}'}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Jumlah Siswa:</span>
                  <span className="font-bold text-slate-900">{students.length} Siswa</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmGen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleGenerateExamNumbers}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ya, Generate Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Simpan Seluruh Pengaturan
          </button>
        </div>
      </form>

      {/* Database Maintenance & Purge Section */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 mt-8">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <Database className="w-4 h-4 text-rose-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Manajemen Data & Pembersihan Database
            </h3>
            <p className="text-xs text-slate-500">
              Opsi untuk membersihkan sisa data dummy atau mengosongkan seluruh data sebelum import baru.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Purge Dummy Only */}
          <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/50 flex flex-col justify-between">
            <div className="space-y-1.5 mb-3">
              <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 text-amber-700 ${isClearing ? 'animate-spin' : ''}`} />
                Bersihkan Sisa Data Dummy
              </h4>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Hanya menghapus data contoh bawaan (siswa, kelas, pengawas dummy). Data riil yang telah Anda impor atau simpan tidak akan terhapus.
              </p>
            </div>
            <button
              type="button"
              disabled={isClearing}
              onClick={handlePurgeDummy}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isClearing ? 'animate-spin' : ''}`} />
              <span>Bersihkan Data Dummy</span>
            </button>
          </div>

          {/* Reset All Master Data */}
          <div className="p-4 rounded-lg border border-rose-200 bg-rose-50/50 flex flex-col justify-between">
            <div className="space-y-1.5 mb-3">
              <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5 text-rose-700" />
                Kosongkan Seluruh Data Master & Ujian
              </h4>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                Menghapus seluruh siswa, kelas, ruang, pengawas, mapel, dan jadwal dari database dan penyimpanan lokal sehingga siap diimpor dari awal.
              </p>
            </div>
            <button
              type="button"
              disabled={isClearing}
              onClick={() => setShowConfirmClearAll(true)}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Kosongkan Semua Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Clearing Database */}
      {showConfirmClearAll && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Konfirmasi Pengosongan Data</h3>
                <p className="text-xs text-slate-500">Tindakan ini akan mengosongkan seluruh data ujian.</p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-800 space-y-1.5 my-3">
              <p className="font-semibold">Data yang akan dihapus bersih:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                <li>Data Seluruh Siswa ({students.length} siswa)</li>
                <li>Data Seluruh Kelas ({classes.length} kelas)</li>
                <li>Data Ruangan, Pengawas, Mata Pelajaran & Jadwal Ujian</li>
              </ul>
              <p className="text-[11px] text-rose-600 pt-1 font-medium">
                Pengaturan sekolah & akun login tetap dipertahankan.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isClearing}
                onClick={() => setShowConfirmClearAll(false)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isClearing}
                onClick={handleClearAllDatabase}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {isClearing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sedang Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Kosongkan Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
