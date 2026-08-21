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
   KONFIGURASI
===================================================== */

const AUTO_SCAN_DELAY =
  2500;


/* =====================================================
   VARIABLE SCANNER
===================================================== */

let html5QrCode =
  null;


let scannerRunning =
  false;


let processingScan =
  false;


/* =====================================================
   COUNTER SESI
===================================================== */

let countPresent =
  0;


let countLate =
  0;


let countAlready =
  0;


let countError =
  0;


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


/* =====================================================
   LOAD
===================================================== */

window.addEventListener(
  'load',
  function () {

    console.log(
      'Scanner V1 siap.'
    );


    if (
      typeof Html5Qrcode ===
      'undefined'
    ) {

      setStatus(
        '🔴 Library scanner gagal dimuat.'
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

  }
);


/* =====================================================
   BUTTON
===================================================== */

startButton.addEventListener(
  'click',
  function () {

    startScanner();

  }
);


scanAgainButton.addEventListener(
  'click',
  function () {

    restartScanner();

  }
);


/* =====================================================
   AUTO SCAN TOGGLE
===================================================== */

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


/* =====================================================
   START SCANNER
===================================================== */

function startScanner() {

  processingScan =
    false;


  resultElement.style.display =
    'none';


  scannerCard.style.display =
    'block';


  setStatus(
    '📷 Meminta izin kamera...'
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
   CREATE SCANNER
===================================================== */

function createScanner() {

  const reader =
    document.getElementById(
      'reader'
    );


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


      setStatus(
        '🟢 SIAP SCAN KARTU'
      );


      startButton.style.display =
        'none';


      console.log(
        'Kamera aktif.'
      );

    })

    .catch(function (
      error
    ) {

      scannerRunning =
        false;


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
    'QR:',
    studentId
  );


  stopScanner();


  showProcessing();


  processAttendance(
    studentId
  );

}


/* =====================================================
   SCAN ERROR
===================================================== */

function onScanError(
  errorMessage
) {

  /*
   * Sengaja kosong.
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
   API ABSENSI
===================================================== */

function processAttendance(
  studentId
) {

  const url =
    API_URL +
    '?action=attendance' +
    '&studentId=' +
    encodeURIComponent(
      studentId
    );


  console.log(
    'Mengirim ke API:',
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
          'HTTP ' +
          response.status
        );

      }


      return response.json();

    })

    .then(function (
      result
    ) {

      console.log(
        'API RESULT:',
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


      countError++;

      updateCounters();


      showAttendanceError(

        'KONEKSI GAGAL',

        'Tidak dapat terhubung ke server absensi.'

      );


      speak(
        'Koneksi gagal'
      );


      scheduleNextScan();

    });

}


/* =====================================================
   HANDLE RESULT
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
      attendance.status ||
      ''
    ).toLowerCase();


  /*
   * Tentukan Hadir / Terlambat
   */

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


  /*
   * TAMPILKAN
   */

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

    ' WIB' +

    '</small>';


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
   AUTO NEXT SCAN
===================================================== */

function scheduleNextScan() {

  /*
   * Kalau Auto Scan MATI,
   * berhenti di halaman hasil.
   */

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
   STOP
===================================================== */

function stopScanner() {

  if (
    html5QrCode &&
    scannerRunning
  ) {

    html5QrCode

      .stop()

      .then(function () {

        scannerRunning =
          false;


        console.log(
          'Scanner dihentikan.'
        );

      })

      .catch(function (
        error
      ) {

        console.error(
          'Stop scanner error:',
          error
        );

        scannerRunning =
          false;

      });

  }

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
   DATE & TIME
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
   SUARA
===================================================== */

function speak(
  text
) {

  /*
   * Cek dukungan browser
   */

  if (
    !(
      'speechSynthesis'
      in window
    )
  ) {

    console.warn(
      'Speech synthesis tidak tersedia.'
    );

    return;

  }


  /*
   * Hentikan suara sebelumnya
   */

  window.speechSynthesis.cancel();


  const utterance =
    new SpeechSynthesisUtterance(
      text
    );


  utterance.lang =
    'id-ID';


  utterance.rate =
    0.95;


  utterance.pitch =
    1;


  utterance.volume =
    1;


  window.speechSynthesis.speak(
    utterance
  );

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
   CAMERA ERROR
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


  if (
    error &&
    error.name
  ) {

    message +=
      ' [' +
      error.name +
      ']';

  }


  if (
    error &&
    error.message
  ) {

    message +=
      ' ' +
      error.message;

  }


  setStatus(
    '🔴 ' + message
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
