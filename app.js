/* ============================================================
   ABSENSI KARTU PELAJAR
   SMP & SMA BAITUL ULUM BOARDING SCHOOL

   APP.JS FINAL - V13

   PERUBAHAN UTAMA:
   - LOGIN menggunakan USERNAME + PASSWORD biasa
   - TIDAK menggunakan SHA-256
   - TIDAK menggunakan PASSWORD_HASH
   - Password dikirim langsung ke Code.gs
   - Password dapat dikelola langsung melalui Sheet USER
   - Admin memiliki tombol REKAP BULANAN manual
   - Guru memiliki REKAP BULANAN per KELAS + MATA PELAJARAN
   - Rekap bulanan Admin tidak dijalankan saat scan
   - Rekap Guru hanya membaca data ABSENSI, tidak menulis REKAP_BULANAN
   - Setelah login, area scanner publik dan statistik publik disembunyikan

   KOMUNIKASI:
   fetch(API_URL)

   TIDAK menggunakan:
   google.script.run
============================================================ */


/* ============================================================
   1. KONFIGURASI
============================================================ */

const API_URL =
  'https://script.google.com/macros/s/AKfycbybMMhzrTv3Uqv3vMAdJTA5Co4FiTh_jZ4ocD5iNdHb2mZBX2S_BJJBrgFCgJIcqb21/exec';

const SESSION_KEY =
  'baitul_ulum_session_token';

const USER_KEY =
  'baitul_ulum_user';

const AUTO_SCAN_DELAY = 2500;

const REFRESH_INTERVAL = 30000;


/* ============================================================
   2. STATE
============================================================ */

let html5QrCode = null;

let scannerRunning = false;

let processingScan = false;

let currentUser = null;

let currentToken = null;

let currentTeacherSchedule = null;

let teacherSchedulesData = [];

let teacherRecapOptionsData = [];

let todayAttendanceData = [];

let refreshTimer = null;

let autoScanTimer = null;

let teacherAttendanceEditing = false;

let teacherAttendanceSaveAllRunning = false;


/* ============================================================
   3. HELPER DOM
============================================================ */

function $(id) {
  return document.getElementById(id);
}


function exists(id) {
  return !!$(id);
}


function setText(id, value) {

  const element = $(id);

  if (!element) {
    return;
  }

  element.textContent =
    value === null ||
    value === undefined
      ? ''
      : String(value);
}


function show(id, display = '') {

  const element = $(id);

  if (!element) {
    return;
  }

  element.style.display = display;
}


function hide(id) {

  const element = $(id);

  if (!element) {
    return;
  }

  element.style.display = 'none';
}


function escapeHTML(value) {

  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


/* ============================================================
   4. API HELPER
============================================================ */

async function apiGet(params = {}, options = {}) {

  const query =
    new URLSearchParams();


  Object.keys(params).forEach(
    function (key) {

      const value =
        params[key];

      if (
        value !== undefined &&
        value !== null &&
        value !== ''
      ) {

        query.append(
          key,
          String(value)
        );
      }

    }
  );


  /*
   * Cache buster
   */

  query.append(
    '_ts',
    String(Date.now())
  );


  const url =
    API_URL +
    '?' +
    query.toString();


  const timeoutMs =
    Number(options.timeoutMs) > 0
      ? Number(options.timeoutMs)
      : 20000;


  try {

    const controller =
      new AbortController();


    const timeout =
      setTimeout(
        function () {

          controller.abort();

        },
        timeoutMs
      );


    let response;


    try {

      response =
        await fetch(
          url,
          {
            method: 'GET',
            cache: 'no-store',
            redirect: 'follow',
            credentials: 'omit',
            signal: controller.signal
          }
        );

    } finally {

      clearTimeout(timeout);

    }


    if (!response.ok) {

      throw new Error(
        'HTTP ' +
        response.status +
        ' ' +
        response.statusText
      );
    }


    const text =
      await response.text();


    if (!text) {

      throw new Error(
        'Server mengirim response kosong.'
      );
    }


    let data;


    try {

      data =
        JSON.parse(text);

    } catch (jsonError) {

      console.error(
        'Response Apps Script bukan JSON:',
        text.substring(0, 500)
      );

      throw new Error(
        'Server tidak mengembalikan JSON yang valid.'
      );
    }


    return data;


  } catch (error) {

    console.error(
      'API REQUEST ERROR:',
      error
    );


    if (
      error &&
      error.name === 'AbortError'
    ) {

      throw new Error(
        'Server terlalu lama merespons. Periksa koneksi internet.'
      );
    }


    if (
      error &&
      (
        error.name === 'TypeError' ||
        String(error.message)
          .toLowerCase()
          .includes('network')
      )
    ) {

      throw new Error(
        'Koneksi ke server absensi gagal. Periksa internet dan pastikan Web App Apps Script masih aktif.'
      );
    }


    throw error;
  }
}


/* ============================================================
   5. SESSION
============================================================ */

function loadStoredSession() {

  try {

    currentToken =
      localStorage.getItem(
        SESSION_KEY
      );


    const storedUser =
      localStorage.getItem(
        USER_KEY
      );


    if (storedUser) {

      try {

        currentUser =
          JSON.parse(
            storedUser
          );

      } catch (error) {

        currentUser = null;
      }
    }


  } catch (error) {

    console.error(
      'Gagal membaca session:',
      error
    );

    currentToken = null;

    currentUser = null;
  }
}


function saveSession(
  token,
  user
) {

  currentToken =
    token;

  currentUser =
    user;


  try {

    if (token) {

      localStorage.setItem(
        SESSION_KEY,
        token
      );
    }


    if (user) {

      localStorage.setItem(
        USER_KEY,
        JSON.stringify(user)
      );
    }


  } catch (error) {

    console.error(
      'Gagal menyimpan session:',
      error
    );
  }
}


function clearSession() {

  currentToken = null;

  currentUser = null;

  currentTeacherSchedule =
    null;


  try {

    localStorage.removeItem(
      SESSION_KEY
    );

    localStorage.removeItem(
      USER_KEY
    );

  } catch (error) {

    console.error(
      'Gagal menghapus session:',
      error
    );
  }
}


/* ============================================================
   6. BLOK DAFTAR ABSENSI PUBLIK
============================================================ */

function getTodayAttendanceBlock() {

  const primary =
    $('attendanceDesktop') ||
    $('attendanceMobile') ||
    $('attendanceTableBody') ||
    $('attendanceCardList');

  if (!primary) {
    return null;
  }

  const block =
    primary.closest(
      'section, .attendance-section, .dashboard-card, .dashboard-panel, .card, .panel'
    );

  return block || primary;
}


function setTodayAttendanceVisibility(visible) {

  const block =
    getTodayAttendanceBlock();

  if (block) {
    block.style.display =
      visible ? '' : 'none';
  }

  if (!block) {
    [
      'attendanceDesktop',
      'attendanceMobile',
      'attendanceEmpty',
      'attendanceLoading',
      'attendanceTotal',
      'attendanceDisplayInfo',
      'attendanceLimit'
    ].forEach(function(id) {

      const element = $(id);

      if (element) {
        element.style.display =
          visible ? '' : 'none';
      }
    });
  }

  if (visible) {
    updateTodayAttendanceLayout();
  }
}


function hideDashboardTodayAttendance() {
  setTodayAttendanceVisibility(false);
}


/* ============================================================
   6B. SEMBUNYIKAN AREA PUBLIK SETELAH LOGIN
============================================================ */

function findCommonPublicSummaryBlock() {

  const ids = [
    'countTotal',
    'countPresent',
    'countLate',
    'countAlready'
  ];

  const first = ids
    .map(function(id) { return $(id); })
    .find(Boolean);

  if (!first) return null;

  let node = first;

  while (node && node !== document.body) {

    let containsAll = true;

    for (const id of ids) {
      if (!node.querySelector || !node.querySelector('#' + id)) {
        containsAll = false;
        break;
      }
    }

    if (containsAll) return node;

    node = node.parentElement;
  }

  return null;
}


function setPublicScannerAreaVisibility(visible) {

  const ids = [
    'scannerCard',
    'result'
  ];

  ids.forEach(function(id) {
    const element = $(id);
    if (element) {
      if (visible) {
        element.style.display = id === 'scannerCard' ? 'block' : 'none';
      } else {
        element.style.display = 'none';
      }
    }
  });

  const summaryBlock = findCommonPublicSummaryBlock();

  if (summaryBlock) {
    summaryBlock.style.display = visible ? '' : 'none';
  }

  if (!visible) {
    clearTimeout(autoScanTimer);
    processingScan = false;

    if (html5QrCode || scannerRunning) {
      stopScanner().catch(function(error) {
        console.warn('Stop scanner saat login:', error);
      });
    }
  }
}


/* ============================================================
   7. LAYOUT ABSENSI PUBLIK
============================================================ */

function updateTodayAttendanceLayout() {

  const desktop = $('attendanceDesktop');
  const mobile = $('attendanceMobile');

  const isMobile =
    window.matchMedia
      ? window.matchMedia('(max-width: 700px)').matches
      : window.innerWidth <= 700;

  const dashboard = $('dashboard');
  const dashboardVisible =
    dashboard &&
    dashboard.style.display !== 'none';

  if (dashboardVisible) {
    if (desktop) desktop.style.display = 'none';
    if (mobile) mobile.style.display = 'none';
    return;
  }

  if (desktop) {
    desktop.style.display =
      isMobile ? 'none' : 'block';
  }

  if (mobile) {
    mobile.style.display =
      isMobile ? 'block' : 'none';
  }
}


/* ============================================================
   8. CEK SESSION
============================================================ */


async function checkSession() {

  loadStoredSession();


  if (!currentToken) {

    hideDashboard();

    return false;
  }


  try {

    const result =
      await apiGet({

        action:
          'checkSession',

        token:
          currentToken

      });


    if (
      result &&
      result.success &&
      result.status !==
        'SESSION_EXPIRED'
    ) {

      if (result.user) {

        currentUser =
          result.user;


        try {

          localStorage.setItem(
            USER_KEY,
            JSON.stringify(
              currentUser
            )
          );

        } catch (error) {}
      }


      showDashboard();

      return true;
    }


    clearSession();

    hideDashboard();

    return false;


  } catch (error) {

    console.warn(
      'Check session gagal:',
      error
    );


    /*
     * Jika internet sementara bermasalah,
     * jangan langsung menghapus session.
     */

    if (currentUser) {

      showDashboard();

      return true;
    }


    hideDashboard();

    return false;
  }
}


/* ============================================================
   7. LOGIN MODAL
============================================================ */

function openLoginModal() {

  const modal =
    $('loginModal');


  if (!modal) {
    return;
  }


  modal.style.display =
    'flex';


  const message =
    $('loginMessage');


  if (message) {

    message.textContent =
      '';

    message.className =
      'login-message';
  }


  const username =
    $('loginUsername');


  if (username) {

    setTimeout(
      function () {

        username.focus();

      },
      100
    );
  }
}


function closeLoginModal() {

  const modal =
    $('loginModal');


  if (modal) {

    modal.style.display =
      'none';
  }
}


function showLoginMessage(
  text,
  type = 'error'
) {

  const message =
    $('loginMessage');


  if (!message) {
    return;
  }


  message.textContent =
    text;


  message.className =
    'login-message ' +
    type;
}


/* ============================================================
   8. LOGIN
============================================================ */

/*
 * LOGIN SEDERHANA
 *
 * Tidak ada:
 * - SHA-256
 * - crypto.subtle
 * - password hash
 *
 * Yang dikirim:
 * username
 * password
 */

async function loginUser() {

  const usernameInput =
    $('loginUsername');

  const passwordInput =
    $('loginPassword');


  if (
    !usernameInput ||
    !passwordInput
  ) {

    console.error(
      'Elemen login tidak ditemukan.'
    );

    return;
  }


  const username =
    usernameInput.value.trim();


  const password =
    passwordInput.value.trim();


  if (!username) {

    showLoginMessage(
      '⚠️ Username wajib diisi.',
      'error'
    );


    usernameInput.focus();

    return;
  }


  if (!password) {

    showLoginMessage(
      '⚠️ Password wajib diisi.',
      'error'
    );


    passwordInput.focus();

    return;
  }


  showLoginMessage(
    '⏳ Memeriksa username dan password...',
    'loading'
  );


  /*
   * ========================================================
   * PENTING
   *
   * Password dikirim LANGSUNG.
   *
   * Code.gs harus membaca:
   *
   * e.parameter.username
   * e.parameter.password
   *
   * dan mencocokkannya dengan kolom PASSWORD
   * pada Sheet USER.
   * ========================================================
   */

  try {

    const result =
      await apiGet({

        action:
          'login',

        username:
          username,

        password:
          password

      });


    console.log(
      'LOGIN RESPONSE:',
      result
    );


    if (!result) {

      showLoginMessage(
        '❌ Server tidak memberikan response.',
        'error'
      );

      return;
    }


    /*
     * LOGIN BERHASIL
     */

    if (
      result.success === true &&
      (
        result.status === 'LOGIN_SUCCESS' ||
        result.status === 'SUCCESS'
      )
    ) {

      if (
        !result.token
      ) {

        showLoginMessage(
          '❌ Login berhasil tetapi token sesi tidak diterima server.',
          'error'
        );

        return;
      }


      saveSession(
        result.token,
        result.user || {
          username:
            username
        }
      );


      passwordInput.value =
        '';


      showLoginMessage(
        '✅ Login berhasil.',
        'success'
      );


      setTimeout(
        function () {

          closeLoginModal();

          showDashboard();

        },
        300
      );


      return;
    }


    /*
     * LOGIN GAGAL
     */

    const serverMessage =
      result.message ||
      'Username atau password salah.';


    showLoginMessage(
      '❌ ' +
      serverMessage,
      'error'
    );


  } catch (error) {

    console.error(
      'LOGIN ERROR:',
      error
    );


    showLoginMessage(
      '🔴 ' +
      (
        error.message ||
        'Tidak dapat terhubung ke server.'
      ),
      'error'
    );
  }
}


/* ============================================================
   9. LOGOUT
============================================================ */

async function logoutUser() {

  const token =
    currentToken;


  try {

    if (token) {

      await apiGet({

        action:
          'logout',

        token:
          token

      });
    }


  } catch (error) {

    console.warn(
      'Logout server gagal:',
      error
    );


  } finally {

    clearSession();

    hideDashboard();


    currentTeacherSchedule =
      null;


    teacherSchedulesData =
      [];


    const schedules =
      $('teacherSchedules');


    if (schedules) {

      schedules.innerHTML =
        '';
    }


    const panel =
      $('teacherAttendancePanel');


    if (panel) {

      panel.style.display =
        'none';
    }


    openLoginModal();
  }
}


/* ============================================================
   10. SESSION EXPIRED
============================================================ */

function handleSessionExpired() {

  clearSession();

  hideDashboard();


  openLoginModal();


  showLoginMessage(
    '⚠️ Sesi login telah berakhir. Silakan login kembali.',
    'error'
  );
}


/* ============================================================
   10B. FOOTER APLIKASI
============================================================ */

const APP_NAME = 'ABSENSI KARTU PELAJAR';
const APP_VERSION = 'V13.0';
const APP_AUTHOR = 'SMP & SMA Baitul Ulum Boarding School';
const APP_YEAR = '2026';


function injectAppFooter() {

  if ($('appFooter')) {
    return;
  }

  const footer = document.createElement('footer');
  footer.id = 'appFooter';
  footer.className = 'app-footer';

  footer.innerHTML = `
    <div class="app-footer-name">${escapeHTML(APP_NAME)}</div>
    <div class="app-footer-meta">
      Versi ${escapeHTML(APP_VERSION)} &nbsp;•&nbsp;
      Dibuat oleh ${escapeHTML(APP_AUTHOR)} &nbsp;•&nbsp;
      © ${escapeHTML(APP_YEAR)}
    </div>
  `;

  document.body.appendChild(footer);
}


/* ============================================================
   11. DASHBOARD
============================================================ */

function showDashboard() {

  const dashboard =
    $('dashboard');


  if (!dashboard) {

    console.warn(
      'Element #dashboard tidak ditemukan.'
    );

    return;
  }


  dashboard.style.display =
    'block';


  hideDashboardTodayAttendance();
  setPublicScannerAreaVisibility(false);


  const title =
    $('dashboardTitle');


  const user =
    $('dashboardUser');


  const role =
    String(
      currentUser?.role ||
      ''
    ).toUpperCase();


  const nama =
    currentUser?.nama ||
    currentUser?.username ||
    'Pengguna';


  if (title) {

    title.textContent =
      role === 'ADMIN'
        ? 'Dashboard Administrator'
        : 'Dashboard Guru';
  }


  if (user) {

    user.textContent =
      nama +
      ' • ' +
      (
        role === 'ADMIN'
          ? 'ADMINISTRATOR'
          : 'GURU'
      );
  }


  injectAdminRecapPanel();
  setAdminRecapVisibility(role === 'ADMIN');

  injectTeacherRecapPanel();
  setTeacherRecapVisibility(role === 'GURU');
  resetTeacherRecapView();
  hideTeacherRecapDownload();
  hideAdminRecapDownload();

  loadTeacherSchedules();

  if (role === 'GURU') {
    loadTeacherRecapOptions();
  }
}


function hideDashboard() {

  const dashboard =
    $('dashboard');


  if (dashboard) {

    dashboard.style.display =
      'none';
  }


  const panel =
    $('teacherAttendancePanel');


  if (panel) {

    panel.style.display =
      'none';
  }


  setTodayAttendanceVisibility(true);
  setPublicScannerAreaVisibility(true);
  resetTeacherRecapView();
  hideTeacherRecapDownload();
  hideAdminRecapDownload();
  teacherAttendanceEditing = false;
}


/* ============================================================
   12. JADWAL GURU
============================================================ */

async function loadTeacherSchedules() {

  if (!currentToken) {
    return;
  }


  const container =
    $('teacherSchedules');


  if (!container) {
    return;
  }


  container.innerHTML =
    '<div class="app-loading">⏳ Memuat jadwal hari ini...</div>';


  try {

    const result =
      await apiGet({

        action:
          'teacherSchedules',

        token:
          currentToken

      });


    if (
      result?.status ===
      'SESSION_EXPIRED'
    ) {

      handleSessionExpired();

      return;
    }


    if (
      !result ||
      !result.success
    ) {

      container.innerHTML =
        '<div class="app-error">❌ ' +
        escapeHTML(
          result?.message ||
          'Jadwal tidak dapat dimuat.'
        ) +
        '</div>';

      return;
    }


    teacherSchedulesData =
      Array.isArray(
        result.data
      )
        ? result.data
        : [];


    renderTeacherSchedules(
      teacherSchedulesData
    );


  } catch (error) {

    console.error(
      'LOAD SCHEDULE ERROR:',
      error
    );


    container.innerHTML =
      '<div class="app-error">🔴 ' +
      escapeHTML(
        error.message ||
        'Gagal mengambil jadwal dari server.'
      ) +
      '</div>';
  }
}


function renderTeacherSchedules(
  schedules
) {

  const container =
    $('teacherSchedules');


  if (!container) {
    return;
  }


  if (!schedules.length) {

    container.innerHTML =
      '<div class="app-empty">📅 Tidak ada jadwal aktif hari ini.</div>';

    return;
  }


  container.innerHTML =
    schedules
      .map(
        function (
          schedule,
          index
        ) {

          const selected =
            currentTeacherSchedule &&
            String(
              currentTeacherSchedule.jadwalId
            ) ===
            String(
              schedule.jadwalId
            );


          return `

            <button
              type="button"
              class="teacher-schedule-card ${selected ? 'selected' : ''}"
              data-schedule-id="${escapeHTML(schedule.jadwalId)}"
            >

              <div class="schedule-number">
                ${index + 1}
              </div>

              <div class="schedule-main">

                <div class="schedule-time">
                  🕐
                  ${escapeHTML(schedule.jamMulai || '-')}
                  -
                  ${escapeHTML(schedule.jamSelesai || '-')}
                </div>

                <div class="schedule-mapel">
                  ${escapeHTML(schedule.mapel || '-')}
                </div>

                <div class="schedule-class">
                  🎓
                  ${escapeHTML(schedule.kelas || '-')}
                </div>

              </div>

              <div class="schedule-ke">
                Jam Ke-
                ${escapeHTML(schedule.jamKe || '-')}
              </div>

            </button>

          `;
        }
      )
      .join('');
}


/* ============================================================
   13. PILIH JADWAL
============================================================ */

async function selectTeacherSchedule(
  jadwalId
) {

  const schedule =
    teacherSchedulesData.find(
      function (item) {

        return String(
          item.jadwalId
        ) ===
        String(
          jadwalId
        );
      }
    );


  if (!schedule) {
    return;
  }


  currentTeacherSchedule =
    schedule;


  renderTeacherSchedules(
    teacherSchedulesData
  );


  const panel =
    $('teacherAttendancePanel');


  if (panel) {

    panel.style.display =
      'block';
  }


  setText(
    'teacherScheduleInfo',
    (
      schedule.jamMulai || '-'
    ) +
    ' - ' +
    (
      schedule.jamSelesai || '-'
    ) +
    ' • Jam Ke-' +
    (
      schedule.jamKe || '-'
    )
  );


  setText(
    'teacherClassTitle',
    schedule.kelas || '-'
  );


  setText(
    'teacherMapelTitle',
    schedule.mapel || '-'
  );


  await loadTeacherAttendance(
    schedule.jadwalId
  );
}


/* ============================================================
   14. ABSENSI KELAS GURU
============================================================ */

async function loadTeacherAttendance(
  jadwalId
) {

  if (!currentToken) {
    return;
  }


  const container =
    $('teacherStudentList');


  if (!container) {
    return;
  }


  container.innerHTML =
    '<div class="app-loading">⏳ Memuat data siswa...</div>';


  try {

    const result =
      await apiGet({

        action:
          'teacherAttendance',

        token:
          currentToken,

        jadwalId:
          jadwalId

      });


    if (
      result?.status ===
      'SESSION_EXPIRED'
    ) {

      handleSessionExpired();

      return;
    }


    if (
      !result ||
      !result.success
    ) {

      container.innerHTML =
        '<div class="app-error">❌ ' +
        escapeHTML(
          result?.message ||
          'Data absensi tidak dapat dimuat.'
        ) +
        '</div>';

      return;
    }


    renderTeacherStats(
      result
    );


    renderTeacherStudentList(
      result.data || []
    );


  } catch (error) {

    console.error(
      'TEACHER ATTENDANCE ERROR:',
      error
    );


    container.innerHTML =
      '<div class="app-error">🔴 ' +
      escapeHTML(
        error.message ||
        'Gagal mengambil absensi kelas.'
      ) +
      '</div>';
  }
}


/* ============================================================
   15. STATISTIK GURU
============================================================ */

function renderTeacherStats(
  result
) {

  const stats =
    $('teacherStats');


  if (!stats) {
    return;
  }


  stats.innerHTML = `

    <div class="teacher-stat">
      <span>👥 Total</span>
      <strong>${result.total || 0}</strong>
    </div>

    <div class="teacher-stat hadir">
      <span>🟢 Hadir</span>
      <strong>${result.hadir || 0}</strong>
    </div>

    <div class="teacher-stat terlambat">
      <span>🟡 Terlambat</span>
      <strong>${result.terlambat || 0}</strong>
    </div>

    <div class="teacher-stat izin">
      <span>🔵 Izin</span>
      <strong>${result.izin || 0}</strong>
    </div>

    <div class="teacher-stat sakit">
      <span>🟣 Sakit</span>
      <strong>${result.sakit || 0}</strong>
    </div>

    <div class="teacher-stat alpa">
      <span>🔴 Alpa</span>
      <strong>${result.alpa || 0}</strong>
    </div>

    <div class="teacher-stat belum">
      <span>⚪ Belum</span>
      <strong>${result.belum || 0}</strong>
    </div>

  `;
}


/* ============================================================
   16. DAFTAR SISWA GURU
============================================================ */

function renderTeacherStudentList(
  students
) {

  const container =
    $('teacherStudentList');


  if (!container) {
    return;
  }


  if (!students.length) {

    container.innerHTML =
      '<div class="app-empty">📭 Belum ada data siswa pada kelas ini.</div>';

    return;
  }


  container.innerHTML = `

    <div class="teacher-attendance-table-wrapper">

      <table class="teacher-attendance-table">

        <thead>

          <tr>
            <th>No</th>
            <th>Siswa</th>
            <th>Status</th>
            <th>Jam</th>
            <th>Catatan</th>
            <th>Aksi</th>
          </tr>

        </thead>

        <tbody>

          ${
            students
              .map(
                function (
                  student,
                  index
                ) {

                  const status =
                    student.status ||
                    'BELUM ABSEN';

                  const normalizedStatus =
                    String(status).trim().toUpperCase();

                  const selectedStatus =
                    normalizedStatus === 'BELUM ABSEN'
                      ? '__BELUM__'
                      : status;


                  return `

                    <tr
                      data-student-id="${escapeHTML(student.studentId)}"
                      data-original-status="${escapeHTML(status)}"
                      data-original-note="${escapeHTML(student.catatan || '')}"
                    >

                      <td class="teacher-rank">
                        ${index + 1}
                      </td>

                      <td>

                        <div class="teacher-student-name">
                          ${escapeHTML(student.nama || '-')}
                        </div>

                        <div class="teacher-student-id">
                          ${escapeHTML(student.studentId || '-')}
                        </div>

                      </td>

                      <td>

                        <select
                          class="attendance-status-select"
                          data-field="status"
                        >

                          <option value="__BELUM__"
                            ${selectedStatus === '__BELUM__' ? 'selected' : ''}>
                            ⚪ Belum Absen
                          </option>

                          <option value="Hadir"
                            ${selectedStatus === 'Hadir' ? 'selected' : ''}>
                            🟢 Hadir
                          </option>

                          <option value="Terlambat"
                            ${selectedStatus === 'Terlambat' ? 'selected' : ''}>
                            🟡 Terlambat
                          </option>

                          <option value="Izin"
                            ${selectedStatus === 'Izin' ? 'selected' : ''}>
                            🔵 Izin
                          </option>

                          <option value="Sakit"
                            ${selectedStatus === 'Sakit' ? 'selected' : ''}>
                            🟣 Sakit
                          </option>

                          <option value="Alpa"
                            ${selectedStatus === 'Alpa' ? 'selected' : ''}>
                            🔴 Alpa
                          </option>

                          <option value="Kegiatan"
                            ${selectedStatus === 'Kegiatan' ? 'selected' : ''}>
                            🟠 Kegiatan
                          </option>

                        </select>

                      </td>

                      <td>
                        ${escapeHTML(student.jam || '-')}
                      </td>

                      <td>

                        <input
                          type="text"
                          class="attendance-note-input"
                          data-field="catatan"
                          value="${escapeHTML(student.catatan || '')}"
                          placeholder="Catatan..."
                        >

                      </td>

                      <td>

                        <button
                          type="button"
                          class="save-attendance-button"
                          data-action="save-attendance"
                        >
                          💾 Simpan
                        </button>

                      </td>

                    </tr>

                  `;

                }
              )
              .join('')
          }

        </tbody>

      </table>

    </div>

    <div class="teacher-save-all-wrap">
      <button
        type="button"
        class="teacher-save-all-button"
        data-action="save-all-attendance"
      >
        💾 Simpan Semua
      </button>
      <span class="teacher-save-all-hint">
        Hanya siswa yang status/catatannya berubah yang akan disimpan.
      </span>
    </div>

  `;
}


/* ============================================================
   17. SIMPAN ABSENSI GURU
============================================================ */

async function saveTeacherAttendance(
  row
) {

  if (
    !row ||
    !currentTeacherSchedule ||
    !currentToken
  ) {
    return;
  }


  const studentId =
    row.dataset.studentId;


  const statusSelect =
    row.querySelector(
      '[data-field="status"]'
    );


  const noteInput =
    row.querySelector(
      '[data-field="catatan"]'
    );


  const saveButton =
    row.querySelector(
      '[data-action="save-attendance"]'
    );


  if (
    !studentId ||
    !statusSelect
  ) {
    return;
  }


  const status =
    statusSelect.value;

  if (status === '__BELUM__') {
    alert('⚠️ Silakan pilih status absensi terlebih dahulu.');
    return;
  }


  const catatan =
    noteInput
      ? noteInput.value.trim()
      : '';


  if (saveButton) {

    saveButton.disabled =
      true;

    saveButton.textContent =
      '⏳ Menyimpan...';
  }


  try {

    const result =
      await apiGet({

        action:
          'updateAttendance',

        token:
          currentToken,

        jadwalId:
          currentTeacherSchedule.jadwalId,

        studentId:
          studentId,

        status:
          status,

        catatan:
          catatan

      });


    if (
      result?.status ===
      'SESSION_EXPIRED'
    ) {

      handleSessionExpired();

      return;
    }


    if (
      result &&
      result.success &&
      result.status ===
        'UPDATED'
    ) {

      if (saveButton) {

        saveButton.textContent =
          '✅ Tersimpan';

        saveButton.disabled = true;
      }

      row.dataset.originalStatus = status;
      row.dataset.originalNote = catatan;
      row.classList.remove('teacher-row-dirty');
      teacherAttendanceEditing = false;

      updateTeacherRowSavedState(row, result);

      return;
    }


    throw new Error(
      result?.message ||
      'Absensi gagal diperbarui.'
    );


  } catch (error) {

    console.error(
      'UPDATE ATTENDANCE ERROR:',
      error
    );


    alert(
      '❌ Gagal menyimpan absensi.\n\n' +
      (
        error.message ||
        'Terjadi kesalahan server.'
      )
    );


    if (saveButton) {

      saveButton.disabled =
        false;

      saveButton.textContent =
        '💾 Simpan';
    }
  }
}


/* ============================================================
   18. EVENT DAFTAR SISWA
============================================================ */

function updateTeacherRowSavedState(row, result) {

  if (!row) return;

  const saveButton = row.querySelector('[data-action="save-attendance"]');
  const statusSelect = row.querySelector('[data-field="status"]');
  const noteInput = row.querySelector('[data-field="catatan"]');

  if (statusSelect && result?.attendance?.status) {
    statusSelect.value = result.attendance.status;
  }

  if (noteInput && result?.attendance?.catatan !== undefined) {
    noteInput.value = result.attendance.catatan || '';
  }

  if (saveButton) {
    saveButton.textContent = '✅ Tersimpan';
    saveButton.disabled = true;
  }
}


function getTeacherAttendanceRows() {
  const container = $('teacherStudentList');
  if (!container) return [];
  return Array.from(container.querySelectorAll('tr[data-student-id]'));
}


function getTeacherRowPayload(row) {
  const statusSelect = row.querySelector('[data-field="status"]');
  const noteInput = row.querySelector('[data-field="catatan"]');

  const studentId = row.dataset.studentId || '';
  const status = statusSelect ? statusSelect.value : '__BELUM__';
  const catatan = noteInput ? noteInput.value.trim() : '';
  const originalStatus = row.dataset.originalStatus || 'BELUM ABSEN';
  const originalNote = row.dataset.originalNote || '';

  if (!studentId || status === '__BELUM__') return null;

  const normalizedOriginal = String(originalStatus).trim().toUpperCase();
  const changed =
    String(status).trim().toUpperCase() !== normalizedOriginal ||
    catatan !== originalNote;

  if (!changed) return null;

  return {
    row: row,
    studentId: studentId,
    status: status,
    catatan: catatan
  };
}


async function saveAllTeacherAttendance() {

  if (teacherAttendanceSaveAllRunning) return;

  if (!currentToken || !currentTeacherSchedule) {
    alert('⚠️ Sesi atau jadwal Guru belum tersedia.');
    return;
  }

  const rows = getTeacherAttendanceRows();
  const pending = rows
    .map(getTeacherRowPayload)
    .filter(Boolean);

  if (!pending.length) {
    alert('ℹ️ Tidak ada perubahan yang perlu disimpan.');
    return;
  }

  const confirmed = window.confirm(
    'Simpan perubahan absensi untuk ' + pending.length + ' siswa?\n\n' +
    'Hanya baris yang status atau catatannya berubah yang akan diproses.'
  );

  if (!confirmed) return;

  const button = document.querySelector('[data-action="save-all-attendance"]');
  teacherAttendanceSaveAllRunning = true;
  teacherAttendanceEditing = false;

  if (button) {
    button.disabled = true;
    button.textContent = '⏳ Menyimpan 0/' + pending.length + '...';
  }

  let saved = 0;
  let failed = 0;

  try {

    for (const item of pending) {

      try {

        const result = await apiGet({
          action: 'updateAttendance',
          token: currentToken,
          jadwalId: currentTeacherSchedule.jadwalId,
          studentId: item.studentId,
          status: item.status,
          catatan: item.catatan
        });

        if (result?.status === 'SESSION_EXPIRED') {
          handleSessionExpired();
          return;
        }

        if (!result || !result.success || result.status !== 'UPDATED') {
          throw new Error(result?.message || 'Gagal menyimpan.');
        }

        updateTeacherRowSavedState(item.row, result);
        item.row.dataset.originalStatus = item.status;
        item.row.dataset.originalNote = item.catatan;
        item.row.classList.remove('teacher-row-dirty');
        saved++;

      } catch (itemError) {
        failed++;
        console.error('SAVE ALL ITEM ERROR:', item.studentId, itemError);
      }

      if (button) {
        button.textContent = '⏳ Menyimpan ' + (saved + failed) + '/' + pending.length + '...';
      }
    }

    if (failed === 0) {
      if (button) button.textContent = '✅ Semua Tersimpan';
      alert('✅ Semua perubahan berhasil disimpan (' + saved + ' siswa).');
    } else {
      if (button) button.textContent = '⚠️ ' + saved + ' tersimpan, ' + failed + ' gagal';
      alert(
        '⚠️ Proses selesai.\n\n' +
        'Berhasil: ' + saved + '\n' +
        'Gagal: ' + failed + '\n\n' +
        'Baris yang gagal tetap dapat disimpan kembali secara individual.'
      );
    }

  } finally {

    teacherAttendanceSaveAllRunning = false;

    setTimeout(function() {
      const currentButton = document.querySelector('[data-action="save-all-attendance"]');
      if (currentButton) {
        currentButton.disabled = false;
        currentButton.textContent = '💾 Simpan Semua';
      }
    }, 1200);
  }
}


function bindTeacherStudentEvents() {

  const container =
    $('teacherStudentList');


  if (!container) {
    return;
  }


  container.addEventListener(
    'click',
    function (event) {

      const saveAllButton =
        event.target.closest('[data-action="save-all-attendance"]');

      if (saveAllButton) {
        saveAllTeacherAttendance();
        return;
      }

      const button =
        event.target.closest(
          '[data-action="save-attendance"]'
        );


      if (!button) {
        return;
      }


      const row =
        button.closest('tr');


      if (!row) {
        return;
      }


      saveTeacherAttendance(
        row
      );
    }
  );

  container.addEventListener('input', function(event) {
    if (event.target.matches('[data-field="catatan"]')) {
      teacherAttendanceEditing = true;
      const row = event.target.closest('tr[data-student-id]');
      if (row) row.classList.add('teacher-row-dirty');
    }
  });

  container.addEventListener('change', function(event) {
    if (event.target.matches('[data-field="status"]')) {
      teacherAttendanceEditing = true;
      const row = event.target.closest('tr[data-student-id]');
      if (row) row.classList.add('teacher-row-dirty');
    }
  });
}


/* ============================================================
   19. SUMMARY
============================================================ */

async function loadTodaySummary() {

  try {

    const result =
      await apiGet({

        action:
          'summary'

      });


    if (
      !result ||
      !result.success
    ) {
      return;
    }


    setText(
      'countTotal',
      result.totalSiswa ??
      result.total ??
      0
    );


    setText(
      'countPresent',
      result.hadir ?? 0
    );


    setText(
      'countLate',
      result.terlambat ?? 0
    );


    setText(
      'countAlready',
      result.sudahAbsen ?? 0
    );


  } catch (error) {

    console.warn(
      'Summary gagal:',
      error
    );
  }
}


/* ============================================================
   20. ABSENSI HARI INI
============================================================ */

async function loadTodayAttendance() {

  const loading =
    $('attendanceLoading');


  const empty =
    $('attendanceEmpty');


  if (loading) {

    loading.style.display =
      'flex';
  }


  if (empty) {

    empty.style.display =
      'none';
  }


  try {

    let result;


    try {

      result =
        await apiGet({

          action:
            'todayAttendance'

        });


    } catch (error) {

      result =
        await apiGet({

          action:
            'todayAttendanceList'

        });
    }


    if (
      !result ||
      !result.success
    ) {

      throw new Error(
        result?.message ||
        'Data absensi tidak tersedia.'
      );
    }


    todayAttendanceData =
      Array.isArray(
        result.data
      )
        ? result.data
        : [];


    renderTodayAttendance();


  } catch (error) {

    console.warn(
      'TODAY ATTENDANCE ERROR:',
      error
    );


    todayAttendanceData =
      [];


    renderTodayAttendance();


  } finally {

    if (loading) {

      loading.style.display =
        'none';
    }
  }
}


/* ============================================================
   21. RENDER ABSENSI HARI INI
============================================================ */

function renderTodayAttendance() {

  const desktop =
    $('attendanceDesktop');


  const mobile =
    $('attendanceMobile');


  const empty =
    $('attendanceEmpty');


  const tbody =
    $('attendanceTableBody');


  const cardList =
    $('attendanceCardList');


  const total =
    todayAttendanceData.length;


  setText(
    'attendanceTotal',
    total
  );


  if (total === 0) {

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
    }


    setText(
      'attendanceDisplayInfo',
      'Belum ada siswa yang melakukan absensi hari ini.'
    );


    updateTodayAttendanceLayout();

    return;
  }


  if (empty) {

    empty.style.display =
      'none';
  }


  const limitSelect =
    $('attendanceLimit');


  const limit =
    limitSelect
      ? limitSelect.value
      : '10';


  let visibleData;


  if (limit === 'all') {

    visibleData =
      todayAttendanceData.slice();

  } else {

    const number =
      parseInt(
        limit,
        10
      );


    visibleData =
      todayAttendanceData.slice(
        0,
        isNaN(number)
          ? 10
          : number
      );
  }


  if (desktop) {

    desktop.style.display =
      'block';
  }


  if (tbody) {

    tbody.innerHTML =
      visibleData
        .map(
          function (
            item,
            index
          ) {

            const rank =
              item.rank ||
              item.urutan ||
              index + 1;


            return `

              <tr>

                <td>
                  ${getRankLabel(rank)}
                </td>

                <td>
                  <strong>
                    ${escapeHTML(item.nama || '-')}
                  </strong>
                </td>

                <td>
                  ${escapeHTML(item.kelas || '-')}
                </td>

                <td>
                  ${escapeHTML(item.jam || '-')}
                </td>

                <td>
                  ${getStatusBadge(item.status)}
                </td>

              </tr>

            `;
          }
        )
        .join('');
  }


  if (mobile) {

    mobile.style.display =
      'block';
  }


  if (cardList) {

    cardList.innerHTML =
      visibleData
        .map(
          function (
            item,
            index
          ) {

            const rank =
              item.rank ||
              item.urutan ||
              index + 1;


            return `

              <div class="attendance-card">

                <div class="attendance-card-rank">
                  ${getRankLabel(rank)}
                </div>

                <div class="attendance-card-content">

                  <div class="attendance-card-name">
                    ${escapeHTML(item.nama || '-')}
                  </div>

                  <div class="attendance-card-class">
                    ${escapeHTML(item.kelas || '-')}
                  </div>

                  <div class="attendance-card-bottom">

                    <span>
                      🕐
                      ${escapeHTML(item.jam || '-')}
                    </span>

                    <span>
                      ${getStatusBadge(item.status)}
                    </span>

                  </div>

                </div>

              </div>

            `;
          }
        )
        .join('');
  }


  setText(
    'attendanceDisplayInfo',

    limit === 'all'
      ? `Menampilkan semua ${total} siswa yang telah melakukan absensi.`
      : `Menampilkan ${visibleData.length} dari ${total} siswa yang telah melakukan absensi.`
  );

  updateTodayAttendanceLayout();
}


/* ============================================================
   22. RANK
============================================================ */

function getRankLabel(
  rank
) {

  const number =
    parseInt(
      rank,
      10
    );


  if (number === 1) {
    return '🥇';
  }


  if (number === 2) {
    return '🥈';
  }


  if (number === 3) {
    return '🥉';
  }


  return String(
    number || '-'
  );
}


/* ============================================================
   23. STATUS BADGE
============================================================ */

function getStatusBadge(
  status
) {

  const value =
    String(
      status || ''
    ).trim();


  let icon =
    '⚪';


  let className =
    'status-default';


  switch (
    value.toLowerCase()
  ) {

    case 'hadir':

      icon = '🟢';

      className =
        'status-hadir';

      break;


    case 'terlambat':

      icon = '🟡';

      className =
        'status-terlambat';

      break;


    case 'izin':

      icon = '🔵';

      className =
        'status-izin';

      break;


    case 'sakit':

      icon = '🟣';

      className =
        'status-sakit';

      break;


    case 'alpa':

      icon = '🔴';

      className =
        'status-alpa';

      break;


    case 'kegiatan':

      icon = '🟠';

      className =
        'status-kegiatan';

      break;


    case 'belum':
    case 'belum absen':

      icon = '⚪';

      className =
        'status-belum';

      break;
  }


  return `
    <span class="attendance-status-badge ${className}">
      ${icon} ${escapeHTML(value || 'Belum')}
    </span>
  `;
}


/* ============================================================
   24. TAMPILKAN SEMUA
============================================================ */

function showAllAttendance() {

  const select =
    $('attendanceLimit');


  if (select) {

    select.value =
      'all';
  }


  renderTodayAttendance();
}


window.showAllAttendance =
  showAllAttendance;


/* ============================================================
   25. TANGGAL & JAM
============================================================ */

function updateDateTime() {

  const now =
    new Date();


  const dateText =
    now.toLocaleDateString(
      'id-ID',
      {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }
    );


  const timeText =
    now.toLocaleTimeString(
      'id-ID',
      {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }
    );


  setText(
    'currentDate',
    dateText
  );


  setText(
    'currentTime',
    timeText
  );


  if (
    exists('attendanceDate')
  ) {

    setText(
      'attendanceDate',
      dateText
    );
  }
}


/* ============================================================
   26. SPEECH
============================================================ */

function prepareSpeech() {

  if (
    'speechSynthesis' in window
  ) {

    window.speechSynthesis.cancel();
  }
}


function speak(text) {

  if (
    !('speechSynthesis' in window)
  ) {
    return;
  }


  if (!text) {
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


  } catch (error) {

    console.warn(
      'Speech error:',
      error
    );
  }
}


/* ============================================================
   27. STATUS SCANNER
============================================================ */

function setStatus(
  text
) {

  const status =
    $('status');


  if (status) {

    status.textContent =
      text;
  }
}


/* ============================================================
   28. START SCANNER
============================================================ */

async function startScanner() {

  console.log(
    '=== START SCANNER ==='
  );


  processingScan =
    false;


  clearTimeout(
    autoScanTimer
  );


  hide('result');


  show(
    'scannerCard',
    'block'
  );


  setStatus(
    '📷 Memeriksa kamera...'
  );


  if (
    typeof Html5Qrcode ===
    'undefined'
  ) {

    setStatus(
      '🔴 Library scanner belum tersedia.'
    );


    console.error(
      'Html5Qrcode tidak ditemukan.'
    );


    return;
  }


  try {

    if (
      html5QrCode &&
      scannerRunning
    ) {

      await stopScanner();
    }


    await getCameraAndStart();


  } catch (error) {

    console.error(
      'START SCANNER ERROR:',
      error
    );


    setStatus(
      '🔴 Kamera tidak dapat digunakan. Pastikan izin kamera diberikan.'
    );
  }
}


/* ============================================================
   29. DETEKSI KAMERA
============================================================ */

async function getCameraAndStart() {

  setStatus(
    '📷 Meminta izin kamera...'
  );


  let cameras;


  try {

    cameras =
      await Html5Qrcode.getCameras();


  } catch (error) {

    console.error(
      'GET CAMERAS ERROR:',
      error
    );


    throw new Error(
      'Kamera tidak dapat diakses.'
    );
  }


  if (
    !cameras ||
    cameras.length === 0
  ) {

    throw new Error(
      'Tidak ada kamera ditemukan.'
    );
  }


  let selectedCamera =
    cameras.find(
      function (camera) {

        const label =
          String(
            camera.label || ''
          ).toLowerCase();


        return (
          label.includes('back') ||
          label.includes('rear') ||
          label.includes('environment') ||
          label.includes('belakang')
        );
      }
    );


  if (!selectedCamera) {

    selectedCamera =
      cameras[0];
  }


  console.log(
    'Camera:',
    selectedCamera.label
  );


  await startCamera(
    selectedCamera.id
  );
}


/* ============================================================
   30. START CAMERA
============================================================ */

async function startCamera(
  cameraId
) {

  const reader =
    $('reader');


  if (!reader) {

    throw new Error(
      'Element reader tidak ditemukan.'
    );
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
      function (
        width,
        height
      ) {

        const minSize =
          Math.min(
            width,
            height
          );


        const boxSize =
          Math.floor(
            minSize * 0.70
          );


        return {

          width:
            Math.min(
              boxSize,
              300
            ),

          height:
            Math.min(
              boxSize,
              300
            )
        };
      },


    aspectRatio: 1.0,


    disableFlip: false
  };


  try {

    await html5QrCode.start(

      cameraId,

      config,

      onScanSuccess,

      onScanFailure

    );


    scannerRunning =
      true;


    setStatus(
      '🟢 SIAP SCAN KARTU'
    );


  } catch (error) {

    scannerRunning =
      false;


    console.error(
      'CAMERA START ERROR:',
      error
    );


    throw error;
  }
}


/* ============================================================
   31. SCAN FAILURE
============================================================ */

function onScanFailure(
  errorMessage
) {

  /*
   * Sengaja kosong.
   */
}


/* ============================================================
   32. SCAN SUCCESS
============================================================ */

async function onScanSuccess(
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


  if (!studentId) {

    processingScan =
      false;

    return;
  }


  console.log(
    'QR TERBACA:',
    studentId
  );


  try {

    await stopScanner();

  } catch (error) {

    console.warn(
      'Stop scanner setelah scan:',
      error
    );
  }


  show(
    'result',
    'block'
  );


  hide(
    'scannerCard'
  );


  setText(
    'resultIcon',
    '⏳'
  );


  setText(
    'resultTitle',
    'MEMPROSES'
  );


  setText(
    'resultMessage',
    'Memeriksa data siswa...'
  );


  setText(
    'studentId',
    studentId
  );


  await processAttendance(
    studentId
  );
}


/* ============================================================
   33. PROSES ABSENSI
============================================================ */

async function processAttendance(
  studentId
) {

  try {

    const result =
      await apiGet({

        action:
          'attendance',

        studentId:
          studentId

      });


    console.log(
      'ATTENDANCE RESPONSE:',
      result
    );


    handleAttendanceResult(
      result
    );


  } catch (error) {

    console.error(
      'PROCESS ATTENDANCE ERROR:',
      error
    );


    showAttendanceError(
      'ERROR',
      error.message ||
      'Tidak dapat terhubung ke server.'
    );
  }
}


/* ============================================================
   34. HANDLE HASIL ABSENSI
============================================================ */

function handleAttendanceResult(
  result
) {

  if (!result) {

    showAttendanceError(
      'ERROR',
      'Server tidak memberikan response.'
    );

    return;
  }


  switch (
    String(
      result.status ||
      ''
    ).toUpperCase()
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

      showAttendanceError(
        'NOT_FOUND',
        result.message ||
        'Data siswa tidak ditemukan.'
      );

      break;


    case 'INACTIVE':

      showAttendanceError(
        'INACTIVE',
        result.message ||
        'Siswa tidak aktif.'
      );

      break;


    case 'NO_SCHEDULE':

      showAttendanceError(
        'NO_SCHEDULE',
        result.message ||
        'Tidak ada jadwal aktif saat ini.'
      );

      break;


    default:

      showAttendanceError(
        'ERROR',
        result.message ||
        'Terjadi kesalahan pada absensi.'
      );
  }
}


/* ============================================================
   35. ABSENSI BERHASIL
============================================================ */

function handleSuccess(
  result
) {

  const student =
    result.student ||
    {};


  const attendance =
    result.attendance ||
    {};


  const status =
    result.attendanceStatus ||
    attendance.status ||
    'Hadir';


  const nama =
    student.nama ||
    '-';


  const kelas =
    student.kelas ||
    '-';


  const jam =
    attendance.jam ||
    '-';


  setText(
    'resultIcon',
    status === 'Terlambat'
      ? '🟡'
      : '✅'
  );


  setText(
    'resultTitle',
    status === 'Terlambat'
      ? 'TERLAMBAT'
      : 'ABSENSI BERHASIL'
  );


  setText(
    'resultMessage',
    nama +
    ' • Kelas ' +
    kelas +
    ' • ' +
    status +
    ' • Pukul ' +
    jam
  );


  setText(
    'studentId',
    student.studentId ||
    ''
  );


  if (
    status === 'Terlambat'
  ) {

    speak(
      'Absensi terlambat. ' +
      nama
    );

  } else {

    speak(
      'Absensi berhasil. ' +
      nama
    );
  }


  loadTodaySummary();

  loadTodayAttendance();


  scheduleNextScan();
}


/* ============================================================
   36. SUDAH ABSEN
============================================================ */

function handleAlready(
  result
) {

  const student =
    result.student ||
    {};


  const previous =
    result.previousAttendance ||
    {};


  const nama =
    student.nama ||
    '-';


  const kelas =
    student.kelas ||
    '-';


  const jam =
    previous.jam ||
    '-';


  const status =
    previous.status ||
    'Sudah Absen';


  setText(
    'resultIcon',
    '🟡'
  );


  setText(
    'resultTitle',
    'SUDAH ABSEN'
  );


  setText(
    'resultMessage',
    nama +
    ' • Kelas ' +
    kelas +
    ' • ' +
    status +
    ' • Absen pukul ' +
    jam
  );


  setText(
    'studentId',
    student.studentId ||
    ''
  );


  speak(
    'Sudah absen. ' +
    nama
  );


  loadTodaySummary();

  loadTodayAttendance();


  scheduleNextScan();
}


/* ============================================================
   37. ERROR ABSENSI
============================================================ */

function showAttendanceError(
  type,
  message
) {

  let icon =
    '🔴';


  let title =
    'TERJADI KESALAHAN';


  if (
    type === 'NOT_FOUND'
  ) {

    icon =
      '❓';


    title =
      'DATA TIDAK DITEMUKAN';


  } else if (
    type === 'INACTIVE'
  ) {

    icon =
      '⛔';


    title =
      'SISWA TIDAK AKTIF';


  } else if (
    type === 'NO_SCHEDULE'
  ) {

    icon =
      '📅';


    title =
      'TIDAK ADA JADWAL';
  }


  setText(
    'resultIcon',
    icon
  );


  setText(
    'resultTitle',
    title
  );


  setText(
    'resultMessage',
    message
  );


  if (
    type !== 'ERROR'
  ) {

    speak(title);
  }


  scheduleNextScan();
}


/* ============================================================
   38. STOP SCANNER
============================================================ */

async function stopScanner() {

  if (!html5QrCode) {

    scannerRunning =
      false;

    return;
  }


  try {

    if (scannerRunning) {

      await html5QrCode.stop();
    }


  } catch (error) {

    console.warn(
      'Scanner stop:',
      error
    );


  } finally {

    scannerRunning =
      false;


    try {

      html5QrCode.clear();

    } catch (error) {}


    html5QrCode =
      null;
  }
}


/* ============================================================
   39. RESTART SCANNER
============================================================ */

async function restartScanner() {

  clearTimeout(
    autoScanTimer
  );


  processingScan =
    false;


  await startScanner();
}


/* ============================================================
   40. AUTO SCAN
============================================================ */

function scheduleNextScan() {

  clearTimeout(
    autoScanTimer
  );


  const toggle =
    $('autoScanToggle');


  if (
    !toggle ||
    !toggle.checked
  ) {

    processingScan =
      false;

    return;
  }


  autoScanTimer =
    setTimeout(
      async function () {

        try {

          await restartScanner();

        } catch (error) {

          console.error(
            'AUTO SCAN ERROR:',
            error
          );

          processingScan =
            false;
        }

      },
      AUTO_SCAN_DELAY
    );
}


/* ============================================================
   41. LABEL AUTO SCAN
============================================================ */

function updateAutoScanLabel() {

  const toggle =
    $('autoScanToggle');


  const label =
    $('autoScanLabel');


  if (
    !toggle ||
    !label
  ) {
    return;
  }


  if (toggle.checked) {

    label.textContent =
      'AKTIF';

    label.style.color =
      '#16a34a';

  } else {

    label.textContent =
      'MATI';

    label.style.color =
      '#64748b';
  }
}


/* ============================================================
   42. REKAP BULANAN GURU
   ------------------------------------------------------------
   Rekap hanya untuk kelas + mata pelajaran yang diajar Guru.
   Data dibaca dari ABSENSI dan tidak menulis REKAP_BULANAN.
============================================================ */

function resetTeacherRecapView() {

  const resultContainer = $('teacherRecapResult');
  const message = $('teacherRecapMessage');

  if (resultContainer) {
    resultContainer.style.display = 'none';
    resultContainer.innerHTML = '';
  }

  if (message) {
    message.textContent = '';
    message.className = 'teacher-recap-message';
  }
}


function injectTeacherRecapPanel() {

  const dashboard = $('dashboard');
  if (!dashboard) return;

  if ($('teacherMonthlyRecapPanel')) return;

  const panel = document.createElement('section');
  panel.id = 'teacherMonthlyRecapPanel';
  panel.className = 'teacher-monthly-recap-panel';

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const months = [
    'Januari','Februari','Maret','April','Mei','Juni',
    'Juli','Agustus','September','Oktober','November','Desember'
  ];

  panel.innerHTML = `
    <div class="teacher-recap-title">📊 Rekap Bulanan Guru</div>
    <div class="teacher-recap-subtitle">
      Pilih kelas dan mata pelajaran. Rekap dihitung per siswa berdasarkan hari, bukan jumlah jam pelajaran.
    </div>

    <div class="teacher-recap-controls">
      <label class="teacher-recap-field">
        <span>Bulan</span>
        <select id="teacherRecapMonth">
          ${months.map((name, i) => `
            <option value="${i + 1}" ${i + 1 === currentMonth ? 'selected' : ''}>${name}</option>
          `).join('')}
        </select>
      </label>

      <label class="teacher-recap-field">
        <span>Tahun</span>
        <select id="teacherRecapYear">
          ${Array.from({length: 5}, (_, i) => currentYear - 2 + i).map(year => `
            <option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}</option>
          `).join('')}
        </select>
      </label>

      <label class="teacher-recap-field">
        <span>Kelas</span>
        <select id="teacherRecapClass">
          <option value="">⏳ Memuat kelas...</option>
        </select>
      </label>

      <label class="teacher-recap-field">
        <span>Mata Pelajaran</span>
        <select id="teacherRecapMapel">
          <option value="">Pilih kelas terlebih dahulu</option>
        </select>
      </label>

      <button
        type="button"
        id="teacherRebuildRecapButton"
        class="teacher-recap-button"
      >
        Rekap...
      </button>
    </div>

    <div id="teacherRecapMessage" class="teacher-recap-message" aria-live="polite"></div>

    <div id="teacherRecapDownloadWrap" class="teacher-recap-download-wrap" style="display:none;">
      <button
        type="button"
        id="teacherRecapDownloadButton"
        class="teacher-recap-download-button"
      >
        📥 Download Rekap Excel (.xlsx)
      </button>
      <span id="teacherRecapDownloadMessage" class="teacher-recap-download-message"></span>
    </div>

    <div id="teacherRecapResult" class="teacher-recap-result" style="display:none;"></div>
  `;

  const scheduleContainer = $('teacherSchedules');

  if (scheduleContainer && scheduleContainer.parentNode) {
    scheduleContainer.parentNode.insertBefore(panel, scheduleContainer.nextSibling);
  } else {
    const userElement = $('dashboardUser');
    if (userElement && userElement.parentNode) {
      userElement.parentNode.insertBefore(panel, userElement.nextSibling);
    } else {
      dashboard.insertBefore(panel, dashboard.firstChild);
    }
  }

  const button = $('teacherRebuildRecapButton');
  if (button) {
    button.addEventListener('click', loadTeacherMonthlyRecap);
  }

  const downloadButton = $('teacherRecapDownloadButton');
  if (downloadButton) {
    downloadButton.addEventListener('click', downloadTeacherMonthlyRecapXlsx);
  }

  const classSelect = $('teacherRecapClass');
  if (classSelect) {
    classSelect.addEventListener('change', function() {
      updateTeacherRecapMapelOptions();
      hideTeacherRecapDownload();
    });
  }

  const monthSelect = $('teacherRecapMonth');
  if (monthSelect) {
    monthSelect.addEventListener('change', hideTeacherRecapDownload);
  }

  const yearSelect = $('teacherRecapYear');
  if (yearSelect) {
    yearSelect.addEventListener('change', hideTeacherRecapDownload);
  }

  const mapelSelect = $('teacherRecapMapel');
  if (mapelSelect) {
    mapelSelect.addEventListener('change', hideTeacherRecapDownload);
  }
}


function setTeacherRecapVisibility(visible) {

  const panel = $('teacherMonthlyRecapPanel');
  if (!panel) return;

  panel.style.display = visible ? 'block' : 'none';
}


function setTeacherRecapMessage(text, type = '') {

  const element = $('teacherRecapMessage');
  if (!element) return;

  element.textContent = text || '';
  element.className =
    'teacher-recap-message' +
    (type ? ' ' + type : '');
}


async function loadTeacherRecapOptions() {

  if (!currentToken || String(currentUser?.role || '').toUpperCase() !== 'GURU') {
    return;
  }

  const classSelect = $('teacherRecapClass');
  const mapelSelect = $('teacherRecapMapel');

  if (!classSelect || !mapelSelect) return;

  classSelect.innerHTML = '<option value="">⏳ Memuat kelas...</option>';
  mapelSelect.innerHTML = '<option value="">Pilih kelas terlebih dahulu</option>';

  try {

    const result = await apiGet({
      action: 'teacherRecapOptions',
      token: currentToken
    });

    if (result?.status === 'SESSION_EXPIRED') {
      handleSessionExpired();
      return;
    }

    if (!result || !result.success) {
      throw new Error(result?.message || 'Pilihan kelas dan mata pelajaran tidak dapat dimuat.');
    }

    teacherRecapOptionsData = Array.isArray(result.data) ? result.data : [];

    const classMap = {};

    teacherRecapOptionsData.forEach(function(item) {
      const key = String(item.kelasId || item.kelas || '').trim();
      if (!key) return;
      if (!classMap[key]) {
        classMap[key] = {
          kelasId: item.kelasId || key,
          kelas: item.kelas || key
        };
      }
    });

    const classes = Object.values(classMap).sort(function(a, b) {
      return String(a.kelas).localeCompare(String(b.kelas), 'id', {numeric:true});
    });

    if (!classes.length) {
      classSelect.innerHTML = '<option value="">Tidak ada kelas</option>';
      mapelSelect.innerHTML = '<option value="">Tidak ada mata pelajaran</option>';
      setTeacherRecapMessage('📭 Belum ada jadwal aktif yang dapat direkap.', 'error');
      return;
    }

    classSelect.innerHTML =
      '<option value="">Pilih kelas</option>' +
      classes.map(function(item) {
        return '<option value="' + escapeHTML(item.kelasId) + '">' + escapeHTML(item.kelas) + '</option>';
      }).join('');

    mapelSelect.innerHTML = '<option value="">Pilih kelas terlebih dahulu</option>';
    setTeacherRecapMessage('');

  } catch (error) {

    console.error('TEACHER RECAP OPTIONS ERROR:', error);

    classSelect.innerHTML = '<option value="">Gagal memuat kelas</option>';
    mapelSelect.innerHTML = '<option value="">Gagal memuat</option>';
    setTeacherRecapMessage('❌ ' + (error.message || 'Gagal memuat pilihan rekap.'), 'error');
  }
}


function updateTeacherRecapMapelOptions() {

  const classSelect = $('teacherRecapClass');
  const mapelSelect = $('teacherRecapMapel');

  if (!classSelect || !mapelSelect) return;

  const kelasId = String(classSelect.value || '').trim();

  if (!kelasId) {
    mapelSelect.innerHTML = '<option value="">Pilih kelas terlebih dahulu</option>';
    return;
  }

  const mapelMap = {};

  teacherRecapOptionsData
    .filter(function(item) {
      return String(item.kelasId || '').trim() === kelasId;
    })
    .forEach(function(item) {
      const key = String(item.mapelId || item.mapel || '').trim();
      if (!key) return;
      if (!mapelMap[key]) {
        mapelMap[key] = {
          mapelId: item.mapelId || key,
          mapel: item.mapel || key
        };
      }
    });

  const mapels = Object.values(mapelMap).sort(function(a, b) {
    return String(a.mapel).localeCompare(String(b.mapel), 'id');
  });

  if (!mapels.length) {
    mapelSelect.innerHTML = '<option value="">Tidak ada mata pelajaran</option>';
    return;
  }

  mapelSelect.innerHTML =
    '<option value="">Pilih mata pelajaran</option>' +
    mapels.map(function(item) {
      return '<option value="' + escapeHTML(item.mapelId) + '">' + escapeHTML(item.mapel) + '</option>';
    }).join('');
}


function renderTeacherMonthlyRecap(result) {

  const container = $('teacherRecapResult');
  if (!container) return;

  const rows = Array.isArray(result?.data?.rows)
    ? result.data.rows
    : [];

  const summary = result?.data?.summary || {};

  if (!rows.length) {
    container.innerHTML = '<div class="teacher-recap-empty">📭 Tidak ada data siswa untuk pilihan tersebut.</div>';
    container.style.display = 'block';
    hideTeacherRecapDownload();
    return;
  }

  container.innerHTML = `
    <div class="teacher-recap-summary">
      <div><span>Total Siswa</span><strong>${summary.totalSiswa || rows.length}</strong></div>
      <div><span>🟢 Hadir</span><strong>${summary.hadir || 0}</strong></div>
      <div><span>🟡 Terlambat</span><strong>${summary.terlambat || 0}</strong></div>
      <div><span>🔵 Izin</span><strong>${summary.izin || 0}</strong></div>
      <div><span>🟣 Sakit</span><strong>${summary.sakit || 0}</strong></div>
      <div><span>🔴 Alpa</span><strong>${summary.alpa || 0}</strong></div>
      <div><span>🟠 Kegiatan</span><strong>${summary.kegiatan || 0}</strong></div>
    </div>

    <div class="teacher-recap-table-wrapper">
      <table class="teacher-recap-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Siswa</th>
            <th>Hadir</th>
            <th>Terlambat</th>
            <th>Izin</th>
            <th>Sakit</th>
            <th>Alpa</th>
            <th>Kegiatan</th>
            <th>Total Hari</th>
            <th>% Kehadiran</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(function(item, index) {
            return `
              <tr>
                <td>${index + 1}</td>
                <td>
                  <strong>${escapeHTML(item.nama || '-')}</strong>
                  <div class="teacher-recap-student-id">${escapeHTML(item.studentId || '-')}</div>
                </td>
                <td>${item.hadir || 0}</td>
                <td>${item.terlambat || 0}</td>
                <td>${item.izin || 0}</td>
                <td>${item.sakit || 0}</td>
                <td>${item.alpa || 0}</td>
                <td>${item.kegiatan || 0}</td>
                <td>${item.totalHari || 0}</td>
                <td><strong>${Number(item.persentase || 0).toFixed(2)}%</strong></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  container.style.display = 'block';
}


function hideTeacherRecapDownload() {
  const wrap = $('teacherRecapDownloadWrap');
  const message = $('teacherRecapDownloadMessage');
  const button = $('teacherRecapDownloadButton');

  if (wrap) wrap.style.display = 'none';
  if (message) message.textContent = '';
  if (button) {
    button.disabled = false;
    button.textContent = '📥 Download Rekap Excel (.xlsx)';
  }
}


function showTeacherRecapDownload() {
  const wrap = $('teacherRecapDownloadWrap');
  if (wrap) wrap.style.display = 'flex';
}


function setTeacherRecapDownloadMessage(text, type = '') {
  const element = $('teacherRecapDownloadMessage');
  if (!element) return;

  element.textContent = text || '';
  element.className =
    'teacher-recap-download-message' +
    (type ? ' ' + type : '');
}


async function loadTeacherMonthlyRecap() {

  if (!currentToken) {
    setTeacherRecapMessage('⚠️ Sesi login tidak tersedia. Silakan login kembali.', 'error');
    return;
  }

  if (String(currentUser?.role || '').toUpperCase() !== 'GURU') {
    setTeacherRecapMessage('⛔ Rekap ini hanya tersedia untuk Guru.', 'error');
    return;
  }

  const monthElement = $('teacherRecapMonth');
  const yearElement = $('teacherRecapYear');
  const classElement = $('teacherRecapClass');
  const mapelElement = $('teacherRecapMapel');
  const button = $('teacherRebuildRecapButton');
  const resultContainer = $('teacherRecapResult');

  const bulan = monthElement?.value || String(new Date().getMonth() + 1);
  const tahun = yearElement?.value || String(new Date().getFullYear());
  const kelasId = classElement?.value || '';
  const mapelId = mapelElement?.value || '';

  if (!kelasId) {
    setTeacherRecapMessage('⚠️ Silakan pilih kelas.', 'error');
    return;
  }

  if (!mapelId) {
    setTeacherRecapMessage('⚠️ Silakan pilih mata pelajaran.', 'error');
    return;
  }

  const monthName = monthElement
    ? monthElement.options[monthElement.selectedIndex].text
    : bulan;
  const className = classElement
    ? classElement.options[classElement.selectedIndex].text
    : kelasId;
  const mapelName = mapelElement
    ? mapelElement.options[mapelElement.selectedIndex].text
    : mapelId;

  if (button) {
    button.disabled = true;
    button.textContent = '⏳ Memuat...';
  }

  if (resultContainer) {
    resultContainer.style.display = 'none';
    resultContainer.innerHTML = '';
  }

  setTeacherRecapMessage(
    '⏳ Mengambil rekap ' + className + ' • ' + mapelName + ' • ' + monthName + ' ' + tahun + '...',
    'loading'
  );

  try {

    const result = await apiGet({
      action: 'teacherMonthlyRecap',
      token: currentToken,
      bulan: bulan,
      tahun: tahun,
      kelasId: kelasId,
      mapelId: mapelId
    });

    if (result?.status === 'SESSION_EXPIRED') {
      handleSessionExpired();
      return;
    }

    if (!result || !result.success) {
      throw new Error(result?.message || 'Rekap bulanan guru gagal dimuat.');
    }

    renderTeacherMonthlyRecap(result);
    showTeacherRecapDownload();
    setTeacherRecapDownloadMessage('Siap diunduh.', 'success');

    setTeacherRecapMessage(
      '✅ Rekap ' + className + ' • ' + mapelName + ' • ' + monthName + ' ' + tahun + ' selesai ditampilkan.',
      'success'
    );

  } catch (error) {

    console.error('TEACHER MONTHLY RECAP ERROR:', error);

    setTeacherRecapMessage(
      '❌ ' + (error.message || 'Rekap bulanan guru gagal dimuat.'),
      'error'
    );

  } finally {

    if (button) {
      button.disabled = false;
      button.textContent = '📊 Hasil Rekap';
    }
  }
}


async function downloadTeacherMonthlyRecapXlsx() {

  if (!currentToken) {
    setTeacherRecapDownloadMessage('⚠️ Sesi login tidak tersedia.', 'error');
    return;
  }

  const monthElement = $('teacherRecapMonth');
  const yearElement = $('teacherRecapYear');
  const classElement = $('teacherRecapClass');
  const mapelElement = $('teacherRecapMapel');
  const button = $('teacherRecapDownloadButton');

  const bulan = monthElement?.value || String(new Date().getMonth() + 1);
  const tahun = yearElement?.value || String(new Date().getFullYear());
  const kelasId = classElement?.value || '';
  const mapelId = mapelElement?.value || '';

  if (!kelasId || !mapelId) {
    setTeacherRecapDownloadMessage('⚠️ Pilih kelas dan mata pelajaran terlebih dahulu.', 'error');
    return;
  }

  const className = classElement
    ? classElement.options[classElement.selectedIndex].text
    : kelasId;
  const mapelName = mapelElement
    ? mapelElement.options[mapelElement.selectedIndex].text
    : mapelId;
  const monthName = monthElement
    ? monthElement.options[monthElement.selectedIndex].text
    : bulan;

  if (button) {
    button.disabled = true;
    button.textContent = '⏳ Menyiapkan Excel...';
  }

  setTeacherRecapDownloadMessage(
    '⏳ Menyiapkan file Excel ' + className + ' • ' + mapelName + '...',
    'loading'
  );

  try {

    const result = await apiGet(
      {
        action: 'exportTeacherMonthlyRecapXlsx',
        token: currentToken,
        bulan: bulan,
        tahun: tahun,
        kelasId: kelasId,
        mapelId: mapelId
      },
      { timeoutMs: 330000 }
    );

    if (result?.status === 'SESSION_EXPIRED') {
      handleSessionExpired();
      return;
    }

    if (!result || !result.success || !result.dataBase64) {
      throw new Error(result?.message || 'File Excel gagal dibuat.');
    }

    downloadBase64File(
      result.dataBase64,
      result.fileName || ('Rekap_' + className + '_' + mapelName + '_' + monthName + '_' + tahun + '.xlsx'),
      result.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    setTeacherRecapDownloadMessage('✅ File Excel berhasil dibuat dan diunduh.', 'success');

  } catch (error) {

    console.error('DOWNLOAD TEACHER RECAP ERROR:', error);
    setTeacherRecapDownloadMessage(
      '❌ ' + (error.message || 'Gagal membuat file Excel.'),
      'error'
    );

  } finally {

    if (button) {
      button.disabled = false;
      button.textContent = '📥 Download Rekap Excel (.xlsx)';
    }
  }
}


/* ============================================================
   42. REKAP BULANAN ADMIN
============================================================ */

function injectAdminRecapPanel() {

  const dashboard = $('dashboard');
  if (!dashboard) return;

  if ($('adminMonthlyRecapPanel')) return;

  const panel = document.createElement('section');
  panel.id = 'adminMonthlyRecapPanel';
  panel.className = 'admin-monthly-recap-panel';

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const months = [
    'Januari','Februari','Maret','April','Mei','Juni',
    'Juli','Agustus','September','Oktober','November','Desember'
  ];

  panel.innerHTML = `
    <div class="admin-recap-header">
      <div>
        <div class="admin-recap-title">📊 Rekap Bulanan</div>
        <div class="admin-recap-subtitle">
          Rekap hanya diperbarui ketika Admin menekan tombol.
          Proses ini tidak dijalankan saat siswa scan.
        </div>
      </div>
    </div>

    <div class="admin-recap-controls">
      <label class="admin-recap-field">
        <span>Bulan</span>
        <select id="adminRecapMonth">
          ${months.map((name, i) => `
            <option value="${i + 1}" ${i + 1 === currentMonth ? 'selected' : ''}>
              ${name}
            </option>
          `).join('')}
        </select>
      </label>

      <label class="admin-recap-field">
        <span>Tahun</span>
        <select id="adminRecapYear">
          ${Array.from({length: 5}, (_, i) => currentYear - 2 + i).map(year => `
            <option value="${year}" ${year === currentYear ? 'selected' : ''}>
              ${year}
            </option>
          `).join('')}
        </select>
      </label>

      <button
        type="button"
        id="adminRebuildRecapButton"
        class="admin-recap-button"
      >
        🔄 Perbarui Rekap
      </button>
    </div>

    <div class="admin-recap-progress-wrap" id="adminRecapProgressWrap" style="display:none;">
      <div class="admin-recap-progress-top">
        <span id="adminRecapProgressText">Menyiapkan proses rekap...</span>
        <strong id="adminRecapProgressPercent">0%</strong>
      </div>
      <div class="admin-recap-progress-track" aria-hidden="true">
        <div id="adminRecapProgressBar" class="admin-recap-progress-bar" style="width:0%;"></div>
      </div>
    </div>

    <div id="adminRecapMessage" class="admin-recap-message" aria-live="polite"></div>

    <div id="adminRecapDownloadWrap" class="admin-recap-download-wrap" style="display:none;">
      <button
        type="button"
        id="adminRecapDownloadButton"
        class="admin-recap-download-button"
      >
        📥 Download Hasil Rekap (.xlsx)
      </button>
      <span id="adminRecapDownloadMessage" class="admin-recap-download-message"></span>
    </div>
  `;

  const userElement = $('dashboardUser');

  if (userElement && userElement.parentNode) {
    userElement.parentNode.insertBefore(
      panel,
      userElement.nextSibling
    );
  } else {
    dashboard.insertBefore(panel, dashboard.firstChild);
  }

  const button = $('adminRebuildRecapButton');

  if (button) {
    button.addEventListener('click', rebuildMonthlyRecapFromDashboard);
  }

  const downloadButton = $('adminRecapDownloadButton');
  if (downloadButton) {
    downloadButton.addEventListener('click', downloadAdminMonthlyRecapXlsx);
  }

  const monthSelect = $('adminRecapMonth');
  if (monthSelect) monthSelect.addEventListener('change', hideAdminRecapDownload);

  const yearSelect = $('adminRecapYear');
  if (yearSelect) yearSelect.addEventListener('change', hideAdminRecapDownload);
}


function setAdminRecapVisibility(visible) {

  const panel = $('adminMonthlyRecapPanel');

  if (!panel) return;

  panel.style.display = visible ? 'block' : 'none';
}


function setAdminRecapMessage(text, type = '') {

  const element = $('adminRecapMessage');
  if (!element) return;

  element.textContent = text || '';
  element.className =
    'admin-recap-message' +
    (type ? ' ' + type : '');
}


function setAdminRecapProgress(percent, text) {

  const safePercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const wrap = $('adminRecapProgressWrap');
  const bar = $('adminRecapProgressBar');
  const percentText = $('adminRecapProgressPercent');
  const progressText = $('adminRecapProgressText');

  if (wrap) {
    wrap.style.display = 'block';
  }

  if (bar) {
    bar.style.width = safePercent + '%';
  }

  if (percentText) {
    percentText.textContent = safePercent + '%';
  }

  if (progressText && text) {
    progressText.textContent = text;
  }
}


function hideAdminRecapProgress() {

  const wrap = $('adminRecapProgressWrap');

  if (wrap) {
    wrap.style.display = 'none';
  }
}


function startAdminRecapProgressSimulation(monthName, tahun) {

  clearInterval(window.__adminRecapProgressTimer);

  let percent = 0;

  setAdminRecapProgress(
    0,
    '⏳ Menyiapkan rekap ' + monthName + ' ' + tahun + '...'
  );

  window.__adminRecapProgressTimer = setInterval(function () {

    if (percent < 70) {
      percent += 5;
    } else if (percent < 90) {
      percent += 2;
    } else if (percent < 95) {
      percent += 1;
    }

    let text = '⏳ Membaca data ABSENSI dan menyusun rekap...';

    if (percent >= 70 && percent < 90) {
      text = '🔄 Mengolah data siswa dan status kehadiran...';
    } else if (percent >= 90) {
      text = '💾 Menulis REKAP_BULANAN. Mohon tunggu...';
    }

    setAdminRecapProgress(percent, text);

  }, 900);
}


function stopAdminRecapProgressSimulation() {

  clearInterval(window.__adminRecapProgressTimer);
  window.__adminRecapProgressTimer = null;
}


function hideAdminRecapDownload() {
  const wrap = $('adminRecapDownloadWrap');
  const message = $('adminRecapDownloadMessage');
  const button = $('adminRecapDownloadButton');

  if (wrap) wrap.style.display = 'none';
  if (message) message.textContent = '';
  if (button) {
    button.disabled = false;
    button.textContent = '📥 Download Hasil Rekap (.xlsx)';
  }
}


function showAdminRecapDownload() {
  const wrap = $('adminRecapDownloadWrap');
  if (wrap) wrap.style.display = 'flex';
}


function setAdminRecapDownloadMessage(text, type = '') {
  const element = $('adminRecapDownloadMessage');
  if (!element) return;

  element.textContent = text || '';
  element.className =
    'admin-recap-download-message' +
    (type ? ' ' + type : '');
}


function downloadBase64File(base64, fileName, mimeType) {
  const binary = atob(base64);
  const length = binary.length;
  const bytes = new Uint8Array(length);

  for (let i = 0; i < length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes], {
    type: mimeType || 'application/octet-stream'
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName || 'rekap.xlsx';
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(function() {
    URL.revokeObjectURL(url);
  }, 30000);
}


async function downloadAdminMonthlyRecapXlsx() {

  if (!currentToken) {
    setAdminRecapDownloadMessage('⚠️ Sesi login tidak tersedia.', 'error');
    return;
  }

  const monthElement = $('adminRecapMonth');
  const yearElement = $('adminRecapYear');
  const button = $('adminRecapDownloadButton');

  const bulan = monthElement?.value || String(new Date().getMonth() + 1);
  const tahun = yearElement?.value || String(new Date().getFullYear());

  const monthName = monthElement
    ? monthElement.options[monthElement.selectedIndex].text
    : bulan;

  if (button) {
    button.disabled = true;
    button.textContent = '⏳ Menyiapkan Excel...';
  }

  setAdminRecapDownloadMessage(
    '⏳ Menyiapkan file Excel Rekap ' + monthName + ' ' + tahun + '...',
    'loading'
  );

  try {

    const result = await apiGet(
      {
        action: 'exportMonthlyRecapXlsx',
        token: currentToken,
        bulan: bulan,
        tahun: tahun
      },
      { timeoutMs: 330000 }
    );

    if (result?.status === 'SESSION_EXPIRED') {
      handleSessionExpired();
      return;
    }

    if (!result || !result.success || !result.dataBase64) {
      throw new Error(result?.message || 'File Excel gagal dibuat.');
    }

    downloadBase64File(
      result.dataBase64,
      result.fileName || ('Rekap_Bulanan_Semua_Siswa_' + monthName + '_' + tahun + '.xlsx'),
      result.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    setAdminRecapDownloadMessage('✅ File Excel berhasil dibuat dan diunduh.', 'success');

  } catch (error) {

    console.error('DOWNLOAD ADMIN RECAP ERROR:', error);
    setAdminRecapDownloadMessage(
      '❌ ' + (error.message || 'Gagal membuat file Excel.'),
      'error'
    );

  } finally {

    if (button) {
      button.disabled = false;
      button.textContent = '📥 Download Hasil Rekap (.xlsx)';
    }
  }
}


async function rebuildMonthlyRecapFromDashboard() {

  if (!currentToken) {
    setAdminRecapMessage(
      '⚠️ Sesi login tidak tersedia. Silakan login kembali.',
      'error'
    );
    return;
  }

  const role = String(currentUser?.role || '').toUpperCase();

  if (role !== 'ADMIN') {
    setAdminRecapMessage(
      '⛔ Hanya Admin yang dapat memperbarui rekap bulanan.',
      'error'
    );
    return;
  }

  const monthElement = $('adminRecapMonth');
  const yearElement = $('adminRecapYear');
  const button = $('adminRebuildRecapButton');

  const bulan = monthElement
    ? monthElement.value
    : String(new Date().getMonth() + 1);

  const tahun = yearElement
    ? yearElement.value
    : String(new Date().getFullYear());

  const monthName = monthElement
    ? monthElement.options[monthElement.selectedIndex].text
    : bulan;

  const confirmed = window.confirm(
    'Perbarui REKAP_BULANAN untuk ' +
    monthName + ' ' + tahun + '?\n\n' +
    'Proses ini membaca ABSENSI dan menulis ulang rekap bulan tersebut.\n' +
    'Scanner siswa tetap aman karena proses ini hanya dijalankan setelah Anda menekan OK.'
  );

  if (!confirmed) {
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = '⏳ Sedang merekap...';
  }

  setAdminRecapMessage(
    '⏳ Proses rekap sedang berjalan. Jangan menutup halaman sampai proses selesai.',
    'loading'
  );

  startAdminRecapProgressSimulation(monthName, tahun);

  try {

    /*
     * Rekap memang dapat membutuhkan waktu lebih lama karena server
     * membaca ABSENSI lalu menulis ulang REKAP_BULANAN.
     * Timeout khusus rekap dibuat jauh lebih panjang daripada scanner.
     * Ini TIDAK mengubah timeout scanner yang tetap 20 detik.
     */
    const result = await apiGet(
      {
        action: 'rebuildMonthlyRecap',
        token: currentToken,
        bulan: bulan,
        tahun: tahun
      },
      {
        timeoutMs: 330000
      }
    );

    if (result?.status === 'SESSION_EXPIRED') {
      stopAdminRecapProgressSimulation();
      hideAdminRecapProgress();
      handleSessionExpired();
      return;
    }

    if (!result || !result.success) {
      throw new Error(
        result?.message ||
        'Rekap bulanan gagal diperbarui.'
      );
    }

    stopAdminRecapProgressSimulation();
    setAdminRecapProgress(
      100,
      '✅ Proses rekap selesai.'
    );

    const data = result.data || {};
    const totalSiswa =
      data.totalSiswa ??
      data.total ??
      0;

    setAdminRecapMessage(
      '✅ Proses rekap selesai. REKAP_BULANAN ' +
      monthName + ' ' + tahun +
      ' berhasil diperbarui. ' +
      totalSiswa + ' siswa diproses.',
      'success'
    );

    showAdminRecapDownload();
    setAdminRecapDownloadMessage('Siap diunduh.', 'success');

  } catch (error) {

    stopAdminRecapProgressSimulation();

    console.error(
      'REBUILD MONTHLY RECAP ERROR:',
      error
    );

    /*
     * Tidak lagi menampilkan kalimat "Server terlalu lama..."
     * khusus proses rekap. Admin mendapat pesan yang lebih jelas.
     */
    const rawMessage = String(error?.message || '');
    const isTimeout =
      error?.name === 'AbortError' ||
      rawMessage.toLowerCase().includes('terlalu lama') ||
      rawMessage.toLowerCase().includes('timeout');

    setAdminRecapProgress(
      0,
      isTimeout
        ? '⚠️ Proses belum dapat dikonfirmasi selesai.'
        : '⚠️ Proses rekap berhenti sebelum selesai.'
    );

    setAdminRecapMessage(
      isTimeout
        ? '⚠️ Proses rekap belum dapat dikonfirmasi selesai. Silakan periksa REKAP_BULANAN sebelum menjalankan rekap lagi.'
        : '❌ Proses rekap belum selesai. ' +
          (rawMessage || 'Terjadi kesalahan saat memperbarui rekap.'),
      'error'
    );

  } finally {

    if (button) {
      button.disabled = false;
      button.textContent = '🔄 Perbarui Rekap';
    }
  }
}

/* ============================================================
   43. CSS DINAMIS DASHBOARD
============================================================ */


function injectDashboardStyles() {

  if (
    $('appDynamicStyles')
  ) {
    return;
  }


  const style =
    document.createElement(
      'style'
    );


  style.id =
    'appDynamicStyles';


  style.textContent = `

    .app-loading {
      padding: 20px;
      text-align: center;
      color: #64748b;
    }

    .app-empty {
      padding: 20px;
      text-align: center;
      color: #64748b;
      background: #f8fafc;
      border-radius: 12px;
    }

    .app-error {
      padding: 15px;
      text-align: center;
      color: #b91c1c;
      background: #fef2f2;
      border-radius: 12px;
    }

    .teacher-schedule-card {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px;
      margin-bottom: 10px;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      background: #ffffff;
      cursor: pointer;
      text-align: left;
      transition: 0.2s ease;
    }

    .teacher-schedule-card:hover {
      transform: translateY(-1px);
      box-shadow: 0 5px 15px rgba(0,0,0,.08);
    }

    .teacher-schedule-card.selected {
      border-color: #2563eb;
      background: #eff6ff;
    }

    .schedule-number {
      width: 34px;
      height: 34px;
      min-width: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: #2563eb;
      color: #fff;
      font-weight: 700;
    }

    .schedule-main {
      flex: 1;
    }

    .schedule-time {
      font-size: 13px;
      color: #64748b;
    }

    .schedule-mapel {
      font-size: 16px;
      font-weight: 700;
      margin-top: 3px;
    }

    .schedule-class {
      font-size: 13px;
      color: #475569;
      margin-top: 3px;
    }

    .schedule-ke {
      font-size: 12px;
      color: #64748b;
      white-space: nowrap;
    }

    #teacherStats {
      display: grid;
      grid-template-columns: repeat(auto-fit,minmax(110px,1fr));
      gap: 8px;
      margin: 12px 0;
    }

    .teacher-stat {
      padding: 10px;
      background: #f8fafc;
      border-radius: 10px;
      text-align: center;
    }

    .teacher-stat span {
      display: block;
      font-size: 12px;
      color: #64748b;
    }

    .teacher-stat strong {
      display: block;
      font-size: 20px;
      margin-top: 3px;
    }

    .teacher-attendance-table-wrapper {
      width: 100%;
      overflow-x: auto;
    }

    .teacher-attendance-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 760px;
    }

    .teacher-attendance-table th,
    .teacher-attendance-table td {
      padding: 9px;
      border-bottom: 1px solid #e2e8f0;
      text-align: left;
      vertical-align: middle;
    }

    .teacher-attendance-table th {
      background: #f8fafc;
      font-size: 13px;
    }

    .teacher-student-name {
      font-weight: 700;
    }

    .teacher-student-id {
      color: #64748b;
      font-size: 11px;
      margin-top: 2px;
    }

    .attendance-status-select,
    .attendance-note-input {
      width: 100%;
      padding: 8px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
      box-sizing: border-box;
    }

    .attendance-status-select {
      min-width: 125px;
    }

    .attendance-note-input {
      min-width: 160px;
    }

    .save-attendance-button {
      border: 0;
      border-radius: 8px;
      padding: 8px 11px;
      cursor: pointer;
      background: #2563eb;
      color: white;
      font-weight: 600;
      white-space: nowrap;
    }

    .save-attendance-button:disabled {
      opacity: .6;
      cursor: wait;
    }

    .teacher-save-all-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 14px;
      padding: 12px;
      border-radius: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
    }

    .teacher-save-all-button {
      border: 0;
      border-radius: 9px;
      padding: 10px 16px;
      background: #0f766e;
      color: #fff;
      font-weight: 800;
      cursor: pointer;
    }

    .teacher-save-all-button:disabled {
      opacity: .65;
      cursor: wait;
    }

    .teacher-save-all-hint {
      color: #64748b;
      font-size: 12px;
    }

    .teacher-row-dirty {
      background: #fffbeb;
    }

    .attendance-status-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 12px;
      white-space: nowrap;
    }

    .status-hadir {
      background: #dcfce7;
    }

    .status-terlambat {
      background: #fef3c7;
    }

    .status-izin {
      background: #dbeafe;
    }

    .status-sakit {
      background: #ede9fe;
    }

    .status-alpa {
      background: #fee2e2;
    }

    .status-kegiatan {
      background: #ffedd5;
    }

    .status-belum,
    .status-default {
      background: #f1f5f9;
    }

    .teacher-monthly-recap-panel {
      margin: 14px 0;
      padding: 16px;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      background: #ffffff;
      box-shadow: 0 5px 18px rgba(0,0,0,.05);
    }

    .teacher-recap-title {
      font-size: 17px;
      font-weight: 800;
    }

    .teacher-recap-subtitle {
      margin-top: 4px;
      color: #64748b;
      font-size: 12px;
      line-height: 1.5;
    }

    .teacher-recap-controls {
      display: grid;
      grid-template-columns: repeat(4, minmax(120px, 1fr)) auto;
      gap: 10px;
      align-items: end;
      margin-top: 13px;
    }

    .teacher-recap-field span {
      display: block;
      margin-bottom: 5px;
      font-size: 12px;
      color: #475569;
      font-weight: 700;
    }

    .teacher-recap-field select {
      width: 100%;
      box-sizing: border-box;
      padding: 9px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 9px;
      background: #fff;
    }

    .teacher-recap-button {
      border: 0;
      border-radius: 9px;
      padding: 10px 14px;
      background: #2563eb;
      color: #fff;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    }

    .teacher-recap-button:disabled {
      opacity: .65;
      cursor: wait;
    }

    .teacher-recap-message {
      min-height: 20px;
      margin-top: 10px;
      font-size: 13px;
      line-height: 1.5;
    }

    .teacher-recap-message.loading { color: #92400e; }
    .teacher-recap-message.success { color: #166534; }
    .teacher-recap-message.error { color: #b91c1c; }

    .teacher-recap-result {
      margin-top: 12px;
    }

    .teacher-recap-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }

    .teacher-recap-summary > div {
      padding: 9px;
      border-radius: 10px;
      background: #f8fafc;
      text-align: center;
    }

    .teacher-recap-summary span {
      display: block;
      font-size: 11px;
      color: #64748b;
    }

    .teacher-recap-summary strong {
      display: block;
      margin-top: 3px;
      font-size: 18px;
    }

    .teacher-recap-table-wrapper {
      width: 100%;
      overflow-x: auto;
    }

    .teacher-recap-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 900px;
    }

    .teacher-recap-table th,
    .teacher-recap-table td {
      padding: 8px 9px;
      border-bottom: 1px solid #e2e8f0;
      text-align: center;
      vertical-align: middle;
      font-size: 12px;
    }

    .teacher-recap-table th {
      background: #f8fafc;
      font-weight: 800;
    }

    .teacher-recap-table th:nth-child(2),
    .teacher-recap-table td:nth-child(2) {
      text-align: left;
    }

    .teacher-recap-student-id {
      color: #64748b;
      font-size: 10px;
      margin-top: 2px;
    }

    .teacher-recap-empty {
      padding: 18px;
      text-align: center;
      color: #64748b;
      background: #f8fafc;
      border-radius: 12px;
    }

    .teacher-recap-download-wrap,
    .admin-recap-download-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 12px;
      padding: 10px 12px;
      border: 1px solid #dcfce7;
      border-radius: 11px;
      background: #f0fdf4;
    }

    .teacher-recap-download-button,
    .admin-recap-download-button {
      border: 0;
      border-radius: 9px;
      padding: 10px 14px;
      background: #15803d;
      color: #fff;
      font-weight: 800;
      cursor: pointer;
      white-space: nowrap;
    }

    .teacher-recap-download-button:disabled,
    .admin-recap-download-button:disabled {
      opacity: .65;
      cursor: wait;
    }

    .teacher-recap-download-message,
    .admin-recap-download-message {
      font-size: 12px;
      color: #475569;
      line-height: 1.5;
    }

    .teacher-recap-download-message.loading,
    .admin-recap-download-message.loading { color: #92400e; }
    .teacher-recap-download-message.success,
    .admin-recap-download-message.success { color: #166534; }
    .teacher-recap-download-message.error,
    .admin-recap-download-message.error { color: #b91c1c; }

    .admin-monthly-recap-panel {
      margin: 14px 0;
      padding: 16px;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      background: #ffffff;
      box-shadow: 0 5px 18px rgba(0,0,0,.05);
    }

    .admin-recap-title {
      font-size: 17px;
      font-weight: 800;
    }

    .admin-recap-subtitle {
      margin-top: 4px;
      color: #64748b;
      font-size: 12px;
      line-height: 1.5;
    }

    .admin-recap-controls {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 10px;
      align-items: end;
      margin-top: 13px;
    }

    .admin-recap-field span {
      display: block;
      margin-bottom: 5px;
      font-size: 12px;
      color: #475569;
      font-weight: 700;
    }

    .admin-recap-field select {
      width: 100%;
      box-sizing: border-box;
      padding: 9px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 9px;
      background: #fff;
    }

    .admin-recap-button {
      border: 0;
      border-radius: 9px;
      padding: 10px 14px;
      background: #2563eb;
      color: #fff;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    }

    .admin-recap-button:disabled {
      opacity: .65;
      cursor: wait;
    }

    .admin-recap-message {
      min-height: 20px;
      margin-top: 10px;
      font-size: 13px;
      line-height: 1.5;
    }

    .admin-recap-message.loading {
      color: #92400e;
    }

    .admin-recap-message.success {
      color: #166534;
    }

    .admin-recap-message.error {
      color: #b91c1c;
    }

    .admin-recap-progress-wrap {
      margin-top: 12px;
      padding: 11px 12px;
      border-radius: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
    }

    .admin-recap-progress-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      font-size: 12px;
      color: #475569;
      margin-bottom: 7px;
    }

    .admin-recap-progress-top strong {
      font-size: 13px;
      color: #2563eb;
      min-width: 38px;
      text-align: right;
    }

    .admin-recap-progress-track {
      width: 100%;
      height: 10px;
      overflow: hidden;
      border-radius: 999px;
      background: #e2e8f0;
    }

    .admin-recap-progress-bar {
      height: 100%;
      width: 0%;
      border-radius: 999px;
      background: linear-gradient(90deg, #2563eb, #16a34a);
      transition: width .35s ease;
    }

    .app-footer {
      width: 100%;
      box-sizing: border-box;
      margin-top: 24px;
      padding: 12px 16px 16px;
      text-align: center;
      color: #64748b;
      font-size: 11px;
      line-height: 1.6;
      border-top: 1px solid #e2e8f0;
      background: rgba(255,255,255,.96);
      backdrop-filter: blur(5px);
      z-index: 20;
    }

    .app-footer-name {
      font-weight: 800;
      letter-spacing: .3px;
      color: #0f766e;
    }

    .app-footer-meta {
      margin-top: 2px;
    }

    @media (max-width: 900px) {

      .teacher-recap-controls {
        grid-template-columns: 1fr 1fr;
      }

      .teacher-recap-button {
        width: 100%;
        grid-column: 1 / -1;
      }

    }

    @media (max-width: 700px) {

      .admin-recap-controls {
        grid-template-columns: 1fr 1fr;
      }

      .admin-recap-button {
        width: 100%;
        grid-column: 1 / -1;
      }

      .teacher-recap-download-button,
      .admin-recap-download-button {
        width: 100%;
      }

      .teacher-recap-download-wrap,
      .admin-recap-download-wrap {
        align-items: stretch;
      }

      .teacher-schedule-card {
        padding: 11px;
      }

      .schedule-ke {
        display: none;
      }

      .teacher-attendance-table-wrapper {
        margin-left: -5px;
        margin-right: -5px;
      }

    }

  `;


  document.head.appendChild(
    style
  );
}


/* ============================================================
   43. EVENT LISTENER
============================================================ */

function bindEvents() {

  /*
   * LOGIN BUTTON
   */

  const loginButton =
    $('loginButton');


  if (loginButton) {

    loginButton.addEventListener(
      'click',
      function () {

        openLoginModal();

      }
    );
  }


  /*
   * CLOSE LOGIN
   */

  const closeLoginButton =
    $('closeLoginButton');


  if (closeLoginButton) {

    closeLoginButton.addEventListener(
      'click',
      function () {

        closeLoginModal();

      }
    );
  }


  /*
   * LOGIN FORM
   */

  const loginForm =
    $('loginForm');


  if (loginForm) {

    loginForm.addEventListener(
      'submit',
      function (event) {

        event.preventDefault();

        loginUser();

      }
    );
  }


  /*
   * KLIK LUAR MODAL
   */

  const loginModal =
    $('loginModal');


  if (loginModal) {

    loginModal.addEventListener(
      'click',
      function (event) {

        if (
          event.target ===
          loginModal
        ) {

          closeLoginModal();
        }
      }
    );
  }


  /*
   * START SCANNER
   */

  const startButton =
    $('startButton');


  if (startButton) {

    startButton.addEventListener(
      'click',
      async function () {

        prepareSpeech();

        speak(
          'Scanner siap'
        );


        await startScanner();

      }
    );
  }


  /*
   * SCAN LAGI
   */

  const scanAgainButton =
    $('scanAgainButton');


  if (scanAgainButton) {

    scanAgainButton.addEventListener(
      'click',
      async function () {

        await restartScanner();

      }
    );
  }


  /*
   * AUTO SCAN
   */

  const autoScanToggle =
    $('autoScanToggle');


  if (autoScanToggle) {

    autoScanToggle.addEventListener(
      'change',
      function () {

        updateAutoScanLabel();

      }
    );
  }


  /*
   * LIMIT ABSENSI
   */

  const attendanceLimit =
    $('attendanceLimit');


  if (attendanceLimit) {

    attendanceLimit.addEventListener(
      'change',
      function () {

        renderTodayAttendance();

      }
    );
  }


  /*
   * LOGOUT
   */

  const logoutButton =
    $('logoutButton');


  if (logoutButton) {

    logoutButton.addEventListener(
      'click',
      function () {

        logoutUser();

      }
    );
  }


  /*
   * JADWAL GURU
   */

  const teacherSchedules =
    $('teacherSchedules');


  if (teacherSchedules) {

    teacherSchedules.addEventListener(
      'click',
      function (event) {

        const card =
          event.target.closest(
            '[data-schedule-id]'
          );


        if (!card) {
          return;
        }


        selectTeacherSchedule(
          card.dataset.scheduleId
        );

      }
    );
  }


  /*
   * RESIZE LAYOUT PUBLIC
   */

  window.addEventListener(
    'resize',
    function () {
      updateTodayAttendanceLayout();
    }
  );


  /*
   * ESC
   */

  document.addEventListener(
    'keydown',
    function (event) {

      if (
        event.key === 'Escape'
      ) {

        closeLoginModal();
      }
    }
  );
}


/* ============================================================
   44. AUTO REFRESH
============================================================ */

function startAutoRefresh() {

  clearInterval(
    refreshTimer
  );


  refreshTimer =
    setInterval(
      async function () {

        try {

          const dashboard = $('dashboard');
          const dashboardVisible =
            dashboard &&
            dashboard.style.display !== 'none';

          if (!dashboardVisible) {
            await loadTodaySummary();
            await loadTodayAttendance();
          }


        } catch (error) {

          console.warn(
            'Auto refresh error:',
            error
          );
        }

      },
      REFRESH_INTERVAL
    );
}


/* ============================================================
   45. INITIALIZE
============================================================ */

async function initializeApp() {

  console.log(
    '========================================'
  );


  console.log(
    'ABSENSI BAITUL ULUM'
  );


  console.log(
    'APP.JS FINAL V14'
  );


  console.log(
    'LOGIN: PASSWORD BIASA'
  );


  console.log(
    '========================================'
  );


  injectDashboardStyles();
  injectAppFooter();


  bindEvents();


  bindTeacherStudentEvents();


  updateAutoScanLabel();


  updateDateTime();


  setInterval(
    updateDateTime,
    1000
  );


  prepareSpeech();


  /*
   * Cek library scanner
   */

  if (
    typeof Html5Qrcode ===
    'undefined'
  ) {

    setStatus(
      '🔴 Library scanner belum siap. Silakan tunggu sebentar.'
    );

  } else {

    setStatus(
      '🟢 Scanner siap.'
    );
  }


  /*
   * Summary publik
   */

  await loadTodaySummary();


  /*
   * Restore session
   */

  await checkSession();


  /*
   * Daftar absensi publik hanya dimuat
   * jika dashboard tidak sedang tampil.
   */

  const dashboard = $('dashboard');
  const dashboardVisible =
    dashboard &&
    dashboard.style.display !== 'none';

  if (!dashboardVisible) {
    await loadTodayAttendance();
  }


  /*
   * Auto refresh
   */

  startAutoRefresh();


  console.log(
    'APP READY'
  );
}


/* ============================================================
   46. WINDOW LOAD
============================================================ */

window.addEventListener(
  'load',
  function () {

    initializeApp();

  }
);


/* ============================================================
   47. PUBLIC FUNCTIONS
============================================================ */

window.startScanner =
  startScanner;

window.stopScanner =
  stopScanner;

window.restartScanner =
  restartScanner;

window.openLoginModal =
  openLoginModal;

window.closeLoginModal =
  closeLoginModal;

window.loginUser =
  loginUser;

window.logoutUser =
  logoutUser;

window.selectTeacherSchedule =
  selectTeacherSchedule;

window.showAllAttendance =
  showAllAttendance;

window.rebuildMonthlyRecapFromDashboard =
  rebuildMonthlyRecapFromDashboard;

window.loadTeacherMonthlyRecap =
  loadTeacherMonthlyRecap;

window.downloadTeacherMonthlyRecapXlsx =
  downloadTeacherMonthlyRecapXlsx;

window.downloadAdminMonthlyRecapXlsx =
  downloadAdminMonthlyRecapXlsx;

window.loadTeacherRecapOptions =
  loadTeacherRecapOptions;


/* ============================================================
   END APP.JS FINAL V14
============================================================ */
