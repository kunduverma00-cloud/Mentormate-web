// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBIz6wDuqGd1KkBdME2p7zqMKntJ1l1G1M",
  authDomain: "mentor-web-6b4c8.firebaseapp.com",
  databaseURL: "https://mentor-web-6b4c8-default-rtdb.firebaseio.com",
  projectId: "mentor-web-6b4c8",
  storageBucket: "mentor-web-6b4c8.firebasestorage.app",
  messagingSenderId: "490743798951",
  appId: "1:490743798951:web:ee3135b39876f3e54f4f82",
  measurementId: "G-ZPTJJ076MB"
};

// Global Variables
let currentUser = null;
let database = null;
let routines = [];
let tests = [];
let testResults = [];
let notifications = [];
let punishmentRules = [];
let studentPunishments = [];
let dailyPoints = {};
let currentEditingRoutineId = null;
let isFirebaseConnected = false;
let dataLoaded = false;

// NEW: NEET Syllabus Variable - ONLY ADDITION
let neetSyllabus = {
  physics: { chapters: [], completed: [] },
  chemistry: { chapters: [], completed: [] },
  biology: { chapters: [], completed: [] }
};

// Test Taking Variables
let currentTest = null;
let currentQuestionIndex = 0;
let testAnswers = [];
let testTimer = null;
let testTimeRemaining = 0;

// Constants
const MENTOR_PASSWORD = "SHARU";
const POINTS_DEDUCTION_RATE = 1;

// Helper functions
function getTodayDateString() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function getYesterdayDateString() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
}

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Initializing MentorMate...');
  initializeFirebase();
  startTimeUpdates();
  checkAndResetDailyRoutines();
});

// Firebase Initialization - UPDATED TO INCLUDE SYLLABUS
function initializeFirebase() {
  try {
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    console.log('✅ Firebase initialized');

    database.ref('.info/connected').on('value', function(snapshot) {
      const connected = snapshot.val() === true;
      isFirebaseConnected = connected;
      updateFirebaseStatus(connected);

      if (connected) {
        console.log('🔥 Firebase connected');
        setupRealTimeListeners();
        if (!dataLoaded) {
          loadInitialData();
        }
      }
    });
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    isFirebaseConnected = false;
    updateFirebaseStatus(false);
    initializeDefaultData();
  }
}

function setupRealTimeListeners() {
  console.log('🎯 Setting up listeners...');

  // Routines listener
  database.ref('routines').on('value', (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      routines = Array.isArray(data) ? data : Object.values(data || {});
      console.log('🔄 Routines updated:', routines.length);

      checkAndResetDailyRoutines();

      if (currentUser) {
        if (currentUser.role === 'student') {
          renderStudentRoutines();
          updateStudentStats();
        } else if (currentUser.role === 'mentor') {
          renderRoutineManager();
        }
      }
    }
  });

  // Daily Points listener
  database.ref('dailyPoints').on('value', (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      dailyPoints = data || {};
      console.log('🔄 Daily points updated');

      if (currentUser && currentUser.role === 'student') {
        updateStudentStats();
        renderDailyPointsBreakdown();
      }
    } else {
      dailyPoints = {};
    }
  });

  // NEW: NEET Syllabus listener - ONLY ADDITION
  database.ref('neetSyllabus').on('value', (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      neetSyllabus = data;
      console.log('🔄 NEET Syllabus updated');

      if (currentUser) {
        if (currentUser.role === 'student') {
          renderStudentSyllabus();
        } else if (currentUser.role === 'mentor') {
          renderMentorSyllabus();
        }
      }
    } else {
      initializeNEETSyllabus();
    }
  });

  // Tests listener
  database.ref('tests').on('value', (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      tests = Array.isArray(data) ? data : Object.values(data || {});

      if (currentUser) {
        renderAvailableTests();
        if (currentUser.role === 'mentor') {
          renderTestReports();
        }
      }
    }
  });

  // Test Results listener
  database.ref('testResults').on('value', (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      testResults = Array.isArray(data) ? data : Object.values(data || {});

      if (currentUser) {
        updateStudentStats();
        if (currentUser.role === 'mentor') {
          renderTestReports();
        }
      }
    }
  });

  // Notifications listener
  database.ref('notifications').on('value', (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      notifications = Array.isArray(data) ? data : Object.values(data || {});

      if (currentUser) {
        if (currentUser.role === 'student') {
          renderStudentActivity();
        } else if (currentUser.role === 'mentor') {
          renderActivityFeed();
          updateNotificationCount();
        }
      }
    }
  });

  // Student Punishments listener
  database.ref('studentPunishments').on('value', (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      studentPunishments = Array.isArray(data) ? data : Object.values(data || {});

      if (currentUser) {
        updateStudentStats();
        if (currentUser.role === 'mentor') {
          renderPunishmentsList();
        }
      }
    }
  });
}

// NEW: NEET Syllabus Initialization - ONLY ADDITION
function initializeNEETSyllabus() {
  console.log('📚 Initializing NEET Syllabus...');

  // Physics chapters with weightages (high to low)
  neetSyllabus.physics.chapters = [
    { id: 'phy_1', name: 'Laws of Motion', class: '11', weightage: '12%' },
    { id: 'phy_2', name: 'Current Electricity', class: '12', weightage: '11%' },
    { id: 'phy_3', name: 'Electromagnetic Induction', class: '12', weightage: '10%' },
    { id: 'phy_4', name: 'Optics', class: '12', weightage: '10%' },
    { id: 'phy_5', name: 'Work Energy Power', class: '11', weightage: '9%' },
    { id: 'phy_6', name: 'Alternating Current', class: '12', weightage: '9%' },
    { id: 'phy_7', name: 'Modern Physics', class: '12', weightage: '8%' },
    { id: 'phy_8', name: 'Thermodynamics', class: '11', weightage: '8%' },
    { id: 'phy_9', name: 'SHM', class: '11', weightage: '7%' },
    { id: 'phy_10', name: 'Waves', class: '11', weightage: '7%' },
    { id: 'phy_11', name: 'Rotational Motion', class: '11', weightage: '6%' },
    { id: 'phy_12', name: 'Gravitation', class: '11', weightage: '6%' },
    { id: 'phy_13', name: 'Electrostatics', class: '12', weightage: '5%' },
    { id: 'phy_14', name: 'Magnetic Effects', class: '12', weightage: '5%' },
    { id: 'phy_15', name: 'Motion in Plane', class: '11', weightage: '4%' },
    { id: 'phy_16', name: 'Motion in Line', class: '11', weightage: '4%' },
    { id: 'phy_17', name: 'Properties of Matter', class: '11', weightage: '4%' },
    { id: 'phy_18', name: 'Kinetic Theory', class: '11', weightage: '3%' },
    { id: 'phy_19', name: 'Semiconductor', class: '12', weightage: '3%' },
    { id: 'phy_20', name: 'Units Measurements', class: '11', weightage: '2%' },
    { id: 'phy_21', name: 'Communication Systems', class: '12', weightage: '2%' }
  ];

  // Chemistry chapters with weightages (high to low)
  neetSyllabus.chemistry.chapters = [
    { id: 'chem_1', name: 'Chemical Bonding', class: '11', weightage: '12%' },
    { id: 'chem_2', name: 'Coordination Compounds', class: '12', weightage: '11%' },
    { id: 'chem_3', name: 'Organic Chemistry GOC', class: '11', weightage: '10%' },
    { id: 'chem_4', name: 'Aldehydes Ketones', class: '12', weightage: '10%' },
    { id: 'chem_5', name: 'Chemical Equilibrium', class: '11', weightage: '9%' },
    { id: 'chem_6', name: 'Electrochemistry', class: '12', weightage: '9%' },
    { id: 'chem_7', name: 'p-Block Elements', class: '12', weightage: '8%' },
    { id: 'chem_8', name: 'Thermodynamics', class: '11', weightage: '8%' },
    { id: 'chem_9', name: 'Solutions', class: '12', weightage: '7%' },
    { id: 'chem_10', name: 'Chemical Kinetics', class: '12', weightage: '7%' },
    { id: 'chem_11', name: 'Alcohols Phenols', class: '12', weightage: '6%' },
    { id: 'chem_12', name: 'Atomic Structure', class: '11', weightage: '6%' },
    { id: 'chem_13', name: 'Hydrocarbons', class: '11', weightage: '5%' },
    { id: 'chem_14', name: 'd f Block Elements', class: '12', weightage: '5%' },
    { id: 'chem_15', name: 'Redox Reactions', class: '11', weightage: '4%' },
    { id: 'chem_16', name: 'States of Matter', class: '11', weightage: '4%' },
    { id: 'chem_17', name: 'Solid State', class: '12', weightage: '4%' },
    { id: 'chem_18', name: 'Periodic Table', class: '11', weightage: '3%' },
    { id: 'chem_19', name: 'Surface Chemistry', class: '12', weightage: '3%' },
    { id: 'chem_20', name: 'Biomolecules', class: '12', weightage: '3%' },
    { id: 'chem_21', name: 's-Block Elements', class: '11', weightage: '2%' },
    { id: 'chem_22', name: 'Basic Concepts', class: '11', weightage: '2%' },
    { id: 'chem_23', name: 'Environmental Chemistry', class: '11', weightage: '2%' }
  ];

  // Biology chapters with weightages (high to low)
  neetSyllabus.biology.chapters = [
    { id: 'bio_1', name: 'Genetics Evolution', class: '12', weightage: '18%' },
    { id: 'bio_2', name: 'Human Physiology', class: '12', weightage: '15%' },
    { id: 'bio_3', name: 'Ecology Environment', class: '12', weightage: '12%' },
    { id: 'bio_4', name: 'Plant Physiology', class: '11', weightage: '10%' },
    { id: 'bio_5', name: 'Reproduction', class: '12', weightage: '9%' },
    { id: 'bio_6', name: 'Biotechnology', class: '12', weightage: '8%' },
    { id: 'bio_7', name: 'Cell Biology', class: '11', weightage: '7%' },
    { id: 'bio_8', name: 'Human Health Disease', class: '12', weightage: '6%' },
    { id: 'bio_9', name: 'Animal Structure', class: '11', weightage: '5%' },
    { id: 'bio_10', name: 'Plant Structure', class: '11', weightage: '4%' },
    { id: 'bio_11', name: 'Classification', class: '11', weightage: '3%' },
    { id: 'bio_12', name: 'Plant Kingdom', class: '11', weightage: '2%' },
    { id: 'bio_13', name: 'Animal Kingdom', class: '11', weightage: '1%' }
  ];

  neetSyllabus.physics.completed = [];
  neetSyllabus.chemistry.completed = [];  
  neetSyllabus.biology.completed = [];

  saveToFirebase('neetSyllabus', neetSyllabus);
  console.log('✅ NEET Syllabus initialized');
}

function checkAndResetDailyRoutines() {
  const today = getTodayDateString();
  let resetNeeded = false;

  routines.forEach(routine => {
    if (routine.status === 'completed' && routine.completedDate !== today) {
      routine.status = 'pending';
      routine.checkedInAt = null;
      routine.minutesLate = null;
      routine.pointsEarned = null;
      routine.punishmentAssigned = null;
      routine.completedDate = null;
      resetNeeded = true;
      console.log(`🔄 Reset routine: ${routine.name} for new day`);
    }
  });

  if (resetNeeded) {
    saveToFirebase('routines', routines);
  }
}

function updateDailyPoints(dateString, points) {
  if (!dailyPoints[dateString]) {
    dailyPoints[dateString] = 0;
  }
  dailyPoints[dateString] += points;
  saveToFirebase('dailyPoints', dailyPoints);
}

function renderDailyPointsBreakdown() {
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();
  const todayPoints = dailyPoints[today] || 0;
  const yesterdayPoints = dailyPoints[yesterday] || 0;

  const todayPointsElement = document.getElementById('todayPoints');
  const yesterdayPointsElement = document.getElementById('yesterdayPoints');
  const yesterdayPointsHistoryElement = document.getElementById('yesterdayPointsHistory');

  if (todayPointsElement) todayPointsElement.textContent = todayPoints;
  if (yesterdayPointsElement) yesterdayPointsElement.textContent = yesterdayPoints;
  if (yesterdayPointsHistoryElement) yesterdayPointsHistoryElement.textContent = yesterdayPoints;
}

function loadInitialData() {
  database.ref('routines').once('value').then(snapshot => {
    if (!snapshot.exists() || !snapshot.val()) {
      console.log('🆕 Initializing default data...');
      initializeDefaultData();
    }

    // Initialize NEET syllabus if not exists - ONLY ADDITION
    database.ref('neetSyllabus').once('value').then(syllabusSnapshot => {
      if (!syllabusSnapshot.exists()) {
        initializeNEETSyllabus();
      }
    });

    dataLoaded = true;
  });
}

function saveToFirebase(path, data) {
  if (!database || !isFirebaseConnected) {
    console.error('❌ Firebase not connected');
    return Promise.reject('Firebase not connected');
  }

  const dataToSave = Array.isArray(data) ? data : (data || {});
  console.log(`💾 Saving to Firebase: ${path}`);

  return database.ref(path).set(dataToSave).then(() => {
    console.log(`✅ Successfully saved: ${path}`);
    return true;
  }).catch(error => {
    console.error(`❌ Error saving ${path}:`, error);
    return false;
  });
}

function updateFirebaseStatus(connected) {
  const statusElement = document.getElementById('firebaseStatus');
  if (!statusElement) return;

  if (connected) {
    statusElement.classList.add('connected');
    const statusText = statusElement.querySelector('.status-text');
    if (statusText) statusText.textContent = 'Firebase Connected';
  } else {
    statusElement.classList.remove('connected');
    const statusText = statusElement.querySelector('.status-text');
    if (statusText) statusText.textContent = 'Firebase Disconnected';
  }
}

function startTimeUpdates() {
  updateCurrentTime();
  setInterval(updateCurrentTime, 1000);
}

function updateCurrentTime() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });

  ['studentTime', 'mentorTime'].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.textContent = timeString;
  });
}

function timeStringToMinutes(timeStr) {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function getSessionStatus(routine) {
  if (!routine.time) return 'no-time';

  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const routineStartTime = timeStringToMinutes(routine.time);

  if (currentTime < routineStartTime - 10) {
    return 'yet-to-live';
  } else if (currentTime < routineStartTime + 30) {
    return 'live';
  } else {
    return 'missed';
  }
}

// SCREEN MANAGEMENT - FIXED
function showScreen(screenId) {
  console.log('📱 Switching to screen:', screenId);

  // Hide all screens
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
    screen.style.display = 'none';
  });

  // Show target screen
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
    targetScreen.style.display = 'block';
    console.log('✅ Screen switched to:', screenId);
  } else {
    console.error('❌ Screen not found:', screenId);
  }
}

// Role Selection - FIXED
function selectRole(role) {
  console.log('👤 Role selected:', role);

  if (role === 'mentor') {
    showScreen('mentorLoginScreen');
    setTimeout(() => {
      const passwordInput = document.getElementById('mentorPasswordInput');
      if (passwordInput) passwordInput.focus();
    }, 100);
  } else {
    currentUser = { role: 'student', name: 'Student' };
    showScreen('studentDashboard');
    setTimeout(() => {
      loadStudentData();
    }, 100);
  }
}

// Mentor Authentication - FIXED
function handlePasswordKeypress(event) {
  if (event.key === 'Enter') {
    verifyMentorPassword();
  }
}

function verifyMentorPassword() {
  const passwordInput = document.getElementById('mentorPasswordInput');
  const errorElement = document.getElementById('passwordError');

  if (!passwordInput || !errorElement) return;

  const password = passwordInput.value;

  if (password === MENTOR_PASSWORD) {
    currentUser = { role: 'mentor', name: 'Mentor' };
    showScreen('mentorDashboard');
    errorElement.textContent = '';
    errorElement.style.display = 'none';
    passwordInput.value = '';
    setTimeout(() => {
      loadMentorData();
    }, 100);
  } else {
    errorElement.textContent = 'Incorrect password. Please try again.';
    errorElement.style.display = 'block';
    passwordInput.value = '';
  }
}

function backToRoleSelection() {
  currentUser = null;
  const passwordInput = document.getElementById('mentorPasswordInput');
  const errorElement = document.getElementById('passwordError');

  if (passwordInput) passwordInput.value = '';
  if (errorElement) errorElement.style.display = 'none';

  showScreen('roleSelectionScreen');
}

// Section Management for Student Dashboard - UPDATED TO INCLUDE SYLLABUS
function showSection(sectionName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  if (event && event.target) {
    event.target.classList.add('active');
  }

  // Update content sections
  document.querySelectorAll('.content-section').forEach(section => {
    section.classList.remove('active');
  });

  const targetSection = document.getElementById(`${sectionName}Section`);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  // Load section data
  if (sectionName === 'routines') {
    renderStudentRoutines();
    updateStudentStats();
  } else if (sectionName === 'tests') {
    renderAvailableTests();
  } else if (sectionName === 'syllabus') {
    renderStudentSyllabus(); // NEW: SYLLABUS RENDERING
  } else if (sectionName === 'progress') {
    updateStudentStats();
    renderStudentActivity();
    renderDailyPointsBreakdown();
  }
}

// Section Management for Mentor Dashboard - UPDATED TO INCLUDE SYLLABUS
function showMentorSection(sectionName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  if (event && event.target) {
    event.target.classList.add('active');
  }

  // Update content sections
  document.querySelectorAll('.content-section').forEach(section => {
    section.classList.remove('active');
  });

  const targetSection = document.getElementById(`mentor${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)}Section`);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  // Load section data
  if (sectionName === 'overview') {
    renderActivityFeed();
    updateNotificationCount();
  } else if (sectionName === 'routines') {
    renderRoutineManager();
  } else if (sectionName === 'tests') {
    renderTestReports();
  } else if (sectionName === 'syllabus') {
    renderMentorSyllabus(); // NEW: MENTOR SYLLABUS RENDERING
  } else if (sectionName === 'punishments') {
    renderPunishmentsList();
  }
}

function initializeDefaultData() {
  console.log('🆕 Initializing default data...');

  if (routines.length === 0) {
    routines = [
      {
        id: 'morning-exercise',
        name: 'Morning Exercise',
        time: '07:00',
        duration: 30,
        points: 10,
        category: 'Health',
        status: 'pending'
      },
      {
        id: 'study-session-1',
        name: 'Study Session 1',
        time: '09:00',
        duration: 120,
        points: 20,
        category: 'Education',
        status: 'pending'
      }
    ];
    saveToFirebase('routines', routines);
  }

  if (tests.length === 0) {
    tests = [
      {
        id: 'weekly-assessment',
        title: 'Weekly Assessment',
        category: 'Academic',
        duration: 30,
        questions: [
          {
            question: 'What is the capital of France?',
            options: ['London', 'Berlin', 'Paris', 'Madrid'],
            correctAnswer: 2
          }
        ],
        status: 'available'
      }
    ];
    saveToFirebase('tests', tests);
  }

  if (testResults.length === 0) {
    testResults = [];
    saveToFirebase('testResults', testResults);
  }

  if (notifications.length === 0) {
    notifications = [];
    saveToFirebase('notifications', notifications);
  }

  if (studentPunishments.length === 0) {
    studentPunishments = [];
    saveToFirebase('studentPunishments', studentPunishments);
  }

  if (Object.keys(dailyPoints).length === 0) {
    dailyPoints = {};
    saveToFirebase('dailyPoints', dailyPoints);
  }

  // Initialize NEET Syllabus - NEW ADDITION
  initializeNEETSyllabus();

  console.log('✅ Default data initialized');
}

// Student Functions
function loadStudentData() {
  console.log('👨🎓 Loading student data...');
  renderStudentRoutines();
  updateStudentStats();
  renderAvailableTests();
  renderStudentActivity();
  renderDailyPointsBreakdown();
  renderStudentSyllabus(); // NEW: LOAD SYLLABUS
}

function renderStudentRoutines() {
  const container = document.getElementById('studentRoutines');
  if (!container) return;

  if (!routines || routines.length === 0) {
    container.innerHTML = '<div class="no-routines">No routines available</div>';
    return;
  }

  const html = routines.map(routine => {
    const sessionStatus = getSessionStatus(routine);
    const isLive = sessionStatus === 'live';
    const isMissed = sessionStatus === 'missed';

    let statusClass = routine.status;
    if (isMissed && routine.status === 'pending') {
      statusClass = 'missed';
    }

    let routineHtml = `
      <div class="routine-card">
        <div class="routine-header">
          <div class="routine-info">
            <h4>${routine.name}</h4>
            <div class="routine-time">🕒 ${routine.time}</div>
            <div class="routine-points">💎 ${routine.points} points</div>
            <div class="routine-category">📂 ${routine.category}</div>
          </div>
          <div class="routine-status ${statusClass}">${routine.status}</div>
        </div>
    `;

    if (routine.status === 'completed' && routine.checkedInAt) {
      const checkedInTime = new Date(routine.checkedInAt);
      const isLate = routine.minutesLate > 0;

      routineHtml += `
        <div class="checkin-details">
          <div class="checkin-time">✅ Checked in at: ${checkedInTime.toLocaleTimeString()}</div>
          ${isLate 
            ? `<div class="late-info">⏰ ${routine.minutesLate} minutes late</div>`
            : `<div class="ontime-info">🎯 On time!</div>`
          }
          <div class="points-earned">💎 Points earned: ${routine.pointsEarned}</div>
          ${routine.punishmentAssigned ? `<div class="punishment-assigned">⚠️ Punishment: ${routine.punishmentAssigned}</div>` : ''}
        </div>
      `;
    }

    routineHtml += `
        <div class="routine-actions">
    `;

    if (isLive && routine.status === 'pending') {
      routineHtml += `<button onclick="checkInToRoutine('${routine.id}')" class="btn btn-primary">✅ Check In</button>`;
    } else if (routine.status === 'pending') {
      if (sessionStatus === 'yet-to-live') {
        routineHtml += `<button class="btn btn-secondary" disabled>⏳ Not yet available</button>`;
      } else {
        routineHtml += `<button class="btn btn-danger" disabled>❌ Missed</button>`;
      }
    } else if (routine.status === 'completed') {
      routineHtml += `<button class="btn btn-success" disabled>✅ Completed</button>`;
    }

    routineHtml += `
        </div>
      </div>
    `;

    return routineHtml;
  }).join('');

  container.innerHTML = html;
}

function checkInToRoutine(routineId) {
  const routine = routines.find(r => r.id === routineId);
  if (!routine) return;

  const now = new Date();
  const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
  const routineTimeMinutes = timeStringToMinutes(routine.time);
  const minutesLate = Math.max(0, currentTimeMinutes - routineTimeMinutes);

  let pointsEarned = routine.points;
  let punishmentAssigned = null;

  // Apply punishment rules for being late
  if (minutesLate > 30) {
    pointsEarned = Math.max(0, routine.points - 5);
    punishmentAssigned = '30 minutes extra study';

    // Add punishment to student punishments
    const punishment = {
      id: Date.now().toString(),
      studentName: 'Student',
      type: 'Late Check-in',
      reason: `${minutesLate} minutes late for ${routine.name}`,
      penalty: '30 minutes extra study',
      assignedDate: now.toISOString(),
      status: 'pending'
    };
    studentPunishments.push(punishment);
    saveToFirebase('studentPunishments', studentPunishments);
  } else if (minutesLate > 15) {
    pointsEarned = Math.max(0, routine.points - 3);
  } else if (minutesLate > 5) {
    pointsEarned = Math.max(0, routine.points - 1);
  }

  // Update routine
  routine.status = 'completed';
  routine.checkedInAt = now.toISOString();
  routine.minutesLate = minutesLate;
  routine.pointsEarned = pointsEarned;
  routine.punishmentAssigned = punishmentAssigned;
  routine.completedDate = getTodayDateString();

  // Update daily points
  const today = getTodayDateString();
  updateDailyPoints(today, pointsEarned);

  // Add notification
  const notification = {
    id: Date.now().toString(),
    type: 'routine',
    studentName: 'Student',
    routineName: routine.name,
    timestamp: now.toISOString(),
    minutesLate: minutesLate,
    pointsEarned: pointsEarned,
    punishmentAssigned: punishmentAssigned
  };
  notifications.push(notification);
  saveToFirebase('notifications', notifications);

  saveToFirebase('routines', routines);

  let message = `✅ Checked in to ${routine.name}!\n\n`;
  if (minutesLate === 0) {
    message += `🎯 Perfect timing! You earned ${pointsEarned} points.`;
  } else if (minutesLate <= 5) {
    message += `⏰ ${minutesLate} minutes late. You earned ${pointsEarned} points.`;
  } else {
    message += `⚠️ ${minutesLate} minutes late. Points deducted: ${pointsEarned} points earned.`;
    if (punishmentAssigned) {
      message += `\n\n🚨 Punishment assigned: ${punishmentAssigned}`;
    }
  }

  alert(message);
}

function updateStudentStats() {
  const totalRoutines = routines.length;
  const completedRoutines = routines.filter(r => r.status === 'completed').length;
  const completedTests = testResults.length;
  const activePunishments = studentPunishments.filter(p => p.status === 'pending').length;

  const totalEl = document.getElementById('totalRoutines');
  const completedEl = document.getElementById('completedRoutines');
  const testsEl = document.getElementById('completedTests');
  const punishmentsEl = document.getElementById('activePunishments');

  if (totalEl) totalEl.textContent = totalRoutines;
  if (completedEl) completedEl.textContent = completedRoutines;
  if (testsEl) testsEl.textContent = completedTests;
  if (punishmentsEl) punishmentsEl.textContent = activePunishments;
}

function renderAvailableTests() {
  const container = document.getElementById('availableTests');
  if (!container) return;

  if (!tests || tests.length === 0) {
    container.innerHTML = '<div class="no-tests">No tests available</div>';
    return;
  }

  const html = tests.map(test => `
    <div class="test-card">
      <div class="test-header">
        <div class="test-info">
          <h4>${test.title}</h4>
          <div class="test-meta">
            <div>📂 ${test.category}</div>
            <div>⏱️ ${test.duration} minutes</div>
            <div>❓ ${test.questions.length} questions</div>
          </div>
        </div>
      </div>
      <div class="test-actions">
        <button onclick="startTest('${test.id}')" class="btn btn-primary">🚀 Start Test</button>
      </div>
    </div>
  `).join('');

  container.innerHTML = html;
}

function renderStudentActivity() {
  const container = document.getElementById('studentActivity');
  if (!container) return;

  if (!notifications || notifications.length === 0) {
    container.innerHTML = '<div class="no-activity">No recent activity</div>';
    return;
  }

  const recentNotifications = notifications.slice(-10).reverse();

  const html = recentNotifications.map(notification => {
    const time = new Date(notification.timestamp);
    const timeAgo = getTimeAgo(time);

    return `
      <div class="activity-item">
        <div class="activity-content">
          <div class="activity-title">${notification.type === 'routine' ? 'Routine Completed' : 'Test Completed'}</div>
          <div class="activity-details">${notification.routineName || notification.testTitle}</div>
          <div class="activity-time">${timeAgo}</div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

// NEW: Student Syllabus Functions - ONLY ADDITION
function renderStudentSyllabus() {
  const container = document.getElementById('syllabusContainer');
  if (!container) return;

  const physicsTotal = neetSyllabus.physics.chapters.length;
  const physicsCompleted = neetSyllabus.physics.completed.length;
  const chemTotal = neetSyllabus.chemistry.chapters.length;
  const chemCompleted = neetSyllabus.chemistry.completed.length;
  const bioTotal = neetSyllabus.biology.chapters.length;
  const bioCompleted = neetSyllabus.biology.completed.length;

  const totalChapters = physicsTotal + chemTotal + bioTotal;
  const totalCompleted = physicsCompleted + chemCompleted + bioCompleted;
  const progress = totalChapters > 0 ? Math.round((totalCompleted/totalChapters)*100) : 0;

  container.innerHTML = `
    <div class="syllabus-overview">
      <h3>📊 Overall Progress: ${progress}% (${totalCompleted}/${totalChapters} chapters)</h3>
      <div class="subject-progress">
        <div class="subject-stat">
          <span>⚗️ Physics: ${physicsCompleted}/${physicsTotal} (${Math.round((physicsCompleted/physicsTotal)*100)}%)</span>
        </div>
        <div class="subject-stat">
          <span>🧪 Chemistry: ${chemCompleted}/${chemTotal} (${Math.round((chemCompleted/chemTotal)*100)}%)</span>
        </div>
        <div class="subject-stat">
          <span>🧬 Biology: ${bioCompleted}/${bioTotal} (${Math.round((bioCompleted/bioTotal)*100)}%)</span>
        </div>
      </div>
    </div>

    <div class="syllabus-tabs">
      <button class="syllabus-tab active" onclick="showSyllabusSubject('physics')">⚗️ Physics</button>
      <button class="syllabus-tab" onclick="showSyllabusSubject('chemistry')">🧪 Chemistry</button>
      <button class="syllabus-tab" onclick="showSyllabusSubject('biology')">🧬 Biology</button>
    </div>

    <div class="syllabus-content">
      <div id="physicsContent" class="syllabus-subject active">
        ${renderSubjectChapters('physics')}
      </div>
      <div id="chemistryContent" class="syllabus-subject">
        ${renderSubjectChapters('chemistry')}
      </div>
      <div id="biologyContent" class="syllabus-subject">
        ${renderSubjectChapters('biology')}
      </div>
    </div>
  `;
}

function renderSubjectChapters(subject) {
  const chapters = neetSyllabus[subject].chapters;
  const completed = neetSyllabus[subject].completed;

  if (!chapters || chapters.length === 0) return '<p>No chapters available</p>';

  let html = '<div class="chapter-list">';

  chapters.forEach(chapter => {
    const isCompleted = completed.includes(chapter.id);
    html += `
      <div class="chapter-item ${isCompleted ? 'completed' : ''}">
        <input type="checkbox" ${isCompleted ? 'checked' : ''} 
               onchange="toggleChapter('${subject}', '${chapter.id}', this.checked)">
        <span class="chapter-name">${chapter.name}</span>
        <span class="chapter-class">${chapter.class}th</span>
        <span class="chapter-weight">${chapter.weightage}</span>
        <span class="chapter-status">${isCompleted ? '✅ Done' : '⏳ Pending'}</span>
      </div>
    `;
  });

  html += '</div>';
  return html;
}

function showSyllabusSubject(subject) {
  document.querySelectorAll('.syllabus-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  event.target.classList.add('active');

  document.querySelectorAll('.syllabus-subject').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`${subject}Content`).classList.add('active');
}

function toggleChapter(subject, chapterId, isCompleted) {
  const completed = neetSyllabus[subject].completed;

  if (isCompleted && !completed.includes(chapterId)) {
    completed.push(chapterId);
  } else if (!isCompleted && completed.includes(chapterId)) {
    const index = completed.indexOf(chapterId);
    completed.splice(index, 1);
  }

  saveToFirebase('neetSyllabus', neetSyllabus);
  renderStudentSyllabus();
}

// NEW: Mentor Syllabus Functions - ONLY ADDITION
function renderMentorSyllabus() {
  const container = document.getElementById('mentorSyllabusContainer');
  if (!container) return;

  const physicsTotal = neetSyllabus.physics.chapters.length;
  const physicsCompleted = neetSyllabus.physics.completed.length;
  const chemTotal = neetSyllabus.chemistry.chapters.length;
  const chemCompleted = neetSyllabus.chemistry.completed.length;
  const bioTotal = neetSyllabus.biology.chapters.length;
  const bioCompleted = neetSyllabus.biology.completed.length;

  container.innerHTML = `
    <div class="mentor-syllabus-overview">
      <h3>📊 Student NEET Syllabus Progress</h3>
      <div class="progress-cards">
        <div class="progress-card physics">
          <h4>⚗️ Physics</h4>
          <div class="big-number">${Math.round((physicsCompleted/physicsTotal)*100)}%</div>
          <div class="progress-detail">${physicsCompleted}/${physicsTotal} chapters</div>
        </div>
        <div class="progress-card chemistry">
          <h4>🧪 Chemistry</h4>
          <div class="big-number">${Math.round((chemCompleted/chemTotal)*100)}%</div>
          <div class="progress-detail">${chemCompleted}/${chemTotal} chapters</div>
        </div>
        <div class="progress-card biology">
          <h4>🧬 Biology</h4>
          <div class="big-number">${Math.round((bioCompleted/bioTotal)*100)}%</div>
          <div class="progress-detail">${bioCompleted}/${bioTotal} chapters</div>
        </div>
      </div>

      <div class="syllabus-summary">
        <h4>📋 Complete Overview</h4>
        <p>Total Chapters: <strong>${physicsTotal + chemTotal + bioTotal}</strong></p>
        <p>Completed: <strong>${physicsCompleted + chemCompleted + bioCompleted}</strong></p>
        <p>Overall Progress: <strong>${Math.round(((physicsCompleted + chemCompleted + bioCompleted)/(physicsTotal + chemTotal + bioTotal))*100)}%</strong></p>
      </div>
    </div>
  `;
}

// Mentor Functions
function loadMentorData() {
  console.log('👨‍🏫 Loading mentor data...');
  renderActivityFeed();
  updateNotificationCount();
  renderRoutineManager();
  renderTestReports();
  renderPunishmentsList();
  renderMentorSyllabus(); // NEW: LOAD MENTOR SYLLABUS
}

function renderActivityFeed() {
  const container = document.getElementById('activityFeed');
  if (!container) return;

  if (!notifications || notifications.length === 0) {
    container.innerHTML = '<div class="no-activity">No recent student activity</div>';
    return;
  }

  const recentNotifications = notifications.slice(-10).reverse();

  const html = recentNotifications.map(notification => {
    const time = new Date(notification.timestamp);
    const timeAgo = getTimeAgo(time);

    return `
      <div class="activity-item">
        <div class="activity-content">
          <div class="activity-title">${notification.studentName} - ${notification.type === 'routine' ? 'Routine' : 'Test'}</div>
          <div class="activity-details">
            ${notification.routineName || notification.testTitle}
            ${notification.minutesLate ? ` (${notification.minutesLate} min late)` : ''}
            ${notification.pointsEarned ? ` - ${notification.pointsEarned} points` : ''}
          </div>
          <div class="activity-time">${timeAgo}</div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

function updateNotificationCount() {
  const count = notifications.length;
  const countElement = document.getElementById('notificationCount');
  if (countElement) {
    countElement.textContent = `${count} new alerts`;
  }
}

function renderRoutineManager() {
  const container = document.getElementById('routineManager');
  if (!container) return;

  if (!routines || routines.length === 0) {
    container.innerHTML = '<div class="no-routines">No routines created yet</div>';
    return;
  }

  const html = routines.map(routine => `
    <div class="routine-card">
      <div class="routine-header">
        <div class="routine-info">
          <h4>${routine.name}</h4>
          <div class="routine-time">🕒 ${routine.time}</div>
          <div class="routine-points">💎 ${routine.points} points</div>
          <div class="routine-category">📂 ${routine.category}</div>
        </div>
        <div class="routine-status ${routine.status}">${routine.status}</div>
      </div>
      <div class="routine-actions">
        <button onclick="editRoutine('${routine.id}')" class="btn btn-secondary btn-small">✏️ Edit</button>
        <button onclick="deleteRoutine('${routine.id}')" class="btn btn-danger btn-small">🗑️ Delete</button>
      </div>
    </div>
  `).join('');

  container.innerHTML = html;
}

function renderTestReports() {
  const container = document.getElementById('testReports');
  if (!container) return;

  if (!testResults || testResults.length === 0) {
    container.innerHTML = '<div class="no-results">No test results yet</div>';
    return;
  }

  const html = testResults.map(result => {
    const test = tests.find(t => t.id === result.testId);
    const testTitle = test ? test.title : 'Unknown Test';

    return `
      <div class="test-result-card">
        <div class="result-header">
          <h4>${testTitle}</h4>
          <div class="result-score">${result.percentage}%</div>
        </div>
        <div class="result-details">
          <div>**Student:** ${result.studentName}</div>
          <div>**Score:** ${result.percentage}% (${result.correctAnswers}/${result.totalQuestions})</div>
          <div>**Completed:** ${new Date(result.completedAt).toLocaleString()}</div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

function renderPunishmentsList() {
  const container = document.getElementById('punishmentsList');
  if (!container) return;

  if (!studentPunishments || studentPunishments.length === 0) {
    container.innerHTML = '<div class="no-punishments">No active punishments</div>';
    return;
  }

  const activePunishments = studentPunishments.filter(p => p.status === 'pending');

  const html = activePunishments.map(punishment => `
    <div class="punishment-card">
      <div class="punishment-header">
        <h4>${punishment.studentName}</h4>
        <div class="punishment-status ${punishment.status}">${punishment.status}</div>
      </div>
      <div class="punishment-details">
        <div>**Type:** ${punishment.type}</div>
        <div>**Reason:** ${punishment.reason}</div>
        <div>**Penalty:** ${punishment.penalty}</div>
        <div>**Assigned:** ${new Date(punishment.assignedDate).toLocaleString()}</div>
      </div>
      <div class="punishment-actions">
        <button onclick="markPunishmentCompleted('${punishment.id}')" class="btn btn-success btn-small">
          ✅ Mark Completed
        </button>
        <button onclick="removePunishment('${punishment.id}')" class="btn btn-danger btn-small">
          🗑️ Remove
        </button>
      </div>
    </div>
  `).join('');

  container.innerHTML = html;
}

// Modal Functions
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
  }
}

// Mentor Action Functions
function showCreateTestModal() {
  openModal('createTestModal');
}

function showAddRoutineModal() {
  openModal('addRoutineModal');
  document.getElementById('routineModalTitle').textContent = 'Add New Routine';
  clearRoutineForm();
  currentEditingRoutineId = null;
}

function clearRoutineForm() {
  document.getElementById('routineName').value = '';
  document.getElementById('routineTime').value = '';
  document.getElementById('routineDuration').value = '30';
  document.getElementById('routinePoints').value = '10';
  document.getElementById('routineCategory').value = 'Health';
}

function saveRoutine() {
  const name = document.getElementById('routineName').value.trim();
  const time = document.getElementById('routineTime').value;
  const duration = parseInt(document.getElementById('routineDuration').value);
  const points = parseInt(document.getElementById('routinePoints').value);
  const category = document.getElementById('routineCategory').value;

  if (!name || !time) {
    alert('Please fill in all required fields');
    return;
  }

  if (currentEditingRoutineId) {
    // Edit existing routine
    const routine = routines.find(r => r.id === currentEditingRoutineId);
    if (routine) {
      routine.name = name;
      routine.time = time;
      routine.duration = duration;
      routine.points = points;
      routine.category = category;
    }
  } else {
    // Add new routine
    const newRoutine = {
      id: Date.now().toString(),
      name: name,
      time: time,
      duration: duration,
      points: points,
      category: category,
      status: 'pending'
    };
    routines.push(newRoutine);
  }

  saveToFirebase('routines', routines);
  closeModal('addRoutineModal');
  renderRoutineManager();
  alert('Routine saved successfully!');
}

function editRoutine(routineId) {
  const routine = routines.find(r => r.id === routineId);
  if (!routine) return;

  currentEditingRoutineId = routineId;
  document.getElementById('routineName').value = routine.name;
  document.getElementById('routineTime').value = routine.time;
  document.getElementById('routineDuration').value = routine.duration;
  document.getElementById('routinePoints').value = routine.points;
  document.getElementById('routineCategory').value = routine.category;
  document.getElementById('routineModalTitle').textContent = 'Edit Routine';

  openModal('addRoutineModal');
}

function deleteRoutine(routineId) {
  if (!confirm('Are you sure you want to delete this routine?')) return;

  const routineIndex = routines.findIndex(r => r.id === routineId);
  if (routineIndex > -1) {
    routines.splice(routineIndex, 1);
    saveToFirebase('routines', routines);
    renderRoutineManager();
    alert('Routine deleted successfully!');
  }
}

function saveTest() {
  const title = document.getElementById('testTitle').value.trim();
  const category = document.getElementById('testCategory').value;
  const duration = parseInt(document.getElementById('testDuration').value);
  const questionsJson = document.getElementById('testQuestions').value.trim();

  if (!title || !questionsJson) {
    alert('Please fill in all required fields');
    return;
  }

  let questions;
  try {
    questions = JSON.parse(questionsJson);
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Questions must be a non-empty array');
    }
  } catch (error) {
    alert('Invalid JSON format for questions');
    return;
  }

  const newTest = {
    id: Date.now().toString(),
    title: title,
    category: category,
    duration: duration,
    questions: questions,
    status: 'available'
  };

  tests.push(newTest);
  saveToFirebase('tests', tests);
  closeModal('createTestModal');
  renderAvailableTests();
  alert('Test created successfully!');
}

function markPunishmentCompleted(punishmentId) {
  const punishment = studentPunishments.find(p => p.id === punishmentId);
  if (punishment) {
    punishment.status = 'completed';
    punishment.completedDate = new Date().toISOString();
    saveToFirebase('studentPunishments', studentPunishments);
    renderPunishmentsList();
    alert('Punishment marked as completed!');
  }
}

function removePunishment(punishmentId) {
  if (!confirm('Are you sure you want to remove this punishment?')) return;

  const punishmentIndex = studentPunishments.findIndex(p => p.id === punishmentId);
  if (punishmentIndex > -1) {
    studentPunishments.splice(punishmentIndex, 1);
    saveToFirebase('studentPunishments', studentPunishments);
    renderPunishmentsList();
    alert('Punishment removed successfully!');
  }
}

function viewAnalytics() {
  alert('Analytics feature coming soon! This will show detailed student performance data.');
}

// Test Taking Functions
function startTest(testId) {
  const test = tests.find(t => t.id === testId);
  if (!test) return;

  currentTest = test;
  currentQuestionIndex = 0;
  testAnswers = new Array(test.questions.length).fill(-1);
  testTimeRemaining = test.duration * 60;

  document.getElementById('testModalTitle').textContent = test.title;
  renderCurrentQuestion();
  startTestTimer();
  openModal('testModal');
}

function renderCurrentQuestion() {
  if (!currentTest) return;

  const question = currentTest.questions[currentQuestionIndex];
  const container = document.getElementById('testQuestionContainer');

  const html = `
    <div class="test-question">
      <h4>Question ${currentQuestionIndex + 1}: ${question.question}</h4>
      <div class="test-options">
        ${question.options.map((option, index) => `
          <div class="test-option ${testAnswers[currentQuestionIndex] === index ? 'selected' : ''}" 
               onclick="selectAnswer(${index})">
            <input type="radio" name="answer" ${testAnswers[currentQuestionIndex] === index ? 'checked' : ''}>
            <span>${String.fromCharCode(65 + index)}. ${option}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  container.innerHTML = html;
  updateTestProgress();
}

function selectAnswer(answerIndex) {
  testAnswers[currentQuestionIndex] = answerIndex;
  renderCurrentQuestion();
}

function updateTestProgress() {
  const progress = ((currentQuestionIndex + 1) / currentTest.questions.length) * 100;
  document.getElementById('testProgressFill').style.width = progress + '%';
  document.getElementById('testProgressText').textContent = 
    `Question ${currentQuestionIndex + 1} of ${currentTest.questions.length}`;

  // Update navigation buttons
  document.getElementById('prevQuestionBtn').disabled = currentQuestionIndex === 0;
  const nextBtn = document.getElementById('nextQuestionBtn');
  if (currentQuestionIndex === currentTest.questions.length - 1) {
    nextBtn.textContent = 'Submit Test';
    nextBtn.onclick = endTest;
  } else {
    nextBtn.textContent = 'Next →';
    nextBtn.onclick = nextQuestion;
  }
}

function previousQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    renderCurrentQuestion();
  }
}

function nextQuestion() {
  if (currentQuestionIndex < currentTest.questions.length - 1) {
    currentQuestionIndex++;
    renderCurrentQuestion();
  }
}

function startTestTimer() {
  testTimer = setInterval(() => {
    testTimeRemaining--;
    const minutes = Math.floor(testTimeRemaining / 60);
    const seconds = testTimeRemaining % 60;
    document.getElementById('testTimer').textContent = 
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    if (testTimeRemaining <= 0) {
      endTest();
    }
  }, 1000);
}

function endTest() {
  if (testTimer) {
    clearInterval(testTimer);
    testTimer = null;
  }

  let correctAnswers = 0;
  currentTest.questions.forEach((question, index) => {
    if (testAnswers[index] === question.correctAnswer) {
      correctAnswers++;
    }
  });

  const totalQuestions = currentTest.questions.length;
  const percentage = Math.round((correctAnswers / totalQuestions) * 100);

  const result = {
    id: Date.now().toString(),
    testId: currentTest.id,
    studentName: 'Student',
    correctAnswers: correctAnswers,
    totalQuestions: totalQuestions,
    percentage: percentage,
    completedAt: new Date().toISOString()
  };

  testResults.push(result);
  saveToFirebase('testResults', testResults);

  const notification = {
    id: Date.now().toString(),
    type: 'test',
    studentName: 'Student',
    testTitle: currentTest.title,
    timestamp: new Date().toISOString(),
    percentage: percentage,
    correctAnswers: correctAnswers,
    totalQuestions: totalQuestions
  };
  notifications.push(notification);
  saveToFirebase('notifications', notifications);

  closeModal('testModal');

  alert(`Test Completed!\n\nScore: ${percentage}% (${correctAnswers}/${totalQuestions})\n\nYour results have been saved.`);

  currentTest = null;
  currentQuestionIndex = 0;
  testAnswers = [];
}

// Utility Functions
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

console.log('✅ MentorMate with NEET Syllabus loaded successfully!');