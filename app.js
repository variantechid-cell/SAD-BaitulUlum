/* =====================================================
   SISTEM ABSENSI KARTU PELAJAR
   SCANNER V4.1
   Android + Laptop
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


/* =====================================================
   VARIABLE
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
   LOAD
===================================================== */

window.addEventListener('load', function () {

  console.log(
    '=== ABSENSI V4.1 ==='
  );

  console.log(
    'Halaman selesai dimuat.'
  );


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


  updateDateTime();

  setInterval(
    updateDateTime,
    1000
  );


  setStatus(
    '🟢 Scanner siap.'
  );

   loadTodaySummary();

  /*
   * Persiapkan audio dari interaksi
   * pengguna.
   */

  prepareSpeech();

});


/* =====================================================
   TOMBOL MULAI
===================================================== */

if (startButton) {

  startButton.addEventListener(
    'click',
    function () {

      console.log(
        'Tombol Mulai Scanner ditekan.'
      );


      /*
       * Aktifkan audio dari interaksi
       * pengguna.
       */

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

        autoScanLabel.textContent =
          'AKTIF';

        autoScanLabel.style.color =
          '#16a34a';

      } else {

        autoScanLabel.textContent =
          'MATI';

        autoScanLabel.style.color =
          '#64748b';

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


  resultElement.style.display =
    'none';


  scannerCard.style.display =
    'block';


  setStatus(
    '📷 Memeriksa kamera...'
  );


  /*
   * Pastikan library tersedia
   */

  if (
    typeof Html5Qrcode === 'undefined'
  ) {

    setStatus(
      '🔴 Library scanner tidak tersedia.'
    );

    return;

  }


  /*
   * Jika scanner lama masih aktif
   */

  if (
    html5QrCode &&
    scannerRunning
  ) {

    console.log(
      'Scanner lama masih aktif.'
    );


    stopScanner()
      .then(function () {

        getCameraAndStart();

      })
      .catch(function () {

        getCameraAndStart();

      });


  } else {

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

    .then(function (cameras) {

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


      /*
       * Tampilkan jumlah kamera
       */

      console.log(
        'Jumlah kamera:',
        cameras.length
      );


      /*
       * Pilih kamera
       */

      let selectedCamera =
        cameras[0];


      /*
       * Prioritaskan kamera belakang
       */

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

    })

    .catch(function (error) {

      console.error(
        'GET CAMERA ERROR:',
        error
      );


      showCameraError(
        error
      );

    });

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


  /*
   * Bersihkan reader
   */

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


  reader.innerHTML =
    '';


  /*
   * Buat instance baru
   */

  html5QrCode =
    new Html5Qrcode(
      'reader'
    );


  /*
   * Konfigurasi
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

    .then(function () {

      scannerRunning =
        true;


      setStatus(
        '🟢 SIAP SCAN KARTU'
      );


      startButton.style.display =
        'none';


      console.log(
        'KAMERA BERHASIL AKTIF.'
      );

    })

    .catch(function (error) {

      scannerRunning =
        false;


      console.error(
        'START CAMERA ERROR:',
        error
      );


      showCameraError(
        error
      );

    });

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
      decodedText
    ).trim();


  console.log(
    'QR TERBACA:',
    studentId
  );


  stopScanner()
    .finally(function () {

      showProcessing();

      processAttendance(
        studentId
      );

    });

}


/* =====================================================
   SCAN ERROR
===================================================== */

function onScanError(
  errorMessage
) {

  /*
   * Jangan tampilkan error scan biasa.
   */

}


/* =====================================================
   PROCESSING
===================================================== */

function showProcessing() {

  scannerCard.style.display =
    'none';


  resultElement.style.display =
    'block';


  resultElement.className =
    'result';


  resultIconElement.textContent =
    '⏳';


  resultTitleElement.textContent =
    'MEMPROSES ABSENSI';


  resultMessageElement.textContent =
    'Menghubungkan ke server...';


  studentIdElement.textContent =
    'Mohon tunggu';

}


/* =====================================================
   API
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

    .then(function (response) {

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

    })

    .then(function (result) {

      console.log(
        'HASIL ABSENSI:',
        result
      );


      handleAttendanceResult(
        result
      );

    })

    .catch(function (error) {

      console.error(
        'API ERROR:',
        error
      );


      countError++;

      updateCounters();
      loadTodaySummary();


      showAttendanceError(

        'KONEKSI GAGAL',

        'Tidak dapat terhubung ke server.'

      );


      speak(
        'Koneksi gagal'
      );


      scheduleNextScan();

    });

}


/* =====================================================
   RESULT
===================================================== */

function handleAttendanceResult(
  result
) {

  if (
    result.status ===
    'SUCCESS'
  ) {

    handleSuccess(
      result
    );

    return;

  }


  if (
    result.status ===
    'ALREADY'
  ) {

    handleAlready(
      result
    );

    return;

  }


  if (
    result.status ===
    'NOT_FOUND'
  ) {

    countError++;

    updateCounters();


    showAttendanceError(

      'DATA TIDAK DITEMUKAN',

      result.message

    );


    speak(
      'Kartu tidak terdaftar'
    );


    scheduleNextScan();

    return;

  }


  if (
    result.status ===
    'INACTIVE'
  ) {

    countError++;

    updateCounters();


    showAttendanceError(

      'SISWA TIDAK AKTIF',

      result.message

    );


    speak(
      'Siswa tidak aktif'
    );


    scheduleNextScan();

    return;

  }


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


  scannerCard.style.display =
    'none';


  resultElement.style.display =
    'block';


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


  scheduleNextScan();

}


/* =====================================================
   ALREADY
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


  scannerCard.style.display =
    'none';


  resultElement.style.display =
    'block';


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


  scheduleNextScan();

}


/* =====================================================
   ERROR
===================================================== */

function showAttendanceError(
  title,
  message
) {

  scannerCard.style.display =
    'none';


  resultElement.style.display =
    'block';


  resultElement.className =
    'result error';


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
   NEXT SCAN
===================================================== */

function scheduleNextScan() {

  if (
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


  resultElement.style.display =
    'none';


  scannerCard.style.display =
    'block';


  setStatus(
    '📷 Menyiapkan kamera berikutnya...'
  );


  if (
    html5QrCode &&
    scannerRunning
  ) {

    stopScanner()
      .finally(function () {

        getCameraAndStart();

      });

  } else {

    getCameraAndStart();

  }

}


/* =====================================================
   STOP
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

        .then(function () {

          scannerRunning =
            false;

          resolve();

        })

        .catch(function (error) {

          console.error(
            'STOP ERROR:',
            error
          );

          scannerRunning =
            false;

          resolve();

        });

    }
  );

}


/* =====================================================
   COUNTER
===================================================== */

function updateCounters() {

  document.getElementById(
    'countPresent'
  ).textContent =
    countPresent;


  document.getElementById(
    'countLate'
  ).textContent =
    countLate;


  document.getElementById(
    'countAlready'
  ).textContent =
    countAlready;


  document.getElementById(
    'countError'
  ).textContent =
    countError;

}


/* =====================================================
   DATE
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


  document.getElementById(
    'currentDate'
  ).textContent =
    date;


  document.getElementById(
    'currentTime'
  ).textContent =
    time;

}


/* =====================================================
   SPEECH
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


  /*
   * Cancel speech sebelumnya.
   */

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


  startButton.style.display =
    'block';

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
   DASHBOARD SUMMARY
===================================================== */

function loadTodaySummary() {

  console.log(
    'Memuat statistik absensi hari ini...'
  );


  google.script.run

    .withSuccessHandler(
      function (result) {

        console.log(
          'SUMMARY:',
          result
        );


        if (
          !result ||
          result.success !== true
        ) {

          console.error(
            'Summary tidak valid.'
          );

          return;

        }


        updateSummary(
          result
        );

      }
    )

    .withFailureHandler(
      function (error) {

        console.error(
          'SUMMARY ERROR:',
          error
        );

      }
    )

    .getTodaySummary();

}

/* =====================================================
   UPDATE SUMMARY
===================================================== */

function updateSummary(
  result
) {

  const total =
    document.getElementById(
      'summaryTotal'
    );

  const hadir =
    document.getElementById(
      'summaryHadir'
    );

  const terlambat =
    document.getElementById(
      'summaryTerlambat'
    );

  const sudahAbsen =
    document.getElementById(
      'summarySudahAbsen'
    );


  if (total) {

    total.textContent =
      result.total || 0;

  }


  if (hadir) {

    hadir.textContent =
      result.hadir || 0;

  }


  if (terlambat) {

    terlambat.textContent =
      result.terlambat || 0;

  }


  if (sudahAbsen) {

    sudahAbsen.textContent =
      result.sudahAbsen || 0;

  }

}
