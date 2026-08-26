/* ============================================================
   SISTEM ABSENSI KARTU PELAJAR
   SMP BAITUL ULUM BOARDING SCHOOL

   APP.JS V6.2

   SERVER:
   fetch(API_URL)

   FITUR:
   - QR Scanner
   - HP / Laptop
   - Hadir
   - Terlambat
   - Sudah Absen
   - Data Tidak Ditemukan
   - Rekap Hari Ini
   - Daftar Urutan Absensi
   - 5 / 10 / 25 / 50 / 100 / 150
   - Tampilkan Semua
   - Total Siswa Absen
============================================================ */


/* ============================================================
   API
============================================================ */

const API_URL =
  'https://script.google.com/macros/s/AKfycbybMMhzrTv3Uqv3vMAdJTA5Co4FiTh_jZ4ocD5iNdHb2mZBX2S_BJJBrgFCgJIcqb21/exec';


/* ============================================================
   KONFIGURASI
============================================================ */

const AUTO_SCAN_DELAY =
  2500;

const SUMMARY_REFRESH_DELAY =
  1200;

const DEFAULT_DISPLAY_LIMIT =
  10;


/* ============================================================
   SCANNER
============================================================ */

let html5QrCode =
  null;

let scannerRunning =
  false;

let processingScan =
  false;


/* ============================================================
   DATA ABSENSI
============================================================ */

let todayAttendanceData =
  [];

let attendanceDisplayLimit =
  DEFAULT_DISPLAY_LIMIT;


/* ============================================================
   COUNTER
============================================================ */

let countPresent =
  0;

let countLate =
  0;

let countAlready =
  0;

let countError =
  0;


/* ============================================================
   ELEMENT
============================================================ */

const statusElement =
  document.getElementById(
    'status'
  );

const resultElement =
  document.getElementById(
    'result'
  );

const scannerCard =
  document.getElementById(
    'scannerCard'
  );

const studentIdElement =
  document.getElementById(
    'studentId'
  );

const resultTitleElement =
  document.getElementById(
    'resultTitle'
  );

const resultIconElement =
  document.getElementById(
    'resultIcon'
  );

const resultMessageElement =
  document.getElementById(
    'resultMessage'
  );

const startButton =
  document.getElementById(
    'startButton'
  );

const scanAgainButton =
  document.getElementById(
    'scanAgainButton'
  );

const autoScanToggle =
  document.getElementById(
    'autoScanToggle'
  );

const autoScanLabel =
  document.getElementById(
    'autoScanLabel'
  );


/* ============================================================
   LOAD
============================================================ */

window.addEventListener(
  'load',
  function() {

    console.log(
      '================================'
    );

    console.log(
      'ABSENSI V6.2'
    );

    console.log(
      '================================'
    );


    updateDateTime();


    setInterval(
      updateDateTime,
      1000
    );


    setStatus(
      '🟢 Scanner siap.'
    );


    prepareSpeech();


    loadTodaySummary();


    loadTodayAttendanceList();


    testServer();

  }
);


/* ============================================================
   TEST SERVER
============================================================ */

function testServer() {

  fetch(
    API_URL +
    '?action=test&_=' +
    Date.now()
  )

  .then(
    function(response) {

      if (!response.ok) {

        throw new Error(
          'HTTP ' +
          response.status
        );

      }

      return response.json();

    }
  )

  .then(
    function(result) {

      console.log(
        'SERVER TEST:',
        result
      );


      if (
        result &&
        result.success === true
      ) {

        setStatus(
          '🟢 Server terhubung.'
        );

      }

    }
  )

  .catch(
    function(error) {

      console.error(
        'SERVER TEST ERROR:',
        error
      );

      setStatus(
        '🔴 Koneksi Apps Script gagal.'
      );

    }
  );

}


/* ============================================================
   START SCANNER
============================================================ */

if (startButton) {

  startButton.addEventListener(
    'click',
    function() {

      prepareSpeech();

      speak(
        'Scanner siap'
      );

      startScanner();

    }
  );

}


/* ============================================================
   SCAN LAGI
============================================================ */

if (scanAgainButton) {

  scanAgainButton.addEventListener(
    'click',
    function() {

      restartScanner();

    }
  );

}


/* ============================================================
   AUTO SCAN
============================================================ */

if (autoScanToggle) {

  autoScanToggle.addEventListener(
    'change',
    function() {

      if (
        autoScanToggle.checked
      ) {

        if (autoScanLabel) {

          autoScanLabel.textContent =
            'AKTIF';

        }

      }

      else {

        if (autoScanLabel) {

          autoScanLabel.textContent =
            'MATI';

        }

      }

    }
  );

}


/* ============================================================
   FILTER JUMLAH
============================================================ */

const attendanceLimit =
  document.getElementById(
    'attendanceLimit'
  );


if (attendanceLimit) {

  attendanceLimit.addEventListener(
    'change',
    function() {

      const value =
        attendanceLimit.value;


      if (
        value === 'all'
      ) {

        attendanceDisplayLimit =
          0;

      }

      else {

        attendanceDisplayLimit =
          Number(value) || 10;

      }


      renderAttendanceByLimit();

    }
  );

}


/* ============================================================
   SCANNER
============================================================ */

function startScanner() {

  processingScan =
    false;


  if (resultElement) {

    resultElement.style.display =
      'none';

  }


  if (scannerCard) {

    scannerCard.style.display =
      'block';

  }


  setStatus(
    '📷 Memeriksa kamera...'
  );


  if (
    typeof Html5Qrcode ===
    'undefined'
  ) {

    setStatus(
      '🔴 Library scanner tidak tersedia.'
    );

    return;

  }


  if (
    html5QrCode &&
    scannerRunning
  ) {

    stopScanner()
      .finally(
        getCameraAndStart
      );

  }

  else {

    getCameraAndStart();

  }

}


/* ============================================================
   KAMERA
============================================================ */

function getCameraAndStart() {

  setStatus(
    '📷 Meminta izin kamera...'
  );


  Html5Qrcode
    .getCameras()

    .then(
      function(cameras) {

        if (
          !cameras ||
          cameras.length === 0
        ) {

          throw new Error(
            'Kamera tidak ditemukan.'
          );

        }


        let camera =
          cameras[0];


        for (
          let i = 0;
          i < cameras.length;
          i++
        ) {

          const label =
            String(
              cameras[i].label || ''
            )
            .toLowerCase();


          if (
            label.includes('back') ||
            label.includes('rear') ||
            label.includes('environment') ||
            label.includes('belakang')
          ) {

            camera =
              cameras[i];

            break;

          }

        }


        startCamera(
          camera.id
        );

      }
    )

    .catch(
      showCameraError
    );

}


/* ============================================================
   START CAMERA
============================================================ */

function startCamera(
  cameraId
) {

  const reader =
    document.getElementById(
      'reader'
    );


  if (!reader) {

    setStatus(
      '🔴 Area kamera tidak ditemukan.'
    );

    return;

  }


  reader.innerHTML =
    '';


  html5QrCode =
    new Html5Qrcode(
      'reader'
    );


  const config = {

    fps: 10,

    qrbox:
      function(width, height) {

        const size =
          Math.floor(
            Math.min(
              width,
              height
            ) * 0.70
          );


        return {

          width: size,

          height: size

        };

      },

    aspectRatio: 1.0

  };


  html5QrCode

    .start(
      cameraId,
      config,
      onScanSuccess,
      onScanError
    )

    .then(
      function() {

        scannerRunning =
          true;


        setStatus(
          '🟢 SIAP SCAN KARTU'
        );


        if (startButton) {

          startButton.style.display =
            'none';

        }

      }
    )

    .catch(
      showCameraError
    );

}


/* ============================================================
   QR BERHASIL
============================================================ */

function onScanSuccess(
  decodedText
) {

  if (
    processingScan
  ) {

    return;

  }


  processingScan =
    true;


  const studentId =
    String(
      decodedText || ''
    ).trim();


  console.log(
    'QR:',
    studentId
  );


  stopScanner()
    .finally(
      function() {

        showProcessing();

        processAttendance(
          studentId
        );

      }
    );

}


/* ============================================================
   QR ERROR NORMAL
============================================================ */

function onScanError() {}


/* ============================================================
   PROCESSING
============================================================ */

function showProcessing() {

  if (scannerCard) {

    scannerCard.style.display =
      'none';

  }


  if (resultElement) {

    resultElement.style.display =
      'block';

    resultElement.className =
      'result';

  }


  if (resultIconElement) {

    resultIconElement.textContent =
      '⏳';

  }


  if (resultTitleElement) {

    resultTitleElement.textContent =
      'MEMPROSES ABSENSI';

  }


  if (resultMessageElement) {

    resultMessageElement.textContent =
      'Menghubungkan ke server...';

  }


  if (studentIdElement) {

    studentIdElement.textContent =
      'Mohon tunggu...';

  }

}


/* ============================================================
   ABSENSI API
============================================================ */

function processAttendance(
  studentId
) {

  const url =
    API_URL +
    '?action=attendance' +
    '&studentId=' +
    encodeURIComponent(
      studentId
    ) +
    '&_=' +
    Date.now();


  fetch(url)

    .then(
      function(response) {

        if (!response.ok) {

          throw new Error(
            'HTTP ' +
            response.status
          );

        }


        return response.json();

      }
    )

    .then(
      handleAttendanceResult
    )

    .catch(
      function(error) {

        console.error(
          'ATTENDANCE API ERROR:',
          error
        );


        countError++;

        updateCounters();


        showAttendanceError(
          'KONEKSI GAGAL',
          'Tidak dapat terhubung ke server Apps Script.'
        );


        speak(
          'Koneksi gagal'
        );


        scheduleNextScan();

      }
    );

}


/* ============================================================
   HASIL ABSENSI
============================================================ */

function handleAttendanceResult(
  result
) {

  console.log(
    'ATTENDANCE RESULT:',
    result
  );


  if (!result) {

    showAttendanceError(
      'ERROR SERVER',
      'Server tidak memberikan data.'
    );

    scheduleNextScan();

    return;

  }


  switch (
    result.status
  ) {

    case 'SUCCESS':

      handleSuccess(
        result
      );

      break;


    case 'ALREADY':

      handleAlready(
        result
      );

      break;


    case 'NOT_FOUND':

      countError++;

      updateCounters();

      showAttendanceError(
        'DATA TIDAK DITEMUKAN',
        result.message ||
        'Kartu tidak terdaftar.'
      );

      speak(
        'Kartu tidak terdaftar'
      );

      scheduleNextScan();

      break;


    case 'INACTIVE':

      countError++;

      updateCounters();

      showAttendanceError(
        'SISWA TIDAK AKTIF',
        result.message ||
        'Siswa tidak aktif.'
      );

      speak(
        'Siswa tidak aktif'
      );

      scheduleNextScan();

      break;


    default:

      countError++;

      updateCounters();

      showAttendanceError(
        'ABSENSI GAGAL',
        result.message ||
        'Terjadi kesalahan server.'
      );

      scheduleNextScan();

  }

}


/* ============================================================
   BERHASIL
============================================================ */

function handleSuccess(
  result
) {

  const student =
    result.student || {};

  const attendance =
    result.attendance || {};


  const status =
    String(
      attendance.status || ''
    );


  if (
    status
      .toLowerCase()
      .includes('terlambat')
  ) {

    countLate++;

  }

  else {

    countPresent++;

  }


  updateCounters();


  if (resultElement) {

    resultElement.style.display =
      'block';

    resultElement.className =
      status
        .toLowerCase()
        .includes('terlambat')
        ? 'result late'
        : 'result success';

  }


  if (resultIconElement) {

    resultIconElement.textContent =
      status
        .toLowerCase()
        .includes('terlambat')
        ? '🟡'
        : '🟢';

  }


  if (resultTitleElement) {

    resultTitleElement.textContent =
      status
        .toLowerCase()
        .includes('terlambat')
        ? 'TERLAMBAT'
        : 'ABSENSI BERHASIL';

  }


  if (resultMessageElement) {

    resultMessageElement.textContent =
      'Absensi berhasil dicatat.';

  }


  if (studentIdElement) {

    studentIdElement.innerHTML =

      '<strong>' +
      escapeHtml(student.nama) +
      '</strong>' +

      '<br>' +

      '<span>' +
      escapeHtml(student.kelas) +
      '</span>' +

      '<br><br>' +

      '<strong>' +
      escapeHtml(status) +
      '</strong>' +

      '<br>' +

      '<small>' +
      escapeHtml(
        attendance.tanggal
      ) +
      ' • ' +
      escapeHtml(
        attendance.jam
      ) +
      ' WIB</small>';

  }


  speak(
    status
      .toLowerCase()
      .includes('terlambat')
      ? 'Terlambat'
      : 'Absensi berhasil'
  );


  setTimeout(
    function() {

      loadTodaySummary();

      loadTodayAttendanceList();

    },
    SUMMARY_REFRESH_DELAY
  );


  scheduleNextScan();

}


/* ============================================================
   SUDAH ABSEN
============================================================ */

function handleAlready(
  result
) {

  const student =
    result.student || {};

  const previous =
    result.previousAttendance || {};


  countAlready++;

  updateCounters();


  if (resultElement) {

    resultElement.style.display =
      'block';

    resultElement.className =
      'result already';

  }


  if (resultIconElement) {

    resultIconElement.textContent =
      '🟠';

  }


  if (resultTitleElement) {

    resultTitleElement.textContent =
      'SUDAH ABSEN';

  }


  if (resultMessageElement) {

    resultMessageElement.textContent =
      'Siswa sudah melakukan absensi hari ini.';

  }


  if (studentIdElement) {

    studentIdElement.innerHTML =

      '<strong>' +
      escapeHtml(student.nama) +
      '</strong>' +

      '<br>' +

      '<span>' +
      escapeHtml(student.kelas) +
      '</span>' +

      '<br><br>' +

      'Status: <strong>' +

      escapeHtml(
        previous.status
      ) +

      '</strong>' +

      '<br>' +

      '<small>Absen pukul ' +

      escapeHtml(
        previous.jam
      ) +

      '</small>';

  }


  speak(
    'Siswa sudah absen'
  );


  loadTodaySummary();

  loadTodayAttendanceList();


  scheduleNextScan();

}


/* ============================================================
   ERROR
============================================================ */

function showAttendanceError(
  title,
  message
) {

  if (resultElement) {

    resultElement.style.display =
      'block';

    resultElement.className =
      'result error';

  }


  if (resultIconElement) {

    resultIconElement.textContent =
      '🔴';

  }


  if (resultTitleElement) {

    resultTitleElement.textContent =
      title;

  }


  if (resultMessageElement) {

    resultMessageElement.textContent =
      '';

  }


  if (studentIdElement) {

    studentIdElement.textContent =
      message;

  }

}


/* ============================================================
   RESTART
============================================================ */

function restartScanner() {

  processingScan =
    false;


  if (resultElement) {

    resultElement.style.display =
      'none';

  }


  if (scannerCard) {

    scannerCard.style.display =
      'block';

  }


  startScanner();

}


/* ============================================================
   STOP
============================================================ */

function stopScanner() {

  return new Promise(
    function(resolve) {

      if (
        !html5QrCode ||
        !scannerRunning
      ) {

        scannerRunning =
          false;

        resolve();

        return;

      }


      html5QrCode

        .stop()

        .then(
          function() {

            scannerRunning =
              false;

            resolve();

          }
        )

        .catch(
          function(error) {

            console.warn(
              'STOP CAMERA:',
              error
            );

            scannerRunning =
              false;

            resolve();

          }
        );

    }
  );

}


/* ============================================================
   AUTO SCAN
============================================================ */

function scheduleNextScan() {

  if (
    !autoScanToggle ||
    !autoScanToggle.checked
  ) {

    return;

  }


  setTimeout(
    restartScanner,
    AUTO_SCAN_DELAY
  );

}


/* ============================================================
   COUNTER
============================================================ */

function updateCounters() {

  const total =
    countPresent +
    countLate;


  setText(
    'countTotal',
    total
  );

  setText(
    'countPresent',
    countPresent
  );

  setText(
    'countLate',
    countLate
  );

  setText(
    'countAlready',
    countAlready
  );

  setText(
    'countError',
    countError
  );

}


/* ============================================================
   SUMMARY
============================================================ */

function loadTodaySummary() {

  fetch(
    API_URL +
    '?action=summary&_=' +
    Date.now()
  )

  .then(
    function(response) {

      if (!response.ok) {

        throw new Error(
          'HTTP ' +
          response.status
        );

      }


      return response.json();

    }
  )

  .then(
    function(result) {

      console.log(
        'SUMMARY:',
        result
      );


      if (
        !result ||
        result.success !== true
      ) {

        throw new Error(
          result &&
          result.message
            ? result.message
            : 'Summary tidak valid.'
        );

      }


      countPresent =
        Number(
          result.hadir || 0
        );


      countLate =
        Number(
          result.terlambat || 0
        );


      /*
       * Jangan menjumlahkan "sudahAbsen"
       * sebagai counter baru.
       *
       * Total siswa =
       * Hadir + Terlambat
       */

      updateCounters();

    }
  )

  .catch(
    function(error) {

      console.error(
        'SUMMARY ERROR:',
        error
      );

    }
  );

}


/* ============================================================
   LOAD DAFTAR ABSENSI
============================================================ */

function loadTodayAttendanceList() {

  console.log(
    'Memuat daftar absensi...'
  );


  showAttendanceLoading();


  fetch(
    API_URL +
    '?action=todayAttendance&_=' +
    Date.now()
  )

  .then(
    function(response) {

      if (!response.ok) {

        throw new Error(
          'HTTP ' +
          response.status
        );

      }


      return response.json();

    }
  )

  .then(
    function(result) {

      console.log(
        'DAFTAR ABSENSI:',
        result
      );


      if (
        !result ||
        result.success !== true
      ) {

        throw new Error(
          result &&
          result.message
            ? result.message
            : 'Data absensi tidak valid.'
        );

      }


      renderTodayAttendance(
        result.data || []
      );

    }
  )

  .catch(
    function(error) {

      console.error(
        'ATTENDANCE LIST ERROR:',
        error
      );


      showAttendanceListError(
        error.message ||
        'Gagal mengambil data absensi.'
      );

    }
  );

}


/* ============================================================
   RENDER DAFTAR
============================================================ */

function renderTodayAttendance(
  data
) {

  if (!Array.isArray(data)) {

    data = [];

  }


  todayAttendanceData =
    normalizeAttendanceData(
      data
    );


  updateAttendanceTotal(
    todayAttendanceData.length
  );


  const empty =
    document.getElementById(
      'attendanceEmpty'
    );


  if (
    todayAttendanceData.length === 0
  ) {

    if (empty) {

      empty.style.display =
        'block';

    }


    hideAttendanceLayouts();


    updateAttendanceDisplayInfo(
      0,
      0
    );


    hideAttendanceLoading();


    return;

  }


  if (empty) {

    empty.style.display =
      'none';

  }


  hideAttendanceLoading();


  renderAttendanceByLimit();

}


/* ============================================================
   FILTER RENDER
============================================================ */

function renderAttendanceByLimit() {

  const total =
    todayAttendanceData.length;


  let displayData;


  if (
    attendanceDisplayLimit === 0
  ) {

    displayData =
      todayAttendanceData.slice();

  }

  else {

    displayData =
      todayAttendanceData.slice(
        0,
        attendanceDisplayLimit
      );

  }


  renderAttendanceTable(
    displayData
  );


  renderAttendanceCards(
    displayData
  );


  updateAttendanceDisplayInfo(
    displayData.length,
    total
  );


  showAttendanceLayouts();

}


/* ============================================================
   NORMALISASI
============================================================ */

function normalizeAttendanceData(
  data
) {

  return data.map(
    function(item) {

      return {

        nama:
          String(
            item.nama ||
            item.NAMA ||
            item.name ||
            '-'
          ),

        kelas:
          String(
            item.kelas ||
            item.KELAS ||
            item.class ||
            '-'
          ),

        jam:
          String(
            item.jam ||
            item.JAM ||
            item.time ||
            '-'
          ),

        status:
          String(
            item.status ||
            item.STATUS ||
            '-'
          )

      };

    }
  );

}


/* ============================================================
   TABLE
============================================================ */

function renderAttendanceTable(
  data
) {

  const tbody =
    document.getElementById(
      'attendanceTableBody'
    );


  if (!tbody) {

    return;

  }


  tbody.innerHTML =
    '';


  data.forEach(
    function(student, index) {

      const row =
        document.createElement(
          'tr'
        );


      row.innerHTML =

        '<td class="rank-column">' +

        getRankHtml(
          index + 1
        ) +

        '</td>' +

        '<td>' +

        '<span class="student-name">' +

        escapeHtml(
          student.nama
        ) +

        '</span>' +

        '</td>' +

        '<td>' +

        '<span class="student-class">' +

        escapeHtml(
          student.kelas
        ) +

        '</span>' +

        '</td>' +

        '<td>' +

        '🕐 ' +

        escapeHtml(
          student.jam
        ) +

        '</td>' +

        '<td>' +

        getStatusBadgeHtml(
          student.status
        ) +

        '</td>';


      tbody.appendChild(
        row
      );

    }
  );

}


/* ============================================================
   MOBILE CARD
============================================================ */

function renderAttendanceCards(
  data
) {

  const container =
    document.getElementById(
      'attendanceCardList'
    );


  if (!container) {

    return;

  }


  container.innerHTML =
    '';


  data.forEach(
    function(student, index) {

      const card =
        document.createElement(
          'div'
        );


      card.className =
        'attendance-card';


      card.innerHTML =

        '<div class="attendance-card-rank">' +

        getRankHtml(
          index + 1
        ) +

        '</div>' +

        '<div class="attendance-card-content">' +

        '<div class="attendance-card-name">' +

        escapeHtml(
          student.nama
        ) +

        '</div>' +

        '<div class="attendance-card-class">' +

        'Kelas ' +

        escapeHtml(
          removeKelasPrefix(
            student.kelas
          )
        ) +

        '</div>' +

        '<div class="attendance-card-bottom">' +

        '<span>🕐 ' +

        escapeHtml(
          student.jam
        ) +

        '</span>' +

        getStatusBadgeHtml(
          student.status
        ) +

        '</div>' +

        '</div>';


      container.appendChild(
        card
      );

    }
  );

}


/* ============================================================
   RANK
============================================================ */

function getRankHtml(
  rank
) {

  if (rank === 1)
    return '🥇';

  if (rank === 2)
    return '🥈';

  if (rank === 3)
    return '🥉';

  return String(rank);

}


/* ============================================================
   STATUS BADGE
============================================================ */

function getStatusBadgeHtml(
  status
) {

  const text =
    String(
      status || '-'
    );


  const lower =
    text.toLowerCase();


  if (
    lower.includes(
      'terlambat'
    )
  ) {

    return (

      '<span class="status-badge status-terlambat">' +

      '🟡 ' +

      escapeHtml(
        text
      ) +

      '</span>'

    );

  }


  if (
    lower.includes(
      'hadir'
    )
  ) {

    return (

      '<span class="status-badge status-hadir">' +

      '🟢 ' +

      escapeHtml(
        text
      ) +

      '</span>'

    );

  }


  return (

    '<span class="status-badge status-other">' +

    escapeHtml(
      text
    ) +

    '</span>'

  );

}


/* ============================================================
   TOTAL
============================================================ */

function updateAttendanceTotal(
  total
) {

  setText(
    'attendanceTotal',
    Number(total || 0)
  );

}


/* ============================================================
   INFO
============================================================ */

function updateAttendanceDisplayInfo(
  displayed,
  total
) {

  const element =
    document.getElementById(
      'attendanceDisplayInfo'
    );


  if (!element) {

    return;

  }


  if (total === 0) {

    element.textContent =
      'Belum ada siswa yang melakukan absensi hari ini.';

    return;

  }


  if (
    displayed >= total
  ) {

    element.textContent =
      'Menampilkan seluruh ' +
      total +
      ' siswa yang sudah absen hari ini.';

    return;

  }


  element.textContent =
    'Menampilkan ' +
    displayed +
    ' dari ' +
    total +
    ' siswa yang sudah absen hari ini.';

}


/* ============================================================
   SHOW / HIDE
============================================================ */

function showAttendanceLayouts() {

  const desktop =
    document.getElementById(
      'attendanceDesktop'
    );

  const mobile =
    document.getElementById(
      'attendanceMobile'
    );


  if (desktop) {

    desktop.style.display =
      '';

  }


  if (mobile) {

    mobile.style.display =
      '';

  }

}


function hideAttendanceLayouts() {

  const desktop =
    document.getElementById(
      'attendanceDesktop'
    );

  const mobile =
    document.getElementById(
      'attendanceMobile'
    );


  if (desktop) {

    desktop.style.display =
      'none';

  }


  if (mobile) {

    mobile.style.display =
      'none';

  }

}


/* ============================================================
   LOADING
============================================================ */

function showAttendanceLoading() {

  const loading =
    document.getElementById(
      'attendanceLoading'
    );


  if (loading) {

    loading.style.display =
      'flex';

  }

}


function hideAttendanceLoading() {

  const loading =
    document.getElementById(
      'attendanceLoading'
    );


  if (loading) {

    loading.style.display =
      'none';

  }

}


/* ============================================================
   ERROR LIST
============================================================ */

function showAttendanceListError(
  message
) {

  const loading =
    document.getElementById(
      'attendanceLoading'
    );


  if (!loading) {

    return;

  }


  loading.style.display =
    'flex';


  loading.innerHTML =

    '<div style="text-align:center;padding:20px;color:#dc2626;">' +

    '🔴 ' +

    escapeHtml(
      message
    ) +

    '<br><br>' +

    '<button onclick="loadTodayAttendanceList()">' +

    '🔄 Coba Lagi' +

    '</button>' +

    '</div>';

}


/* ============================================================
   REFRESH
============================================================ */

function refreshAttendanceList() {

  loadTodayAttendanceList();

}


/* ============================================================
   TAMPILKAN SEMUA
============================================================ */

function showAllAttendance() {

  attendanceDisplayLimit =
    0;


  const selector =
    document.getElementById(
      'attendanceLimit'
    );


  if (selector) {

    selector.value =
      'all';

  }


  renderAttendanceByLimit();

}


/* ============================================================
   HELPER TEXT
============================================================ */

function setText(
  id,
  value
) {

  const element =
    document.getElementById(
      id
    );


  if (element) {

    element.textContent =
      value;

  }

}


/* ============================================================
   TANGGAL & JAM
============================================================ */

function updateDateTime() {

  const now =
    new Date();


  setText(
    'currentDate',
    now.toLocaleDateString(
      'id-ID',
      {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }
    )
  );


  setText(
    'currentTime',
    now.toLocaleTimeString(
      'id-ID',
      {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }
    )
  );


  setText(
    'attendanceDate',
    now.toLocaleDateString(
      'id-ID',
      {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }
    )
  );

}


/* ============================================================
   AUDIO
============================================================ */

function prepareSpeech() {

  if (
    'speechSynthesis'
    in window
  ) {

    window.speechSynthesis.cancel();

  }

}


function speak(
  text
) {

  if (
    !(
      'speechSynthesis'
      in window
    )
  ) {

    return;

  }


  try {

    window.speechSynthesis.cancel();


    const utterance =
      new SpeechSynthesisUtterance(
        text
      );


    utterance.lang =
      'id-ID';

    utterance.rate =
      0.9;

    utterance.pitch =
      1;

    utterance.volume =
      1;


    window.speechSynthesis.speak(
      utterance
    );

  }

  catch(error) {

    console.error(
      'SPEECH ERROR:',
      error
    );

  }

}


/* ============================================================
   STATUS
============================================================ */

function setStatus(
  message
) {

  if (statusElement) {

    statusElement.textContent =
      message;

  }


  console.log(
    'STATUS:',
    message
  );

}


/* ============================================================
   CAMERA ERROR
============================================================ */

function showCameraError(
  error
) {

  console.error(
    'CAMERA ERROR:',
    error
  );


  let message =
    'Kamera gagal diakses.';


  if (error) {

    if (error.message) {

      message +=
        ' ' +
        error.message;

    }

  }


  setStatus(
    '🔴 ' +
    message
  );


  if (startButton) {

    startButton.style.display =
      'block';

  }

}


/* ============================================================
   REMOVE PREFIX KELAS
============================================================ */

function removeKelasPrefix(
  value
) {

  return String(
    value || ''
  )
  .replace(
    /^kelas\s+/i,
    ''
  )
  .trim();

}


/* ============================================================
   ESCAPE HTML
============================================================ */

function escapeHtml(
  value
) {

  return String(
    value ?? ''
  )
  .replace(
    /&/g,
    '&amp;'
  )
  .replace(
    /</g,
    '&lt;'
  )
  .replace(
    />/g,
    '&gt;'
  )
  .replace(
    /"/g,
    '&quot;'
  )
  .replace(
    /'/g,
    '&#039;'
  );

}
