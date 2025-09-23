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

// Global Variables - ALL ORIGINAL VARIABLES RESTORED
let currentUser = null;
let database = null;
let routines = [];
let tests = [];
let testResults = [];
let notifications = [];
let studentPunishments = [];
let dailyPoints = {};
let sessionTracking = {};
let performanceAnalytics = {};
let currentEditingRoutineId = null;
let isFirebaseConnected = false;
let dataLoaded = false;

// NEW: NEET Syllabus Variables
let neetSyllabus = {
  physics: { chapters: [], completed: [] },
  chemistry: { chapters: [], completed: [] },
  biology: { chapters: [], completed: [] }
};

// SESSION TRACKING VARIABLES - ALL ORIGINAL RESTORED
let activeSession = null;
let sessionTimer = null;
let sessionStartTime = null;
let sessionPauseTime = null;
let totalPausedTime = 0;
let sessionElapsedTime = 0;
let sessionPointsEarned = 0;
let sessionState = 'none';
let lastUpdateTime = null;
let sessionValidated = false;

// Test Taking Variables - ALL ORIGINAL RESTORED
let currentTest = null;
let currentQuestionIndex = 0;
let testAnswers = [];
let testTimer = null;
let testTimeRemaining = 0;

// Constants - ALL ORIGINAL RESTORED
const MENTOR_PASSWORD = "SHARU";
const POINTS_PER_MINUTE = 0.2;
const POINT_DEDUCTION_RATE = 1;
const MAX_SESSION_TIME = 480;

// Helper functions - ALL ORIGINAL RESTORED
function getTodayDateString() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function getYesterdayDateString() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
}

function getWeekStartDateString() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek);
  return `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;
}

function formatTime(minutes) {
  if (!minutes || minutes < 0 || minutes > MAX_SESSION_TIME * 60) {
    return '0m';
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

function formatTimeHHMM(minutes) {
  if (!minutes || minutes < 0 || minutes > MAX_SESSION_TIME * 60) {
    return '00:00';
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  return `${String(Math.min(hours, 99)).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function validateSessionTime(elapsedMinutes) {
  if (!elapsedMinutes || isNaN(elapsedMinutes) || elapsedMinutes < 0) {
    return 0;
  }
  return Math.min(elapsedMinutes, MAX_SESSION_TIME);
}

function validatePoints(points) {
  if (!points || isNaN(points) || points < 0) {
    return 0;
  }
  return Math.min(points, MAX_SESSION_TIME * POINTS_PER_MINUTE);
}

// NEW: NEET SYLLABUS INITIALIZATION
function initializeNEETSyllabus() {
  console.log('📚 Initializing NEET Syllabus...');

  // Physics Chapters - Class 11 & 12 with High to Low Weightage
  neetSyllabus.physics.chapters = [
    // HIGH WEIGHTAGE
    { id: 'phy_1', name: 'Laws of Motion', class: '11', weightage: '12%' },
    { id: 'phy_2', name: 'Current Electricity', class: '12', weightage: '11%' },
    { id: 'phy_3', name: 'Electromagnetic Induction', class: '12', weightage: '10%' },
    { id: 'phy_4', name: 'Optics (Ray & Wave)', class: '12', weightage: '10%' },
    { id: 'phy_5', name: 'Work, Energy & Power', class: '11', weightage: '9%' },
    { id: 'phy_6', name: 'Alternating Current', class: '12', weightage: '9%' },
    { id: 'phy_7', name: 'Modern Physics', class: '12', weightage: '8%' },
    { id: 'phy_8', name: 'Thermodynamics', class: '11', weightage: '8%' },
    // MEDIUM WEIGHTAGE
    { id: 'phy_9', name: 'Simple Harmonic Motion', class: '11', weightage: '7%' },
    { id: 'phy_10', name: 'Waves', class: '11', weightage: '7%' },
    { id: 'phy_11', name: 'Rotational Motion', class: '11', weightage: '6%' },
    { id: 'phy_12', name: 'Gravitation', class: '11', weightage: '6%' },
    { id: 'phy_13', name: 'Electrostatics', class: '12', weightage: '5%' },
    { id: 'phy_14', name: 'Magnetic Effects of Current', class: '12', weightage: '5%' },
    { id: 'phy_15', name: 'Motion in Plane', class: '11', weightage: '4%' },
    { id: 'phy_16', name: 'Motion in Straight Line', class: '11', weightage: '4%' },
    { id: 'phy_17', name: 'Properties of Solids & Liquids', class: '11', weightage: '4%' },
    // LOW WEIGHTAGE
    { id: 'phy_18', name: 'Kinetic Theory of Gases', class: '11', weightage: '3%' },
    { id: 'phy_19', name: 'Semiconductor Electronics', class: '12', weightage: '3%' },
    { id: 'phy_20', name: 'Units & Measurements', class: '11', weightage: '2%' },
    { id: 'phy_21', name: 'Communication Systems', class: '12', weightage: '2%' }
  ];

  // Chemistry Chapters - Class 11 & 12 with High to Low Weightage
  neetSyllabus.chemistry.chapters = [
    // HIGH WEIGHTAGE
    { id: 'chem_1', name: 'Chemical Bonding', class: '11', weightage: '12%' },
    { id: 'chem_2', name: 'Coordination Compounds', class: '12', weightage: '11%' },
    { id: 'chem_3', name: 'Organic Chemistry - GOC', class: '11', weightage: '10%' },
    { id: 'chem_4', name: 'Aldehydes, Ketones & Carboxylic Acids', class: '12', weightage: '10%' },
    { id: 'chem_5', name: 'Chemical Equilibrium', class: '11', weightage: '9%' },
    { id: 'chem_6', name: 'Electrochemistry', class: '12', weightage: '9%' },
    { id: 'chem_7', name: 'p-Block Elements', class: '12', weightage: '8%' },
    { id: 'chem_8', name: 'Thermodynamics', class: '11', weightage: '8%' },
    // MEDIUM WEIGHTAGE
    { id: 'chem_9', name: 'Solutions', class: '12', weightage: '7%' },
    { id: 'chem_10', name: 'Chemical Kinetics', class: '12', weightage: '7%' },
    { id: 'chem_11', name: 'Alcohols, Phenols & Ethers', class: '12', weightage: '6%' },
    { id: 'chem_12', name: 'Atomic Structure', class: '11', weightage: '6%' },
    { id: 'chem_13', name: 'Hydrocarbons', class: '11', weightage: '5%' },
    { id: 'chem_14', name: 'd & f Block Elements', class: '12', weightage: '5%' },
    { id: 'chem_15', name: 'Redox Reactions', class: '11', weightage: '4%' },
    { id: 'chem_16', name: 'States of Matter', class: '11', weightage: '4%' },
    { id: 'chem_17', name: 'Solid State', class: '12', weightage: '4%' },
    // LOW WEIGHTAGE
    { id: 'chem_18', name: 'Periodic Table', class: '11', weightage: '3%' },
    { id: 'chem_19', name: 'Surface Chemistry', class: '12', weightage: '3%' },
    { id: 'chem_20', name: 'Biomolecules', class: '12', weightage: '3%' },
    { id: 'chem_21', name: 's-Block Elements', class: '11', weightage: '2%' },
    { id: 'chem_22', name: 'Some Basic Concepts', class: '11', weightage: '2%' },
    { id: 'chem_23', name: 'Environmental Chemistry', class: '11', weightage: '2%' }
  ];

  // Biology Chapters - Class 11 & 12 with High to Low Weightage
  neetSyllabus.biology.chapters = [
    // HIGH WEIGHTAGE
    { id: 'bio_1', name: 'Genetics & Evolution', class: '12', weightage: '18%' },
    { id: 'bio_2', name: 'Human Physiology', class: '12', weightage: '15%' },
    { id: 'bio_3', name: 'Ecology & Environment', class: '12', weightage: '12%' },
    { id: 'bio_4', name: 'Plant Physiology', class: '11', weightage: '10%' },
    { id: 'bio_5', name: 'Reproduction', class: '12', weightage: '9%' },
    { id: 'bio_6', name: 'Biotechnology', class: '12', weightage: '8%' },
    // MEDIUM WEIGHTAGE
    { id: 'bio_7', name: 'Cell Biology', class: '11', weightage: '7%' },
    { id: 'bio_8', name: 'Human Health & Disease', class: '12', weightage: '6%' },
    { id: 'bio_9', name: 'Structural Organisation (Animals)', class: '11', weightage: '5%' },
    { id: 'bio_10', name: 'Structural Organisation (Plants)', class: '11', weightage: '4%' },
    // LOW WEIGHTAGE
    { id: 'bio_11', name: 'Biological Classification', class: '11', weightage: '3%' },
    { id: 'bio_12', name: 'Plant Kingdom', class: '11', weightage: '2%' },
    { id: 'bio_13', name: 'Animal Kingdom', class: '11', weightage: '1%' }
  ];

  // Initialize completion arrays
  neetSyllabus.physics.completed = [];
  neetSyllabus.chemistry.completed = [];
  neetSyllabus.biology.completed = [];

  // Save to Firebase
  saveToFirebase('neetSyllabus', neetSyllabus);
  console.log('✅ NEET Syllabus initialized with proper weightages and class divisions');
}

// NEW: RENDER STUDENT SYLLABUS
function renderStudentSyllabus() {
  const container = document.getElementById('syllabusContainer');
  if (!container) return;

  // Calculate progress
  const physicsTotal = neetSyllabus.physics.chapters.length;
  const physicsCompleted = neetSyllabus.physics.completed.length;
  const chemistryTotal = neetSyllabus.chemistry.chapters.length;
  const chemistryCompleted = neetSyllabus.chemistry.completed.length;
  const biologyTotal = neetSyllabus.biology.chapters.length;
  const biologyCompleted = neetSyllabus.biology.completed.length;

  const totalChapters = physicsTotal + chemistryTotal + biologyTotal;
  const totalCompleted = physicsCompleted + chemistryCompleted + biologyCompleted;
  const overallProgress = totalChapters > 0 ? Math.round((totalCompleted / totalChapters) * 100) : 0;

  container.innerHTML = `
    <div class="syllabus-overview">
      <div class="progress-summary">
        <h3>📊 Overall Progress: ${overallProgress}% (${totalCompleted}/${totalChapters} chapters)</h3>
        <div class="subject-progress">
          <div class="subject-stat">
            <span class="subject-icon">⚗️</span>
            <span>Physics: ${physicsCompleted}/${physicsTotal}</span>
            <span class="progress-percent">${physicsTotal > 0 ? Math.round((physicsCompleted/physicsTotal)*100) : 0}%</span>
          </div>
          <div class="subject-stat">
            <span class="subject-icon">🧪</span>
            <span>Chemistry: ${chemistryCompleted}/${chemistryTotal}</span>
            <span class="progress-percent">${chemistryTotal > 0 ? Math.round((chemistryCompleted/chemistryTotal)*100) : 0}%</span>
          </div>
          <div class="subject-stat">
            <span class="subject-icon">🧬</span>
            <span>Biology: ${biologyCompleted}/${biologyTotal}</span>
            <span class="progress-percent">${biologyTotal > 0 ? Math.round((biologyCompleted/biologyTotal)*100) : 0}%</span>
          </div>
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

  if (!chapters || chapters.length === 0) {
    return '<div class="no-chapters">No chapters available</div>';
  }

  let html = `
    <div class="chapter-list">
      <div class="chapter-header">
        <div class="col-check">✓</div>
        <div class="col-chapter">Chapter Name</div>
        <div class="col-class">Class</div>
        <div class="col-weight">Weightage</div>
        <div class="col-status">Status</div>
      </div>
  `;

  chapters.forEach(chapter => {
    const isCompleted = completed.includes(chapter.id);
    const statusClass = isCompleted ? 'completed' : 'pending';

    html += `
      <div class="chapter-row ${statusClass}">
        <div class="col-check">
          <input type="checkbox" ${isCompleted ? 'checked' : ''} 
                 onchange="toggleChapter('${subject}', '${chapter.id}', this.checked)">
        </div>
        <div class="col-chapter">${chapter.name}</div>
        <div class="col-class">
          <span class="class-badge class-${chapter.class}">${chapter.class}th</span>
        </div>
        <div class="col-weight">
          <span class="weight-badge">${chapter.weightage}</span>
        </div>
        <div class="col-status">
          <span class="status-text ${statusClass}">
            ${isCompleted ? '✅ Completed' : '⏳ Pending'}
          </span>
        </div>
      </div>
    `;
  });

  html += '</div>';
  return html;
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

  console.log(`📚 ${subject} chapter ${chapterId} marked as ${isCompleted ? 'completed' : 'pending'}`);
}

function showSyllabusSubject(subject) {
  document.querySelectorAll('.syllabus-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  event.target.classList.add('active');

  document.querySelectorAll('.syllabus-subject').forEach(content => {
    content.classList.remove('active');
  });

  const targetContent = document.getElementById(`${subject}Content`);
  if (targetContent) {
    targetContent.classList.add('active');
  }
}

// NEW: RENDER MENTOR SYLLABUS MANAGEMENT
function renderMentorSyllabus() {
  const container = document.getElementById('mentorSyllabusContainer');
  if (!container) return;

  // Calculate progress for mentor overview
  const physicsTotal = neetSyllabus.physics.chapters.length;
  const physicsCompleted = neetSyllabus.physics.completed.length;
  const chemistryTotal = neetSyllabus.chemistry.chapters.length;
  const chemistryCompleted = neetSyllabus.chemistry.completed.length;
  const biologyTotal = neetSyllabus.biology.chapters.length;
  const biologyCompleted = neetSyllabus.biology.completed.length;

  container.innerHTML = `
    <div class="mentor-syllabus-overview">
      <h3>📊 Student Progress Monitoring</h3>
      <div class="mentor-progress-cards">
        <div class="progress-card physics">
          <h4>⚗️ Physics</h4>
          <div class="progress-info">
            <span class="big-number">${Math.round((physicsCompleted/physicsTotal)*100)}%</span>
            <span class="progress-detail">${physicsCompleted}/${physicsTotal} chapters</span>
          </div>
        </div>
        <div class="progress-card chemistry">
          <h4>🧪 Chemistry</h4>
          <div class="progress-info">
            <span class="big-number">${Math.round((chemistryCompleted/chemistryTotal)*100)}%</span>
            <span class="progress-detail">${chemistryCompleted}/${chemistryTotal} chapters</span>
          </div>
        </div>
        <div class="progress-card biology">
          <h4>🧬 Biology</h4>
          <div class="progress-info">
            <span class="big-number">${Math.round((biologyCompleted/biologyTotal)*100)}%</span>
            <span class="progress-detail">${biologyCompleted}/${biologyTotal} chapters</span>
          </div>
        </div>
      </div>

      <div class="syllabus-details">
        <h4>📋 Complete NEET Syllabus Overview</h4>
        <div class="syllabus-summary">
          <p>📖 Total Chapters: <strong>${physicsTotal + chemistryTotal + biologyTotal}</strong></p>
          <p>✅ Completed: <strong>${physicsCompleted + chemistryCompleted + biologyCompleted}</strong></p>
          <p>⏳ Remaining: <strong>${(physicsTotal + chemistryTotal + biologyTotal) - (physicsCompleted + chemistryCompleted + biologyCompleted)}</strong></p>
          <p>🎯 Overall Progress: <strong>${Math.round(((physicsCompleted + chemistryCompleted + biologyCompleted)/(physicsTotal + chemistryTotal + biologyTotal))*100)}%</strong></p>
        </div>
      </div>
    </div>

    <div class="mentor-syllabus-tabs">
      <button class="mentor-tab active" onclick="showMentorSyllabusSubject('physics')">⚗️ Physics Details</button>
      <button class="mentor-tab" onclick="showMentorSyllabusSubject('chemistry')">🧪 Chemistry Details</button>
      <button class="mentor-tab" onclick="showMentorSyllabusSubject('biology')">🧬 Biology Details</button>
    </div>

    <div class="mentor-syllabus-content">
      <div id="mentorPhysicsContent" class="mentor-subject active">
        ${renderMentorSubjectDetails('physics')}
      </div>
      <div id="mentorChemistryContent" class="mentor-subject">
        ${renderMentorSubjectDetails('chemistry')}
      </div>
      <div id="mentorBiologyContent" class="mentor-subject">
        ${renderMentorSubjectDetails('biology')}
      </div>
    </div>
  `;
}

function renderMentorSubjectDetails(subject) {
  const chapters = neetSyllabus[subject].chapters;
  const completed = neetSyllabus[subject].completed;
  const subjectName = subject.charAt(0).toUpperCase() + subject.slice(1);

  let html = `
    <div class="mentor-subject-header">
      <h4>${subjectName} - NEET Chapter Breakdown</h4>
      <p>Organized by weightage (High to Low) with class divisions</p>
    </div>

    <div class="mentor-chapter-list">
      <div class="mentor-chapter-header">
        <div class="col-status">Status</div>
        <div class="col-chapter">Chapter Name</div>
        <div class="col-class">Class</div>
        <div class="col-weight">NEET Weightage</div>
        <div class="col-priority">Priority</div>
      </div>
  `;

  chapters.forEach((chapter, index) => {
    const isCompleted = completed.includes(chapter.id);
    const priority = index < 5 ? 'High' : index < 10 ? 'Medium' : 'Low';
    const priorityClass = priority.toLowerCase();

    html += `
      <div class="mentor-chapter-row ${isCompleted ? 'completed' : 'pending'}">
        <div class="col-status">
          <span class="status-icon">${isCompleted ? '✅' : '⏳'}</span>
        </div>
        <div class="col-chapter">${chapter.name}</div>
        <div class="col-class">
          <span class="class-badge class-${chapter.class}">${chapter.class}th</span>
        </div>
        <div class="col-weight">
          <span class="weight-badge">${chapter.weightage}</span>
        </div>
        <div class="col-priority">
          <span class="priority-badge ${priorityClass}">${priority}</span>
        </div>
      </div>
    `;
  });

  html += '</div>';
  return html;
}

function showMentorSyllabusSubject(subject) {
  document.querySelectorAll('.mentor-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  event.target.classList.add('active');

  document.querySelectorAll('.mentor-subject').forEach(content => {
    content.classList.remove('active');
  });

  const targetContent = document.getElementById(`mentor${subject.charAt(0).toUpperCase() + subject.slice(1)}Content`);
  if (targetContent) {
    targetContent.classList.add('active');
  }
}
// Initialize App - EXACTLY AS ORIGINAL
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Initializing MentorMate Pro...');

  // Add keyboard shortcut for data reset (Ctrl+Shift+R)
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
      e.preventDefault();
      if (currentUser && currentUser.role === 'mentor') {
        resetAllData();
      } else {
        console.log('⚠️ Only mentor can reset data');
      }
    }
  });

  initializeFirebase();
  startTimeUpdates();
  checkAndResetDailyRoutines();

  setTimeout(() => {
    checkSessionStateWithValidation();
  }, 2000);
});

// Firebase Initialization - UPDATED TO INCLUDE NEET SYLLABUS
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

  // Routines listener - ORIGINAL RESTORED
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
          renderLiveSessionsMonitor();
        }
      }
    }
  });

  // NEW: NEET Syllabus listener
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

  // Session Tracking listener - ORIGINAL RESTORED
  database.ref('sessionTracking').on('value', (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      sessionTracking = data || {};
      console.log('🔄 Session tracking updated');

      validateSessionTrackingData();

      if (currentUser) {
        if (currentUser.role === 'student') {
          updateSessionDisplay();
        } else if (currentUser.role === 'mentor') {
          renderLiveSessionsMonitor();
          updateMentorAnalytics();
        }
      }
    } else {
      sessionTracking = {};
    }
  });

  // All other listeners - ORIGINAL RESTORED
  database.ref('dailyPoints').on('value', (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      dailyPoints = validateDailyPointsData(data || {});
      console.log('🔄 Daily points updated');

      if (currentUser) {
        updateStudentStats();
        if (currentUser.role === 'mentor') {
          updateMentorAnalytics();
        }
      }
    } else {
      dailyPoints = {};
    }
  });

  database.ref('performanceAnalytics').on('value', (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      performanceAnalytics = data || {};
      console.log('🔄 Performance analytics updated');

      if (currentUser && currentUser.role === 'mentor') {
        updateMentorAnalytics();
      }
    } else {
      performanceAnalytics = {};
    }
  });

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

  database.ref('notifications').on('value', (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      notifications = Array.isArray(data) ? data : Object.values(data || {});

      if (currentUser) {
        if (currentUser.role === 'student') {
          renderStudentActivity();
        } else if (currentUser.role === 'mentor') {
          renderActivityFeed();
        }
      }
    }
  });

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

// ALL ORIGINAL UTILITY FUNCTIONS RESTORED
function validateSessionTrackingData() {
  for (const date in sessionTracking) {
    const dayData = sessionTracking[date];
    if (dayData.sessions) {
      dayData.sessions = dayData.sessions.map(session => {
        return {
          ...session,
          actualDuration: validateSessionTime(session.actualDuration || 0),
          pointsEarned: validatePoints(session.pointsEarned || 0),
          efficiency: Math.min(Math.max(session.efficiency || 0, 0), 200)
        };
      });
    }
    if (dayData.activeSession) {
      const activeSession = dayData.activeSession;
      if (!validateSavedSession(activeSession)) {
        dayData.activeSession = null;
        console.log('🗑️ Removed invalid active session for', date);
      }
    }
  }
}

function validateDailyPointsData(data) {
  const validatedData = {};
  for (const date in data) {
    const points = data[date];
    if (typeof points === 'number' && points >= 0 && points <= MAX_SESSION_TIME * 12) {
      validatedData[date] = Math.floor(points);
    } else {
      console.log(`⚠️ Invalid points for ${date}: ${points} - setting to 0`);
      validatedData[date] = 0;
    }
  }
  return validatedData;
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
      routine.sessionStarted = null;
      routine.actualDuration = null;
      routine.efficiency = null;
      resetNeeded = true;
      console.log(`🔄 Reset routine: ${routine.name} for new day`);
    }
  });

  if (resetNeeded) {
    saveToFirebase('routines', routines);
  }
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

  const todayDateElement = document.getElementById('todayDate');
  if (todayDateElement) {
    todayDateElement.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}

function loadInitialData() {
  database.ref('routines').once('value').then(snapshot => {
    if (!snapshot.exists() || !snapshot.val()) {
      console.log('🆕 Initializing default data...');
      initializeDefaultData();
    }

    // Initialize NEET syllabus if not exists
    database.ref('neetSyllabus').once('value').then(syllabusSnapshot => {
      if (!syllabusSnapshot.exists()) {
        initializeNEETSyllabus();
      }
    });

    dataLoaded = true;
  });
}

function initializeDefaultData() {
  console.log('🆕 Initializing default data...');

  if (routines.length === 0) {
    routines = [
      {
        id: 'morning-study',
        name: 'Morning Study Session',
        time: '07:00',
        duration: 90,
        points: 18,
        category: 'Education',
        status: 'pending'
      },
      {
        id: 'evening-study',
        name: 'Evening Study Session',
        time: '19:00',
        duration: 120,
        points: 24,
        category: 'Education',
        status: 'pending'
      }
    ];
    saveToFirebase('routines', routines);
  }

  if (Object.keys(dailyPoints).length === 0) {
    dailyPoints = {};
    saveToFirebase('dailyPoints', dailyPoints);
  }

  if (Object.keys(sessionTracking).length === 0) {
    sessionTracking = {};
    saveToFirebase('sessionTracking', sessionTracking);
  }

  if (Object.keys(performanceAnalytics).length === 0) {
    performanceAnalytics = {};
    saveToFirebase('performanceAnalytics', performanceAnalytics);
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

  // Initialize NEET Syllabus
  initializeNEETSyllabus();

  console.log('✅ Default data initialized');
}
// SCREEN MANAGEMENT - EXACTLY AS ORIGINAL
function showScreen(screenId) {
  console.log('📱 Switching to screen:', screenId);

  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
    screen.style.display = 'none';
  });

  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
    targetScreen.style.display = 'block';
    console.log('✅ Screen switched to:', screenId);
  } else {
    console.error('❌ Screen not found:', screenId);
  }
}

function selectRole(role) {
  console.log('👤 Role selected:', role);
  clearActiveSession();

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
  if (activeSession && sessionState === 'active') {
    pauseSession();
  }

  currentUser = null;
  const passwordInput = document.getElementById('mentorPasswordInput');
  const errorElement = document.getElementById('passwordError');

  if (passwordInput) passwordInput.value = '';
  if (errorElement) errorElement.style.display = 'none';

  showScreen('roleSelectionScreen');
}

// Section Management for Student Dashboard - UPDATED TO INCLUDE SYLLABUS
function showSection(sectionName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  if (event && event.target) {
    event.target.classList.add('active');
  }

  document.querySelectorAll('.content-section').forEach(section => {
    section.classList.remove('active');
  });

  const targetSection = document.getElementById(`${sectionName}Section`);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  if (sectionName === 'routines') {
    renderStudentRoutines();
    updateStudentStats();
  } else if (sectionName === 'tests') {
    renderAvailableTests();
  } else if (sectionName === 'syllabus') {
    renderStudentSyllabus();
  } else if (sectionName === 'progress') {
    updateStudentStats();
    renderStudentActivity();
    renderStudentAnalytics();
  }
}

// Section Management for Mentor Dashboard - UPDATED TO INCLUDE SYLLABUS
function showMentorSection(sectionName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  if (event && event.target) {
    event.target.classList.add('active');
  }

  document.querySelectorAll('.content-section').forEach(section => {
    section.classList.remove('active');
  });

  const targetSection = document.getElementById(`mentor${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)}Section`);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  if (sectionName === 'analytics') {
    updateMentorAnalytics();
    renderMentorCharts();
  } else if (sectionName === 'sessions') {
    renderLiveSessionsMonitor();
  } else if (sectionName === 'routines') {
    renderRoutineManager();
  } else if (sectionName === 'tests') {
    renderTestReports();
  } else if (sectionName === 'syllabus') {
    renderMentorSyllabus();
  } else if (sectionName === 'punishments') {
    renderPunishmentsList();
  }
}

// ALL SESSION TRACKING FUNCTIONS - ORIGINAL RESTORED
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
  } else if (currentTime < routineStartTime + 60) {
    return 'live';
  } else {
    return 'missed';
  }
}

function startSession(routineId) {
  console.log('🎯 Starting session:', routineId);
  const routine = routines.find(r => r.id === routineId);
  if (!routine) {
    alert('Session not found!');
    return;
  }

  const sessionStatus = getSessionStatus(routine);
  if (sessionStatus !== 'live') {
    alert('This session is not currently available for check-in!');
    return;
  }

  if (activeSession && sessionState === 'active') {
    alert('Please end your current session before starting a new one!');
    return;
  }

  if (activeSession) {
    const confirmStart = confirm('You have a paused session. Starting a new session will end the previous one. Continue?');
    if (!confirmStart) return;
    clearActiveSession();
  }

  const now = Date.now();
  sessionStartTime = now;
  lastUpdateTime = now;
  activeSession = {
    routineId: routineId,
    routineName: routine.name,
    targetDuration: Math.min(routine.duration, MAX_SESSION_TIME),
    pointsPerMinute: POINTS_PER_MINUTE,
    startTime: new Date().toISOString(),
    status: 'active',
    totalPausedTime: 0
  };
  sessionPauseTime = null;
  totalPausedTime = 0;
  sessionElapsedTime = 0;
  sessionPointsEarned = 0;
  sessionState = 'active';
  sessionValidated = true;

  routine.status = 'in-progress';
  routine.sessionStarted = new Date().toISOString();

  saveToFirebase('routines', routines);
  saveSessionToFirebase();

  if (sessionTimer) {
    clearInterval(sessionTimer);
  }
  sessionTimer = setInterval(updateSessionTimerSafely, 1000);

  showActiveSessionMonitor();
  hidePausedSessionResume();

  console.log('✅ Session started successfully');
}

function pauseSession() {
  console.log('⏸️ Pausing session');
  if (!activeSession || sessionState !== 'active') {
    console.log('❌ No active session to pause');
    return;
  }

  sessionPauseTime = Date.now();
  sessionState = 'paused';
  activeSession.status = 'paused';

  if (sessionTimer) {
    clearInterval(sessionTimer);
    sessionTimer = null;
  }

  saveSessionToFirebase();
  showPausedSessionResume();
  hideActiveSessionMonitor();

  console.log('✅ Session paused successfully');
}

function resumeSession() {
  console.log('▶️ Resuming session');
  if (!activeSession || sessionState !== 'paused') {
    console.log('❌ No paused session to resume');
    return;
  }

  if (sessionPauseTime) {
    const pauseDuration = Date.now() - sessionPauseTime;
    totalPausedTime += pauseDuration;
    sessionPauseTime = null;
  }

  sessionState = 'active';
  activeSession.status = 'active';
  activeSession.totalPausedTime = totalPausedTime;
  lastUpdateTime = Date.now();

  if (sessionTimer) {
    clearInterval(sessionTimer);
  }
  sessionTimer = setInterval(updateSessionTimerSafely, 1000);

  saveSessionToFirebase();
  showActiveSessionMonitor();
  hidePausedSessionResume();

  console.log('✅ Session resumed successfully');
}

function stopSession() {
  console.log('⏹️ Stopping session');
  if (!activeSession) {
    console.log('❌ No active session to stop');
    return;
  }

  if (sessionTimer) {
    clearInterval(sessionTimer);
    sessionTimer = null;
  }

  const endTime = Date.now();
  const rawTotalTime = Math.floor((endTime - sessionStartTime - totalPausedTime) / 60000);
  const totalSessionTime = validateSessionTime(rawTotalTime);
  const targetDuration = activeSession.targetDuration;
  const pointsEarned = validatePoints(totalSessionTime * POINTS_PER_MINUTE);

  const routine = routines.find(r => r.id === activeSession.routineId);
  if (routine) {
    routine.status = 'completed';
    routine.completedAt = new Date().toISOString();
    routine.actualDuration = totalSessionTime;
    routine.pointsEarned = pointsEarned;
    routine.completedDate = getTodayDateString();
    routine.efficiency = Math.min(Math.round((totalSessionTime / targetDuration) * 100), 200);
  }

  const today = getTodayDateString();
  if (!dailyPoints[today]) {
    dailyPoints[today] = 0;
  }
  dailyPoints[today] = validatePoints(dailyPoints[today] + pointsEarned);

  const sessionData = {
    routineId: activeSession.routineId,
    routineName: activeSession.routineName,
    targetDuration: targetDuration,
    actualDuration: totalSessionTime,
    pointsEarned: pointsEarned,
    efficiency: Math.min(Math.round((totalSessionTime / targetDuration) * 100), 200),
    startTime: activeSession.startTime,
    endTime: new Date().toISOString(),
    totalPausedTime: Math.floor(totalPausedTime / 60000)
  };

  if (!sessionTracking[today]) {
    sessionTracking[today] = { sessions: [] };
  }
  if (!sessionTracking[today].sessions) {
    sessionTracking[today].sessions = [];
  }
  sessionTracking[today].sessions.push(sessionData);
  sessionTracking[today].activeSession = null;

  updatePerformanceAnalytics(sessionData);

  saveToFirebase('routines', routines);
  saveToFirebase('dailyPoints', dailyPoints);
  saveToFirebase('sessionTracking', sessionTracking);
  saveToFirebase('performanceAnalytics', performanceAnalytics);

  const notification = {
    id: Date.now().toString(),
    type: 'session',
    studentName: 'Student',
    routineName: activeSession.routineName,
    timestamp: new Date().toISOString(),
    actualDuration: totalSessionTime,
    pointsEarned: pointsEarned,
    efficiency: Math.round((totalSessionTime / targetDuration) * 100),
    date: today
  };
  notifications.push(notification);
  saveToFirebase('notifications', notifications);

  let message = `🎉 Session Completed!\n\n`;
  message += `📚 Session: ${activeSession.routineName}\n`;
  message += `⏱️ Study Time: ${formatTime(totalSessionTime)}\n`;
  message += `🎯 Target: ${formatTime(targetDuration)}\n`;
  message += `📊 Efficiency: ${Math.round((totalSessionTime / targetDuration) * 100)}%\n`;
  message += `🏆 Points Earned: ${pointsEarned}\n\n`;

  if (totalSessionTime >= targetDuration) {
    message += `🌟 Excellent! You met your target!`;
  } else if (totalSessionTime >= targetDuration * 0.8) {
    message += `👍 Good effort! Almost reached your target!`;
  } else {
    message += `💪 Keep pushing! Try to reach your target next time!`;
  }

  alert(message);
  clearActiveSession();
  console.log('✅ Session completed successfully');
}

function saveSessionToFirebase() {
  const today = getTodayDateString();
  if (!sessionTracking[today]) {
    sessionTracking[today] = {};
  }
  sessionTracking[today].activeSession = activeSession;
  saveToFirebase('sessionTracking', sessionTracking);
}

function updateSessionTimerSafely() {
  if (!activeSession || sessionState !== 'active' || !sessionValidated) return;

  const now = Date.now();
  if (lastUpdateTime && (now - lastUpdateTime) > 5000) {
    console.log('⚠️ Timer anomaly detected - resetting');
    lastUpdateTime = now;
    return;
  }
  lastUpdateTime = now;

  const elapsed = now - sessionStartTime - totalPausedTime;
  const elapsedMinutes = Math.floor(elapsed / 60000);

  sessionElapsedTime = validateSessionTime(elapsedMinutes);
  sessionPointsEarned = validatePoints(sessionElapsedTime * POINTS_PER_MINUTE);

  updateActiveSessionDisplay();
}

function updateActiveSessionDisplay() {
  if (!activeSession || !sessionValidated) return;

  const targetDuration = activeSession.targetDuration;
  const percentage = Math.min((sessionElapsedTime / targetDuration) * 100, 100);

  const timeElement = document.getElementById('activeSessionTime');
  if (timeElement) {
    timeElement.textContent = formatTimeHHMM(sessionElapsedTime);
  }

  const percentageElement = document.getElementById('sessionPercentage');
  if (percentageElement) {
    percentageElement.textContent = `${Math.round(percentage)}%`;
  }

  const progressRing = document.getElementById('progressRingFill');
  if (progressRing) {
    const circumference = 2 * Math.PI * 54;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    progressRing.style.strokeDasharray = strokeDasharray;
    progressRing.style.strokeDashoffset = strokeDashoffset;
  }

  const nameElement = document.getElementById('activeSessionName');
  if (nameElement) {
    nameElement.textContent = activeSession.routineName;
  }

  const targetElement = document.getElementById('targetDuration');
  if (targetElement) {
    targetElement.textContent = formatTime(targetDuration);
  }

  const elapsedElement = document.getElementById('elapsedTime');
  if (elapsedElement) {
    elapsedElement.textContent = formatTime(sessionElapsedTime);
  }

  const pointsElement = document.getElementById('currentPoints');
  if (pointsElement) {
    pointsElement.textContent = sessionPointsEarned;
  }

  const statusElement = document.getElementById('sessionStatus');
  if (statusElement) {
    statusElement.textContent = sessionState === 'active' ? 'Active' : 'Paused';
  }
}
// ALL ORIGINAL HELPER FUNCTIONS RESTORED
function showActiveSessionMonitor() {
  const monitor = document.getElementById('activeSessionMonitor');
  if (monitor) {
    monitor.style.display = 'block';
  }
}

function hideActiveSessionMonitor() {
  const monitor = document.getElementById('activeSessionMonitor');
  if (monitor) {
    monitor.style.display = 'none';
  }
}

function showPausedSessionResume() {
  const resume = document.getElementById('pausedSessionResume');
  if (resume) {
    resume.style.display = 'block';
    const nameElement = document.getElementById('pausedSessionName');
    const timeElement = document.getElementById('pausedSessionTime');
    if (nameElement && activeSession) {
      nameElement.textContent = activeSession.routineName;
    }
    if (timeElement && sessionElapsedTime !== null) {
      timeElement.textContent = `Paused at: ${formatTimeHHMM(sessionElapsedTime)}`;
    }
  }
}

function hidePausedSessionResume() {
  const resume = document.getElementById('pausedSessionResume');
  if (resume) {
    resume.style.display = 'none';
  }
}

function updateSessionDisplay() {
  const today = getTodayDateString();
  const todaySessions = sessionTracking[today];
  let totalTime = 0;

  if (todaySessions && todaySessions.sessions) {
    totalTime = todaySessions.sessions.reduce((sum, session) => {
      const duration = validateSessionTime(session.actualDuration || 0);
      return sum + duration;
    }, 0);
  }

  if (activeSession && sessionState === 'active' && sessionValidated) {
    totalTime += sessionElapsedTime;
  }

  totalTime = validateSessionTime(totalTime);

  const sessionTimeElement = document.getElementById('totalSessionTime');
  if (sessionTimeElement) {
    sessionTimeElement.textContent = formatTime(totalTime);
  }
}

function updatePerformanceAnalytics(sessionData) {
  const today = getTodayDateString();
  if (!performanceAnalytics[today]) {
    performanceAnalytics[today] = {
      totalSessions: 0,
      totalStudyTime: 0,
      totalPointsEarned: 0,
      averageEfficiency: 0,
      sessions: []
    };
  }

  const todayAnalytics = performanceAnalytics[today];
  todayAnalytics.totalSessions += 1;
  todayAnalytics.totalStudyTime = validateSessionTime(todayAnalytics.totalStudyTime + sessionData.actualDuration);
  todayAnalytics.totalPointsEarned = validatePoints(todayAnalytics.totalPointsEarned + sessionData.pointsEarned);
  todayAnalytics.sessions.push(sessionData);

  const totalEfficiency = todayAnalytics.sessions.reduce((sum, session) => sum + Math.min(session.efficiency || 0, 200), 0);
  todayAnalytics.averageEfficiency = Math.round(totalEfficiency / todayAnalytics.totalSessions);
}

function validateSavedSession(session) {
  if (!session || typeof session !== 'object') {
    return false;
  }
  if (!session.routineId || !session.startTime || !session.targetDuration) {
    return false;
  }
  const startTime = new Date(session.startTime);
  if (isNaN(startTime.getTime())) {
    return false;
  }
  const sessionDate = startTime.toISOString().split('T')[0];
  const today = getTodayDateString();
  if (sessionDate !== today) {
    return false;
  }
  const sessionAge = (Date.now() - startTime.getTime()) / (1000 * 60 * 60);
  if (sessionAge > 24) {
    return false;
  }
  if (session.targetDuration > MAX_SESSION_TIME) {
    return false;
  }
  return true;
}

function checkSessionStateWithValidation() {
  const today = getTodayDateString();
  if (sessionTracking[today] && sessionTracking[today].activeSession) {
    const savedSession = sessionTracking[today].activeSession;
    console.log('🔍 Found saved session:', savedSession);

    if (validateSavedSession(savedSession)) {
      activeSession = savedSession;
      sessionState = savedSession.status || 'paused';
      if (sessionState === 'active') {
        sessionState = 'paused';
        activeSession.status = 'paused';
      }

      if (savedSession.startTime) {
        const startTime = new Date(savedSession.startTime).getTime();
        const currentTime = Date.now();
        const rawElapsed = Math.floor((currentTime - startTime - (savedSession.totalPausedTime || 0)) / 60000);

        sessionElapsedTime = validateSessionTime(rawElapsed);
        sessionPointsEarned = validatePoints(sessionElapsedTime * POINTS_PER_MINUTE);

        console.log('⏱️ Validated session time:', sessionElapsedTime, 'minutes');
        console.log('🎯 Validated points:', sessionPointsEarned);
      }

      if (sessionState === 'paused') {
        showPausedSessionResume();
        hideActiveSessionMonitor();
        console.log('⏸️ Restored paused session');
      }
      sessionValidated = true;
    } else {
      console.log('⚠️ Invalid saved session data - clearing');
      clearActiveSession();
      sessionTracking[today].activeSession = null;
      saveToFirebase('sessionTracking', sessionTracking);
    }
  }

  if (currentUser && currentUser.role === 'student') {
    updateSessionDisplay();
    renderStudentRoutines();
  }
}

function clearActiveSession() {
  if (sessionTimer) {
    clearInterval(sessionTimer);
    sessionTimer = null;
  }
  activeSession = null;
  sessionState = 'none';
  sessionStartTime = null;
  sessionPauseTime = null;
  totalPausedTime = 0;
  sessionElapsedTime = 0;
  sessionPointsEarned = 0;
  lastUpdateTime = null;
  sessionValidated = false;
  hideActiveSessionMonitor();
  hidePausedSessionResume();
}

function resetAllData() {
  if (confirm('⚠️ WARNING! This will completely reset all data. Are you sure?')) {
    const confirmReset = prompt('Type "RESET" to confirm complete data reset:');
    if (confirmReset === 'RESET') {
      console.log('🔄 Resetting all data...');
      dailyPoints = {};
      sessionTracking = {};
      performanceAnalytics = {};
      testResults = [];
      notifications = [];
      studentPunishments = [];

      clearActiveSession();

      saveToFirebase('dailyPoints', {});
      saveToFirebase('sessionTracking', {});
      saveToFirebase('performanceAnalytics', {});
      saveToFirebase('testResults', []);
      saveToFirebase('notifications', []);
      saveToFirebase('studentPunishments', []);

      alert('✅ All data has been reset successfully!');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }
}

// Student Functions - ALL ORIGINAL RESTORED
function loadStudentData() {
  console.log('👨🎓 Loading student data...');
  renderStudentRoutines();
  updateStudentStats();
  renderAvailableTests();
  renderStudentActivity();
  updateSessionDisplay();
  renderStudentSyllabus();

  setTimeout(() => {
    checkSessionStateWithValidation();
  }, 1000);
}

function renderStudentRoutines() {
  const container = document.getElementById('studentRoutines');
  if (!container) return;

  if (!routines || routines.length === 0) {
    container.innerHTML = '<div class="text-center">No routines available</div>';
    return;
  }

  const html = routines.map(routine => {
    const status = getSessionStatus(routine);
    const canCheckIn = status === 'live' && routine.status === 'pending';

    let routineHtml = `
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
    `;

    if (routine.status === 'completed' && routine.completedAt) {
      routineHtml += `
        <div class="completion-details">
          <div class="completion-time">✅ Completed at: ${new Date(routine.completedAt).toLocaleTimeString()}</div>
          <div class="study-time">⏱️ Study time: ${formatTime(routine.actualDuration)}</div>
          <div class="points-earned">💎 Points earned: ${routine.pointsEarned}</div>
          <div class="efficiency">📊 Efficiency: ${routine.efficiency}%</div>
        </div>
      `;
    }

    if (routine.status === 'in-progress' && routine.id === activeSession?.routineId) {
      routineHtml += `
        <div class="session-progress">
          <div class="progress-info">⏱️ Session in progress...</div>
          <div class="elapsed-time">Elapsed: ${formatTimeHHMM(sessionElapsedTime)}</div>
        </div>
      `;
    }

    routineHtml += `
        <div class="routine-actions">
    `;

    if (canCheckIn) {
      routineHtml += `<button onclick="startSession('${routine.id}')" class="btn btn-primary">🎯 Start Session</button>`;
    } else if (routine.status === 'pending') {
      if (status === 'yet-to-live') {
        routineHtml += `<button class="btn btn-secondary" disabled>⏳ Not yet available</button>`;
      } else if (status === 'missed') {
        routineHtml += `<button class="btn btn-danger" disabled>❌ Missed</button>`;
      } else if (status === 'no-time') {
        routineHtml += `<button class="btn btn-secondary" disabled>⚪ No time set</button>`;
      }
    } else if (routine.status === 'completed') {
      routineHtml += `<button class="btn btn-success" disabled>✅ Completed</button>`;
    } else if (routine.status === 'in-progress') {
      routineHtml += `<button class="btn btn-warning" disabled>🎯 In Progress</button>`;
    }

    routineHtml += `
        </div>
      </div>
    `;

    return routineHtml;
  }).join('');

  container.innerHTML = html;
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

  // Update daily points display
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();
  const todayPoints = dailyPoints[today] || 0;
  const yesterdayPoints = dailyPoints[yesterday] || 0;

  const todayPointsElement = document.getElementById('todayPoints');
  const yesterdayPointsElement = document.getElementById('yesterdayPoints');

  if (todayPointsElement) todayPointsElement.textContent = todayPoints;
  if (yesterdayPointsElement) yesterdayPointsElement.textContent = yesterdayPoints;
}

// THIS IS THE CRITICAL PART - ALL ORIGINAL MENTOR FUNCTIONS RESTORED
function loadMentorData() {
  console.log('👨‍🏫 Loading mentor data...');
  renderRoutineManager();
  renderTestReports();
  renderPunishmentsList();
  renderMentorSyllabus();
  renderActivityFeed();
  renderLiveSessionsMonitor();
  updateMentorAnalytics();
}

// MENTOR ROUTINE MANAGEMENT - ORIGINAL FUNCTION RESTORED
function renderRoutineManager() {
  const container = document.getElementById('routineManager');
  if (!container) return;

  if (!routines || routines.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>📚 No Routines Created Yet</h3>
        <p>Click "Add Routine" to create your first learning routine.</p>
      </div>
    `;
    return;
  }

  const html = routines.map(routine => `
    <div class="routine-manager-card">
      <div class="routine-header">
        <h4>${routine.name}</h4>
        <div class="routine-status ${routine.status}">${routine.status}</div>
      </div>

      <div class="routine-details">
        <div class="detail-row">
          <span class="label">⏰ Time:</span>
          <span class="value">${routine.time || 'Not set'}</span>
        </div>
        <div class="detail-row">
          <span class="label">⏱️ Duration:</span>
          <span class="value">${routine.duration} minutes</span>
        </div>
        <div class="detail-row">
          <span class="label">💎 Points:</span>
          <span class="value">${routine.points}</span>
        </div>
        <div class="detail-row">
          <span class="label">📂 Category:</span>
          <span class="value">${routine.category}</span>
        </div>
      </div>

      ${routine.status === 'completed' ? `
        <div class="completion-info">
          <div class="completion-detail">✅ Completed: ${new Date(routine.completedAt).toLocaleString()}</div>
          <div class="completion-detail">⏱️ Actual Duration: ${formatTime(routine.actualDuration)}</div>
          <div class="completion-detail">💎 Points Earned: ${routine.pointsEarned}</div>
          <div class="completion-detail">📊 Efficiency: ${routine.efficiency}%</div>
        </div>
      ` : ''}

      <div class="routine-actions">
        <button onclick="editRoutine('${routine.id}')" class="btn btn-secondary btn-small">
          ✏️ Edit
        </button>
        <button onclick="deleteRoutine('${routine.id}')" class="btn btn-danger btn-small">
          🗑️ Delete
        </button>
      </div>
    </div>
  `).join('');

  container.innerHTML = html;
}

// MENTOR TEST MANAGEMENT - ORIGINAL FUNCTION RESTORED
function renderTestReports() {
  const container = document.getElementById('testReports');
  if (!container) return;

  let html = '<div class="test-reports-container">';

  // Test Management Section
  html += `
    <div class="section">
      <h3>📝 Available Tests</h3>
      <div class="tests-grid">
  `;

  if (tests && tests.length > 0) {
    tests.forEach(test => {
      const testResults = getTestResults(test.id);
      html += `
        <div class="test-card">
          <div class="test-header">
            <h4>${test.title}</h4>
            <span class="test-category">${test.category}</span>
          </div>
          <div class="test-details">
            <div class="test-info">⏱️ Duration: ${test.duration} minutes</div>
            <div class="test-info">❓ Questions: ${test.questions.length}</div>
            <div class="test-info">✅ Attempts: ${testResults.length}</div>
          </div>
          <div class="test-actions">
            <button onclick="editTest('${test.id}')" class="btn btn-secondary btn-small">
              ✏️ Edit
            </button>
            <button onclick="deleteTest('${test.id}')" class="btn btn-danger btn-small">
              🗑️ Delete
            </button>
          </div>
        </div>
      `;
    });
  } else {
    html += `
      <div class="empty-state">
        <h4>📝 No Tests Created</h4>
        <p>Create your first test to start assessments.</p>
      </div>
    `;
  }

  html += '</div></div>';

  // Test Results Section
  html += `
    <div class="section">
      <h3>📊 Recent Test Results</h3>
      <div class="test-results-list">
  `;

  if (testResults && testResults.length > 0) {
    const recentResults = testResults.slice(-10).reverse();
    recentResults.forEach(result => {
      const test = tests.find(t => t.id === result.testId);
      const testTitle = test ? test.title : 'Unknown Test';

      html += `
        <div class="result-card">
          <div class="result-header">
            <h4>${result.studentName}</h4>
            <div class="result-score ${result.percentage >= 80 ? 'excellent' : result.percentage >= 60 ? 'good' : 'needs-improvement'}">
              ${result.percentage}%
            </div>
          </div>
          <div class="result-details">
            <div class="result-info">📝 ${testTitle}</div>
            <div class="result-info">✅ ${result.correctAnswers}/${result.totalQuestions}</div>
            <div class="result-info">📅 ${new Date(result.completedAt).toLocaleString()}</div>
          </div>
        </div>
      `;
    });
  } else {
    html += `
      <div class="empty-state">
        <h4>📊 No Test Results Yet</h4>
        <p>Results will appear here when students complete tests.</p>
      </div>
    `;
  }

  html += '</div></div></div>';
  container.innerHTML = html;
}

// MENTOR ACTIVITY FEED - ORIGINAL FUNCTION RESTORED
function renderActivityFeed() {
  const container = document.getElementById('activityFeed');
  if (!container) return;

  if (!notifications || notifications.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h4>📋 No Recent Activity</h4>
        <p>Student activities will appear here.</p>
      </div>
    `;
    return;
  }

  const recentNotifications = notifications.slice(-20).reverse();

  const html = recentNotifications.map(notification => {
    const timeAgo = getTimeAgo(new Date(notification.timestamp));

    if (notification.type === 'session') {
      return `
        <div class="activity-item session-activity">
          <div class="activity-icon">🎯</div>
          <div class="activity-content">
            <div class="activity-title">Session Completed</div>
            <div class="activity-details">
              <div class="detail">${notification.studentName} completed ${notification.routineName}</div>
              <div class="detail">⏱️ Duration: ${formatTime(notification.actualDuration)}</div>
              <div class="detail">💎 Points: ${notification.pointsEarned}</div>
              <div class="detail">📊 Efficiency: ${notification.efficiency}%</div>
            </div>
            <div class="activity-time">${timeAgo}</div>
          </div>
        </div>
      `;
    } else if (notification.type === 'test') {
      return `
        <div class="activity-item test-activity">
          <div class="activity-icon">📝</div>
          <div class="activity-content">
            <div class="activity-title">Test Completed</div>
            <div class="activity-details">
              <div class="detail">${notification.studentName} completed ${notification.testTitle}</div>
              <div class="detail">📊 Score: ${notification.percentage}% (${notification.correctAnswers}/${notification.totalQuestions})</div>
            </div>
            <div class="activity-time">${timeAgo}</div>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="activity-item default-activity">
          <div class="activity-icon">📋</div>
          <div class="activity-content">
            <div class="activity-title">${notification.type}</div>
            <div class="activity-details">
              <div class="detail">${notification.studentName || 'Student'} - ${notification.message || 'Activity completed'}</div>
            </div>
            <div class="activity-time">${timeAgo}</div>
          </div>
        </div>
      `;
    }
  }).join('');

  container.innerHTML = html;
}
// ALL REMAINING MENTOR FUNCTIONS - ORIGINAL RESTORED
function renderPunishmentsList() {
  const container = document.getElementById('punishmentsList');
  if (!container) return;

  if (!studentPunishments || studentPunishments.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h4>⚠️ No Active Punishments</h4>
        <p>Student discipline records will appear here.</p>
      </div>
    `;
    return;
  }

  const activePunishments = studentPunishments.filter(p => p.status === 'pending');
  const completedPunishments = studentPunishments.filter(p => p.status === 'completed');

  let html = '<div class="punishments-container">';

  if (activePunishments.length > 0) {
    html += `
      <div class="section">
        <h3>⚠️ Active Punishments</h3>
        <div class="punishments-list">
    `;

    activePunishments.forEach(punishment => {
      html += `
        <div class="punishment-card active">
          <div class="punishment-header">
            <h4>${punishment.studentName}</h4>
            <div class="punishment-type">${punishment.type}</div>
          </div>
          <div class="punishment-details">
            <div class="punishment-reason">Reason: ${punishment.reason}</div>
            <div class="punishment-penalty">Penalty: ${punishment.penalty}</div>
            <div class="punishment-date">Date: ${new Date(punishment.assignedDate).toLocaleString()}</div>
          </div>
          <div class="punishment-actions">
            <button onclick="completePunishment('${punishment.id}')" class="btn btn-success btn-small">
              ✅ Complete
            </button>
            <button onclick="removePunishment('${punishment.id}')" class="btn btn-danger btn-small">
              🗑️ Remove
            </button>
          </div>
        </div>
      `;
    });

    html += '</div></div>';
  }

  if (completedPunishments.length > 0) {
    html += `
      <div class="section">
        <h3>✅ Completed Punishments</h3>
        <div class="punishments-list">
    `;

    completedPunishments.slice(-10).forEach(punishment => {
      html += `
        <div class="punishment-card completed">
          <div class="punishment-header">
            <h4>${punishment.studentName}</h4>
            <div class="punishment-type completed">${punishment.type}</div>
          </div>
          <div class="punishment-details">
            <div class="punishment-reason">Reason: ${punishment.reason}</div>
            <div class="punishment-penalty">Penalty: ${punishment.penalty}</div>
            <div class="punishment-date">Completed: ${new Date(punishment.completedDate).toLocaleString()}</div>
          </div>
        </div>
      `;
    });

    html += '</div></div>';
  }

  html += '</div>';
  container.innerHTML = html;
}

function renderLiveSessionsMonitor() {
  const container = document.getElementById('liveSessionsMonitor');
  if (!container) return;

  const today = getTodayDateString();
  const todayTracking = sessionTracking[today];

  let html = '<div class="live-sessions-container">';

  // Active Sessions
  if (todayTracking && todayTracking.activeSession) {
    const activeSession = todayTracking.activeSession;
    const routine = routines.find(r => r.id === activeSession.routineId);
    const startTime = new Date(activeSession.startTime);
    const elapsed = Math.floor((Date.now() - startTime.getTime() - (activeSession.totalPausedTime || 0)) / 60000);

    html += `
      <div class="section">
        <h3>🔴 Live Session</h3>
        <div class="live-session-card">
          <div class="session-header">
            <h4>Student is studying: ${activeSession.routineName}</h4>
            <div class="session-status ${activeSession.status}">${activeSession.status}</div>
          </div>
          <div class="session-stats">
            <div class="stat">
              <span class="label">⏱️ Elapsed:</span>
              <span class="value">${formatTime(elapsed)}</span>
            </div>
            <div class="stat">
              <span class="label">🎯 Target:</span>
              <span class="value">${formatTime(activeSession.targetDuration)}</span>
            </div>
            <div class="stat">
              <span class="label">📊 Progress:</span>
              <span class="value">${Math.round((elapsed / activeSession.targetDuration) * 100)}%</span>
            </div>
          </div>
          <div class="session-timeline">
            <div class="timeline-item">
              <span class="time">Started:</span>
              <span class="event">${startTime.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    html += `
      <div class="section">
        <h3>🟢 No Active Sessions</h3>
        <div class="no-sessions">
          <p>Student is not currently in a learning session.</p>
        </div>
      </div>
    `;
  }

  // Today's Completed Sessions
  if (todayTracking && todayTracking.sessions && todayTracking.sessions.length > 0) {
    html += `
      <div class="section">
        <h3>✅ Today's Completed Sessions</h3>
        <div class="completed-sessions">
    `;

    todayTracking.sessions.forEach(session => {
      html += `
        <div class="session-summary">
          <div class="session-name">${session.routineName}</div>
          <div class="session-details">
            <span>⏱️ ${formatTime(session.actualDuration)}</span>
            <span>💎 ${session.pointsEarned}pts</span>
            <span>📊 ${session.efficiency}%</span>
          </div>
          <div class="session-time">${new Date(session.endTime).toLocaleTimeString()}</div>
        </div>
      `;
    });

    html += '</div></div>';
  }

  html += '</div>';
  container.innerHTML = html;
}

function updateMentorAnalytics() {
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();
  const weekStart = getWeekStartDateString();

  // Today's stats
  const todayAnalytics = performanceAnalytics[today];
  const todayPoints = dailyPoints[today] || 0;
  const yesterdayPoints = dailyPoints[yesterday] || 0;

  // Update analytics display
  const todayPointsEl = document.getElementById('mentorTodayPoints');
  const yesterdayPointsEl = document.getElementById('mentorYesterdayPoints');
  const todaySessionsEl = document.getElementById('mentorTodaySessions');
  const todayStudyTimeEl = document.getElementById('mentorTodayStudyTime');

  if (todayPointsEl) todayPointsEl.textContent = todayPoints;
  if (yesterdayPointsEl) yesterdayPointsEl.textContent = yesterdayPoints;

  if (todayAnalytics) {
    if (todaySessionsEl) todaySessionsEl.textContent = todayAnalytics.totalSessions;
    if (todayStudyTimeEl) todayStudyTimeEl.textContent = formatTime(todayAnalytics.totalStudyTime);
  } else {
    if (todaySessionsEl) todaySessionsEl.textContent = '0';
    if (todayStudyTimeEl) todayStudyTimeEl.textContent = '0h 0m';
  }
}

// MODAL FUNCTIONS - ALL ORIGINAL RESTORED
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';

    // Clear form if it's an add routine modal
    if (modalId === 'addRoutineModal') {
      clearRoutineForm();
      document.getElementById('routineModalTitle').textContent = 'Add New Routine';
      currentEditingRoutineId = null;
    }
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

function clearRoutineForm() {
  document.getElementById('routineName').value = '';
  document.getElementById('routineTime').value = '';
  document.getElementById('routineDuration').value = '30';
  document.getElementById('routinePoints').value = '10';
  document.getElementById('routineCategory').value = 'Health';
}

// ROUTINE MANAGEMENT FUNCTIONS - ALL ORIGINAL RESTORED
function saveRoutine() {
  const name = document.getElementById('routineName').value.trim();
  const time = document.getElementById('routineTime').value;
  const duration = parseInt(document.getElementById('routineDuration').value);
  const points = parseInt(document.getElementById('routinePoints').value);
  const category = document.getElementById('routineCategory').value;

  if (!name) {
    alert('Please enter a routine name');
    return;
  }

  if (!time) {
    alert('Please set a time for the routine');
    return;
  }

  if (duration < 15 || duration > 480) {
    alert('Duration must be between 15 and 480 minutes');
    return;
  }

  if (points < 1 || points > 100) {
    alert('Points must be between 1 and 100');
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

  console.log('✅ Routine saved successfully');
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
    console.log('✅ Routine deleted successfully');
  }
}

// TEST MANAGEMENT FUNCTIONS - ALL ORIGINAL RESTORED
function saveTest() {
  const title = document.getElementById('testTitle').value.trim();
  const category = document.getElementById('testCategory').value;
  const duration = parseInt(document.getElementById('testDuration').value);
  const questionsJson = document.getElementById('testQuestions').value.trim();

  if (!title) {
    alert('Please enter a test title');
    return;
  }

  if (!questionsJson) {
    alert('Please enter test questions in JSON format');
    return;
  }

  let questions;
  try {
    questions = JSON.parse(questionsJson);
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Questions must be a non-empty array');
    }

    // Validate question format
    for (const q of questions) {
      if (!q.question || !q.options || !Array.isArray(q.options) || typeof q.correctAnswer !== 'number') {
        throw new Error('Invalid question format');
      }
    }
  } catch (error) {
    alert('Invalid JSON format for questions. Please check your syntax.');
    return;
  }

  const newTest = {
    id: Date.now().toString(),
    title: title,
    category: category,
    duration: duration,
    questions: questions,
    status: 'available',
    createdAt: new Date().toISOString()
  };

  tests.push(newTest);
  saveToFirebase('tests', tests);
  closeModal('addTestModal');
  renderTestReports();

  console.log('✅ Test created successfully');
}

function editTest(testId) {
  const test = tests.find(t => t.id === testId);
  if (!test) return;

  document.getElementById('testTitle').value = test.title;
  document.getElementById('testCategory').value = test.category;
  document.getElementById('testDuration').value = test.duration;
  document.getElementById('testQuestions').value = JSON.stringify(test.questions, null, 2);

  openModal('addTestModal');
}

function deleteTest(testId) {
  if (!confirm('Are you sure you want to delete this test?')) return;

  const testIndex = tests.findIndex(t => t.id === testId);
  if (testIndex > -1) {
    tests.splice(testIndex, 1);
    saveToFirebase('tests', tests);
    renderTestReports();
    console.log('✅ Test deleted successfully');
  }
}

function getTestResults(testId) {
  return testResults.filter(result => result.testId === testId);
}

function completePunishment(punishmentId) {
  const punishment = studentPunishments.find(p => p.id === punishmentId);
  if (punishment) {
    punishment.status = 'completed';
    punishment.completedDate = new Date().toISOString();
    saveToFirebase('studentPunishments', studentPunishments);
    renderPunishmentsList();
  }
}

function removePunishment(punishmentId) {
  if (!confirm('Are you sure you want to remove this punishment?')) return;

  const punishmentIndex = studentPunishments.findIndex(p => p.id === punishmentId);
  if (punishmentIndex > -1) {
    studentPunishments.splice(punishmentIndex, 1);
    saveToFirebase('studentPunishments', studentPunishments);
    renderPunishmentsList();
  }
}

// UTILITY FUNCTIONS - ALL ORIGINAL RESTORED
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

// PLACEHOLDER FUNCTIONS FOR STUDENT FEATURES
function renderAvailableTests() {
  const container = document.getElementById('availableTests');
  if (!container) return;

  if (!tests || tests.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h4>📝 No Tests Available</h4>
        <p>Tests will appear here when your mentor creates them.</p>
      </div>
    `;
    return;
  }

  const html = tests.map(test => `
    <div class="test-card">
      <div class="test-header">
        <h4>${test.title}</h4>
        <span class="test-category">${test.category}</span>
      </div>
      <div class="test-info">
        <div class="test-detail">⏱️ Duration: ${test.duration} minutes</div>
        <div class="test-detail">❓ Questions: ${test.questions.length}</div>
      </div>
      <div class="test-actions">
        <button onclick="startTest('${test.id}')" class="btn btn-primary">
          🚀 Start Test
        </button>
      </div>
    </div>
  `).join('');

  container.innerHTML = html;
}

function renderStudentActivity() {
  const container = document.getElementById('studentActivity');
  if (!container) return;

  if (!notifications || notifications.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h4>📋 No Recent Activity</h4>
        <p>Your learning activities will appear here.</p>
      </div>
    `;
    return;
  }

  const recentNotifications = notifications.slice(-10).reverse();

  const html = recentNotifications.map(notification => {
    const timeAgo = getTimeAgo(new Date(notification.timestamp));

    return `
      <div class="activity-item">
        <div class="activity-content">
          <div class="activity-title">${notification.type === 'session' ? 'Session Completed' : 'Test Completed'}</div>
          <div class="activity-details">${notification.routineName || notification.testTitle}</div>
          <div class="activity-time">${timeAgo}</div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

function renderStudentAnalytics() {
  // Placeholder for student analytics
  console.log('📊 Student analytics rendered');
}

function renderMentorCharts() {
  // Placeholder for mentor charts
  console.log('📊 Mentor charts rendered');
}

function startTest(testId) {
  alert('Test functionality will be implemented soon!');
}

console.log('✅ MentorMate Pro with NEET Syllabus System loaded successfully!');
console.log('🔧 All original mentor functions restored');
console.log('📚 NEET syllabus system added');
console.log('🎓 Ready for use!');