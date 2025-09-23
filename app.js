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
let studentPunishments = [];
let dailyPoints = {};
let sessionTracking = {};
let performanceAnalytics = {};
let currentEditingRoutineId = null;
let isFirebaseConnected = false;
let dataLoaded = false;

// NEW: Syllabus Global Variables
let syllabusData = {
  physics: { chapters: {} },
  chemistry: { chapters: {} },
  biology: { chapters: {} }
};
let currentEditingChapter = null;

// SESSION TRACKING VARIABLES - FIXED STATE MANAGEMENT
let activeSession = null;
let sessionTimer = null;
let sessionStartTime = null;
let sessionPauseTime = null;
let totalPausedTime = 0;
let sessionElapsedTime = 0;
let sessionPointsEarned = 0;
let sessionState = 'none'; // 'none', 'active', 'paused'

// NEW: Auto-end timer for sessions
let autoEndTimer = null;

// FIXED: Add session validation variables
let lastUpdateTime = null;
let sessionValidated = false;

// Test Taking Variables
let currentTest = null;
let currentQuestionIndex = 0;
let testAnswers = [];
let testTimer = null;
let testTimeRemaining = 0;

// Constants
const MENTOR_PASSWORD = "SHARU";
const POINTS_PER_MINUTE = 0.2; // 12 points per hour = 0.2 per minute
const POINT_DEDUCTION_RATE = 1; // 1 point per 5 minutes late
const MAX_SESSION_TIME = 480; // Max 8 hours to prevent crazy values

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

// NEW: Auto-end session when target duration is reached
function autoEndSession() {
  console.log('🎯 Auto-ending session - target duration reached');

  if (!activeSession) {
    console.log('❌ No active session to auto-end');
    return;
  }

  // Stop all timers
  if (sessionTimer) {
    clearInterval(sessionTimer);
    sessionTimer = null;
  }
  if (autoEndTimer) {
    clearTimeout(autoEndTimer);
    autoEndTimer = null;
  }

  // Calculate final session time
  const endTime = Date.now();
  const rawTotalTime = Math.floor((endTime - sessionStartTime - totalPausedTime) / 60000);
  const totalSessionTime = validateSessionTime(rawTotalTime);
  const targetDuration = activeSession.targetDuration;

  // Calculate points
  const pointsEarned = validatePoints(totalSessionTime * POINTS_PER_MINUTE);

  // Update routine
  const routine = routines.find(r => r.id === activeSession.routineId);
  if (routine) {
    routine.status = 'completed';
    routine.completedAt = new Date().toISOString();
    routine.actualDuration = totalSessionTime;
    routine.pointsEarned = pointsEarned;
    routine.completedDate = getTodayDateString();
    routine.efficiency = Math.min(Math.round((totalSessionTime / targetDuration) * 100), 200);
  }

  // Update daily points
  const today = getTodayDateString();
  if (!dailyPoints[today]) {
    dailyPoints[today] = 0;
  }
  dailyPoints[today] = validatePoints(dailyPoints[today] + pointsEarned);

  // Save session data
  const sessionData = {
    routineId: activeSession.routineId,
    routineName: activeSession.routineName,
    targetDuration: targetDuration,
    actualDuration: totalSessionTime,
    pointsEarned: pointsEarned,
    efficiency: Math.min(Math.round((totalSessionTime / targetDuration) * 100), 200),
    startTime: activeSession.startTime,
    endTime: new Date().toISOString(),
    totalPausedTime: Math.floor(totalPausedTime / 60000),
    autoEnded: true // Flag to indicate auto-ended
  };

  // Update session tracking
  if (!sessionTracking[today]) {
    sessionTracking[today] = { sessions: [] };
  }
  if (!sessionTracking[today].sessions) {
    sessionTracking[today].sessions = [];
  }
  sessionTracking[today].sessions.push(sessionData);
  sessionTracking[today].activeSession = null;

  // Update performance analytics
  updatePerformanceAnalytics(sessionData);

  // Save to Firebase
  saveToFirebase('routines', routines);
  saveToFirebase('dailyPoints', dailyPoints);
  saveToFirebase('sessionTracking', sessionTracking);
  saveToFirebase('performanceAnalytics', performanceAnalytics);

  // Add notification
  const notification = {
    id: Date.now().toString(),
    type: 'session',
    studentName: 'Student',
    routineName: activeSession.routineName,
    timestamp: new Date().toISOString(),
    actualDuration: totalSessionTime,
    pointsEarned: pointsEarned,
    efficiency: Math.round((totalSessionTime / targetDuration) * 100),
    autoEnded: true,
    date: today
  };

  notifications.push(notification);
  saveToFirebase('notifications', notifications);

  // Show completion message
  let message = `🎉 Session Completed Automatically!\n\n`;
  message += `📚 Session: ${activeSession.routineName}\n`;
  message += `⏱️ Study Time: ${formatTime(totalSessionTime)}\n`;
  message += `🎯 Target: ${formatTime(targetDuration)}\n`;
  message += `📊 Efficiency: ${Math.round((totalSessionTime / targetDuration) * 100)}%\n`;
  message += `🏆 Points Earned: ${pointsEarned}\n\n`;
  message += `🌟 Congratulations! You reached your target session time!`;

  alert(message);

  // Clear session state
  clearActiveSession();

  console.log('✅ Session auto-ended successfully');
}
// NEW: SYLLABUS SYSTEM
function initializeSyllabus() {
  if (Object.keys(syllabusData.physics.chapters).length === 0) {
    console.log('🆕 Initializing default NEET syllabus...');

    // Physics chapters with NEET weightages
    const physicsChapters = [
      { name: "Units and Measurements", weight: 2 },
      { name: "Motion in a Straight Line", weight: 3 },
      { name: "Motion in a Plane", weight: 4 },
      { name: "Laws of Motion", weight: 5 },
      { name: "Work, Energy and Power", weight: 4 },
      { name: "System of Particles and Rotational Motion", weight: 4 },
      { name: "Gravitation", weight: 3 },
      { name: "Mechanical Properties of Solids", weight: 3 },
      { name: "Mechanical Properties of Fluids", weight: 3 },
      { name: "Thermal Properties of Matter", weight: 3 },
      { name: "Thermodynamics", weight: 4 },
      { name: "Kinetic Theory", weight: 2 },
      { name: "Oscillations", weight: 3 },
      { name: "Waves", weight: 4 },
      { name: "Electric Charges and Fields", weight: 4 },
      { name: "Electrostatic Potential and Capacitance", weight: 4 },
      { name: "Current Electricity", weight: 5 },
      { name: "Moving Charges and Magnetism", weight: 4 },
      { name: "Magnetism and Matter", weight: 3 },
      { name: "Electromagnetic Induction", weight: 5 },
      { name: "Alternating Current", weight: 4 },
      { name: "Electromagnetic Waves", weight: 2 },
      { name: "Ray Optics and Optical Instruments", weight: 4 },
      { name: "Wave Optics", weight: 3 },
      { name: "Dual Nature of Radiation and Matter", weight: 3 },
      { name: "Atoms", weight: 2 },
      { name: "Nuclei", weight: 3 },
      { name: "Semiconductor Electronics", weight: 4 },
      { name: "Communication Systems", weight: 2 }
    ];

    // Chemistry chapters with NEET weightages
    const chemistryChapters = [
      { name: "Some Basic Concepts of Chemistry", weight: 3 },
      { name: "Structure of Atom", weight: 4 },
      { name: "Classification of Elements", weight: 3 },
      { name: "Chemical Bonding and Molecular Structure", weight: 5 },
      { name: "States of Matter", weight: 3 },
      { name: "Thermodynamics", weight: 4 },
      { name: "Equilibrium", weight: 4 },
      { name: "Redox Reactions", weight: 3 },
      { name: "Hydrogen", weight: 2 },
      { name: "s-Block Elements", weight: 3 },
      { name: "p-Block Elements", weight: 5 },
      { name: "Organic Chemistry - Basic Principles", weight: 4 },
      { name: "Hydrocarbons", weight: 4 },
      { name: "Environmental Chemistry", weight: 2 },
      { name: "Solid State", weight: 3 },
      { name: "Solutions", weight: 4 },
      { name: "Electrochemistry", weight: 4 },
      { name: "Chemical Kinetics", weight: 3 },
      { name: "Surface Chemistry", weight: 3 },
      { name: "d and f Block Elements", weight: 4 },
      { name: "Coordination Compounds", weight: 4 },
      { name: "Haloalkanes and Haloarenes", weight: 3 },
      { name: "Alcohols, Phenols and Ethers", weight: 4 },
      { name: "Aldehydes, Ketones and Carboxylic Acids", weight: 5 },
      { name: "Amines", weight: 3 },
      { name: "Biomolecules", weight: 4 },
      { name: "Polymers", weight: 2 },
      { name: "Chemistry in Everyday Life", weight: 2 },
      { name: "Isolation of Elements", weight: 3 }
    ];

    // Biology chapters with NEET weightages
    const biologyChapters = [
      { name: "The Living World", weight: 2 },
      { name: "Biological Classification", weight: 3 },
      { name: "Plant Kingdom", weight: 4 },
      { name: "Animal Kingdom", weight: 5 },
      { name: "Morphology of Flowering Plants", weight: 3 },
      { name: "Anatomy of Flowering Plants", weight: 4 },
      { name: "Structural Organisation in Animals", weight: 3 },
      { name: "Cell: The Unit of Life", weight: 4 },
      { name: "Biomolecules", weight: 4 },
      { name: "Cell Cycle and Cell Division", weight: 4 },
      { name: "Transport in Plants", weight: 3 },
      { name: "Mineral Nutrition", weight: 2 },
      { name: "Photosynthesis in Higher Plants", weight: 5 },
      { name: "Respiration in Plants", weight: 4 },
      { name: "Plant Growth and Development", weight: 3 },
      { name: "Digestion and Absorption", weight: 4 },
      { name: "Breathing and Exchange of Gases", weight: 4 },
      { name: "Body Fluids and Circulation", weight: 4 },
      { name: "Excretory Products and their Elimination", weight: 3 },
      { name: "Locomotion and Movement", weight: 3 },
      { name: "Neural Control and Coordination", weight: 5 },
      { name: "Chemical Coordination and Integration", weight: 4 },
      { name: "Reproduction in Organisms", weight: 3 },
      { name: "Sexual Reproduction in Flowering Plants", weight: 4 },
      { name: "Human Reproduction", weight: 5 },
      { name: "Reproductive Health", weight: 3 },
      { name: "Principles of Inheritance and Variation", weight: 5 },
      { name: "Molecular Basis of Inheritance", weight: 4 },
      { name: "Evolution", weight: 4 },
      { name: "Human Health and Disease", weight: 4 },
      { name: "Strategies for Enhancement in Food Production", weight: 3 },
      { name: "Microbes in Human Welfare", weight: 3 },
      { name: "Biotechnology: Principles and Processes", weight: 4 },
      { name: "Biotechnology and its Applications", weight: 3 },
      { name: "Organisms and Populations", weight: 4 },
      { name: "Ecosystem", weight: 4 },
      { name: "Biodiversity and Conservation", weight: 3 }
    ];

    // Initialize chapters
    physicsChapters.forEach((chapter, index) => {
      const id = `physics_${index + 1}`;
      syllabusData.physics.chapters[id] = {
        id: id,
        name: chapter.name,
        weight: chapter.weight,
        completed: false,
        completedAt: null
      };
    });

    chemistryChapters.forEach((chapter, index) => {
      const id = `chemistry_${index + 1}`;
      syllabusData.chemistry.chapters[id] = {
        id: id,
        name: chapter.name,
        weight: chapter.weight,
        completed: false,
        completedAt: null
      };
    });

    biologyChapters.forEach((chapter, index) => {
      const id = `biology_${index + 1}`;
      syllabusData.biology.chapters[id] = {
        id: id,
        name: chapter.name,
        weight: chapter.weight,
        completed: false,
        completedAt: null
      };
    });

    saveToFirebase('syllabus', syllabusData);
    console.log('✅ Default NEET syllabus initialized');
  }
}

// NEW: Render syllabus for students
function renderSyllabusSection() {
  const container = document.getElementById('syllabusContent');
  if (!container) return;

  container.innerHTML = `
    <div class="syllabus-overview">
      ${renderSyllabusOverview()}
    </div>

    <div class="syllabus-tabs">
      <button class="syllabus-tab-btn active" onclick="showSyllabusSubject('physics')">⚗️ Physics</button>
      <button class="syllabus-tab-btn" onclick="showSyllabusSubject('chemistry')">🧪 Chemistry</button>
      <button class="syllabus-tab-btn" onclick="showSyllabusSubject('biology')">🧬 Biology</button>
    </div>

    <div class="syllabus-content">
      <div id="physicsContent" class="syllabus-subject-content active">
        ${renderSubjectChapters('physics')}
      </div>
      <div id="chemistryContent" class="syllabus-subject-content">
        ${renderSubjectChapters('chemistry')}
      </div>
      <div id="biologyContent" class="syllabus-subject-content">
        ${renderSubjectChapters('biology')}
      </div>
    </div>
  `;
}

function renderSyllabusOverview() {
  const subjects = ['physics', 'chemistry', 'biology'];
  let overallCompleted = 0;
  let overallTotal = 0;
  let overallWeightedCompleted = 0;
  let overallWeightedTotal = 0;

  let overviewHtml = '<div class="overview-cards">';

  subjects.forEach(subject => {
    const chapters = Object.values(syllabusData[subject].chapters || {});
    const completed = chapters.filter(ch => ch.completed).length;
    const total = chapters.length;
    const completedWeight = chapters.filter(ch => ch.completed).reduce((sum, ch) => sum + (ch.weight || 0), 0);
    const totalWeight = chapters.reduce((sum, ch) => sum + (ch.weight || 0), 0);

    overallCompleted += completed;
    overallTotal += total;
    overallWeightedCompleted += completedWeight;
    overallWeightedTotal += totalWeight;

    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const weightedPercentage = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;

    const subjectName = subject.charAt(0).toUpperCase() + subject.slice(1);
    const icon = subject === 'physics' ? '⚗️' : subject === 'chemistry' ? '🧪' : '🧬';

    overviewHtml += `
      <div class="overview-card">
        <div class="card-header">
          <span class="subject-icon">${icon}</span>
          <h4>${subjectName}</h4>
        </div>
        <div class="card-stats">
          <div class="stat">
            <span class="stat-value">${completed}/${total}</span>
            <span class="stat-label">Chapters</span>
          </div>
          <div class="stat">
            <span class="stat-value">${percentage}%</span>
            <span class="stat-label">Progress</span>
          </div>
          <div class="stat">
            <span class="stat-value">${weightedPercentage}%</span>
            <span class="stat-label">Weighted</span>
          </div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
  });

  // Overall progress
  const overallPercentage = overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0;
  const overallWeightedPercentage = overallWeightedTotal > 0 ? Math.round((overallWeightedCompleted / overallWeightedTotal) * 100) : 0;

  overviewHtml += `
    <div class="overview-card overall">
      <div class="card-header">
        <span class="subject-icon">🎯</span>
        <h4>Overall</h4>
      </div>
      <div class="card-stats">
        <div class="stat">
          <span class="stat-value">${overallCompleted}/${overallTotal}</span>
          <span class="stat-label">Total</span>
        </div>
        <div class="stat">
          <span class="stat-value">${overallPercentage}%</span>
          <span class="stat-label">Progress</span>
        </div>
        <div class="stat">
          <span class="stat-value">${overallWeightedPercentage}%</span>
          <span class="stat-label">Weighted</span>
        </div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${overallPercentage}%"></div>
      </div>
    </div>
  `;

  overviewHtml += '</div>';
  return overviewHtml;
}

function renderSubjectChapters(subject) {
  const chapters = Object.values(syllabusData[subject].chapters || {});

  if (chapters.length === 0) {
    return '<div class="no-chapters">No chapters available</div>';
  }

  let html = `
    <div class="chapters-table">
      <div class="table-header">
        <div>✓</div>
        <div>Chapter Name</div>
        <div>Weight</div>
        <div>Status</div>
      </div>
  `;

  chapters.forEach(chapter => {
    const completed = chapter.completed || false;
    const rowClass = completed ? 'table-row completed' : 'table-row';

    html += `
      <div class="${rowClass}">
        <div class="col-checkbox">
          <input type="checkbox" ${completed ? 'checked' : ''} 
                 onchange="toggleChapterComplete('${subject}', '${chapter.id}', this.checked)">
        </div>
        <div class="col-chapter">
          <span class="chapter-name">${chapter.name}</span>
        </div>
        <div class="col-weight">
          <span class="weight-badge">${chapter.weight}%</span>
        </div>
        <div class="col-status">
          <span class="status-text">${completed ? 'Completed' : 'Pending'}</span>
        </div>
      </div>
    `;
  });

  html += '</div>';
  return html;
}

// NEW: Toggle chapter completion
function toggleChapterComplete(subject, chapterId, completed) {
  console.log(`📚 Toggling chapter: ${subject}/${chapterId} = ${completed}`);

  if (!syllabusData[subject] || !syllabusData[subject].chapters[chapterId]) {
    console.error('Chapter not found:', subject, chapterId);
    return;
  }

  const chapter = syllabusData[subject].chapters[chapterId];
  chapter.completed = completed;
  chapter.completedAt = completed ? new Date().toISOString() : null;

  // Save to Firebase
  saveToFirebase('syllabus', syllabusData);

  // Add notification for completion
  if (completed) {
    const notification = {
      id: Date.now().toString(),
      type: 'syllabus',
      studentName: 'Student',
      chapterName: chapter.name,
      subject: subject,
      timestamp: new Date().toISOString(),
      date: getTodayDateString()
    };

    notifications.push(notification);
    saveToFirebase('notifications', notifications);
  }

  // Re-render overview
  renderSyllabusSection();

  console.log('✅ Chapter completion updated');
}

function showSyllabusSubject(subject) {
  // Update tab buttons
  document.querySelectorAll('.syllabus-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');

  // Update content sections
  document.querySelectorAll('.syllabus-subject-content').forEach(content => {
    content.classList.remove('active');
  });

  const targetContent = document.getElementById(`${subject}Content`);
  if (targetContent) {
    targetContent.classList.add('active');
  }
}
// NEW: Render mentor syllabus management
function renderMentorSyllabusContent() {
  const container = document.getElementById('mentorSyllabusContent');
  if (!container) return;

  container.innerHTML = `
    <div class="syllabus-overview">
      ${renderSyllabusOverview()}
    </div>

    <div class="syllabus-tabs">
      <button class="syllabus-tab-btn active" onclick="showMentorSyllabusSubject('physics')">⚗️ Physics</button>
      <button class="syllabus-tab-btn" onclick="showMentorSyllabusSubject('chemistry')">🧪 Chemistry</button>
      <button class="syllabus-tab-btn" onclick="showMentorSyllabusSubject('biology')">🧬 Biology</button>
    </div>

    <div class="syllabus-content">
      <div id="mentorPhysicsContent" class="mentor-subject-content active">
        ${renderMentorSubjectChapters('physics')}
      </div>
      <div id="mentorChemistryContent" class="mentor-subject-content">
        ${renderMentorSubjectChapters('chemistry')}
      </div>
      <div id="mentorBiologyContent" class="mentor-subject-content">
        ${renderMentorSubjectChapters('biology')}
      </div>
    </div>
  `;
}

function renderMentorSubjectChapters(subject) {
  const chapters = Object.values(syllabusData[subject].chapters || {});
  const subjectName = subject.charAt(0).toUpperCase() + subject.slice(1);

  let html = `
    <div class="mentor-subject-header">
      <h4>${subjectName} Chapters</h4>
      <div class="subject-summary">
        <span>Total: ${chapters.length} chapters</span>
        <span>Completed: ${chapters.filter(ch => ch.completed).length}</span>
        <span>Progress: ${chapters.length > 0 ? Math.round((chapters.filter(ch => ch.completed).length / chapters.length) * 100) : 0}%</span>
      </div>
    </div>

    <div class="mentor-chapters-table">
      <div class="table-header">
        <div>Status</div>
        <div>Chapter Name</div>
        <div>Weight (%)</div>
        <div>Completed</div>
        <div>Actions</div>
      </div>
  `;

  chapters.forEach(chapter => {
    const completed = chapter.completed || false;
    const rowClass = completed ? 'table-row completed' : 'table-row';

    html += `
      <div class="${rowClass}">
        <div class="col-status">
          <span class="status-icon">${completed ? '✅' : '⏳'}</span>
        </div>
        <div class="col-chapter">
          <span class="chapter-name">${chapter.name}</span>
        </div>
        <div class="col-weight">
          <span class="weight-value">${chapter.weight}</span>
        </div>
        <div class="col-completed">
          ${completed ? 
            `<span class="completed-date">${new Date(chapter.completedAt).toLocaleDateString()}</span>` : 
            '<span>-</span>'
          }
        </div>
        <div class="col-actions">
          <button onclick="editChapter('${subject}', '${chapter.id}')" class="btn btn-secondary btn-small">Edit</button>
          <button onclick="deleteChapter('${subject}', '${chapter.id}')" class="btn btn-danger btn-small">Delete</button>
        </div>
      </div>
    `;
  });

  html += '</div>';
  return html;
}

function showMentorSyllabusSubject(subject) {
  // Update tab buttons
  document.querySelectorAll('.syllabus-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');

  // Update content sections
  document.querySelectorAll('.mentor-subject-content').forEach(content => {
    content.classList.remove('active');
  });

  const targetContent = document.getElementById(`mentor${subject.charAt(0).toUpperCase() + subject.slice(1)}Content`);
  if (targetContent) {
    targetContent.classList.add('active');
  }
}

// NEW: Chapter management functions
function editChapter(subject, chapterId) {
  const chapter = syllabusData[subject].chapters[chapterId];
  if (!chapter) return;

  currentEditingChapter = { subject, chapterId };

  document.getElementById('addChapterModalTitle').textContent = 'Edit Chapter';
  document.getElementById('chapterName').value = chapter.name;
  document.getElementById('chapterSubject').value = subject;
  document.getElementById('chapterWeight').value = chapter.weight;

  openModal('addChapterModal');
}

function deleteChapter(subject, chapterId) {
  const chapter = syllabusData[subject].chapters[chapterId];
  if (!chapter) return;

  if (confirm(`Are you sure you want to delete "${chapter.name}"?`)) {
    delete syllabusData[subject].chapters[chapterId];
    saveToFirebase('syllabus', syllabusData);
    renderMentorSyllabusContent();
  }
}

function saveChapter() {
  const name = document.getElementById('chapterName').value.trim();
  const subject = document.getElementById('chapterSubject').value;
  const weight = parseInt(document.getElementById('chapterWeight').value);

  if (!name || !subject || !weight) {
    alert('Please fill all fields');
    return;
  }

  if (currentEditingChapter) {
    // Edit existing chapter
    const chapter = syllabusData[currentEditingChapter.subject].chapters[currentEditingChapter.chapterId];
    chapter.name = name;
    chapter.weight = weight;

    // If subject changed, move chapter
    if (currentEditingChapter.subject !== subject) {
      delete syllabusData[currentEditingChapter.subject].chapters[currentEditingChapter.chapterId];
      const newId = `${subject}_${Date.now()}`;
      syllabusData[subject].chapters[newId] = {
        ...chapter,
        id: newId
      };
    }
  } else {
    // Add new chapter
    const chapterId = `${subject}_${Date.now()}`;
    syllabusData[subject].chapters[chapterId] = {
      id: chapterId,
      name: name,
      weight: weight,
      completed: false,
      completedAt: null
    };
  }

  saveToFirebase('syllabus', syllabusData);
  closeModal('addChapterModal');
  renderMentorSyllabusContent();

  // Clear editing state
  currentEditingChapter = null;
  document.getElementById('addChapterModalTitle').textContent = 'Add New Chapter';
  document.getElementById('chapterName').value = '';
  document.getElementById('chapterWeight').value = '5';
}

function clearActiveSession() {
  if (sessionTimer) {
    clearInterval(sessionTimer);
    sessionTimer = null;
  }
  if (autoEndTimer) {
    clearTimeout(autoEndTimer);
    autoEndTimer = null;
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

// UPDATED: Start session with auto-end timer
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

  // Check if there's already an active session
  if (activeSession && sessionState === 'active') {
    alert('Please pause your current session before starting a new one!');
    return;
  }

  // Clear any existing paused session
  if (activeSession) {
    const confirmStart = confirm('You have a paused session. Starting a new session will end the previous one. Continue?');
    if (!confirmStart) return;
    clearActiveSession();
  }

  // Initialize session with validation
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

  // Update routine status
  routine.status = 'in-progress';
  routine.sessionStarted = new Date().toISOString();

  // Save to Firebase
  saveToFirebase('routines', routines);
  saveSessionToFirebase();

  // Start session timer
  if (sessionTimer) {
    clearInterval(sessionTimer);
  }
  sessionTimer = setInterval(updateSessionTimerSafely, 1000);

  // NEW: Set up auto-end timer
  if (autoEndTimer) {
    clearTimeout(autoEndTimer);
  }
  autoEndTimer = setTimeout(() => {
    autoEndSession();
  }, activeSession.targetDuration * 60 * 1000); // Convert minutes to milliseconds

  // Show session monitor
  showActiveSessionMonitor();
  hidePausedSessionResume();

  console.log('✅ Session started successfully');
  console.log(`⏰ Auto-end scheduled for ${activeSession.targetDuration} minutes`);
}

function pauseSession() {
  console.log('⏸️ Pausing session');

  if (!activeSession || sessionState !== 'active') {
    console.log('❌ No active session to pause');
    return;
  }

  // Pause the session
  sessionPauseTime = Date.now();
  sessionState = 'paused';
  activeSession.status = 'paused';

  // Stop timers
  if (sessionTimer) {
    clearInterval(sessionTimer);
    sessionTimer = null;
  }
  if (autoEndTimer) {
    clearTimeout(autoEndTimer);
    autoEndTimer = null;
  }

  // Save current state
  saveSessionToFirebase();

  // Update display
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

  // Calculate paused time
  if (sessionPauseTime) {
    const pauseDuration = Date.now() - sessionPauseTime;
    totalPausedTime += pauseDuration;
    sessionPauseTime = null;
  }

  // Resume session
  sessionState = 'active';
  activeSession.status = 'active';
  activeSession.totalPausedTime = totalPausedTime;
  lastUpdateTime = Date.now();

  // Restart timers
  if (sessionTimer) {
    clearInterval(sessionTimer);
  }
  sessionTimer = setInterval(updateSessionTimerSafely, 1000);

  // NEW: Calculate remaining time and restart auto-end timer
  const remainingMinutes = activeSession.targetDuration - sessionElapsedTime;
  if (remainingMinutes > 0) {
    if (autoEndTimer) {
      clearTimeout(autoEndTimer);
    }
    autoEndTimer = setTimeout(() => {
      autoEndSession();
    }, remainingMinutes * 60 * 1000);
    console.log(`⏰ Auto-end rescheduled for ${remainingMinutes} minutes`);
  }

  // Save state
  saveSessionToFirebase();

  // Update display
  showActiveSessionMonitor();
  hidePausedSessionResume();

  console.log('✅ Session resumed successfully');
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

  // Validate time progression
  if (lastUpdateTime && (now - lastUpdateTime) > 5000) {
    console.log('⚠️ Timer anomaly detected - resetting');
    lastUpdateTime = now;
    return;
  }

  lastUpdateTime = now;
  const elapsed = now - sessionStartTime - totalPausedTime;
  const elapsedMinutes = Math.floor(elapsed / 60000);

  // Validate elapsed time to prevent explosions
  sessionElapsedTime = validateSessionTime(elapsedMinutes);
  sessionPointsEarned = validatePoints(sessionElapsedTime * POINTS_PER_MINUTE);

  // NEW: Check if target duration reached and auto-end
  if (sessionElapsedTime >= activeSession.targetDuration) {
    console.log('🎯 Target duration reached, auto-ending session...');
    autoEndSession();
    return;
  }

  // Update display
  updateActiveSessionDisplay();
}

function updateActiveSessionDisplay() {
  if (!activeSession || !sessionValidated) return;

  const targetDuration = activeSession.targetDuration;
  const percentage = Math.min((sessionElapsedTime / targetDuration) * 100, 100);

  // Update time display
  const timeElement = document.getElementById('activeSessionTime');
  if (timeElement) {
    timeElement.textContent = formatTimeHHMM(sessionElapsedTime);
  }

  // Update percentage
  const percentageElement = document.getElementById('sessionPercentage');
  if (percentageElement) {
    percentageElement.textContent = `${Math.round(percentage)}%`;
  }

  // Update progress ring
  const progressRing = document.getElementById('progressRingFill');
  if (progressRing) {
    const circumference = 2 * Math.PI * 54;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    progressRing.style.strokeDasharray = strokeDasharray;
    progressRing.style.strokeDashoffset = strokeDashoffset;
  }

  // Update session details
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
  // Update total session time for today
  const today = getTodayDateString();
  const todaySessions = sessionTracking[today];
  let totalTime = 0;

  if (todaySessions && todaySessions.sessions) {
    totalTime = todaySessions.sessions.reduce((sum, session) => {
      const duration = validateSessionTime(session.actualDuration || 0);
      return sum + duration;
    }, 0);
  }

  // Add current active session time
  if (activeSession && sessionState === 'active' && sessionValidated) {
    totalTime += sessionElapsedTime;
  }

  // Validate total time to prevent display explosions
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
  todayAnalytics.totalSessions++;
  todayAnalytics.totalStudyTime += sessionData.actualDuration;
  todayAnalytics.totalPointsEarned += sessionData.pointsEarned;
  todayAnalytics.sessions.push(sessionData);

  // Calculate average efficiency
  todayAnalytics.averageEfficiency = Math.round(
    todayAnalytics.sessions.reduce((sum, s) => sum + s.efficiency, 0) / todayAnalytics.sessions.length
  );
}

// Session Status and Time Management
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

// Firebase Initialization
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
          renderLiveSessionsMonitor();
        }
      }
    }
  });

  // NEW: Syllabus listener
  database.ref('syllabus').on('value', (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      syllabusData = data || { physics: { chapters: {} }, chemistry: { chapters: {} }, biology: { chapters: {} } };
      console.log('🔄 Syllabus updated');

      if (currentUser) {
        if (currentUser.role === 'student') {
          renderSyllabusSection();
        } else if (currentUser.role === 'mentor') {
          renderMentorSyllabusContent();
        }
      }
    } else {
      syllabusData = { physics: { chapters: {} }, chemistry: { chapters: {} }, biology: { chapters: {} } };
      initializeSyllabus();
    }
  });

  // Session Tracking listener
  database.ref('sessionTracking').on('value', (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      sessionTracking = data || {};
      console.log('🔄 Session tracking updated');

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

  // Daily Points listener
  database.ref('dailyPoints').on('value', (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      dailyPoints = data || {};
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

  // Performance Analytics listener
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

  // Other listeners
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

  // Update today's date in mentor analytics
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
      },
      {
        id: 'skill-practice',
        name: 'Skill Practice',
        time: '15:00',
        duration: 60,
        points: 12,
        category: 'Skills',
        status: 'pending'
      }
    ];
    saveToFirebase('routines', routines);
  }

  // Initialize other data structures
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

  // NEW: Initialize syllabus
  initializeSyllabus();

  console.log('✅ Default data initialized');
}

// SCREEN MANAGEMENT
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

  // Clear any existing session state when switching roles
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
  // Properly cleanup session state
  if (activeSession && sessionState === 'active') {
    // Auto-pause active session when logging out
    pauseSession();
  }

  currentUser = null;
  const passwordInput = document.getElementById('mentorPasswordInput');
  const errorElement = document.getElementById('passwordError');

  if (passwordInput) passwordInput.value = '';
  if (errorElement) errorElement.style.display = 'none';

  showScreen('roleSelectionScreen');
}

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
    renderSyllabusSection();
  } else if (sectionName === 'progress') {
    updateStudentStats();
    renderStudentActivity();
  }
}

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
  } else if (sectionName === 'sessions') {
    renderLiveSessionsMonitor();
  } else if (sectionName === 'routines') {
    renderRoutineManager();
  } else if (sectionName === 'syllabus') {
    renderMentorSyllabusContent();
  } else if (sectionName === 'tests') {
    renderTestReports();
  } else if (sectionName === 'punishments') {
    renderPunishmentsList();
  }
}

// DATA LOADING
function loadStudentData() {
  console.log('📚 Loading student data...');
  renderStudentRoutines();
  updateStudentStats();
  renderAvailableTests();
  renderStudentActivity();
  renderSyllabusSection();
}

function loadMentorData() {
  console.log('👨‍🏫 Loading mentor data...');
  renderRoutineManager();
  renderTestReports();
  renderPunishmentsList();
  renderMentorSyllabusContent();
  renderLiveSessionsMonitor();
  updateMentorAnalytics();
}

// Modal functions
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }

  // Clear editing states
  if (modalId === 'addChapterModal') {
    currentEditingChapter = null;
    document.getElementById('addChapterModalTitle').textContent = 'Add New Chapter';
    document.getElementById('chapterName').value = '';
    document.getElementById('chapterWeight').value = '5';
  }
}

// Placeholder render functions (keeping your existing functionality)
function renderStudentRoutines() {
  const container = document.getElementById('studentRoutines');
  if (!container || !routines || routines.length === 0) {
    if (container) container.innerHTML = '<div class="text-center">No sessions available</div>';
    return;
  }

  const html = routines.map(routine => {
    const status = getSessionStatus(routine);
    const canStart = status === 'live';

    return `
      <div class="routine-card">
        <div class="routine-header">
          <div class="routine-info">
            <h4>${routine.name}</h4>
            <div class="routine-time">📅 ${routine.time}</div>
            <div class="routine-category">📂 ${routine.category}</div>
            <div class="routine-points">💎 ${routine.duration}min = ${Math.round(routine.duration * POINTS_PER_MINUTE)} points</div>
          </div>
          <div class="routine-status ${routine.status}">${routine.status}</div>
        </div>
        <div class="routine-actions">
          ${canStart ? 
            `<button onclick="startSession('${routine.id}')" class="btn btn-primary">▶️ Start Session</button>` :
            `<button class="btn btn-secondary" disabled>⏳ ${status === 'yet-to-live' ? 'Not Yet Available' : 'Session Missed'}</button>`
          }
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

// Placeholder functions for existing functionality
function renderAvailableTests() {
  const container = document.getElementById('availableTests');
  if (container) container.innerHTML = '<div class="text-center">Tests loading...</div>';
}

function renderStudentActivity() {
  const container = document.getElementById('studentActivity');
  if (container) container.innerHTML = '<div class="text-center">Activity loading...</div>';
}

function renderRoutineManager() {
  const container = document.getElementById('routineManager');
  if (container) container.innerHTML = '<div class="text-center">Sessions loading...</div>';
}

function renderTestReports() {
  const container = document.getElementById('testReports');
  if (container) container.innerHTML = '<div class="text-center">Tests loading...</div>';
}

function renderPunishmentsList() {
  const container = document.getElementById('punishmentsList');
  if (container) container.innerHTML = '<div class="text-center">Punishments loading...</div>';
}

function renderLiveSessionsMonitor() {
  const container = document.getElementById('liveSessionsContainer');
  if (container) {
    container.innerHTML = `
      <div class="no-active-sessions">
        <div class="no-session-icon">💤</div>
        <h3>No Active Sessions</h3>
        <p>Students will appear here when they start study sessions</p>
      </div>
    `;
  }
}

function updateMentorAnalytics() {
  const container = document.getElementById('analyticsOverview');
  if (container) container.innerHTML = '<div class="text-center">Analytics loading...</div>';
}

function updateStudentStats() {
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

  // Update points display
  const todayPointsEl = document.getElementById('todayPoints');
  const yesterdayPointsEl = document.getElementById('yesterdayPoints');

  if (todayPointsEl) todayPointsEl.textContent = dailyPoints[today] || 0;
  if (yesterdayPointsEl) yesterdayPointsEl.textContent = dailyPoints[yesterday] || 0;

  // Update session stats
  const completedEl = document.getElementById('completedSessions');
  const efficiencyEl = document.getElementById('averageEfficiency');

  if (completedEl) {
    const completed = routines.filter(r => r.status === 'completed').length;
    completedEl.textContent = completed;
  }

  if (efficiencyEl) {
    const completedRoutines = routines.filter(r => r.efficiency);
    const avgEfficiency = completedRoutines.length > 0 
      ? Math.round(completedRoutines.reduce((sum, r) => sum + r.efficiency, 0) / completedRoutines.length)
      : 0;
    efficiencyEl.textContent = `${avgEfficiency}%`;
  }
}

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Initializing MentorMate Pro...');

  initializeFirebase();
  startTimeUpdates();
  checkAndResetDailyRoutines();

  // Check for active/paused sessions on page load
  setTimeout(() => {
    const today = getTodayDateString();
    if (sessionTracking[today] && sessionTracking[today].activeSession) {
      // Restore paused session if exists
      const savedSession = sessionTracking[today].activeSession;
      if (savedSession) {
        activeSession = savedSession;
        sessionState = 'paused';
        showPausedSessionResume();
      }
    }
  }, 2000);
});

console.log('✅ MentorMate Pro loaded with Auto-End Sessions & Syllabus System!');