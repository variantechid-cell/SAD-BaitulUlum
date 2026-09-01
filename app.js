/* ============================================================
   SISTEM ABSENSI KARTU PELAJAR - SMP & SMA BAITUL ULUM
   CODE.GS V6.3 (SINKRON 100% DENGAN SHEET EXCEL & APP.JS)
============================================================ */

const CONFIG = {
  SPREADSHEET_ID: '', // Kosongkan jika script terikat langsung dengan Spreadsheet
  SHEET_SISWA: 'SISWA',
  SHEET_ABSENSI: 'ABSENSI',
  SHEET_LOG: 'LOG',
  TIMEZONE: 'Asia/Jakarta',
  JAM_MASUK: '07:00',
  BATAS_TERLAMBAT: '07:20'
};

// Ganti bagian API_URL di dalam app.js Anda dengan URL yang baru disalin
const API_URL = "https://script.google.com/macros/s/AKfycbybMMhzrTv3Uqv3vMAdJTA5Co4FiTh_jZ4ocD5iNdHb2mZBX2S_BJJBrgFCgJIcqb21/exec";

/* ============================================================
   DO GET - PINTU MASUK API UTAMA
============================================================ */
function doGet(e) {
  let action = 'test';
  try {
    if (e && e.parameter && e.parameter.action) {
      action = String(e.parameter.action).trim();
    }

    console.log('API Action: ' + action);

    if (action === 'test' || action === 'serverTime') {
      const serverTime = getCurrentDateTime();
      writeLog('TEST', 'ONLINE', '', '', '', 'ONLINE', 'Pengecekan koneksi Apps Script berhasil');
      return jsonResponse({
        success: true,
        status: 'ONLINE',
        message: 'Apps Script V6.3 aktif & sinkron 100%.',
        serverTime: serverTime
      });
    }

    if (action === 'attendance') {
      return handleAttendance(e.parameter.studentId);
    }

    if (action === 'summary') {
      return handleSummary();
    }

    if (action === 'todayAttendance' || action === 'todayAttendanceList' || action === 'attendanceList') {
      return handleTodayAttendance();
    }

    writeLog('API', 'INVALID_ACTION', '', '', '', 'INVALID', 'Action tidak dikenal: ' + action);
    return jsonResponse({
      success: false,
      status: 'INVALID_ACTION',
      message: 'Action tidak dikenal: ' + action
    });

  } catch (error) {
    console.error('DO GET ERROR: ' + error.message);
    writeLog('ERROR', 'SERVER_ERROR', '', '', '', 'ERROR', error.message || String(error));
    return jsonResponse({
      success: false,
      status: 'SERVER_ERROR',
      message: error.message || String(error)
    });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet() {
  if (CONFIG.SPREADSHEET_ID && String(CONFIG.SPREADSHEET_ID).trim() !== '') {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Spreadsheet tidak ditemukan. Periksa konfigurasi ID.');
  }
  return ss;
}

function getSheet(name) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error('Sheet "' + name + '" tidak ditemukan.');
  }
  return sheet;
}

function getCurrentDateTime() {
  const now = new Date();
  return {
    tanggal: Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy-MM-dd'),
    jam: Utilities.formatDate(now, CONFIG.TIMEZONE, 'HH:mm:ss'),
    timestamp: now.getTime()
  };
}

/* ============================================================
   LOGIKA ABSENSI (100% SINKRON DENGAN 19 KOLOM SHEET ABSENSI)
============================================================ */
function handleAttendance(studentId) {
  studentId = String(studentId || '').trim();

  if (!studentId) {
    writeLog('ATTENDANCE', 'EMPTY_ID', '', '', '', 'FAIL', 'Student ID kosong');
    return jsonResponse({
      success: false,
      status: 'NOT_FOUND',
      message: 'Student ID kosong.'
    });
  }

  try {
    // 1. CARI DATA SISWA
    const student = findStudent(studentId);

    if (!student) {
      writeLog('SCAN', 'NOT_FOUND', studentId, '', '', 'FAIL', 'Data siswa tidak ditemukan');
      return jsonResponse({
        success: false,
        status: 'NOT_FOUND',
        message: 'Data siswa tidak ditemukan.'
      });
    }

    // 2. CEK STATUS SISWA
    if (!isStudentActive(student)) {
      writeLog('ATTENDANCE', 'INACTIVE', student.studentId, student.nama, student.kelas, 'FAIL', 'Siswa tidak aktif');
      return jsonResponse({
        success: false,
        status: 'INACTIVE',
        message: 'Siswa tidak aktif.',
        student: student
      });
    }

    // 3. CEK DOUBLE ABSEN HARI INI
    const previous = findTodayAttendance(studentId);
    if (previous) {
      writeLog('ATTENDANCE', 'ALREADY', student.studentId, student.nama, student.kelas, 'DUPLICATE', 'Siswa sudah absen hari ini');
      return jsonResponse({
        success: true,
        status: 'ALREADY',
        message: 'Siswa sudah melakukan absensi hari ini.',
        student: student,
        previousAttendance: previous
      });
    }

    // 4. PENENTUAN STATUS HADIR / TERLAMBAT
    const now = new Date();
    const tanggal = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy-MM-dd');
    const jam = Utilities.formatDate(now, CONFIG.TIMEZONE, 'HH:mm:ss');
    const status = determineAttendanceStatus(now);
    const absensiId = 'ABS' + Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyMMddHHmmss');

    // 5. PENULISAN 19 KOLOM KE SHEET ABSENSI
    const sheetAbsensi = getSheet(CONFIG.SHEET_ABSENSI);
    const rowAbsensi = [
      absensiId,          // [0] ABSENSI_ID
      now,                // [1] TIMESTAMP
      tanggal,            // [2] TANGGAL
      jam,                // [3] JAM
      student.studentId,  // [4] STUDENT_ID
      student.nama,       // [5] NAMA
      student.kelasId,    // [6] KELAS_ID
      student.kelas,      // [7] KELAS
      '-',                // [8] JADWAL_ID
      '-',                // [9] JAM_KE
      '-',                // [10] MAPEL_ID
      '-',                // [11] MAPEL
      '-',                // [12] GURU_ID
      '-',                // [13] GURU
      status,             // [14] STATUS (Hadir / Terlambat)
      'Masuk',            // [15] JENIS
      'QR',               // [16] METODE
      '-',                // [17] CATATAN
      'Sistem'            // [18] PETUGAS
    ];

    sheetAbsensi.appendRow(rowAbsensi);
    SpreadsheetApp.flush();

    writeLog('ATTENDANCE', 'SUCCESS', student.studentId, student.nama, student.kelas, status, 'Absensi berhasil dicatat');

    return jsonResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Absensi berhasil dicatat.',
      student: student,
      attendance: {
        tanggal: formatDateValue(now),
        jam: jam,
        status: status
      }
    });

  } catch (error) {
    console.error('ATTENDANCE ERROR: ' + error.message);
    writeLog('ATTENDANCE', 'SERVER_ERROR', studentId, '', '', 'ERROR', error.message || String(error));
    return jsonResponse({
      success: false,
      status: 'SERVER_ERROR',
      message: error.message || String(error)
    });
  }
}

/* ============================================================
   PENCARIAN DATA SISWA
============================================================ */
function findStudent(studentId) {
  const sheet = getSheet(CONFIG.SHEET_SISWA);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;

  const headers = values[0].map(h => String(h).trim().toUpperCase());
  
  const idIndex = findColumn(headers, ['STUDENT_ID', 'STUDENT ID', 'ID', 'NIS', 'NISN']);
  const nameIndex = findColumn(headers, ['NAMA', 'NAMA SISWA', 'NAMA_SISWA']);
  const classIdIndex = findColumn(headers, ['KELAS_ID', 'KELAS ID']);
  const classIndex = findColumn(headers, ['KELAS', 'CLASS']);
  const statusIndex = findColumn(headers, ['STATUS', 'STATUS SISWA', 'AKTIF']);

  if (idIndex === -1) throw new Error('Kolom STUDENT_ID pada sheet SISWA tidak ditemukan.');

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const id = String(row[idIndex] || '').trim();

    if (id === studentId) {
      return {
        studentId: id,
        nama: nameIndex >= 0 ? String(row[nameIndex] || '-').trim() : '-',
        kelasId: classIdIndex >= 0 ? String(row[classIdIndex] || '-').trim() : (classIndex >= 0 ? String(row[classIndex] || '-').trim() : '-'),
        kelas: classIndex >= 0 ? String(row[classIndex] || '-').trim() : '-',
        status: statusIndex >= 0 ? String(row[statusIndex] || 'Aktif').trim() : 'Aktif'
      };
    }
  }
  return null;
}

function findColumn(headers, names) {
  for (let i = 0; i < names.length; i++) {
    const idx = headers.indexOf(names[i]);
    if (idx !== -1) return idx;
  }
  return -1;
}

function isStudentActive(student) {
  const st = String(student.status || '').trim().toLowerCase();
  if (!st) return true;
  return !['nonaktif', 'non aktif', 'tidak aktif', 'inactive', 'false', '0'].includes(st);
}

function determineAttendanceStatus(date) {
  const time = Utilities.formatDate(date, CONFIG.TIMEZONE, 'HH:mm');
  return time > CONFIG.BATAS_TERLAMBAT ? 'Terlambat' : 'Hadir';
}

/* ============================================================
   CEK ABSEN HARI INI (MENYESUAIKAN KOLOM ABSENSI 19 KOLOM)
============================================================ */
function findTodayAttendance(studentId) {
  const sheet = getSheet(CONFIG.SHEET_ABSENSI);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;

  const today = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');

  for (let i = values.length - 1; i >= 1; i--) {
    const row = values[i];
    const rowStudentId = String(row[4] || '').trim(); // Index 4: STUDENT_ID

    if (rowStudentId !== studentId) continue;

    const rowDate = getSheetDate(row[2]); // Index 2: TANGGAL
    if (rowDate === today) {
      return {
        tanggal: formatDateValue(row[2]),
        jam: formatTimeValue(row[3]), // Index 3: JAM
        status: String(row[14] || '').trim() // Index 14: STATUS
      };
    }
  }
  return null;
}

/* ============================================================
   SUMMARY RINGKASAN REKAP
============================================================ */
function handleSummary() {
  try {
    const sheetAbsensi = getSheet(CONFIG.SHEET_ABSENSI);
    const values = sheetAbsensi.getDataRange().getValues();
    const today = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');

    let hadir = 0;
    let terlambat = 0;

    if (values.length >= 2) {
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const rowDate = getSheetDate(row[2]); // Index 2: TANGGAL

        if (rowDate !== today) continue;

        const status = String(row[14] || '').trim().toLowerCase(); // Index 14: STATUS
        if (status.includes('terlambat')) {
          terlambat++;
        } else if (status.includes('hadir')) {
          hadir++;
        }
      }
    }

    const totalSiswa = getTotalSiswa();
    const sudahAbsen = hadir + terlambat;
    const belumAbsen = Math.max(totalSiswa - sudahAbsen, 0);

    return jsonResponse({
      success: true,
      status: 'OK',
      tanggal: today,
      hadir: hadir,
      terlambat: terlambat,
      total: sudahAbsen,
      sudahAbsen: sudahAbsen,
      totalSiswa: totalSiswa,
      belumAbsen: belumAbsen,
      error: 0
    });
  } catch (error) {
    writeLog('SUMMARY', 'SERVER_ERROR', '', '', '', 'ERROR', error.message || String(error));
    return jsonResponse({
      success: false,
      status: 'SERVER_ERROR',
      message: error.message || String(error),
      hadir: 0, terlambat: 0, total: 0, sudahAbsen: 0, totalSiswa: 0, belumAbsen: 0, error: 1
    });
  }
}

function getTotalSiswa() {
  const sheet = getSheet(CONFIG.SHEET_SISWA);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return 0;

  const headers = values[0].map(h => String(h).trim().toUpperCase());
  const idIndex = findColumn(headers, ['STUDENT_ID', 'STUDENT ID', 'ID', 'NIS', 'NISN']);
  const statusIndex = findColumn(headers, ['STATUS', 'STATUS SISWA', 'AKTIF']);

  let total = 0;
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const id = idIndex >= 0 ? String(row[idIndex] || '').trim() : '';
    if (!id) continue;

    if (statusIndex >= 0) {
      const st = String(row[statusIndex] || '').trim().toLowerCase();
      if (['nonaktif', 'non aktif', 'tidak aktif', 'inactive', 'false', '0'].includes(st)) continue;
    }
    total++;
  }
  return total;
}

/* ============================================================
   DAFTAR ABSENSI HARI INI (MENYESUAIKAN 19 KOLOM)
============================================================ */
function handleTodayAttendance() {
  try {
    const sheet = getSheet(CONFIG.SHEET_ABSENSI);
    const values = sheet.getDataRange().getValues();
    const today = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
    const list = [];

    if (values.length >= 2) {
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const rowDate = getSheetDate(row[2]); // Index 2: TANGGAL

        if (rowDate !== today) continue;

        list.push({
          studentId: String(row[4] || '').trim(), // Index 4: STUDENT_ID
          nama: String(row[5] || '-').trim(),      // Index 5: NAMA
          kelas: String(row[7] || '-').trim(),     // Index 7: KELAS
          jam: formatTimeValue(row[3]),            // Index 3: JAM
          status: String(row[14] || '-').trim()    // Index 14: STATUS
        });
      }
    }

    list.sort((a, b) => convertTime(a.jam) - convertTime(b.jam));
    list.forEach((item, index) => { item.rank = index + 1; });

    writeLog('LIST', 'SUCCESS', '', '', '', 'OK', 'Memuat daftar absensi hari ini: ' + list.length + ' data');

    return jsonResponse({
      success: true,
      status: 'OK',
      tanggal: today,
      total: list.length,
      data: list
    });

  } catch (error) {
    writeLog('LIST', 'SERVER_ERROR', '', '', '', 'ERROR', error.message || String(error));
    return jsonResponse({
      success: false,
      status: 'SERVER_ERROR',
      message: error.message || String(error),
      tanggal: Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd'),
      total: 0,
      data: []
    });
  }
}

/* ============================================================
   HELPER FORMAT TANGGAL & JAM
============================================================ */
function getSheetDate(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    return match[3] + '-' + String(match[2]).padStart(2, '0') + '-' + String(match[1]).padStart(2, '0');
  }
  return '';
}

function formatDateValue(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, CONFIG.TIMEZONE, 'dd/MM/yyyy');
  }
  return String(value || '-');
}

function formatTimeValue(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, CONFIG.TIMEZONE, 'HH:mm:ss');
  }
  const text = String(value || '').trim();
  if (/^\d{1,2}:\d{2}$/.test(text)) return text + ':00';
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(text)) return text;
  return text || '-';
}

function convertTime(value) {
  const parts = String(value || '').split(':');
  if (parts.length < 2) return 999999;
  return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2] || 0);
}

/* ============================================================
   LOG SYSTEM (9 KOLOM SHEET LOG)
============================================================ */
function writeLog(aksi, hasil, studentId, nama, kelas, status, keterangan) {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEET_LOG);

    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEET_LOG);
      sheet.appendRow(['TIMESTAMP', 'TANGGAL', 'AKSI', 'HASIL', 'STUDENT_ID', 'NAMA', 'KELAS', 'STATUS', 'KETERANGAN']);
    }

    const now = new Date();
    const tanggal = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy-MM-dd');

    sheet.appendRow([
      now,
      tanggal,
      String(aksi || ''),
      String(hasil || ''),
      String(studentId || ''),
      String(nama || ''),
      String(kelas || ''),
      String(status || ''),
      String(keterangan || '')
    ]);
  } catch (error) {
    console.error('WRITE LOG ERROR: ' + error.message);
  }
}
