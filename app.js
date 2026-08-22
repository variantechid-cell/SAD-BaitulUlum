/* =====================================================
   SISTEM ABSENSI KARTU PELAJAR
   SMP BAITUL ULUM BOARDING SCHOOL

   APP.JS V5.2

   FITUR:
   - Scanner QR
   - Kamera HP / Laptop
   - Validasi siswa
   - Absensi Google Sheet
   - Status Hadir
   - Status Terlambat
   - Sudah Absen
   - Siswa Tidak Ditemukan
   - Error Server
   - Timeout Server
   - Rekap Absensi Hari Ini
   - Rekap setelah Refresh
   - Auto Refresh Rekap
   - Auto Recovery Scanner
   - Notifikasi Suara
===================================================== */


/* =====================================================
   API
===================================================== */

const API_URL =
  'https://script.google.com/macros/s/AKfycbybMMhzrTv3Uqv3vMAdJTA5Co4FiTh_jZ4ocD5iNdHb2mZBX2S_BJJBrgFCgJIcqb21/exec';


/* =====================================================
   KONFIGURASI
===================================================== */

/*
 * Jeda sebelum scanner berikutnya
 * setelah proses absensi selesai.
 */
const AUTO_SCAN_DELAY = 2500;


/*
 * Interval mengambil rekap
 * dari server.
 *
 * 30 detik.
 */
const SUMMARY_REFRESH_INTERVAL = 30000;


/*
 * Batas waktu API.
 *
 * Jika server tidak merespon
 * selama 15 detik,
 * request dianggap timeout.
 */
const API_TIMEOUT = 15000;


/* =====================================================
   VARIABLE SCANNER
===================================================== */

let html5QrCode = null;

let scannerRunning = false;

let processingScan = false;


/* =====================================================
   COUNTER REKAP
===================================================== */

let countPresent = 0;

let countLate = 0;

let countAlready = 0;

let countError = 0;


/* =====================================================
   VARIABLE SUMMARY
===================================================== */

let summaryRefreshTimer = null;


/*
 * Menyimpan tanggal rekap terakhir
 * yang diterima dari server.
 */
let currentSummaryDate = '';


/* =====================================================
   ELEMENT
===================================================== */

let statusElement;
let resultElement;
let scannerCard;
let studentIdElement;
let resultTitleElement;
let resultIconElement;
let resultMessageElement;

let startButton;
let scanAgainButton;

let autoScanToggle;
let autoScanLabel;


/* =====================================================
   LOAD
===================================================== */

window.addEventListener(
  'load',
  function () {

    console.log(
      '===================================='
    );

    console.log(
      'ABSENSI KARTU PELAJAR V5.2'
    );

    console.log(
      'Halaman selesai dimuat.'
    );

    console.log(
      '===================================='
    );


    /*
     * Ambil element setelah
     * DOM selesai dimuat.
     */

    statusElement =
      document.getElementById(
        'status'
      );

    resultElement =
      document.getElementById(
        'result'
      );

    scannerCard =
      document.getElementById(
        'scannerCard'
      );

    studentIdElement =
      document.getElementById(
        'studentId'
      );

    resultTitleElement =
      document.getElementById(
        'resultTitle'
      );

    resultIconElement =
      document.getElementById(
        'resultIcon'
      );

    resultMessageElement =
      document.getElementById(
        'resultMessage'
      );

    startButton =
      document.getElementById(
        'startButton'
      );

    scanAgainButton =
      document.getElementById(
        'scanAgainButton'
      );

    autoScanToggle =
      document.getElementById(
        'autoScanToggle'
      );

    autoScanLabel =
      document.getElementById(
        'autoScanLabel'
      );


    /*
     * Cek library scanner.
     */

    if (
      typeof Html5Qrcode ===
      'undefined'
    ) {

      setStatus(
        '🔴 Library scanner gagal dimuat.'
      );

      console.error(
        'Html5Qrcode tidak ditemukan.'
      );

      return;

    }


    /*
     * Jam dan tanggal.
     */

    updateDateTime();

    setInterval(
      updateDateTime,
      1000
    );


    /*
     * Status awal.
     */

    setStatus(
      '🟢 Scanner siap.'
    );


    /*
     * Persiapkan suara.
     */

    prepareSpeech();


    /*
     * ==========================================
     * LOAD REKAP HARI INI
     * ==========================================
     */

    loadTodaySummary();


    /*
     * ==========================================
     * AUTO REFRESH REKAP
     * ==========================================
     */

    summaryRefreshTimer =
      setInterval(
        function () {

          console.log(
            'Auto refresh rekap...'
          );

          loadTodaySummary();

        },
        SUMMARY_REFRESH_INTERVAL
      );


    /*
     * Setup tombol.
     */

    setupButtons();


    /*
     * Setup auto scan.
     */

    setupAutoScan();

  }
);


/* =====================================================
   SETUP BUTTON
===================================================== */

function setupButtons() {


  /* ===================================================
     TOMBOL MULAI
  =================================================== */

  if (
    startButton
  ) {

    startButton.addEventListener(
      'click',
      function () {

        console.log(
          'Tombol Mulai Scanner ditekan.'
        );


        /*
         * Aktifkan audio dari
         * interaksi pengguna.
         */

        prepareSpeech();


        speak(
          'Scanner siap'
        );


        startScanner();

      }
    );

  }


  /* ===================================================
     TOMBOL SCAN LAGI
  =================================================== */

  if (
    scanAgainButton
  ) {

    scanAgainButton.addEventListener(
      'click',
      function () {

        console.log(
          'Tombol Scan Lagi ditekan.'
        );


        prepareSpeech();


        restartScanner();

      }
    );

  }

}


/* =====================================================
   SETUP AUTO SCAN
===================================================== */

function setupAutoScan() {

  if (
    !autoScanToggle
  ) {

    return;

  }


  /*
   * Default aktif.
   */

  if (
    autoScanToggle.checked
  ) {

    if (
      autoScanLabel
    ) {

      autoScanLabel.textContent =
        'AKTIF';

      autoScanLabel.style.color =
        '#16a34a';

    }

  }

  else {

    if (
      autoScanLabel
    ) {

      autoScanLabel.textContent =
        'MATI';

      autoScanLabel.style.color =
        '#64748b';

    }

  }


  /*
   * Event perubahan.
   */

  autoScanToggle.addEventListener(
    'change',
    function () {

      if (
        autoScanToggle.checked
      ) {

        if (
          autoScanLabel
        ) {

          autoScanLabel.textContent =
            'AKTIF';

          autoScanLabel.style.color =
            '#16a34a';

        }

      }

      else {

        if (
          autoScanLabel
        ) {

          autoScanLabel.textContent =
            'MATI';

          autoScanLabel.style.color =
            '#64748b';

        }

      }

    }
  );

}


/* =====================================================
   START SCANNER
===================================================== */

function startScanner() {

  console.log(
    'Memulai scanner...'
  );


  processingScan =
    false;


  if (
    resultElement
  ) {

    resultElement.style.display =
      'none';

  }


  if (
    scannerCard
  ) {

    scannerCard.style.display =
      'block';

  }


  setStatus(
    '📷 Memeriksa kamera...'
  );


  /*
   * Cek library.
   */

  if (
    typeof Html5Qrcode ===
    'undefined'
  ) {

    setStatus(
      '🔴 Library scanner tidak tersedia.'
    );

    return;

  }


  /*
   * Jika scanner lama aktif,
   * hentikan terlebih dahulu.
   */

  if (
    html5QrCode &&
    scannerRunning
  ) {

    stopScanner()
      .finally(
        function () {

          getCameraAndStart();

        }
      );

  }

  else {

    getCameraAndStart();

  }

}


/* =====================================================
   DETEKSI KAMERA
===================================================== */

function getCameraAndStart() {

  setStatus(
    '📷 Meminta izin kamera...'
  );


  console.log(
    'Memanggil Html5Qrcode.getCameras()'
  );


  Html5Qrcode
    .getCameras()

    .then(
      function (cameras) {

        console.log(
          'Daftar kamera:',
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


        console.log(
          'Jumlah kamera:',
          cameras.length
        );


        /*
         * Default kamera pertama.
         */

        let selectedCamera =
          cameras[0];


        /*
         * Prioritas kamera belakang.
         */

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

            label.includes(
              'back'
            ) ||

            label.includes(
              'rear'
            ) ||

            label.includes(
              'environment'
            ) ||

            label.includes(
              'belakang'
            )

          ) {

            selectedCamera =
              cameras[i];

            break;

          }

        }


        console.log(
          'Kamera terpilih:',
          selectedCamera
        );


        startCamera(
          selectedCamera.id
        );

      }
    )

    .catch(
      function (error) {

        console.error(
          'GET CAMERA ERROR:',
          error
        );


        showCameraError(
          error
        );

      }
    );

}


/* =====================================================
   START CAMERA
===================================================== */

function startCamera(
  cameraId
) {

  setStatus(
    '📷 Menyalakan kamera...'
  );


  console.log(
    'Camera ID:',
    cameraId
  );


  const reader =
    document.getElementById(
      'reader'
    );


  if (!reader) {

    console.error(
      'Element #reader tidak ditemukan.'
    );


    setStatus(
      '🔴 Area scanner tidak ditemukan.'
    );


    return;

  }


  /*
   * Bersihkan reader.
   */

  reader.innerHTML =
    '';


  /*
   * Instance scanner baru.
   */

  html5QrCode =
    new Html5Qrcode(
      'reader'
    );


  /*
   * Konfigurasi.
   */

  const config = {

    fps:
      10,

    qrbox:
      function (
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

      },

    aspectRatio:
      1.0

  };


  console.log(
    'Menjalankan kamera...'
  );


  html5QrCode

    .start(

      cameraId,

      config,

      onScanSuccess,

      onScanError

    )

    .then(
      function () {

        scannerRunning =
          true;


        setStatus(
          '🟢 SIAP SCAN KARTU'
        );


        if (
          startButton
        ) {

          startButton.style.display =
            'none';

        }


        console.log(
          'KAMERA BERHASIL AKTIF.'
        );

      }
    )

    .catch(
      function (error) {

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


/* =====================================================
   QR SUCCESS
===================================================== */

function onScanSuccess(
  decodedText,
  decodedResult
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
    'QR TERBACA:',
    studentId
  );


  /*
   * Hentikan scanner sebelum
   * memproses data.
   */

  stopScanner()
    .finally(
      function () {

        showProcessing();

        processAttendance(
          studentId
        );

      }
    );

}


/* =====================================================
   SCAN ERROR
===================================================== */

function onScanError(
  errorMessage
) {

  /*
   * Error scan biasa sengaja
   * tidak ditampilkan.
   *
   * Scanner terus mencari QR.
   */

}


/* =====================================================
   PROCESSING
===================================================== */

function showProcessing() {

  if (
    scannerCard
  ) {

    scannerCard.style.display =
      'none';

  }


  if (
    resultElement
  ) {

    resultElement.style.display =
      'block';

    resultElement.className =
      'result';

  }


  if (
    resultIconElement
  ) {

    resultIconElement.textContent =
      '⏳';

  }


  if (
    resultTitleElement
  ) {

    resultTitleElement.textContent =
      'MEMPROSES ABSENSI';

  }


  if (
    resultMessageElement
  ) {

    resultMessageElement.textContent =
      'Menghubungkan ke server...';

  }


  if (
    studentIdElement
  ) {

    studentIdElement.textContent =
      'Mohon tunggu';

  }

}


/* =====================================================
   PROCESS ATTENDANCE
===================================================== */

function processAttendance(
  studentId
) {

  console.log(
    'Mengirim ID:',
    studentId
  );


  const url =
    API_URL +
    '?action=attendance' +
    '&studentId=' +
    encodeURIComponent(
      studentId
    );


  /*
   * AbortController untuk timeout.
   */

  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      function () {

        controller.abort();

      },
      API_TIMEOUT
    );


  fetch(
    url,
    {
      method:
        'GET',

      cache:
        'no-store',

      signal:
        controller.signal
    }
  )

    .then(
      function (response) {

        clearTimeout(
          timeout
        );


        console.log(
          'HTTP STATUS:',
          response.status
        );


        if (
          !response.ok
        ) {

          throw new Error(
            'HTTP ' +
            response.status
          );

        }


        return response.json();

      }
    )

    .then(
      function (result) {

        console.log(
          'HASIL ABSENSI:',
          result
        );


        handleAttendanceResult(
          result
        );

      }
    )

    .catch(
      function (error) {

        clearTimeout(
          timeout
        );


        console.error(
          'API ERROR:',
          error
        );


        countError++;

        updateCounters();


        let errorMessage =
          'Tidak dapat terhubung ke server.';


        /*
         * Khusus timeout.
         */

        if (
          error.name ===
          'AbortError'
        ) {

          errorMessage =
            'Server timeout. Silakan coba kembali.';

        }


        showAttendanceError(

          'KONEKSI GAGAL',

          errorMessage

        );


        speak(
          'Koneksi gagal'
        );


        /*
         * Jangan langsung mengambil
         * data rekap setelah error.
         *
         * Beri kesempatan scanner
         * pulih.
         */

        scheduleNextScan();

      }
    );

}


/* =====================================================
   HANDLE RESULT
===================================================== */

function handleAttendanceResult(
  result
) {

  if (
    !result
  ) {

    countError++;

    updateCounters();


    showAttendanceError(

      'RESPON SERVER KOSONG',

      'Server tidak mengirim data.'

    );


    speak(
      'Server tidak merespon'
    );


    scheduleNextScan();


    return;

  }


  console.log(
    'STATUS SERVER:',
    result.status
  );


  /* ===================================================
     SUCCESS
  =================================================== */

  if (
    result.status ===
    'SUCCESS'
  ) {

    handleSuccess(
      result
    );

    return;

  }


  /* ===================================================
     ALREADY
  =================================================== */

  if (
    result.status ===
    'ALREADY'
  ) {

    handleAlready(
      result
    );

    return;

  }


  /* ===================================================
     NOT FOUND
  =================================================== */

  if (
    result.status ===
    'NOT_FOUND'
  ) {

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


    return;

  }


  /* ===================================================
     INACTIVE
  =================================================== */

  if (
    result.status ===
    'INACTIVE'
  ) {

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


    return;

  }


  /* ===================================================
     ERROR
  =================================================== */

  countError++;

  updateCounters();


  showAttendanceError(

    'ABSENSI GAGAL',

    result.message ||
      'Terjadi kesalahan.'

  );


  speak(
    'Absensi gagal'
  );


  scheduleNextScan();

}


/* =====================================================
   SUCCESS
===================================================== */

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
    ).toLowerCase();


  /*
   * ==========================================
   * COUNTER
   * ==========================================
   */

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


  /*
   * ==========================================
   * TAMPILKAN HASIL
   * ==========================================
   */

  if (
    scannerCard
  ) {

    scannerCard.style.display =
      'none';

  }


  if (
    resultElement
  ) {

    resultElement.style.display =
      'block';

  }


  /*
   * ==========================================
   * TERLAMBAT
   * ==========================================
   */

  if (
    status.includes(
      'terlambat'
    )
  ) {

    resultElement.className =
      'result late';


    resultIconElement.textContent =
      '🟡';


    resultTitleElement.textContent =
      'TERLAMBAT';


    resultMessageElement.textContent =
      'Absensi berhasil dicatat.';


    speak(
      'Terlambat'
    );

  }


  /*
   * ==========================================
   * HADIR
   * ==========================================
   */

  else {

    resultElement.className =
      'result success';


    resultIconElement.textContent =
      '🟢';


    resultTitleElement.textContent =
      'ABSENSI BERHASIL';


    resultMessageElement.textContent =
      'Kehadiran berhasil dicatat.';


    speak(
      'Absensi berhasil'
    );

  }


  /*
   * ==========================================
   * DATA SISWA
   * ==========================================
   */

  studentIdElement.innerHTML =

    '<strong>' +

    escapeHtml(
      student.nama
    ) +

    '</strong>' +

    '<br>' +

    '<span>' +

    escapeHtml(
      student.kelas
    ) +

    '</span>' +

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


  /*
   * ==========================================
   * REFRESH REKAP DARI SERVER
   * ==========================================
   *
   * Penting:
   * angka dashboard diambil lagi
   * dari Google Sheet.
   */

  setTimeout(
    function () {

      loadTodaySummary();

    },
    500
  );


  /*
   * ==========================================
   * SCAN BERIKUTNYA
   * ==========================================
   */

  scheduleNextScan();

}


/* =====================================================
   ALREADY
===================================================== */

function handleAlready(
  result
) {

  const student =
    result.student || {};


  const previous =
    result.previousAttendance || {};


  /*
   * Counter sudah absen.
   */

  countAlready++;

  updateCounters();


  /*
   * Tampilan.
   */

  if (
    scannerCard
  ) {

    scannerCard.style.display =
      'none';

  }


  if (
    resultElement
  ) {

    resultElement.style.display =
      'block';

  }


  resultElement.className =
    'result already';


  resultIconElement.textContent =
    '🟠';


  resultTitleElement.textContent =
    'SUDAH ABSEN';


  resultMessageElement.textContent =
    'Siswa sudah melakukan absensi hari ini.';


  studentIdElement.innerHTML =

    '<strong>' +

    escapeHtml(
      student.nama
    ) +

    '</strong>' +

    '<br>' +

    '<span>' +

    escapeHtml(
      student.kelas
    ) +

    '</span>' +

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


  speak(
    'Siswa sudah absen'
  );


  /*
   * Refresh rekap.
   */

  setTimeout(
    function () {

      loadTodaySummary();

    },
    500
  );


  scheduleNextScan();

}


/* =====================================================
   ERROR ABSENSI
===================================================== */

function showAttendanceError(
  title,
  message
) {

  if (
    scannerCard
  ) {

    scannerCard.style.display =
      'none';

  }


  if (
    resultElement
  ) {

    resultElement.style.display =
      'block';

    resultElement.className =
      'result error';

  }


  if (
    resultIconElement
  ) {

    resultIconElement.textContent =
      '🔴';

  }


  if (
    resultTitleElement
  ) {

    resultTitleElement.textContent =
      title;

  }


  if (
    resultMessageElement
  ) {

    resultMessageElement.textContent =
      '';

  }


  if (
    studentIdElement
  ) {

    studentIdElement.textContent =
      message ||
      'Terjadi kesalahan.';

  }

}


/* =====================================================
   NEXT SCAN
===================================================== */

function scheduleNextScan() {

  /*
   * Jika Auto Scan mati,
   * jangan otomatis restart.
   */

  if (
    !autoScanToggle ||
    !autoScanToggle.checked
  ) {

    return;

  }


  setTimeout(
    function () {

      restartScanner();

    },
    AUTO_SCAN_DELAY
  );

}


/* =====================================================
   RESTART
===================================================== */

function restartScanner() {

  console.log(
    'Restart scanner...'
  );


  processingScan =
    false;


  if (
    resultElement
  ) {

    resultElement.style.display =
      'none';

  }


  if (
    scannerCard
  ) {

    scannerCard.style.display =
      'block';

  }


  setStatus(
    '📷 Menyiapkan kamera berikutnya...'
  );


  if (
    html5QrCode &&
    scannerRunning
  ) {

    stopScanner()
      .finally(
        function () {

          getCameraAndStart();

        }
      );

  }

  else {

    getCameraAndStart();

  }

}


/* =====================================================
   STOP SCANNER
===================================================== */

function stopScanner() {

  return new Promise(
    function (resolve) {

      if (
        !html5QrCode ||
        !scannerRunning
      ) {

        scannerRunning =
          false;

        resolve();

        return;

      }


      console.log(
        'Menghentikan kamera...'
      );


      html5QrCode

        .stop()

        .then(
          function () {

            scannerRunning =
              false;

            resolve();

          }
        )

        .catch(
          function (error) {

            console.error(
              'STOP ERROR:',
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


/* =====================================================
   REKAP ABSENSI HARI INI
===================================================== */

/**
 * Mengambil rekap dari Code.gs
 *
 * API:
 *
 * ?action=summary
 *
 */

function loadTodaySummary() {

  console.log(
    '===================================='
  );

  console.log(
    'Memuat rekap absensi hari ini...'
  );


  const url =
    API_URL +
    '?action=summary' +
    '&t=' +
    Date.now();


  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      function () {

        controller.abort();

      },
      API_TIMEOUT
    );


  fetch(
    url,
    {
      method:
        'GET',

      cache:
        'no-store',

      signal:
        controller.signal
    }
  )

    .then(
      function (response) {

        clearTimeout(
          timeout
        );


        console.log(
          'SUMMARY HTTP STATUS:',
          response.status
        );


        if (
          !response.ok
        ) {

          throw new Error(
            'HTTP ' +
            response.status
          );

        }


        return response.json();

      }
    )

    .then(
      function (result) {

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
              : 'Rekap tidak valid.'
          );

        }


        updateSummaryFromServer(
          result
        );

      }
    )

    .catch(
      function (error) {

        clearTimeout(
          timeout
        );


        console.error(
          'SUMMARY ERROR:',
          error
        );


        /*
         * Jangan menghapus angka
         * yang sudah tampil.
         *
         * Jika server gagal,
         * angka terakhir tetap terlihat.
         */

        setStatus(
          '🟡 Rekap sementara. Server belum merespon.'
        );

      }
    );

}


/* =====================================================
   UPDATE REKAP DARI SERVER
===================================================== */

function updateSummaryFromServer(
  summary
) {

  /*
   * Ambil nilai dari server.
   */

  countPresent =
    Number(
      summary.hadir || 0
    );


  countLate =
    Number(
      summary.terlambat || 0
    );


  countAlready =
    Number(
      summary.sudahAbsen || 0
    );


  countError =
    Number(
      summary.error || 0
    );


  /*
   * Simpan tanggal.
   */

  currentSummaryDate =
    String(
      summary.tanggal || ''
    );


  /*
   * Update dashboard.
   */

  updateCounters();


  console.log(
    'REKAP DIPERBARUI:',
    {
      total:
        summary.total,

      hadir:
        countPresent,

      terlambat:
        countLate,

      sudahAbsen:
        countAlready,

      error:
        countError,

      tanggal:
        currentSummaryDate
    }
  );


  /*
   * Status normal.
   */

  setStatus(
    '🟢 Scanner siap.'
  );

}


/* =====================================================
   UPDATE COUNTERS
===================================================== */

function updateCounters() {

  /*
   * ==========================================
   * HADIR
   * ==========================================
   */

  const presentElement =
    document.getElementById(
      'countPresent'
    );


  if (
    presentElement
  ) {

    presentElement.textContent =
      countPresent;

  }


  /*
   * ==========================================
   * TERLAMBAT
   * ==========================================
   */

  const lateElement =
    document.getElementById(
      'countLate'
    );


  if (
    lateElement
  ) {

    lateElement.textContent =
      countLate;

  }


  /*
   * ==========================================
   * SUDAH ABSEN
   * ==========================================
   */

  const alreadyElement =
    document.getElementById(
      'countAlready'
    );


  if (
    alreadyElement
  ) {

    alreadyElement.textContent =
      countAlready;

  }


  /*
   * ==========================================
   * ERROR
   * ==========================================
   */

  const errorElement =
    document.getElementById(
      'countError'
    );


  if (
    errorElement
  ) {

    errorElement.textContent =
      countError;

  }


  /*
   * ==========================================
   * TOTAL ABSEN
   * ==========================================
   *
   * Total = Hadir + Terlambat
   *
   * Karena keduanya merupakan
   * absensi yang berhasil.
   */

  const totalElement =
    document.getElementById(
      'countTotal'
    );


  if (
    totalElement
  ) {

    totalElement.textContent =
      countPresent +
      countLate;

  }

}


/* =====================================================
   UPDATE DATE TIME
===================================================== */

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


  const currentDate =
    document.getElementById(
      'currentDate'
    );


  if (
    currentDate
  ) {

    currentDate.textContent =
      date;

  }


  const currentTime =
    document.getElementById(
      'currentTime'
    );


  if (
    currentTime
  ) {

    currentTime.textContent =
      time;

  }

}


/* =====================================================
   SPEECH PREPARE
===================================================== */

function prepareSpeech() {

  if (
    !(
      'speechSynthesis'
      in window
    )
  ) {

    console.warn(
      'Speech Synthesis tidak tersedia.'
    );

    return;

  }


  window.speechSynthesis.cancel();

}


/* =====================================================
   SPEAK
===================================================== */

function speak(
  text
) {

  if (
    !(
      'speechSynthesis'
      in window
    )
  ) {

    console.warn(
      'Browser tidak mendukung suara.'
    );

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


    console.log(
      'VOICE:',
      text
    );

  }

  catch (error) {

    console.error(
      'VOICE ERROR:',
      error
    );

  }

}


/* =====================================================
   STATUS
===================================================== */

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


/* =====================================================
   CAMERA ERROR
===================================================== */

function showCameraError(
  error
) {

  console.error(
    '===================================='
  );

  console.error(
    'CAMERA ERROR'
  );

  console.error(
    error
  );

  console.error(
    '===================================='
  );


  let message =
    'Kamera gagal diakses.';


  if (
    error
  ) {

    if (
      error.name
    ) {

      message +=
        ' [' +
        error.name +
        ']';

    }


    if (
      error.message
    ) {

      message +=
        ' ' +
        error.message;

    }

  }


  setStatus(
    '🔴 ' +
    message
  );


  if (
    startButton
  ) {

    startButton.style.display =
      'block';

  }

}


/* =====================================================
   ESCAPE HTML
===================================================== */

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
