/* =====================================================
   GOOGLE APPS SCRIPT API
===================================================== */

const API_URL =
  'https://script.google.com/a/macros/guru.smk.belajar.id/s/AKfycbybMMhzrTv3Uqv3vMAdJTA5Co4FiTh_jZ4ocD5iNdHb2mZBX2S_BJJBrgFCgJIcqb21/exec';
/* =====================================================
   ABSENSI SISWA
   WEB SCANNER V1
   TAHAP 3B-1

   Fokus:
   - Mengakses kameraonScanSuccess()
   - Membaca QR / Barcode
   - Menampilkan Student ID

   BELUM TERHUBUNG KE GOOGLE SHEET
===================================================== */


/* =====================================================
   VARIABLE
===================================================== */

let html5QrCode = null;

let scannerRunning = false;

let processingScan = false;


/* =====================================================
   ELEMENT
===================================================== */

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


const startButton =
  document.getElementById(
    'startButton'
  );


const scanAgainButton =
  document.getElementById(
    'scanAgainButton'
  );


/* =====================================================
   SAAT HALAMAN SELESAI
===================================================== */

window.addEventListener(
  'load',
  function () {

    console.log(
      'Halaman scanner siap.'
    );


    /*
     * Cek library
     */

    if (
      typeof Html5Qrcode ===
      'undefined'
    ) {

      setStatus(
        '🔴 Library scanner gagal dimuat.'
      );

      console.error(
        'Html5Qrcode tidak tersedia.'
      );

      return;

    }


    console.log(
      'Html5Qrcode berhasil dimuat.'
    );


    setStatus(
      '🟢 Scanner siap. Tekan "Mulai Scanner".'
    );

  }
);


/* =====================================================
   BUTTON MULAI
===================================================== */

startButton.addEventListener(
  'click',
  function () {

    startScanner();

  }
);


/* =====================================================
   BUTTON SCAN LAGI
===================================================== */

scanAgainButton.addEventListener(
  'click',
  function () {

    restartScanner();

  }
);


/* =====================================================
   START SCANNER
===================================================== */

function startScanner() {

  console.log(
    'Memulai kamera...'
  );


  processingScan = false;


  /*
   * Pastikan hasil scan disembunyikan
   */

  resultElement.style.display =
    'none';


  scannerCard.style.display =
    'block';


  setStatus(
    '📷 Meminta izin kamera...'
  );


  /*
   * Pastikan library tersedia
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
   * Jika scanner lama masih aktif,
   * hentikan terlebih dahulu.
   */

  if (
    html5QrCode &&
    scannerRunning
  ) {

    html5QrCode
      .stop()
      .then(function () {

        scannerRunning =
          false;

        createScanner();

      })
      .catch(function () {

        scannerRunning =
          false;

        createScanner();

      });

  } else {

    createScanner();

  }

}


/* =====================================================
   MEMBUAT SCANNER
===================================================== */

function createScanner() {

  console.log(
    'Membuat instance Html5Qrcode...'
  );


  /*
   * Bersihkan elemen reader
   */

  const reader =
    document.getElementById(
      'reader'
    );


  reader.innerHTML =
    '';


  /*
   * Buat scanner baru
   */

  html5QrCode =
    new Html5Qrcode(
      'reader'
    );


  /*
   * Konfigurasi
   */

  const config = {

    fps: 10,

    qrbox: function (
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

    }

  };


  /*
   * Gunakan kamera belakang.
   *
   * Tidak menggunakan "exact"
   * supaya lebih kompatibel.
   */

  html5QrCode

    .start(

      {
        facingMode:
          "environment"
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
        '🟢 SIAP SCAN KARTU'
      );


      /*
       * Tombol mulai tidak diperlukan
       * ketika kamera sudah aktif.
       */

      startButton.style.display =
        'none';

    })

    .catch(function (error) {

      scannerRunning =
        false;


      console.error(
        'Kamera gagal dijalankan:',
        error
      );


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

  if (
    processingScan
  ) {

    return;

  }


  processingScan =
    true;


  console.log(
    'QR TERBACA:',
    decodedText
  );


  const studentId =
    String(
      decodedText
    ).trim();


  stopScanner();


  showProcessing();


  processAttendance(
    studentId
  );

}


/* =====================================================
   ERROR SCAN
===================================================== */

function onScanError(
  errorMessage
) {

  /*
   * Jangan tampilkan error
   * karena selama proses scan,
   * scanner memang akan terus
   * gagal membaca frame yang
   * tidak mengandung QR.
   */

}


/* =====================================================
   TAMPILKAN HASIL
===================================================== */

function showScanResult(
  studentId
) {

  scannerCard.style.display =
    'none';


  resultElement.style.display =
    'block';


  resultIconElement.textContent =
    '🟢';


  resultTitleElement.textContent =
    'QR BERHASIL DIBACA';


  studentIdElement.textContent =
    studentId;


  console.log(
    'Student ID:',
    studentId
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


  startButton.style.display =
    'none';


  setStatus(
    '📷 Menyiapkan kamera...'
  );


  /*
   * Kalau scanner masih aktif,
   * hentikan dahulu.
   */

  if (
    html5QrCode &&
    scannerRunning
  ) {

    html5QrCode

      .stop()

      .then(function () {

        scannerRunning =
          false;

        createScanner();

      })

      .catch(function () {

        scannerRunning =
          false;

        createScanner();

      });

  } else {

    createScanner();

  }

}


/* =====================================================
   STOP SCANNER
===================================================== */

function stopScanner() {

  if (
    html5QrCode &&
    scannerRunning
  ) {

    html5QrCode

      .stop()

      .then(function () {

        console.log(
          'Scanner dihentikan.'
        );


        scannerRunning =
          false;

      })

      .catch(function (error) {

        console.error(
          'Gagal menghentikan scanner:',
          error
        );


        scannerRunning =
          false;

      });

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

}


/* =====================================================
   ERROR KAMERA
===================================================== */

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
    '🔴 ' + message
  );


  /*
   * Tampilkan kembali tombol
   * agar pengguna bisa mencoba lagi.
   */

  startButton.style.display =
    'block';

}

/* =====================================================
   KIRIM ABSENSI KE GOOGLE APPS SCRIPT
===================================================== */

function processAttendance(
  studentId
) {

  console.log(
    'Mengirim absensi:',
    studentId
  );


  setStatus(
    '⏳ Memproses absensi...'
  );


  const url =
    API_URL +
    '?action=attendance' +
    '&studentId=' +
    encodeURIComponent(
      studentId
    );


  console.log(
    'API URL:',
    url
  );


  fetch(url)

    .then(function (
      response
    ) {

      if (
        !response.ok
      ) {

        throw new Error(
          'HTTP Error ' +
          response.status
        );

      }


      return response.json();

    })


    .then(function (
      result
    ) {

      console.log(
        'Response API:',
        result
      );


      handleAttendanceResult(
        result
      );

    })


    .catch(function (
      error
    ) {

      console.error(
        'API ERROR:',
        error
      );


      showApiError(
        error
      );

    });

}

/* =====================================================
   PROSES ABSENSI
===================================================== */

function showProcessing() {

  scannerCard.style.display =
    'none';


  resultElement.style.display =
    'block';


  resultIconElement.textContent =
    '⏳';


  resultTitleElement.textContent =
    'MEMPROSES ABSENSI';


  studentIdElement.textContent =
    'Mohon tunggu...';

}

/* =====================================================
   HASIL ABSENSI
===================================================== */

function handleAttendanceResult(
  result
) {

  console.log(
    'Hasil absensi:',
    result
  );


  /*
   * SUCCESS
   */

  if (
    result.status ===
    'SUCCESS'
  ) {

    showAttendanceSuccess(
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

    showAttendanceAlready(
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

    showAttendanceError(
      'DATA TIDAK DITEMUKAN',
      result.message
    );

    return;

  }


  /*
   * INACTIVE
   */

  if (
    result.status ===
    'INACTIVE'
  ) {

    showAttendanceError(
      'SISWA TIDAK AKTIF',
      result.message
    );

    return;

  }


  /*
   * ERROR LAIN
   */

  showAttendanceError(

    'ABSENSI GAGAL',

    result.message ||
      'Terjadi kesalahan.'

  );

}

function showAttendanceSuccess(
  result
) {

  const student =
    result.student;


  const attendance =
    result.attendance;


  scannerCard.style.display =
    'none';


  resultElement.style.display =
    'block';


  resultIconElement.textContent =
    '🟢';


  resultTitleElement.textContent =
    'ABSENSI BERHASIL';


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
    ' WIB' +
    '</small>';

}

function showAttendanceAlready(
  result
) {

  const student =
    result.student;


  const previous =
    result.previousAttendance;


  scannerCard.style.display =
    'none';


  resultElement.style.display =
    'block';


  resultIconElement.textContent =
    '🟡';


  resultTitleElement.textContent =
    'SUDAH ABSEN';


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

    'Status: ' +

    '<strong>' +
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

function showAttendanceError(
  title,
  message
) {

  scannerCard.style.display =
    'none';


  resultElement.style.display =
    'block';


  resultIconElement.textContent =
    '🔴';


  resultTitleElement.textContent =
    title;


  studentIdElement.textContent =
    message ||
    'Terjadi kesalahan.';

}

function showApiError(
  error
) {

  console.error(
    'API CONNECTION ERROR:',
    error
  );


  scannerCard.style.display =
    'none';


  resultElement.style.display =
    'block';


  resultIconElement.textContent =
    '🔴';


  resultTitleElement.textContent =
    'KONEKSI GAGAL';


  studentIdElement.textContent =
    'Tidak dapat terhubung ke server absensi.';

}

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
