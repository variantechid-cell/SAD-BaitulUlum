/* =====================================================
   V5.2.9 - URUTAN ABSENSI HARI INI
   SMP BAITUL ULUM BOARDING SCHOOL

   FITUR:
   - Mengambil data dari Google Sheet melalui API
   - Urutan berdasarkan waktu absensi
   - 🥇 🥈 🥉 untuk 3 siswa pertama
   - Nomor untuk siswa berikutnya
   - Nama
   - Kelas
   - Jam
   - Status
   - Tampilan Desktop = Tabel
   - Tampilan HP = Card
   - Tetap muncul setelah refresh
===================================================== */


/* =====================================================
   LOAD DATA ABSENSI HARI INI
===================================================== */

function loadTodayAttendanceList() {

  console.log(
    '===================================='
  );

  console.log(
    'V5.2.9 - MEMUAT ABSENSI HARI INI'
  );

  console.log(
    '===================================='
  );


  /* ---------------------------------
     UPDATE TANGGAL
  --------------------------------- */

  updateAttendanceDate();


  /* ---------------------------------
     SEKALIGUS MUAT REKAP
  --------------------------------- */

  loadTodaySummary();


  /* ---------------------------------
     ELEMENT TAMPILAN
  --------------------------------- */

  const loading =
    document.getElementById(
      'attendanceLoading'
    );

  const empty =
    document.getElementById(
      'attendanceEmpty'
    );

  const desktop =
    document.getElementById(
      'attendanceDesktop'
    );

  const mobile =
    document.getElementById(
      'attendanceMobile'
    );


  /* ---------------------------------
     TAMPILKAN LOADING
  --------------------------------- */

  if (loading) {

    loading.style.display =
      'flex';

  }


  if (empty) {

    empty.style.display =
      'none';

  }


  if (desktop) {

    desktop.style.display =
      'none';

  }


  if (mobile) {

    mobile.style.display =
      'none';

  }


  /* ---------------------------------
     URL API
  --------------------------------- */

  const url =
    API_URL +
    '?action=attendanceList' +
    '&_=' +
    Date.now();


  console.log(
    'Mengambil data dari:',
    url
  );


  /* ---------------------------------
     REQUEST KE GOOGLE APPS SCRIPT
  --------------------------------- */

  fetch(url)

    .then(
      function(response) {

        console.log(
          'ATTENDANCE LIST HTTP:',
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
      function(result) {

        console.log(
          'ATTENDANCE LIST RESULT:',
          result
        );


        renderTodayAttendance(
          result
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
          error.message
        );

      }
    );

}


/* =====================================================
   UPDATE TANGGAL
===================================================== */

function updateAttendanceDate() {

  const element =
    document.getElementById(
      'attendanceDate'
    );


  if (!element) {

    return;

  }


  const now =
    new Date();


  element.textContent =
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

}


/* =====================================================
   RENDER DATA ABSENSI
===================================================== */

function renderTodayAttendance(
  result
) {

  console.log(
    '===================================='
  );

  console.log(
    'RENDER ABSENSI HARI INI'
  );

  console.log(
    result
  );


  const loading =
    document.getElementById(
      'attendanceLoading'
    );

  const empty =
    document.getElementById(
      'attendanceEmpty'
    );

  const desktop =
    document.getElementById(
      'attendanceDesktop'
    );

  const mobile =
    document.getElementById(
      'attendanceMobile'
    );


  /* ---------------------------------
     MATIKAN LOADING
  --------------------------------- */

  if (loading) {

    loading.style.display =
      'none';

  }


  /* ---------------------------------
     VALIDASI RESPONSE
  --------------------------------- */

  if (!result) {

    showAttendanceListError(
      'Server tidak mengirim data.'
    );

    return;

  }


  if (
    result.success !== true
  ) {

    showAttendanceListError(

      result.message ||
      'Data absensi tidak dapat dimuat.'

    );

    return;

  }


  /* ---------------------------------
     AMBIL ARRAY DATA
  --------------------------------- */

  let data = [];


  if (
    Array.isArray(
      result.data
    )
  ) {

    data =
      result.data;

  }


  console.log(
    'JUMLAH ABSENSI:',
    data.length
  );


  /* ---------------------------------
     DATA KOSONG
  --------------------------------- */

  if (
    data.length === 0
  ) {

    if (empty) {

      empty.style.display =
        'block';

      empty.textContent =
        '📋 Belum ada siswa yang melakukan absensi hari ini.';

    }


    if (desktop) {

      desktop.style.display =
        'none';

    }


    if (mobile) {

      mobile.style.display =
        'none';

    }


    return;

  }


  /* ---------------------------------
     NORMALISASI DATA
  --------------------------------- */

  data =
    normalizeAttendanceData(
      data
    );


  /* ---------------------------------
     URUTKAN BERDASARKAN WAKTU
  --------------------------------- */

  data.sort(
    function(a, b) {

      return (
        convertTimeToSeconds(
          a.jam
        ) -
        convertTimeToSeconds(
          b.jam
        )
      );

    }
  );


  /* ---------------------------------
     RENDER ULANG RANKING
  --------------------------------- */

  data =
    data.map(
      function(
        item,
        index
      ) {

        item.rank =
          index + 1;

        return item;

      }
    );


  /* ---------------------------------
     RENDER DESKTOP
  --------------------------------- */

  renderAttendanceTable(
    data
  );


  /* ---------------------------------
     RENDER HP
  --------------------------------- */

  renderAttendanceCards(
    data
  );


  /* ---------------------------------
     TAMPILKAN LAYOUT
  --------------------------------- */

  if (empty) {

    empty.style.display =
      'none';

  }


  if (desktop) {

    desktop.style.display =
      'block';

  }


  if (mobile) {

    mobile.style.display =
      'block';

  }


}


/* =====================================================
   NORMALISASI DATA
===================================================== */

function normalizeAttendanceData(
  data
) {

  return data.map(
    function(
      item
    ) {

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
            item.waktu ||
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


/* =====================================================
   KONVERSI JAM
===================================================== */

function convertTimeToSeconds(
  time
) {

  if (!time) {

    return 999999;

  }


  const text =
    String(
      time
    ).trim();


  const parts =
    text.split(':');


  if (
    parts.length < 2
  ) {

    return 999999;

  }


  const hour =
    Number(
      parts[0]
    ) || 0;


  const minute =
    Number(
      parts[1]
    ) || 0;


  const second =
    Number(
      parts[2]
    ) || 0;


  return (
    hour * 3600 +
    minute * 60 +
    second
  );

}


/* =====================================================
   DESKTOP - TABLE
===================================================== */

function renderAttendanceTable(
  data
) {

  const tbody =
    document.getElementById(
      'attendanceTableBody'
    );


  if (!tbody) {

    console.error(
      '#attendanceTableBody tidak ditemukan.'
    );

    return;

  }


  tbody.innerHTML =
    '';


  data.forEach(
    function(
      student
    ) {

      const row =
        document.createElement(
          'tr'
        );


      /* ---------------------------------
         RANK
      --------------------------------- */

      const rankCell =
        document.createElement(
          'td'
        );


      rankCell.className =
        'rank-column';


      rankCell.innerHTML =
        getRankHtml(
          student.rank
        );


      /* ---------------------------------
         NAMA
      --------------------------------- */

      const nameCell =
        document.createElement(
          'td'
        );


      nameCell.innerHTML =

        '<span class="student-name">' +

        escapeHtml(
          student.nama
        ) +

        '</span>';


      /* ---------------------------------
         KELAS
      --------------------------------- */

      const classCell =
        document.createElement(
          'td'
        );


      classCell.innerHTML =

        '<span class="student-class">' +

        'Kelas ' +

        escapeHtml(
          removeKelasPrefix(
            student.kelas
          )
        ) +

        '</span>';


      /* ---------------------------------
         JAM
      --------------------------------- */

      const timeCell =
        document.createElement(
          'td'
        );


      timeCell.innerHTML =

        '<span class="attendance-time">' +

        '🕐 ' +

        escapeHtml(
          student.jam
        ) +

        '</span>';


      /* ---------------------------------
         STATUS
      --------------------------------- */

      const statusCell =
        document.createElement(
          'td'
        );


      statusCell.innerHTML =
        getStatusBadgeHtml(
          student.status
        );


      /* ---------------------------------
         MASUKKAN KE BARIS
      --------------------------------- */

      row.appendChild(
        rankCell
      );

      row.appendChild(
        nameCell
      );

      row.appendChild(
        classCell
      );

      row.appendChild(
        timeCell
      );

      row.appendChild(
        statusCell
      );


      tbody.appendChild(
        row
      );

    }
  );

}


/* =====================================================
   MOBILE - CARD
===================================================== */

function renderAttendanceCards(
  data
) {

  const container =
    document.getElementById(
      'attendanceCardList'
    );


  if (!container) {

    console.error(
      '#attendanceCardList tidak ditemukan.'
    );

    return;

  }


  container.innerHTML =
    '';


  data.forEach(
    function(
      student
    ) {

      const card =
        document.createElement(
          'div'
        );


      card.className =
        'attendance-card';


      card.innerHTML =

        '<div class="attendance-card-rank ' +

        (
          student.rank <= 3
            ? 'medal'
            : ''
        ) +

        '">' +

        getRankHtml(
          student.rank
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


            '<div class="attendance-card-status">' +

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


/* =====================================================
   RANKING
===================================================== */

function getRankHtml(
  rank
) {

  rank =
    Number(
      rank
    );


  if (
    rank === 1
  ) {

    return (
      '<span class="rank-medal">🥇</span>'
    );

  }


  if (
    rank === 2
  ) {

    return (
      '<span class="rank-medal">🥈</span>'
    );

  }


  if (
    rank === 3
  ) {

    return (
      '<span class="rank-medal">🥉</span>'
    );

  }


  return (

    '<span class="rank-number">' +

    rank +

    '</span>'

  );

}


/* =====================================================
   STATUS
===================================================== */

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


/* =====================================================
   REFRESH SETELAH ABSEN
===================================================== */

function refreshAttendanceList() {

  console.log(
    'Refresh daftar absensi...'
  );


  loadTodayAttendanceList();

}


/* =====================================================
   ERROR DAFTAR ABSENSI
===================================================== */

function showAttendanceListError(
  message
) {

  const loading =
    document.getElementById(
      'attendanceLoading'
    );

  const empty =
    document.getElementById(
      'attendanceEmpty'
    );

  const desktop =
    document.getElementById(
      'attendanceDesktop'
    );

  const mobile =
    document.getElementById(
      'attendanceMobile'
    );


  if (loading) {

    loading.style.display =
      'none';

  }


  if (desktop) {

    desktop.style.display =
      'none';

  }


  if (mobile) {

    mobile.style.display =
      'none';

  }


  if (empty) {

    empty.style.display =
      'block';


    empty.textContent =

      '🔴 ' +

      (
        message ||
        'Daftar absensi tidak dapat dimuat.'
      );

  }

}


/* =====================================================
   HAPUS PREFIX "KELAS"
===================================================== */

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
   AUTO REFRESH DAFTAR ABSENSI
===================================================== */

setInterval(
  function() {

    console.log(
      'Auto refresh absensi hari ini...'
    );


    loadTodayAttendanceList();

  },
  30000
);
