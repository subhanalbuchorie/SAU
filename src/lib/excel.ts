import * as XLSX from 'xlsx';

// Helper to normalize header keys (lowercase and remove punctuation/spaces)
export const normalizeKey = (key: string): string => {
  return String(key || '')
    .toLowerCase()
    .replace(/[\s_\-\.\/\\]+/g, '');
};

// Flexible helper to extract a value from an imported row using multiple possible alias keys
export const getRowValue = (
  row: Record<string, any>,
  aliases: string[],
  fallback = ''
): string => {
  if (!row) return fallback;
  const entries = Object.entries(row);
  const normalizedMap = new Map<string, any>();
  for (const [k, v] of entries) {
    normalizedMap.set(normalizeKey(k), v);
  }

  for (const alias of aliases) {
    const normAlias = normalizeKey(alias);
    if (normalizedMap.has(normAlias)) {
      const val = normalizedMap.get(normAlias);
      if (val !== undefined && val !== null) {
        const str = String(val).trim();
        if (str !== '') return str;
      }
    }
  }
  return fallback;
};

export const ExcelService = {
  // Normalize key export
  normalizeKey,
  getRowValue,

  // Export array of objects to Excel .xlsx file
  exportToExcel: (data: any[], fileName: string, sheetName = 'Data') => {
    try {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `${fileName}.xlsx`);
      return true;
    } catch (err) {
      console.error('Export Excel error', err);
      return false;
    }
  },

  // Parse an uploaded Excel or CSV file
  parseExcelFile: async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, {
            type: 'array',
            cellDates: true,
            dateNF: 'yyyy-mm-dd'
          });
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) {
            resolve([]);
            return;
          }
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, {
            defval: '',
            raw: false
          });
          resolve(json);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  },

  // Download Templates for Import
  downloadTemplate: (type: 'students' | 'classes' | 'supervisors' | 'subjects' | 'rooms') => {
    let templateData: any[] = [];
    let filename = `Template_Import_${type}`;

    if (type === 'students') {
      templateData = [
        {
          NIS: '24251001',
          NISN: '0071234001',
          Nama_Lengkap: 'Achmad Fauzi',
          Jenis_Kelamin: 'L',
          Tempat_Lahir: 'Jakarta',
          Tanggal_Lahir: '2008-05-12',
          Kelas: 'X-RPL-1',
          Jurusan: 'Rekayasa Perangkat Lunak',
          Nomor_Peserta: '001/X-RPL-1/US/2026',
          Status: 'AKTIF',
          Keterangan: 'Siswa Reguler'
        },
        {
          NIS: '24251002',
          NISN: '0071234002',
          Nama_Lengkap: 'Aisyah Putri',
          Jenis_Kelamin: 'P',
          Tempat_Lahir: 'Bandung',
          Tanggal_Lahir: '2008-08-20',
          Kelas: 'X-RPL-1',
          Jurusan: 'Rekayasa Perangkat Lunak',
          Nomor_Peserta: '002/X-RPL-1/US/2026',
          Status: 'AKTIF',
          Keterangan: 'Siswa Reguler'
        }
      ];
    } else if (type === 'rooms') {
      templateData = [
        {
          Kode_Ruang: 'R-01',
          Nama_Ruang: 'Ruang Ujian 01',
          Gedung: 'Gedung Utama',
          Lantai: 1,
          Kapasitas: 30,
          Jumlah_Komputer: 0,
          Jumlah_Meja: 30,
          Jumlah_Kursi: 30,
          Status: 'Aktif',
          Keterangan: 'Ruang kelas ber-AC'
        }
      ];
    } else if (type === 'classes') {
      templateData = [
        {
          Kode_Kelas: 'X-RPL-1',
          Nama_Kelas: 'X RPL 1',
          Tingkat: 10,
          Program_Keahlian: 'Rekayasa Perangkat Lunak',
          Wali_Kelas: 'Ahmad Syafii, S.Pd',
          Kapasitas: 36,
          Status_Aktif: 'YA'
        },
        {
          Kode_Kelas: 'X-TKJ-1',
          Nama_Kelas: 'X TKJ 1',
          Tingkat: 10,
          Program_Keahlian: 'Teknik Komputer & Jaringan',
          Wali_Kelas: 'Budi Santoso, S.Kom',
          Kapasitas: 36,
          Status_Aktif: 'YA'
        }
      ];
    } else if (type === 'supervisors') {
      templateData = [
        {
          NIP: '19850115 201001 1 008',
          Nama_Pengawas: 'Drs. Hendro Wibowo, M.Pd',
          Jenis_Kelamin: 'L',
          Mata_Pelajaran: 'Matematika',
          Nomor_HP: '081234567890',
          Status: 'Aktif',
          Keterangan: 'Pengawas Utama'
        }
      ];
    } else if (type === 'subjects') {
      templateData = [
        {
          Kode_Mapel: 'MAT-01',
          Nama_Mata_Pelajaran: 'Matematika',
          Kelompok: 'Muatan Nasional',
          Tingkat: 10,
          Durasi_Menit: 90,
          Status_Aktif: 'YA'
        }
      ];
    }

    ExcelService.exportToExcel(templateData, filename, 'Template');
  }
};
