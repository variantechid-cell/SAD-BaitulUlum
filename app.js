/* =========================================================
   SISTEM ABSENSI KARTU PELAJAR
   SMP BAITUL ULUM BOARDING SCHOOL

   APP.JS V6.2

   KOMUNIKASI SERVER:
   google.script.run

   TIDAK MENGGUNAKAN:
   fetch()
   API_URL
========================================================= */


/* =========================================================
   KONFIGURASI
========================================================= */

const APP_VERSION =
  'V6.2';


const AUTO_SCAN_DELAY =
  2500;


const SUMMARY_REFRESH_DELAY =
  800;


/* =========================================================
   SCANNER
========================================================= */

let html5QrCode =
  null;


let scannerRunning =
  false;


let processingScan =
  false;


/* =========================================================
   DATA ABSENSI
========================================================= */

let todayAttendanceData =
  [];


let attendanceDisplayLimit =
  10;


/* =========================================================
   COUNTER
========================================================= */

let countPresent =
  0;


let countLate =
  0;


let countAlready =
  0;


let countError =
  0;


/* =========================================================
   ELEMENT
========================================================= */

const statusElement =
  document.getElementById(
    'status'
  );


const scannerCard =
  document.getElementById(
    'scannerCard'
  );


const resultElement =
  document.getElementById(
    'result'
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


/* =========================================================
   LOAD
========================================================= */

window.addEventListener(
  'load',
  function() {

    console.log(
      '================================'
    );

    console.log(
      'SISTEM ABSENSI ' +
      APP_VERSION
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
      '🟢 Sistem siap.'
    );


    prepareSpeech();


    checkServerConnection();


    loadTodaySummary();


    loadTodayAttendanceList();

  }
);


/* =========================================================
   TOMBOL SCANNER
========================================================= */

if (startButton) {

  startButton.addEventListener(
    'click',
    function() {

      console.log(
        'MULAI SCANNER'
      );


      prepareSpeech();


      speak(
        'Scanner siap'
      );


      startScanner();

    }
  );

}


/* =========================================================
   SCAN LAGI
========================================================= */

if (scanAgainButton) {

  scanAgainButton.addEventListener(
    'click',
    function() {

      restartScanner();

    }
  );

}


/* =========================================================
   AUTO SCAN
========================================================= */

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

          autoScanLabel.style.color =
            '#16a34a';

        }

      }

      else {

        if (autoScanLabel) {

          autoScanLabel.textContent =
            'MATI';

          autoScanLabel.style.color =
            '#64748b';

        }

      }

    }
  );

}


/* =========================================================
   FILTER DATA
========================================================= */

const attendanceLimit =
  document.getElementById(
    'attendanceLimit'
  );


if (attendanceLimit) {

  attendanceLimit.addEventListener(
    'change',
    function() {

      attendanceDisplayLimit =
        Number(
          attendanceLimit.value
        );


      if (
        isNaN(
          attendanceDisplayLimit
        )
      ) {

        attendanceDisplayLimit =
          10;

      }


      renderAttendanceByLimit();

    }
  );

}


/* =========================================================
   TOMBOL TAMPILKAN SEMUA
========================================================= */

const showAllButton =
  document.getElementById(
    'showAllButton'
  );


if (showAllButton) {

  showAllButton.addEventListener(
    'click',
    function() {

      attendanceDisplayLimit =
        0;


      if (attendanceLimit) {

        attendanceLimit.value =
          '0';

      }


      renderAttendanceByLimit();

    }
  );

}


/* =========================================================
   CEK SERVER
========================================================= */

function checkServerConnection() {

  const serverStatus =
    document.getElementById(
      'serverStatus'
    );


  if (!serverStatus) {

    return;

  }


  serverStatus.textContent =
    '🟡 Menghubungkan ke server...';


  if (
    typeof google === 'undefined' ||
    !google.script ||
    !google.script.run
  ) {

    serverStatus.textContent =
      '🔴 google.script.run tidak tersedia.';


    console.error(
      'google.script.run tidak tersedia.'
    );


    return;

  }


  google.script.run

    .withSuccessHandler(
      function(result) {

        console.log(
          'SERVER INFO:',
          result
        );


        if (
          result &&
          result.success
        ) {

          serverStatus.textContent =
            '🟢 Server terhubung • ' +
            result.version;

        }

        else {

          serverStatus.textContent =
            '🔴 Server bermasalah.';

        }

      }
    )

    .withFailureHandler(
      function(error) {

        console.error(
          'SERVER ERROR:',
          error
        );


        serverStatus.textContent =
          '🔴 Server tidak terhubung.';

      }
    )

    .getServerInfo();

}


/* =========================================================
   START SCANNER
========================================================= */

function startScanner() {

  if (
    typeof Html5Qrcode ===
    'undefined'
  ) {

    setStatus(
      '🔴 Library scanner belum tersedia.'
    );

    return;

  }


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
    html5QrCode &&
    scannerRunning
  ) {

    stopScanner()
      .finally(
        function() {

          getCameraAndStart();

        }
      );

  }

  else {

    getCameraAndStart();

  }

}


/* =========================================================
   CARI KAMERA
========================================================= */

function getCameraAndStart() {

  setStatus(
    '📷 Meminta izin kamera...'
  );


  Html5Qrcode
    .getCameras()

    .then(
      function(cameras) {

        console.log(
          'CAMERAS:',
          cameras
        );


        if (
          !cameras ||
          cameras.length === 0
        ) {

          setStatus(
            '🔴 Kamera tidak ditemukan.'
          );

          return;

        }


        let selectedCamera =
          cameras[0];


        for (
          let i = 0;
          i < cameras.length;
          i++
        ) {

          const label =
            String(
              cameras[i].label ||
              ''
            )
            .toLowerCase();


          if (
            label.includes('back') ||
            label.includes('rear') ||
            label.includes('environment') ||
            label.includes('belakang')
          ) {

            selectedCamera =
              cameras[i];

            break;

          }

        }


        startCamera(
          selectedCamera.id
        );

      }
    )

    .catch(
      function(error) {

        console.error(
          'CAMERA ERROR:',
          error
        );


        showCameraError(
          error
        );

      }
    );

}


/* =========================================================
   START CAMERA
========================================================= */

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
      function(
        width,
        height
      ) {

        const size =
          Math.floor(
            Math.min(
              width,
              height
            ) * 0.70
          );


        return {

          width:
            size,

          height:
            size

        };

      }

  };


  setStatus(
    '📷 Menyalakan kamera...'
  );


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
      function(error) {

        scannerRunning =
          false;


        console.error(
          'START CAMERA ERROR:',
          error
        );


        showCameraError(
          error
        );

      }
    );

}


/* =========================================================
   QR SUCCESS
========================================================= */

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


/* =========================================================
   QR ERROR
========================================================= */

function onScanError() {

  /*
   * Sengaja kosong.
   */

}


/* =========================================================
   PROCESSING
========================================================= */

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


/* =========================================================
   KIRIM ABSENSI KE CODE.GS
========================================================= */

function processAttendance(
  studentId
) {

  if (
    typeof google === 'undefined' ||
    !google.script ||
    !google.script.run
  ) {

    handleServerError(
      'Koneksi Apps Script tidak tersedia.'
    );

    return;

  }


  google.script.run

    .withSuccessHandler(
      function(result) {

        console.log(
          'HASIL ABSENSI:',
          result
        );


        handleAttendanceResult(
          result
        );

      }
    )

    .withFailureHandler(
      function(error) {

        console.error(
          'ABSENSI SERVER ERROR:',
          error
        );


        handleServerError(
          error &&
          error.message
            ? error.message
            : 'Server gagal memproses absensi.'
        );

      }
    )

    .processAttendance(
      studentId
    );

}


/* =========================================================
   HASIL ABSENSI
========================================================= */

function handleAttendanceResult(
  result
) {

  if (!result) {

    handleServerError(
      'Server tidak mengirim hasil.'
    );

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
        'Data tidak ditemukan'
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

      handleServerError(
        result.message ||
        'Absensi gagal diproses.'
      );

  }

}


/* =========================================================
   ABSENSI BERHASIL
========================================================= */

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
    )
    .toLowerCase();


  if (
    status.includes(
      'terlambat'
    )
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
      status.includes(
        'terlambat'
      )
      ? 'result late'
      : 'result success';

  }


  if (resultIconElement) {

    resultIconElement.textContent =
      status.includes(
        'terlambat'
      )
      ? '🟡'
      : '🟢';

  }


  if (resultTitleElement) {

    resultTitleElement.textContent =
      status.includes(
        'terlambat'
      )
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

      escapeHtml(
        student.nama
      ) +

      '</strong>' +

      '<br>' +

      escapeHtml(
        student.kelas
      ) +

      '<br><br>' +

      '<strong>' +

      escapeHtml(
        attendance.status
      ) +

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
    status.includes(
      'terlambat'
    )
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


/* =========================================================
   SUDAH ABSEN
========================================================= */

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

      escapeHtml(
        student.nama
      ) +

      '</strong>' +

      '<br>' +

      escapeHtml(
        student.kelas
      ) +

      '<br><br>' +

      'Status: <strong>' +

      escapeHtml(
        previous.status
      ) +

      '</strong>' +

      '<br>' +

      '<small>' +

      'Absen pukul ' +

      escapeHtml(
        previous.jam
      ) +

      '</small>';

  }


  speak(
    'Siswa sudah absen'
  );


  scheduleNextScan();

}


/* =========================================================
   SERVER ERROR
========================================================= */

function handleServerError(
  message
) {

  countError++;

  updateCounters();


  showAttendanceError(
    'ERROR SERVER',
    message
  );


  speak(
    'Terjadi kesalahan server'
  );


  scheduleNextScan();

}


/* =========================================================
   ERROR ABSENSI
========================================================= */

function showAttendanceError(
  title,
  message
) {

  if (scannerCard) {

    scannerCard.style.display =
      'none';

  }


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
      message ||
      'Terjadi kesalahan.';

  }

}


/* =========================================================
   AUTO SCAN
========================================================= */

function scheduleNextScan() {

  if (
    !autoScanToggle ||
    !autoScanToggle.checked
  ) {

    return;

  }


  setTimeout(
    function() {

      restartScanner();

    },
    AUTO_SCAN_DELAY
  );

}


/* =========================================================
   RESTART
========================================================= */

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


  setStatus(
    '📷 Menyiapkan kamera...'
  );


  if (
    html5QrCode &&
    scannerRunning
  ) {

    stopScanner()
      .finally(
        function() {

          getCameraAndStart();

        }
      );

  }

  else {

    getCameraAndStart();

  }

}


/* =========================================================
   STOP
========================================================= */

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


/* =========================================================
   COUNTER
========================================================= */

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


/* =========================================================
   LOAD SUMMARY
========================================================= */

function loadTodaySummary() {

  if (
    typeof google === 'undefined' ||
    !google.script ||
    !google.script.run
  ) {

    return;

  }


  google.script.run

    .withSuccessHandler(
      function(result) {

        console.log(
          'SUMMARY:',
          result
        );


        if (
          !result ||
          !result.success
        ) {

          console.error(
            'SUMMARY INVALID:',
            result
          );

          return;

        }


        countPresent =
          Number(
            result.hadir || 0
          );


        countLate =
          Number(
            result.terlambat || 0
          );


        updateCounters();

      }
    )

    .withFailureHandler(
      function(error) {

        console.error(
          'SUMMARY ERROR:',
          error
        );

      }
    )

    .getTodaySummary();

}


/* =========================================================
   LOAD DAFTAR ABSENSI
========================================================= */

function loadTodayAttendanceList() {

  const loading =
    document.getElementById(
      'attendanceLoading'
    );


  const empty =
    document.getElementById(
      'attendanceEmpty'
    );


  if (loading) {

    loading.style.display =
      'block';

    loading.textContent =
      '⏳ Memuat data absensi...';

  }


  if (empty) {

    empty.style.display =
      'none';

  }


  if (
    typeof google === 'undefined' ||
    !google.script ||
    !google.script.run
  ) {

    showAttendanceListError(
      'Koneksi Apps Script tidak tersedia.'
    );

    return;

  }


  google.script.run

    .withSuccessHandler(
      function(result) {

        console.log(
          'ATTENDANCE DATA:',
          result
        );


        renderTodayAttendance(
          result
        );

      }
    )

    .withFailureHandler(
      function(error) {

        console.error(
          'ATTENDANCE ERROR:',
          error
        );


        showAttendanceListError(

          error &&
          error.message
            ? error.message
            : 'Gagal mengambil data absensi.'

        );

      }
    )

    .getTodayAttendanceList();

}


/* =========================================================
   RENDER ABSENSI
========================================================= */

function renderTodayAttendance(
  result
) {

  const loading =
    document.getElementById(
      'attendanceLoading'
    );


  const empty =
    document.getElementById(
      'attendanceEmpty'
    );


  if (loading) {

    loading.style.display =
      'none';

  }


  let data = [];


  if (
    Array.isArray(result)
  ) {

    data =
      result;

  }


  console.log(
    'DATA MURNI:',
    data
  );


  todayAttendanceData =
    normalizeAttendanceData(
      data
    );


  updateAttendanceTotal(
    todayAttendanceData.length
  );


  if (
    todayAttendanceData.length === 0
  ) {

    if (empty) {

      empty.style.display =
        'block';

    }


    renderAttendanceTable(
      []
    );


    renderAttendanceCards(
      []
    );


    updateAttendanceDisplayInfo(
      0,
      0
    );


    return;

  }


  if (empty) {

    empty.style.display =
      'none';

  }


  renderAttendanceByLimit();

}


/* =========================================================
   RENDER BERDASARKAN LIMIT
========================================================= */

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

}


/* =========================================================
   NORMALISASI
========================================================= */

function normalizeAttendanceData(
  data
) {

  if (
    !Array.isArray(data)
  ) {

    return [];

  }


  const result =
    data.map(
      function(item) {

        return {

          nama:
            String(
              item.nama ||
              item.NAMA ||
              '-'
            ),

          kelas:
            String(
              item.kelas ||
              item.KELAS ||
              '-'
            ),

          jam:
            String(
              item.jam ||
              item.JAM ||
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


  result.sort(
    function(a, b) {

      return (
        convertTimeToSeconds(
          a.jam
        )
        -
        convertTimeToSeconds(
          b.jam
        )
      );

    }
  );


  return result;

}


/* =========================================================
   TOTAL
========================================================= */

function updateAttendanceTotal(
  total
) {

  setText(
    'attendanceTotal',
    total
  );

}


/* =========================================================
   INFO
========================================================= */

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


  if (
    total === 0
  ) {

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


/* =========================================================
   TABEL
========================================================= */

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


/* =========================================================
   CARD
========================================================= */

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

        '<div class="attendance-card-time">' +

        '🕐 ' +

        escapeHtml(
          student.jam
        ) +

        '</div>' +

        '<div>' +

        getStatusBadgeHtml(
          student.status
        ) +

        '</div>' +

        '</div>' +

        '</div>';


      container.appendChild(
        card
      );

    }
  );

}


/* =========================================================
   RANK
========================================================= */

function getRankHtml(
  rank
) {

  if (
    rank === 1
  ) {

    return '🥇';

  }


  if (
    rank === 2
  ) {

    return '🥈';

  }


  if (
    rank === 3
  ) {

    return '🥉';

  }


  return (
    '<span class="rank-number">' +
    rank +
    '</span>'
  );

}


/* =========================================================
   STATUS
========================================================= */

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

      '<span class="' +
      'status-badge ' +
      'status-terlambat">' +

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

      '<span class="' +
      'status-badge ' +
      'status-hadir">' +

      '🟢 ' +

      escapeHtml(
        text
      ) +

      '</span>'

    );

  }


  return (

    '<span class="' +
    'status-badge ' +
    'status-other">' +

    escapeHtml(
      text
    ) +

    '</span>'

  );

}


/* =========================================================
   ERROR DAFTAR
========================================================= */

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
    'block';


  loading.innerHTML =

    '<div style="' +

    'color:#dc2626;' +

    'padding:15px;' +

    'text-align:center;' +

    '">' +

    '🔴 ' +

    escapeHtml(
      message
    ) +

    '<br><br>' +

    '<button ' +

    'class="btn-secondary" ' +

    'onclick="' +
    'loadTodayAttendanceList()' +
    '">' +

    '🔄 Coba Lagi' +

    '</button>' +

    '</div>';

}


/* =========================================================
   KONVERSI JAM
========================================================= */

function convertTimeToSeconds(
  time
) {

  const parts =
    String(
      time || ''
    )
    .split(':');


  if (
    parts.length < 2
  ) {

    return 999999;

  }


  return (

    Number(
      parts[0]
    ) * 3600 +

    Number(
      parts[1]
    ) * 60 +

    Number(
      parts[2] || 0
    )

  );

}


/* =========================================================
   HAPUS PREFIX
========================================================= */

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


/* =========================================================
   DATE TIME
========================================================= */

function updateDateTime() {

  const now =
    new Date();


  const date =
    now.toLocaleDateString(
      'id-ID',
      {
        weekday:
          'long',

        day:
          'numeric',

        month:
          'long',

        year:
          'numeric'
      }
    );


  const time =
    now.toLocaleTimeString(
      'id-ID',
      {
        hour:
          '2-digit',

        minute:
          '2-digit',

        second:
          '2-digit'
      }
    );


  setText(
    'currentDate',
    date
  );


  setText(
    'currentTime',
    time
  );


  setText(
    'attendanceDate',
    date
  );

}


/* =========================================================
   AUDIO
========================================================= */

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


    window.speechSynthesis.speak(
      utterance
    );

  }

  catch(error) {

    console.error(
      'VOICE ERROR:',
      error
    );

  }

}


/* =========================================================
   STATUS
========================================================= */

function setStatus(
  message
) {

  if (
    statusElement
  ) {

    statusElement.textContent =
      message;

  }


  console.log(
    'STATUS:',
    message
  );

}


/* =========================================================
   CAMERA ERROR
========================================================= */

function showCameraError(
  error
) {

  console.error(
    'CAMERA ERROR:',
    error
  );


  let message =
    'Kamera gagal diakses.';


  if (
    error &&
    error.message
  ) {

    message +=
      ' ' +
      error.message;

  }


  setStatus(
    '🔴 ' +
    message
  );


  if (startButton) {

    startButton.style.display =
      'inline-block';

  }

}


/* =========================================================
   SET TEXT
========================================================= */

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
      String(
        value ?? ''
      );

  }

}


/* =========================================================
   ESCAPE HTML
========================================================= */

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
