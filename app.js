/* ============================================================
   FRONTEND APPLICATION SCRIPT - SMP & SMA BAITUL ULUM
   APP.JS V6.5 (MENDUKUNG FASE 1, FASE 2 & FASE 3)
============================================================ */

// MASUKKAN URL WEB APP GOOGLE APPS SCRIPT ANDA DI SINI
const API_URL = 'https://script.google.com/macros/s/AKfycbwqo7Z3-6_kR2wLp_M1W6x-S4OqjYgq-5nQxWz8s2k/exec';

let html5QrcodeScanner = null;
let isProcessingScan = false;

document.addEventListener('DOMContentLoaded', () => {
  initLiveClock();
  loadTodaySchedules();
  fetchSummaryData();
  fetchTodayAttendanceList();
  initScanner();
  setupEventListeners();
});

/* ============================================================
   AUDIO FEEDBACK GENERATOR (WEB AUDIO API)
============================================================ */
function playAudioFeedback(type) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'warning') {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(350, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {
    console.log('Audio error:', e);
  }
}

/* ============================================================
   JAM & SINKRONISASI DATETIME
============================================================ */
function initLiveClock() {
  const clockEl = document.getElementById('liveClock');
  setInterval(() => {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('id-ID') + ' WIB';
  }, 1000);
}

/* ============================================================
   FASE 2: MEMUAT JADWAL PELAJARAN HARI INI
============================================================ */
function loadTodaySchedules() {
  const selectJadwal = document.getElementById('selectJadwal');
  fetch(`${API_URL}?action=getSchedules&_=${Date.now()}`)
    .then(res => res.json())
    .then(data => {
      if (data.success && Array.isArray(data.data)) {
        selectJadwal.innerHTML = '<option value="">⚡ Otomatis (Sesuai Jam Berjalan)</option>';
        data.data.forEach(item => {
          const opt = document.createElement('option');
          opt.value = item.jadwalId;
          opt.textContent = `Jam Ke-${item.jamKe} [${item.jamMulai}-${item.jamSelesai}] : ${item.mapel} (${item.kelas})`;
          selectJadwal.appendChild(opt);
        });
      }
    })
    .catch(err => console.error('Error loading schedules:', err));
}

/* ============================================================
   MEMUAT STATISTIK SUMMARY & DAFTAR HARI INI
============================================================ */
function fetchSummaryData() {
  fetch(`${API_URL}?action=summary&_=${Date.now()}`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        document.getElementById('summaryTotal').textContent = data.totalSiswa || 0;
        document.getElementById('summaryHadir').textContent = data.hadir || 0;
        document.getElementById('summaryTerlambat').textContent = data.terlambat || 0;
        document.getElementById('summaryBelum').textContent = data.belumAbsen || 0;
      }
    })
    .catch(err => console.error('Error summary:', err));
}

function fetchTodayAttendanceList() {
  const tbody = document.getElementById('tableAbsensiBody');
  fetch(`${API_URL}?action=todayAttendanceList&_=${Date.now()}`)
    .then(res => res.json())
    .then(data => {
      if (data.success && Array.isArray(data.data)) {
        if (data.data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="9" class="text-center">Belum ada siswa yang melakukan absensi hari ini.</td></tr>';
          return;
        }

        tbody.innerHTML = data.data.map((item, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${item.jam}</td>
            <td><strong>${item.studentId}</strong></td>
            <td>${item.nama}</td>
            <td>${item.kelas}</td>
            <td>${item.mapel}</td>
            <td>${item.guru}</td>
            <td><span class="result-badge ${item.status === 'Hadir' ? 'badge-hadir' : 'badge-terlambat'}">${item.status}</span></td>
            <td><span class="status-indicator online">Terkirim WA</span></td>
          </tr>
        `).join('');
      }
    })
    .catch(err => {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center">Gagal memuat data absensi.</td></tr>';
    });
}

/* ============================================================
   EKSEKUSI PRESENSI (FASE 1, FASE 2 & FASE 3)
============================================================ */
function processAttendance(studentId) {
  if (!studentId || isProcessingScan) return;
  isProcessingScan = true;

  const selectJadwal = document.getElementById('selectJadwal');
  const jadwalId = selectJadwal ? selectJadwal.value : '';

  const url = `${API_URL}?action=attendance&studentId=${encodeURIComponent(studentId)}&jadwalId=${encodeURIComponent(jadwalId)}&_=${Date.now()}`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      renderAttendanceResult(data);
      if (data.success) {
        if (data.status === 'ALREADY') {
          playAudioFeedback('warning');
        } else {
          playAudioFeedback('success');
        }
        fetchSummaryData();
        fetchTodayAttendanceList();
      } else {
        playAudioFeedback('error');
      }
    })
    .catch(err => {
      console.error('API Error:', err);
      playAudioFeedback('error');
      renderErrorResult('KONEKSI GAGAL', 'Tidak dapat terhubung ke server.');
    })
    .finally(() => {
      isProcessingScan = false;
      const inputEl = document.getElementById('inputStudentId');
      inputEl.value = '';
      inputEl.focus();
    });
}

/* ============================================================
   RENDER HASIL ABSENSI DI UI
============================================================ */
function renderAttendanceResult(res) {
  const container = document.getElementById('resultCard');

  if (!res.success) {
    renderErrorResult(res.status || 'GAGAL', res.message || 'Proses absensi gagal.');
    return;
  }

  const student = res.student || {};
  const schedule = res.schedule || {};
  const attendance = res.attendance || res.previousAttendance || {};
  const waStatus = res.waStatus || {};

  let badgeClass = 'badge-hadir';
  if (res.status === 'ALREADY') badgeClass = 'badge-duplicate';
  else if (attendance.status === 'Terlambat') badgeClass = 'badge-terlambat';

  let waHtml = '';
  if (res.status !== 'ALREADY') {
    if (waStatus.sent) {
      waHtml = `<div class="wa-status-box wa-success">📲 Notifikasi WA Orang Tua: TERKIRIM</div>`;
    } else {
      waHtml = `<div class="wa-status-box wa-fail">⚠️ WA: ${waStatus.reason || 'Tidak Terkirim'}</div>`;
    }
  }

  container.innerHTML = `
    <div class="result-card-inner">
      <span class="result-badge ${badgeClass}">${res.status === 'ALREADY' ? 'SUDAH ABSEN' : attendance.status}</span>
      <div class="student-info">
        <h4>${student.nama}</h4>
        <p>${student.studentId} | Kelas: ${student.kelas}</p>
      </div>
      <div class="result-details">
        <div><strong>Waktu:</strong> ${attendance.jam || '-'} WIB</div>
        <div><strong>Mata Pelajaran (Fase 2):</strong> ${schedule.mapel || '-'}</div>
        <div><strong>Guru Pengajar:</strong> ${schedule.guru || '-'}</div>
      </div>
      ${waHtml}
    </div>
  `;
}

function renderErrorResult(title, message) {
  const container = document.getElementById('resultCard');
  container.innerHTML = `
    <div class="result-card-inner">
      <span class="result-badge badge-error">${title}</span>
      <div class="student-info">
        <h4 style="color:var(--danger-color);">${message}</h4>
      </div>
    </div>
  `;
}

/* ============================================================
   EVENT LISTENERS & SCANNER SETUP
============================================================ */
function setupEventListeners() {
  const btnScan = document.getElementById('btnScanManual');
  const inputEl = document.getElementById('inputStudentId');
  const btnRefresh = document.getElementById('btnRefresh');

  btnScan.addEventListener('click', () => {
    processAttendance(inputEl.value.trim());
  });

  inputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      processAttendance(inputEl.value.trim());
    }
  });

  btnRefresh.addEventListener('click', () => {
    fetchSummaryData();
    fetchTodayAttendanceList();
    loadTodaySchedules();
  });
}

function initScanner() {
  try {
    html5QrcodeScanner = new Html5QrcodeScanner("reader", {
      fps: 10,
      qrbox: { width: 220, height: 220 }
    });

    html5QrcodeScanner.render((decodedText) => {
      processAttendance(decodedText.trim());
    }, (error) => {
      // Ignore scanning scan-frame errors
    });
  } catch (e) {
    console.error('Camera Scanner Error:', e);
  }
}
