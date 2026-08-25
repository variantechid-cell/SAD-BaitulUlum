/* =====================================================
   SISTEM ABSENSI KARTU PELAJAR
   SMP BAITUL ULUM BOARDING SCHOOL

   APP.JS V6.0

   FITUR:
   - Scanner QR
   - Kamera HP / Laptop
   - Validasi siswa
   - Absensi Google Sheet
   - Hadir
   - Terlambat
   - Sudah Absen
   - Data Tidak Ditemukan
   - Siswa Tidak Aktif
   - Error Server
   - Auto Scan
   - Rekap Absensi Hari Ini
   - Rekap tetap muncul setelah refresh
===================================================== */


/* =====================================================
   API
===================================================== */

const API_URL =
  'https://script.google.com/macros/s/AKfycbybMMhzrTv3Uqv3vMAdJTA5Co4FiTh_jZ4ocD5iNdHb2mZBX2S_BJJBrgFCgJIcqb21/exec';


/* =====================================================
   KONFIGURASI
===================================================== */

const AUTO_SCAN_DELAY = 2500;

const SUMMARY_REFRESH_DELAY = 1500;


/* =====================================================
   SCANNER VARIABLE
===================================================== */

let html5QrCode = null;

let scannerRunning = false;

let processingScan = false;


/* =====================================================
   COUNTER
===================================================== */

let countPresent = 0;

let countLate = 0;

let countAlready = 0;

let countError = 0;


/* =====================================================
   ELEMENT
===================================================== */

const statusElement =
  document.getElementById('status');

const resultElement =
  document.getElementById('result');

const scannerCard =
  document.getElementById('scannerCard');

const studentIdElement =
  document.getElementById('studentId');

const resultTitleElement =
  document.getElementById('resultTitle');

const resultIconElement =
  document.getElementById('resultIcon');

const resultMessageElement =
  document.getElementById('resultMessage');

const startButton =
  document.getElementById('startButton');

const scanAgainButton =
  document.getElementById('scanAgainButton');

const autoScanToggle =
  document.getElementById('autoScanToggle');

const autoScanLabel =
  document.getElementById('autoScanLabel');


/* =====================================================
   LOAD HALAMAN
===================================================== */

window.addEventListener(
  'load',
  function () {

    console.log(
      '===================================='
    );

    console.log(
      'SISTEM ABSENSI KARTU PELAJAR V6.0'
    );

    console.log(
      'Halaman selesai dimuat.'
    );

    console.log(
      '===================================='
    );


    /* ---------------------------------
       CEK LIBRARY QR
    --------------------------------- */

    if (
      typeof Html5Qrcode === 'undefined'
    ) {

      setStatus(
        '🔴 Library scanner gagal dimuat.'
      );

      console.error(
        'Html5Qrcode tidak ditemukan.'
      );

      return;

    }


    /* ---------------------------------
       JAM DAN TANGGAL
    --------------------------------- */

    updateDateTime();

    setInterval(
      updateDateTime,
      1000
    );


    /* ---------------------------------
       STATUS
    --------------------------------- */

    setStatus(
      '🟢 Scanner siap.'
    );


    /* ---------------------------------
       AUDIO
    --------------------------------- */

    prepareSpeech();


    /* ---------------------------------
       LOAD REKAP HARI INI
    --------------------------------- */

    loadTodaySummary();

  }
);


/* =====================================================
   TOMBOL MULAI SCANNER
===================================================== */

if (startButton) {

  startButton.addEventListener(
    'click',
    function () {

      console.log(
        'Tombol Mulai Scanner ditekan.'
      );


      prepareSpeech();

      speak(
        'Scanner siap'
      );


      startScanner();

    }
  );

}


/* =====================================================
   TOMBOL SCAN LAGI
===================================================== */

if (scanAgainButton) {

  scanAgainButton.addEventListener(
    'click',
    function () {

      console.log(
        'Tombol Scan Lagi ditekan.'
      );


      restartScanner();

    }
  );

}


/* =====================================================
   AUTO SCAN
===================================================== */

if (autoScanToggle) {

  autoScanToggle.addEventListener(
    'change',
    function () {

      if (
        autoScanToggle.checked
      ) {

        if (autoScanLabel) {

          autoScanLabel.textContent =
            'AKTIF';

          autoScanLabel.style.color =
            '#16a34a';

        }

      } else {

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


/* =====================================================
   START SCANNER
===================================================== */

function startScanner() {

  console.log(
    'Memulai scanner...'
  );


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
    typeof Html5Qrcode === 'undefined'
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
        function () {

          getCameraAndStart();

        }
      );

  } else {

    getCameraAndStart();

  }

}


/* =====================================================
   MENCARI KAMERA
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


        let selectedCamera =
          cameras[0];


        for (
          let i = 0;
          i < cameras.length;
          i++
        ) {

          const label =
            String(
              cameras[i].label || ''
            ).toLowerCase();


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
   MENJALANKAN KAMERA
===================================================== */

function startCamera(
  cameraId
) {

  setStatus(
    '📷 Menyalakan kamera...'
  );


  const reader =
    document.getElementById(
      'reader'
    );


  if (!reader) {

    setStatus(
      '🔴 Area scanner tidak ditemukan.'
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


        if (startButton) {

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
   QR BERHASIL DIBACA
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
      decodedText
    ).trim();


  console.log(
    'QR TERBACA:',
    studentId
  );


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
   ERROR SCAN BIASA
===================================================== */

function onScanError(
  errorMessage
) {

  /*
   * Sengaja dikosongkan.
   *
   * Error seperti QR belum terbaca
   * bukan merupakan error sistem.
   */

}


/* =====================================================
   TAMPILAN PROCESSING
===================================================== */

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
      'Mohon tunggu';

  }

}


/* =====================================================
   PROSES ABSENSI
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


  fetch(url)

    .then(
      function (response) {

        console.log(
          'HTTP STATUS:',
          response.status
        );


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

        console.error(
          'API ERROR:',
          error
        );


        countError++;

        updateCounters();


        showAttendanceError(

          'KONEKSI GAGAL',

          'Tidak dapat terhubung ke server.'

        );


        speak(
          'Koneksi gagal'
        );


        scheduleNextScan();

      }
    );

}


/* =====================================================
   HASIL ABSENSI
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

      'ERROR SERVER',

      'Server tidak mengirim data.'

    );


    speak(
      'Server tidak merespon'
    );


    scheduleNextScan();

    return;

  }


  /* ---------------------------------
     BERHASIL
  --------------------------------- */

  if (
    result.status ===
    'SUCCESS'
  ) {

    handleSuccess(
      result
    );

    return;

  }


  /* ---------------------------------
     SUDAH ABSEN
  --------------------------------- */

  if (
    result.status ===
    'ALREADY'
  ) {

    handleAlready(
      result
    );

    return;

  }


  /* ---------------------------------
     TIDAK DITEMUKAN
  --------------------------------- */

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


  /* ---------------------------------
     TIDAK AKTIF
  --------------------------------- */

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


  /* ---------------------------------
     ERROR LAIN
  --------------------------------- */

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
   ABSENSI BERHASIL
===================================================== */

function handleSuccess(
  result
) {

  const student =
    result.student;


  const attendance =
    result.attendance;


  const status =
    String(
      attendance.status || ''
    ).toLowerCase();


  if (
    status.includes(
      'terlambat'
    )
  ) {

    countLate++;

  } else {

    countPresent++;

  }


  updateCounters();


  if (scannerCard) {

    scannerCard.style.display =
      'none';

  }


  if (resultElement) {

    resultElement.style.display =
      'block';

  }


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

  } else {

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
   * Sinkronisasi dengan Google Sheet.
   *
   * Ini penting agar dashboard tidak hanya
   * mengandalkan counter lokal.
   */

  setTimeout(
    function () {

      loadTodaySummary();

    },
    SUMMARY_REFRESH_DELAY
  );


  refreshAttendanceList();
  
  scheduleNextScan();

}


/* =====================================================
   SUDAH ABSEN
===================================================== */

function handleAlready(
  result
) {

  const student =
    result.student;


  const previous =
    result.previousAttendance;


  countAlready++;

  updateCounters();


  if (scannerCard) {

    scannerCard.style.display =
      'none';

  }


  if (resultElement) {

    resultElement.style.display =
      'block';

    resultElement.className =
      'result already';

  }


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
   * Ambil ulang rekap server.
   */

  loadTodaySummary();

  refreshAttendanceList();

  scheduleNextScan();
  

}


/* =====================================================
   ERROR ABSENSI
===================================================== */

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


  resultIconElement.textContent =
    '🔴';


  resultTitleElement.textContent =
    title;


  resultMessageElement.textContent =
    '';


  studentIdElement.textContent =
    message ||
    'Terjadi kesalahan.';

}


/* =====================================================
   AUTO SCAN BERIKUTNYA
===================================================== */

function scheduleNextScan() {

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
   RESTART SCANNER
===================================================== */

function restartScanner() {

  console.log(
    'Restart scanner...'
  );


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

  } else {

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
   UPDATE COUNTER TAMPILAN
===================================================== */

function updateCounters() {

  /*
   * TOTAL = HADIR + TERLAMBAT
   */

  const total =
    countPresent +
    countLate;


  const totalElement =
    document.getElementById(
      'countTotal'
    );


  const presentElement =
    document.getElementById(
      'countPresent'
    );


  const lateElement =
    document.getElementById(
      'countLate'
    );


  const alreadyElement =
    document.getElementById(
      'countAlready'
    );


  const errorElement =
    document.getElementById(
      'countError'
    );


  if (totalElement) {

    totalElement.textContent =
      total;

  }


  if (presentElement) {

    presentElement.textContent =
      countPresent;

  }


  if (lateElement) {

    lateElement.textContent =
      countLate;

  }


  if (alreadyElement) {

    alreadyElement.textContent =
      countAlready;

  }


  if (errorElement) {

    errorElement.textContent =
      countError;

  }

}


/* =====================================================
   LOAD REKAP ABSENSI HARI INI
===================================================== */

function loadTodaySummary() {

  console.log(
    'Memuat rekap absensi hari ini...'
  );


  const url =
    API_URL +
    '?action=summary' +
    '&_=' +
    Date.now();


  fetch(url)

    .then(
      function (response) {

        console.log(
          'SUMMARY HTTP STATUS:',
          response.status
        );


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
      function (result) {

        console.log(
          'SUMMARY RESULT:',
          result
        );


        if (
          !result ||
          result.success !== true
        ) {

          throw new Error(
            result.message ||
            'Data rekap tidak valid.'
          );

        }


        /*
         * ======================================
         * AMBIL DATA DARI SERVER
         * ======================================
         */

        countPresent =
          Number(
            result.hadir || 0
          );


        countLate =
          Number(
            result.terlambat || 0
          );


        countAlready =
          Number(
            result.sudahAbsen || 0
          );


        countError =
          Number(
            result.error || 0
          );


        /*
         * ======================================
         * UPDATE TAMPILAN
         * ======================================
         */

        updateCounters();


        console.log(
          'REKAP HARI INI:',
          {
            total:
              result.total,

            hadir:
              countPresent,

            terlambat:
              countLate,

            sudahAbsen:
              countAlready,

            error:
              countError,

            tanggal:
              result.tanggal

          }
        );

      }
    )

    .catch(
      function (error) {

        console.error(
          'SUMMARY ERROR:',
          error
        );

        /*
         * Jangan mengosongkan counter
         * jika server gagal merespons.
         */

      }
    );

}


/* =====================================================
   UPDATE TANGGAL DAN JAM
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


  const currentTime =
    document.getElementById(
      'currentTime'
    );


  if (currentDate) {

    currentDate.textContent =
      date;

  }


  if (currentTime) {

    currentTime.textContent =
      time;

  }

}


/* =====================================================
   PERSIAPAN AUDIO
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
   SUARA
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
    '=== CAMERA ERROR ==='
  );


  console.error(
    error
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


  if (startButton) {

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

/* =====================================================
   V5.2 - DAFTAR ABSENSI HARI INI
   -----------------------------------------------------
   FUNGSI:
   - Mengambil data absensi hari ini
   - Menampilkan urutan absensi
   - 🥇 siswa pertama
   - 🥈 siswa kedua
   - 🥉 siswa ketiga
   - Nomor biasa untuk siswa berikutnya
   - Data tetap muncul setelah refresh
   - Refresh otomatis setelah scan
===================================================== */


/* =====================================================
   ELEMENT DAFTAR ABSENSI
===================================================== */

const attendanceListElement =
  document.getElementById(
    'attendanceList'
  );


const attendanceListEmptyElement =
  document.getElementById(
    'attendanceListEmpty'
  );


const attendanceListLoadingElement =
  document.getElementById(
    'attendanceListLoading'
  );


/* =====================================================
   LOAD DAFTAR ABSENSI SAAT HALAMAN DIBUKA
===================================================== */

window.addEventListener(
  'load',
  function () {

    console.log(
      'V5.2 - Memuat daftar absensi hari ini...'
    );

    loadTodayAttendanceList();

  }
);


/* =====================================================
   LOAD DATA ABSENSI
===================================================== */

function loadTodayAttendanceList() {

  console.log(
    'Mengambil data absensi hari ini...'
  );


  showAttendanceListLoading();


  google.script.run

    .withSuccessHandler(
      function (result) {

        console.log(
          'DAFTAR ABSENSI:',
          result
        );


        handleTodayAttendanceList(
          result
        );

      }
    )

    .withFailureHandler(
      function (error) {

        console.error(
          'GAGAL MEMUAT DAFTAR ABSENSI:',
          error
        );


        hideAttendanceListLoading();

        showAttendanceListError(
          error
        );

      }
    )

    .getTodayAttendanceList();

}


/* =====================================================
   HANDLE DATA
===================================================== */

function handleTodayAttendanceList(
  result
) {

  hideAttendanceListLoading();


  if (
    !result ||
    result.success !== true
  ) {

    console.error(
      'Response daftar absensi tidak valid:',
      result
    );


    showAttendanceListError();

    return;

  }


  const data =
    Array.isArray(
      result.data
    )
      ? result.data
      : [];


  console.log(
    'Jumlah absensi hari ini:',
    data.length
  );


  /*
   * Jika belum ada siswa
   */

  if (
    data.length === 0
  ) {

    showAttendanceListEmpty();

    return;

  }


  /*
   * Tampilkan data
   */

  renderAttendanceList(
    data
  );

}


/* =====================================================
   RENDER DAFTAR ABSENSI
===================================================== */

function renderAttendanceList(
  data
) {

  if (
    !attendanceListElement
  ) {

    console.warn(
      'Element #attendanceList tidak ditemukan.'
    );

    return;

  }


  /*
   * Bersihkan isi lama
   */

  attendanceListElement.innerHTML =
    '';


  /*
   * Buat setiap baris/card
   */

  data.forEach(
    function (
      item,
      index
    ) {

      /*
       * Jika backend belum
       * memberikan nomor,
       * gunakan index + 1.
       */

      const nomor =
        Number(
          item.nomor
        ) ||
        index + 1;


      /*
       * Tentukan badge urutan
       */

      const rank =
        getAttendanceRank(
          nomor
        );


      /*
       * Status
       */

      const status =
        String(
          item.status || ''
        ).trim();


      const statusLower =
        status.toLowerCase();


      let statusClass =
        'status-hadir';


      let statusIcon =
        '🟢';


      if (
        statusLower.includes(
          'terlambat'
        )
      ) {

        statusClass =
          'status-terlambat';

        statusIcon =
          '🟡';

      }


      /*
       * Buat element
       */

      const itemElement =
        document.createElement(
          'div'
        );


      itemElement.className =
        'attendance-item';


      /*
       * Data aman dari XSS
       */

      const nama =
        escapeHtml(
          item.nama || '-'
        );


      const kelas =
        escapeHtml(
          item.kelas || '-'
        );


      const jam =
        escapeHtml(
          item.jam || '-'
        );


      const statusSafe =
        escapeHtml(
          status || '-'
        );


      /*
       * Isi card
       */

      itemElement.innerHTML =

        '<div class="attendance-rank">' +

          rank +

        '</div>' +


        '<div class="attendance-info">' +

          '<div class="attendance-name">' +

            nama +

          '</div>' +

          '<div class="attendance-class">' +

            'Kelas ' +

            kelas +

          '</div>' +

        '</div>' +


        '<div class="attendance-time">' +

          jam +

        '</div>' +


        '<div class="attendance-status ' +

          statusClass +

        '">' +

          statusIcon +

          ' ' +

          statusSafe +

        '</div>';


      /*
       * Masukkan ke daftar
       */

      attendanceListElement.appendChild(
        itemElement
      );

    }
  );


  /*
   * Pastikan daftar terlihat
   */

  attendanceListElement.style.display =
    'block';


  if (
    attendanceListEmptyElement
  ) {

    attendanceListEmptyElement.style.display =
      'none';

  }

}


/* =====================================================
   RANK / URUTAN
===================================================== */

function getAttendanceRank(
  nomor
) {

  if (
    nomor === 1
  ) {

    return '🥇';

  }


  if (
    nomor === 2
  ) {

    return '🥈';

  }


  if (
    nomor === 3
  ) {

    return '🥉';

  }


  return String(
    nomor
  );

}


/* =====================================================
   LOADING
===================================================== */

function showAttendanceListLoading() {

  if (
    attendanceListLoadingElement
  ) {

    attendanceListLoadingElement.style.display =
      'block';

  }


  if (
    attendanceListEmptyElement
  ) {

    attendanceListEmptyElement.style.display =
      'none';

  }

}


/* =====================================================
   HIDE LOADING
===================================================== */

function hideAttendanceListLoading() {

  if (
    attendanceListLoadingElement
  ) {

    attendanceListLoadingElement.style.display =
      'none';

  }

}


/* =====================================================
   DATA KOSONG
===================================================== */

function showAttendanceListEmpty() {

  if (
    attendanceListElement
  ) {

    attendanceListElement.innerHTML =
      '';

    attendanceListElement.style.display =
      'none';

  }


  if (
    attendanceListEmptyElement
  ) {

    attendanceListEmptyElement.style.display =
      'block';

    attendanceListEmptyElement.textContent =
      'Belum ada siswa yang melakukan absensi hari ini.';

  }

}


/* =====================================================
   ERROR
===================================================== */

function showAttendanceListError(
  error
) {

  if (
    attendanceListElement
  ) {

    attendanceListElement.innerHTML =
      '';

    attendanceListElement.style.display =
      'none';

  }


  if (
    attendanceListEmptyElement
  ) {

    attendanceListEmptyElement.style.display =
      'block';


    attendanceListEmptyElement.textContent =
      '⚠️ Daftar absensi tidak dapat dimuat.';

  }

}


/* =====================================================
   REFRESH SETELAH ABSENSI
===================================================== */

function refreshAttendanceList() {

  console.log(
    'Memperbarui daftar absensi...'
  );


  loadTodayAttendanceList();

}
