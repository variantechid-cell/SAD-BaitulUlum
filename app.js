/* =====================================================
   SISTEM ABSENSI KARTU PELAJAR
   APP.JS V5.1

   FUNGSI:
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
   - Auto recovery scanner
===================================================== */


/* =====================================================
   VARIABLE UTAMA
===================================================== */

let html5QrCode = null;

let scannerRunning = false;

let processingScan = false;


/*
 * Timer untuk mendeteksi server
 * tidak memberikan respons.
 */

let serverTimeout = null;


/*
 * Waktu maksimal menunggu
 * respons Apps Script.
 */

const SERVER_TIMEOUT = 10000;


/* =====================================================
   SAAT HALAMAN SELESAI DIMUAT
===================================================== */

window.addEventListener(
  'load',
  function () {

    console.log(
      '================================='
    );

    console.log(
      'SISTEM ABSENSI V5.1'
    );

    console.log(
      'Halaman selesai dimuat.'
    );

    console.log(
      '================================='
    );


    /*
     * Cek library scanner.
     */

    if (
      typeof Html5Qrcode ===
      'undefined'
    ) {

      console.error(
        'Html5Qrcode tidak tersedia.'
      );

      setStatus(
        '🔴 Library QR Scanner gagal dimuat.'
      );

      return;

    }


    console.log(
      'Library Html5Qrcode tersedia.'
    );


    /*
     * Scanner otomatis dimulai
     * seperti sistem sebelumnya.
     */

    startScanner();

  }
);


/* =====================================================
   MEMULAI SCANNER
===================================================== */

function startScanner() {

  console.log(
    'Memulai scanner...'
  );


  /*
   * Reset status proses scan.
   */

  processingScan =
    false;


  /*
   * Reset tampilan hasil.
   */

  const result =
    document.getElementById(
      'result'
    );


  const scannerCard =
    document.getElementById(
      'scannerCard'
    );


  if (result) {

    result.style.display =
      'none';

  }


  if (scannerCard) {

    scannerCard.style.display =
      'block';

  }


  setStatus(
    '📷 Meminta akses kamera...'
  );


  /*
   * Jika scanner lama masih aktif,
   * hentikan dahulu.
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

        startCamera();

      });


    return;

  }


  startCamera();

}


/* =====================================================
   START CAMERA
===================================================== */

function startCamera() {

  console.log(
    'Menyiapkan kamera...'
  );


  /*
   * Bersihkan reader.
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
      '🔴 Area kamera tidak ditemukan.'
    );

    return;

  }


  reader.innerHTML =
    '';


  /*
   * Buat scanner baru.
   */

  html5QrCode =
    new Html5Qrcode(
      'reader'
    );


  /*
   * Konfigurasi scanner.
   */

  const config = {

    fps:
      10,

    qrbox:
      function (
        viewfinderWidth,
        viewfinderHeight
      ) {

        const size =
          Math.floor(
            Math.min(
              viewfinderWidth,
              viewfinderHeight
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


  /*
   * Gunakan kamera belakang.
   */

  console.log(
    'Mencoba kamera belakang...'
  );


  html5QrCode

    .start(

      {
        facingMode: {
          exact:
            'environment'
        }
      },

      config,

      onScanSuccess,

      onScanError

    )

    .then(function () {

      scannerRunning =
        true;


      console.log(
        'Kamera berhasil dijalankan.'
      );


      setStatus(
        '🟢 SIAP SCAN'
      );

    })

    .catch(function (error) {

      console.warn(
        'Kamera belakang gagal:',
        error
      );


      /*
       * Coba kamera environment biasa.
       */

      startCameraFallback();

    });

}


/* =====================================================
   FALLBACK CAMERA
===================================================== */

function startCameraFallback() {

  console.log(
    'Mencoba kamera fallback...'
  );


  /*
   * Bersihkan scanner lama.
   */

  if (html5QrCode) {

    try {

      html5QrCode.clear();

    }

    catch (error) {

      console.log(
        'Scanner lama tidak perlu dibersihkan.'
      );

    }

  }


  /*
   * Buat scanner baru.
   */

  html5QrCode =
    new Html5Qrcode(
      'reader'
    );


  const config = {

    fps:
      10,

    qrbox:
      function (
        viewfinderWidth,
        viewfinderHeight
      ) {

        const size =
          Math.floor(
            Math.min(
              viewfinderWidth,
              viewfinderHeight
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

      {
        facingMode:
          'environment'
      },

      config,

      onScanSuccess,

      onScanError

    )

    .then(function () {

      scannerRunning =
        true;


      console.log(
        'Kamera fallback berhasil.'
      );


      setStatus(
        '🟢 SIAP SCAN'
      );

    })

    .catch(function (error) {

      scannerRunning =
        false;


      showCameraError(
        error
      );

    });

}


/* =====================================================
   QR BERHASIL DIBACA
===================================================== */

function onScanSuccess(
  decodedText,
  decodedResult
) {

  /*
   * Jika sedang memproses QR,
   * abaikan scan berikutnya.
   */

  if (
    processingScan
  ) {

    return;

  }


  /*
   * Kunci proses.
   */

  processingScan =
    true;


  console.log(
    '================================='
  );


  console.log(
    'QR TERBACA:',
    decodedText
  );


  /*
   * Ambil Student ID.
   */

  const studentId =
    String(
      decodedText || ''
    ).trim();


  console.log(
    'STUDENT ID:',
    studentId
  );


  /*
   * Cek QR kosong.
   */

  if (!studentId) {

    processingScan =
      false;


    showError(
      'QR TIDAK VALID',
      'Isi QR Code kosong.'
    );


    return;

  }


  /*
   * Hentikan kamera.
   */

  stopScanner()
    .then(function () {

      /*
       * Tampilkan loading.
       */

      setStatus(
        '⏳ Memproses absensi...'
      );


      showProcessing();


      /*
       * Kirim ke Apps Script.
       */

      sendAttendance(
        studentId
      );

    });

}


/* =====================================================
   KIRIM ABSENSI KE APPS SCRIPT
===================================================== */

function sendAttendance(
  studentId
) {

  console.log(
    'Mengirim data ke Apps Script...'
  );


  console.log(
    'Student ID:',
    studentId
  );


  /*
   * Bersihkan timer sebelumnya.
   */

  clearServerTimeout();


  /*
   * Buat timeout.
   *
   * Jika Apps Script tidak memberikan
   * respons dalam 10 detik,
   * sistem dianggap gagal.
   */

  serverTimeout =
    setTimeout(
      function () {

        console.error(
          'SERVER TIMEOUT.'
        );


        processingScan =
          false;


        showError(
          'SERVER TIMEOUT',
          'Server tidak memberikan respons dalam 10 detik.'
        );


        setStatus(
          '🔴 Server tidak merespons.'
        );


        /*
         * Berikan kesempatan
         * melakukan scan lagi.
         */

        enableRetry();

      },

      SERVER_TIMEOUT
    );


  /*
   * Panggil Apps Script.
   */

  google.script.run

    .withSuccessHandler(
      function (result) {

        /*
         * Server sudah merespons.
         * Hentikan timer timeout.
         */

        clearServerTimeout();


        console.log(
          'RESPONS SERVER:',
          result
        );


        handleAttendanceResult(
          result
        );

      }
    )

    .withFailureHandler(
      function (error) {

        /*
         * Server gagal.
         */

        clearServerTimeout();


        console.error(
          'APPS SCRIPT ERROR:',
          error
        );


        processingScan =
          false;


        handleServerError(
          error
        );

      }
    )

    .processAttendance(
      studentId
    );

}


/* =====================================================
   CLEAR SERVER TIMEOUT
===================================================== */

function clearServerTimeout() {

  if (
    serverTimeout
  ) {

    clearTimeout(
      serverTimeout
    );


    serverTimeout =
      null;

  }

}


/* =====================================================
   TAMPILKAN LOADING
===================================================== */

function showProcessing() {

  const resultBox =
    document.getElementById(
      'result'
    );


  if (!resultBox) {

    return;

  }


  resultBox.className =
    'result';


  resultBox.style.display =
    'block';


  const icon =
    document.getElementById(
      'resultIcon'
    );


  const title =
    document.getElementById(
      'resultTitle'
    );


  const studentName =
    document.getElementById(
      'studentName'
    );


  const studentClass =
    document.getElementById(
      'studentClass'
    );


  const attendanceStatus =
    document.getElementById(
      'attendanceStatus'
    );


  const attendanceTime =
    document.getElementById(
      'attendanceTime'
    );


  if (icon) {

    icon.textContent =
      '⏳';

  }


  if (title) {

    title.textContent =
      'MEMPROSES ABSENSI';

  }


  if (studentName) {

    studentName.textContent =
      'Menghubungkan ke server...';

  }


  if (studentClass) {

    studentClass.textContent =
      '';

  }


  if (attendanceStatus) {

    attendanceStatus.textContent =
      '';

  }


  if (attendanceTime) {

    attendanceTime.textContent =
      '';

  }

}


/* =====================================================
   HASIL DARI SERVER
===================================================== */

function handleAttendanceResult(
  result
) {

  console.log(
    '================================='
  );

  console.log(
    'HASIL ABSENSI:',
    result
  );


  /*
   * Pastikan result ada.
   */

  if (
    !result
  ) {

    processingScan =
      false;


    showError(
      'SERVER ERROR',
      'Server tidak memberikan hasil absensi.'
    );


    enableRetry();


    return;

  }


  /*
   * SUCCESS
   */

  if (
    result.status ===
    'SUCCESS'
  ) {

    showSuccess(
      result
    );


    return;

  }


  /*
   * ALREADY
   */

  if (
    result.status ===
    'ALREADY'
  ) {

    showAlready(
      result
    );


    return;

  }


  /*
   * NOT FOUND
   */

  if (
    result.status ===
    'NOT_FOUND'
  ) {

    processingScan =
      false;


    showError(
      'DATA TIDAK DITEMUKAN',
      result.message ||
        'Student ID tidak terdaftar.'
    );


    setStatus(
      '🔴 Kartu tidak terdaftar.'
    );


    enableRetry();


    return;

  }


  /*
   * INACTIVE
   */

  if (
    result.status ===
    'INACTIVE'
  ) {

    processingScan =
      false;


    showError(
      'SISWA TIDAK AKTIF',
      result.message ||
        'Data siswa tidak aktif.'
    );


    setStatus(
      '🔴 Siswa tidak aktif.'
    );


    enableRetry();


    return;

  }


  /*
   * ERROR LAIN
   */

  processingScan =
    false;


  showError(
    'ABSENSI GAGAL',
    result.message ||
      'Terjadi kesalahan pada server.'
  );


  setStatus(
    '🔴 Absensi gagal.'
  );


  enableRetry();

}


/* =====================================================
   ABSENSI BERHASIL
===================================================== */

function showSuccess(
  result
) {

  processingScan =
    false;


  const student =
    result.student || {};


  const attendance =
    result.attendance || {};


  const resultBox =
    document.getElementById(
      'result'
    );


  if (!resultBox) {

    return;

  }


  resultBox.className =
    'result success';


  resultBox.style.display =
    'block';


  const icon =
    document.getElementById(
      'resultIcon'
    );


  const title =
    document.getElementById(
      'resultTitle'
    );


  const studentName =
    document.getElementById(
      'studentName'
    );


  const studentClass =
    document.getElementById(
      'studentClass'
    );


  const attendanceStatus =
    document.getElementById(
      'attendanceStatus'
    );


  const attendanceTime =
    document.getElementById(
      'attendanceTime'
    );


  if (icon) {

    icon.textContent =
      '🟢';

  }


  if (title) {

    title.textContent =
      'ABSENSI BERHASIL';

  }


  if (studentName) {

    studentName.textContent =
      student.nama ||
      '-';

  }


  if (studentClass) {

    studentClass.textContent =
      student.kelas ||
      '-';

  }


  if (attendanceStatus) {

    attendanceStatus.textContent =
      attendance.status ||
      '-';

  }


  if (attendanceTime) {

    attendanceTime.textContent =

      (
        attendance.tanggal ||
        ''
      ) +

      ' • ' +

      (
        attendance.jam ||
        ''
      ) +

      ' WIB';

  }


  setStatus(
    '🟢 Absensi berhasil.'
  );


  /*
   * Setelah berhasil,
   * beri waktu untuk melihat hasil.
   */

  autoRestartScanner();

}


/* =====================================================
   SUDAH ABSEN
===================================================== */

function showAlready(
  result
) {

  processingScan =
    false;


  const student =
    result.student || {};


  const previous =
    result.previousAttendance || {};


  const resultBox =
    document.getElementById(
      'result'
    );


  if (!resultBox) {

    return;

  }


  resultBox.className =
    'result warning';


  resultBox.style.display =
    'block';


  const icon =
    document.getElementById(
      'resultIcon'
    );


  const title =
    document.getElementById(
      'resultTitle'
    );


  const studentName =
    document.getElementById(
      'studentName'
    );


  const studentClass =
    document.getElementById(
      'studentClass'
    );


  const attendanceStatus =
    document.getElementById(
      'attendanceStatus'
    );


  const attendanceTime =
    document.getElementById(
      'attendanceTime'
    );


  if (icon) {

    icon.textContent =
      '🟡';

  }


  if (title) {

    title.textContent =
      'SUDAH ABSEN';

  }


  if (studentName) {

    studentName.textContent =
      student.nama ||
      '-';

  }


  if (studentClass) {

    studentClass.textContent =
      student.kelas ||
      '-';

  }


  if (attendanceStatus) {

    attendanceStatus.textContent =
      previous.status ||
      'Sudah absen';

  }


  if (attendanceTime) {

    attendanceTime.textContent =

      'Absensi sebelumnya: ' +

      (
        previous.jam ||
        '-'
      );

  }


  setStatus(
    '🟡 Siswa sudah melakukan absensi.'
  );


  /*
   * Persiapkan scanner berikutnya.
   */

  autoRestartScanner();

}


/* =====================================================
   ERROR
===================================================== */

function showError(
  title,
  message
) {

  const resultBox =
    document.getElementById(
      'result'
    );


  if (!resultBox) {

    return;

  }


  resultBox.className =
    'result error';


  resultBox.style.display =
    'block';


  const icon =
    document.getElementById(
      'resultIcon'
    );


  const titleElement =
    document.getElementById(
      'resultTitle'
    );


  const studentName =
    document.getElementById(
      'studentName'
    );


  const studentClass =
    document.getElementById(
      'studentClass'
    );


  const attendanceStatus =
    document.getElementById(
      'attendanceStatus'
    );


  const attendanceTime =
    document.getElementById(
      'attendanceTime'
    );


  if (icon) {

    icon.textContent =
      '🔴';

  }


  if (titleElement) {

    titleElement.textContent =
      title ||
      'ERROR';

  }


  if (studentName) {

    studentName.textContent =
      message ||
      'Terjadi kesalahan.';

  }


  if (studentClass) {

    studentClass.textContent =
      '';

  }


  if (attendanceStatus) {

    attendanceStatus.textContent =
      '';

  }


  if (attendanceTime) {

    attendanceTime.textContent =
      '';

  }

}


/* =====================================================
   SERVER ERROR
===================================================== */

function handleServerError(
  error
) {

  console.error(
    '================================='
  );

  console.error(
    'SERVER ERROR'
  );

  console.error(
    error
  );


  processingScan =
    false;


  let message =
    'Tidak dapat terhubung ke server.';


  if (
    error &&
    error.message
  ) {

    message =
      error.message;

  }


  showError(
    'SERVER ERROR',
    message
  );


  setStatus(
    '🔴 Terjadi kesalahan server.'
  );


  enableRetry();

}


/* =====================================================
   AKTIFKAN KEMBALI SCANNER
===================================================== */

function enableRetry() {

  /*
   * Jangan langsung restart.
   *
   * Berikan waktu 2,5 detik agar
   * operator dapat membaca pesan.
   */

  setTimeout(
    function () {

      restartScanner();

    },

    2500

  );

}


/* =====================================================
   AUTO RESTART
===================================================== */

function autoRestartScanner() {

  setTimeout(
    function () {

      restartScanner();

    },

    2500

  );

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
        'Menghentikan scanner...'
      );


      html5QrCode

        .stop()

        .then(function () {

          scannerRunning =
            false;


          console.log(
            'Scanner berhasil dihentikan.'
          );


          resolve();

        })

        .catch(function (error) {

          console.warn(
            'Gagal menghentikan scanner:',
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
   RESTART SCANNER
===================================================== */

function restartScanner() {

  console.log(
    '================================='
  );

  console.log(
    'RESTART SCANNER'
  );


  processingScan =
    false;


  const result =
    document.getElementById(
      'result'
    );


  const scannerCard =
    document.getElementById(
      'scannerCard'
    );


  if (result) {

    result.style.display =
      'none';

  }


  if (scannerCard) {

    scannerCard.style.display =
      'block';

  }


  setStatus(
    '📷 Menyiapkan kamera...'
  );


  /*
   * Jika kamera masih aktif,
   * hentikan dahulu.
   */

  if (
    html5QrCode &&
    scannerRunning
  ) {

    stopScanner()
      .then(function () {

        startScanner();

      });

  }

  else {

    startScanner();

  }

}


/* =====================================================
   SCAN ERROR
===================================================== */

function onScanError(
  errorMessage
) {

  /*
   * Error pencarian QR biasa
   * tidak perlu ditampilkan.
   */

}


/* =====================================================
   STATUS
===================================================== */

function setStatus(
  message
) {

  const status =
    document.getElementById(
      'status'
    );


  if (status) {

    status.textContent =
      message;

  }


  console.log(
    'STATUS:',
    message
  );

}


/* =====================================================
   ERROR KAMERA
===================================================== */

function showCameraError(
  error
) {

  console.error(
    '================================='
  );

  console.error(
    'CAMERA ERROR'
  );

  console.error(
    error
  );


  scannerRunning =
    false;


  let message =
    'Kamera gagal diakses.';


  if (error) {

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

}
