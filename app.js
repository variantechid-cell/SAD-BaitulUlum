/* ============================================================
   SISTEM ABSENSI KARTU PELAJAR - CLIENT SIDE V6.5
============================================================ */

const API_URL = 'https://script.google.com/macros/s/AKfycbx.../exec'; 

let html5QrCode = null;
let isCameraActive = false;
let isProcessing = false;

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  initAutoCameraScanner();
  setupEventListeners();
});

function initApp() {
  checkServerConnection();
  loadSchedules();
  loadSummary();
  loadTodayAttendance();

  setInterval(() => {
    loadSummary();
    loadTodayAttendance();
  }, 30000);
}

function checkServerConnection() {
  fetch(`${API_URL}?action=test&_=${Date.now()}`)
    .then(res => res.json())
    .then(data => {
      const statusDot = document.getElementById('statusDot');
      const statusText = document.getElementById('statusText');
      if (data.success) {
        statusDot.className = 'status-dot green';
        statusText.innerText = 'Terhubung ke Server';
      } else {
        statusDot.className = 'status-dot red';
        statusText.innerText = 'Koneksi Bermasalah';
      }
    })
    .catch(() => {
      document.getElementById('statusDot').className = 'status-dot red';
      document.getElementById('statusText').innerText = 'Offline / Gagal Koneksi';
    });
}

function loadSchedules() {
  fetch(`${API_URL}?action=getSchedules&_=${Date.now()}`)
    .then(res => res.json())
    .then(res => {
      const select = document.getElementById('selectJadwal');
      select.innerHTML = '<option value="">-- Auto-Match Jam Berjalan --</option>';
      if (res.success && res.data) {
        res.data.forEach(item => {
          const opt = document.createElement('option');
          opt.value = item.jadwalId;
          opt.innerText = `[Jam ${item.jamKe}] ${item.mapel} (${item.kelas}) - ${item.jamMulai.substring(0,5)}`;
          select.appendChild(opt);
        });
      }
    })
    .catch(err => console.error('Gagal memuat jadwal:', err));
}

function loadSummary() {
  fetch(`${API_URL}?action=summary&_=${Date.now()}`)
    .then(res => res.json())
    .then(res => {
      if (res.success) {
        document.getElementById('statHadir').innerText = res.hadir || 0;
        document.getElementById('statTerlambat').innerText = res.terlambat || 0;
        document.getElementById('statTotal').innerText = res.sudahAbsen || 0;
        document.getElementById('statBelum').innerText = res.belumAbsen || 0;
      }
    })
    .catch(err => console.error('Gagal memuat ringkasan:', err));
}

function loadTodayAttendance() {
  fetch(`${API_URL}?action=todayAttendance&_=${Date.now()}`)
    .then(res => res.json())
    .then(res => {
      const tbody = document.getElementById('attendanceTableBody');
      tbody.innerHTML = '';

      if (!res.success || !res.data || res.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Belum ada absensi hari ini.</td></tr>';
        return;
      }

      res.data.forEach(item => {
        const tr = document.createElement('tr');
        const badgeClass = item.status.toLowerCase().includes('terlambat') ? 'badge-warning' : 'badge-success';
        
        tr.innerHTML = `
          <td>${item.rank}</td>
          <td><strong>${item.jam}</strong></td>
          <td>${item.studentId}</td>
          <td>${item.nama}</td>
          <td>${item.kelas}</td>
          <td>${item.mapel}</td>
          <td><span class="badge ${badgeClass}">${item.status}</span></td>
        `;
        tbody.appendChild(tr);
      });
    })
    .catch(err => console.error('Gagal memuat daftar absensi:', err));
}

/* ============================================================
   PEMINDAI KAMERA & AUTO SCAN BARCODE / QR
============================================================ */
function initAutoCameraScanner() {
  html5QrCode = new Html5Qrcode("reader");

  const config = { 
    fps: 15, 
    qrbox: { width: 260, height: 180 },
    aspectRatio: 1.0,
    formatsToSupport: [
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.UPC_A
    ]
  };

  Html5Qrcode.getCameras().then(devices => {
    if (devices && devices.length > 0) {
      const cameraId = devices[0].id;
      html5QrCode.start(
        { facingMode: "environment" },
        config,
        onScanSuccess
      ).then(() => {
        isCameraActive = true;
      }).catch(err => {
        console.warn('Gagal membuka kamera belakang, mencoba kamera default:', err);
        html5QrCode.start(cameraId, config, onScanSuccess);
        isCameraActive = true;
      });
    }
  }).catch(err => {
    console.error('Kamera tidak ditemukan atau ditolak:', err);
  });
}

function onScanSuccess(decodedText) {
  if (isProcessing) return;
  const cleanId = String(decodedText || '').trim();
  if (cleanId) {
    processAttendance(cleanId);
  }
}

function toggleCamera() {
  if (!html5QrCode) return;
  if (isCameraActive) {
    html5QrCode.stop().then(() => {
      isCameraActive = false;
      document.getElementById('reader-wrapper').style.display = 'none';
    });
  } else {
    document.getElementById('reader-wrapper').style.display = 'block';
    initAutoCameraScanner();
  }
}

/* ============================================================
   EVENT LISTENERS & SCANNER GUN FOCUS MANAGEMENT
============================================================ */
function setupEventListeners() {
  const form = document.getElementById('attendanceForm');
  const input = document.getElementById('studentIdInput');
  const btnRefresh = document.getElementById('btnRefresh');
  const btnToggleCam = document.getElementById('btnToggleCam');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const studentId = input.value.trim();
    if (studentId) {
      processAttendance(studentId);
      input.value = '';
    }
  });

  btnRefresh.addEventListener('click', () => {
    loadSummary();
    loadTodayAttendance();
  });

  btnToggleCam.addEventListener('click', toggleCamera);

  document.addEventListener('click', (e) => {
    if (!['INPUT', 'SELECT', 'BUTTON', 'A'].includes(e.target.tagName)) {
      input.focus();
    }
  });
}

/* ============================================================
   PROSES ABSENSI & FEEDBACK
============================================================ */
function processAttendance(studentId) {
  if (isProcessing) return;
  isProcessing = true;

  const selectJadwal = document.getElementById('selectJadwal');
  const jadwalId = selectJadwal ? selectJadwal.value : '';

  const url = `${API_URL}?action=attendance&studentId=${encodeURIComponent(studentId)}&jadwalId=${encodeURIComponent(jadwalId)}&_=${Date.now()}`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      renderResult(data);
      if (data.success) {
        playBeep(data.status === 'ALREADY' ? 'warning' : 'success');
        loadSummary();
        loadTodayAttendance();
      } else {
        playBeep('error');
      }
    })
    .catch(err => {
      renderResult({
        success: false,
        status: 'ERROR',
        message: 'Gagal terhubung ke API Apps Script.'
      });
      playBeep('error');
    })
    .finally(() => {
      setTimeout(() => {
        isProcessing = false;
        const input = document.getElementById('studentIdInput');
        if (input) input.focus();
      }, 2500);
    });
}

function renderResult(data) {
  const box = document.getElementById('resultBox');
  const icon = document.getElementById('resultIcon');
  const nama = document.getElementById('resultNama');
  const kelas = document.getElementById('resultKelas');
  const badgeStatus = document.getElementById('badgeStatus');
  const badgeJadwal = document.getElementById('badgeJadwal');
  const badgeWa = document.getElementById('badgeWa');
  const message = document.getElementById('resultMessage');

  box.classList.remove('hidden', 'success', 'warning', 'error');

  if (!data.success) {
    box.classList.add('error');
    icon.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
    nama.innerText = 'Absensi Gagal';
    kelas.innerText = '-';
    badgeStatus.className = 'badge badge-danger';
    badgeStatus.innerText = data.status || 'GAGAL';
    badgeJadwal.innerText = '-';
    badgeWa.classList.add('hidden');
    message.innerText = data.message || 'Data siswa tidak terdaftar.';
    return;
  }

  const student = data.student || {};
  const schedule = data.schedule || {};
  const att = data.attendance || {};
  const wa = data.waStatus || {};

  nama.innerText = student.nama || 'Siswa';
  kelas.innerText = `Kelas: ${student.kelas || '-'}`;
  badgeJadwal.innerText = `Mapel: ${schedule.mapel || '-'}`;
  message.innerText = data.message;

  if (data.status === 'ALREADY') {
    box.classList.add('warning');
    icon.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
    badgeStatus.className = 'badge badge-warning';
    badgeStatus.innerText = 'SUDAH ABSEN';
    badgeWa.classList.add('hidden');
  } else {
    box.classList.add('success');
    icon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
    badgeStatus.className = att.status === 'Terlambat' ? 'badge badge-warning' : 'badge badge-success';
    badgeStatus.innerText = att.status || 'HADIR';

    badgeWa.classList.remove('hidden');
    if (wa.sent) {
      badgeWa.className = 'badge badge-wa';
      badgeWa.innerHTML = '<i class="fa-brands fa-whatsapp"></i> WA Terkirim';
    } else {
      badgeWa.className = 'badge badge-danger';
      badgeWa.innerHTML = `<i class="fa-brands fa-whatsapp"></i> WA: ${wa.reason || 'Gagal'}`;
    }
  }
}

function playBeep(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'warning') {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {
    console.log('Audio error:', e);
  }
}
