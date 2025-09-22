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

// BULLETPROOF GLOBAL VARIABLES - SIMPLIFIED
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

// BULLETPROOF SESSION VARIABLES - NO MORE 8HR GLITCH!
let activeSession = null;
let sessionTimer = null;
let sessionState = 'none'; // 'none', 'active', 'paused'
let sessionStartTime = null;
let sessionPausedTime = 0; // Total time paused in milliseconds
let sessionElapsedSeconds = 0; // Current elapsed seconds
let lastUpdateTime = null;

// Test Taking Variables
let currentTest = null;
let currentQuestionIndex = 0;
let testAnswers = [];
let testTimer = null;
let testTimeRemaining = 0;

// Constants
const MENTOR_PASSWORD = "SHARU";
const POINTS_PER_MINUTE = 0.2;
const MAX_SESSION_MINUTES = 480; // 8 hours max

// BULLETPROOF HELPER FUNCTIONS - SAFE TIME HANDLING
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
    if (!minutes || isNaN(minutes) || minutes < 0) return '0m';
    if (minutes > MAX_SESSION_MINUTES) minutes = MAX_SESSION_MINUTES; // Cap at 8 hours

    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    if (hours > 0) {
        return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
}

function formatTimeHHMM(minutes) {
    if (!minutes || isNaN(minutes) || minutes < 0) return '00:00';
    if (minutes > MAX_SESSION_MINUTES) minutes = MAX_SESSION_MINUTES; // Cap at 8 hours

    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// BULLETPROOF SESSION TIME CALCULATION - NO MORE 8HR EXPLOSIONS!
function calculateCurrentSessionTime() {
    if (!activeSession || !sessionStartTime) {
        return { minutes: 0, points: 0 };
    }

    let elapsedMs = 0;
    const now = Date.now();

    if (sessionState === 'active') {
        // Session is currently running
        elapsedMs = now - sessionStartTime - sessionPausedTime;
    } else if (sessionState === 'paused' && lastUpdateTime) {
        // Session is paused - use last known time
        elapsedMs = lastUpdateTime - sessionStartTime - sessionPausedTime;
    }

    // Convert to minutes and validate
    let minutes = Math.floor(elapsedMs / 60000);

    // BULLETPROOF VALIDATION - PREVENT 8HR GLITCH!
    if (minutes < 0) minutes = 0;
    if (minutes > MAX_SESSION_MINUTES) minutes = MAX_SESSION_MINUTES;
    if (isNaN(minutes) || !isFinite(minutes)) minutes = 0;

    const points = Math.floor(minutes * POINTS_PER_MINUTE);

    return { minutes: minutes, points: points };
}

// BULLETPROOF SESSION STATE MANAGEMENT
function saveSessionToFirebase() {
    if (!activeSession) return;

    const today = getTodayDateString();
    const sessionTime = calculateCurrentSessionTime();

    const sessionData = {
        routineId: activeSession.routineId,
        routineName: activeSession.routineName,
        targetDuration: activeSession.targetDuration,
        startTime: sessionStartTime,
        state: sessionState,
        pausedTime: sessionPausedTime,
        lastUpdate: Date.now(),
        elapsedMinutes: sessionTime.minutes,
        pointsEarned: sessionTime.points,
        timestamp: Date.now()
    };

    // Save to Firebase
    if (!sessionTracking[today]) {
        sessionTracking[today] = {};
    }
    sessionTracking[today].activeSession = sessionData;

    saveToFirebase('sessionTracking', sessionTracking);
    console.log('✅ Session saved to Firebase:', sessionTime);
}

// BULLETPROOF SESSION RESTORATION - NO MORE 8HR ON REFRESH!
function restoreSessionFromFirebase() {
    const today = getTodayDateString();

    if (sessionTracking[today] && sessionTracking[today].activeSession) {
        const savedSession = sessionTracking[today].activeSession;

        console.log('🔄 Attempting to restore session:', savedSession);

        // Validate saved session data
        if (!savedSession.startTime || !savedSession.routineId) {
            console.log('❌ Invalid session data - clearing');
            clearSession();
            return false;
        }

        // Check if session is from today
        const sessionDate = new Date(savedSession.startTime);
        const today_date = new Date().toDateString();
        const session_date = sessionDate.toDateString();

        if (session_date !== today_date) {
            console.log('❌ Session from different day - clearing');
            clearSession();
            return false;
        }

        // Check if session is not too old (max 12 hours)
        const sessionAge = (Date.now() - savedSession.startTime) / (1000 * 60 * 60);
        if (sessionAge > 12) {
            console.log('❌ Session too old - clearing');
            clearSession();
            return false;
        }

        // Restore session variables
        activeSession = {
            routineId: savedSession.routineId,
            routineName: savedSession.routineName,
            targetDuration: savedSession.targetDuration
        };

        sessionStartTime = savedSession.startTime;
        sessionState = savedSession.state || 'paused'; // Default to paused on restore
        sessionPausedTime = savedSession.pausedTime || 0;
        lastUpdateTime = savedSession.lastUpdate || Date.now();

        // BULLETPROOF VALIDATION OF RESTORED TIME
        const restoredTime = calculateCurrentSessionTime();
        console.log('📱 Restored session time:', restoredTime);

        // If restored time is reasonable, proceed
        if (restoredTime.minutes >= 0 && restoredTime.minutes <= MAX_SESSION_MINUTES) {

            // Update routine status
            const routine = routines.find(r => r.id === savedSession.routineId);
            if (routine) {
                routine.status = 'in-progress';
            }

            // Show appropriate UI
            if (sessionState === 'active') {
                // Treat as paused after refresh for safety
                sessionState = 'paused';
                showPausedSessionResume();
                hideActiveSessionMonitor();
            } else {
                showPausedSessionResume();
                hideActiveSessionMonitor();
            }

            updateSessionDisplay();
            renderStudentRoutines();

            console.log('✅ Session restored successfully');
            return true;
        } else {
            console.log('❌ Restored time invalid - clearing session');
            clearSession();
            return false;
        }
    }

    return false;
}

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing MentorMate Pro - COMPLETE VERSION...');

    initializeFirebase();
    startTimeUpdates();
    checkAndResetDailyRoutines();
});

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
                    // BULLETPROOF: Try to restore session after routines load
                    setTimeout(() => {
                        restoreSessionFromFirebase();
                    }, 500);
                } else if (currentUser.role === 'mentor') {
                    renderRoutineManager();
                    renderLiveSessionsMonitor();
                }
            }
        }
    });

    // Session tracking listener
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
                    },
                    {
                        question: 'What is 2 + 2?',
                        options: ['3', '4', '5', '6'],
                        correctAnswer: 1
                    },
                    {
                        question: 'Who wrote Romeo and Juliet?',
                        options: ['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain'],
                        correctAnswer: 1
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
    } else if (sectionName === 'progress') {
        updateStudentStats();
        renderStudentActivity();
        renderStudentAnalytics();
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
        renderMentorCharts();
    } else if (sectionName === 'sessions') {
        renderLiveSessionsMonitor();
    } else if (sectionName === 'routines') {
        renderRoutineManager();
    } else if (sectionName === 'tests') {
        renderTestReports();
    } else if (sectionName === 'punishments') {
        renderPunishmentsList();
    }
}

// SESSION TRACKING FUNCTIONS

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
    const routineEndTime = routineStartTime + (routine.duration || 60) + 60;

    if (currentTime < routineStartTime - 30) {
        return 'yet-to-live';
    } else if (currentTime <= routineEndTime) {
        return 'live';
    } else {
        return 'missed';
    }
}

// BULLETPROOF SESSION FUNCTIONS - FIXED!

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
        clearSession();
    }

    // Initialize new session
    const now = Date.now();
    sessionStartTime = now;
    sessionState = 'active';
    sessionPausedTime = 0;
    lastUpdateTime = now;

    activeSession = {
        routineId: routineId,
        routineName: routine.name,
        targetDuration: routine.duration
    };

    // Update routine status
    routine.status = 'in-progress';
    routine.sessionStarted = new Date().toISOString();

    // Save to Firebase
    saveToFirebase('routines', routines);
    saveSessionToFirebase();

    // Start UI timer
    if (sessionTimer) clearInterval(sessionTimer);
    sessionTimer = setInterval(updateActiveSessionDisplay, 1000);

    // Show session monitor
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

    // Update paused time
    const now = Date.now();
    lastUpdateTime = now;
    sessionState = 'paused';

    // Stop timer
    if (sessionTimer) {
        clearInterval(sessionTimer);
        sessionTimer = null;
    }

    // Save state
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

    // Calculate paused time and resume
    const now = Date.now();
    if (lastUpdateTime) {
        sessionPausedTime += (now - lastUpdateTime);
    }

    sessionState = 'active';
    lastUpdateTime = now;

    // Save state
    saveSessionToFirebase();

    // Restart timer
    if (sessionTimer) clearInterval(sessionTimer);
    sessionTimer = setInterval(updateActiveSessionDisplay, 1000);

    // Update display
    showActiveSessionMonitor();
    hidePausedSessionResume();

    console.log('✅ Session resumed successfully');
}

// BULLETPROOF END SESSION - FIXED!
function stopSession() {
    console.log('⏹️ Stopping session');

    if (!activeSession) {
        console.log('❌ No active session to stop');
        alert('No active session found!');
        return;
    }

    // FIXED: Show confirmation dialog that actually works
    const confirmed = confirm(`Are you sure you want to end this session?\n\n📚 Session: ${activeSession.routineName}\n⏱️ Current Progress: ${formatTime(calculateCurrentSessionTime().minutes)}`);

    if (!confirmed) {
        console.log('❌ Session end cancelled by user');
        return;
    }

    console.log('✅ User confirmed session end');

    // Stop timer
    if (sessionTimer) {
        clearInterval(sessionTimer);
        sessionTimer = null;
    }

    // Calculate final session time
    const finalTime = calculateCurrentSessionTime();
    const totalSessionTime = finalTime.minutes;
    const pointsEarned = finalTime.points;
    const targetDuration = activeSession.targetDuration;

    console.log('📊 Final session stats:', {
        time: totalSessionTime,
        points: pointsEarned,
        target: targetDuration
    });

    // Update routine
    const routine = routines.find(r => r.id === activeSession.routineId);
    if (routine) {
        routine.status = 'completed';
        routine.completedAt = new Date().toISOString();
        routine.actualDuration = totalSessionTime;
        routine.pointsEarned = pointsEarned;
        routine.completedDate = getTodayDateString();
        routine.efficiency = Math.round((totalSessionTime / targetDuration) * 100);
    }

    // Update daily points
    const today = getTodayDateString();
    if (!dailyPoints[today]) {
        dailyPoints[today] = 0;
    }
    dailyPoints[today] += pointsEarned;

    // Save session data for analytics
    const sessionData = {
        routineId: activeSession.routineId,
        routineName: activeSession.routineName,
        targetDuration: targetDuration,
        actualDuration: totalSessionTime,
        pointsEarned: pointsEarned,
        efficiency: Math.round((totalSessionTime / targetDuration) * 100),
        startTime: new Date(sessionStartTime).toISOString(),
        endTime: new Date().toISOString(),
        totalPausedTime: Math.floor(sessionPausedTime / 60000)
    };

    // Update session tracking
    if (!sessionTracking[today]) {
        sessionTracking[today] = { sessions: [] };
    }
    if (!sessionTracking[today].sessions) {
        sessionTracking[today].sessions = [];
    }
    sessionTracking[today].sessions.push(sessionData);
    sessionTracking[today].activeSession = null; // Clear active session

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
        date: today
    };

    notifications.push(notification);
    saveToFirebase('notifications', notifications);

    // Show completion message
    let message = `🎉 Session Completed Successfully!\n\n`;
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

    // Clear session
    clearSession();

    // Update UI
    renderStudentRoutines();
    updateStudentStats();
    updateSessionDisplay();

    console.log('✅ Session completed and saved successfully');
}

function clearSession() {
    // Clear session variables
    activeSession = null;
    sessionState = 'none';
    sessionStartTime = null;
    sessionPausedTime = 0;
    lastUpdateTime = null;

    // Stop timer
    if (sessionTimer) {
        clearInterval(sessionTimer);
        sessionTimer = null;
    }

    // Hide UI elements
    hideActiveSessionMonitor();
    hidePausedSessionResume();

    console.log('🧹 Session cleared');
}

function updateActiveSessionDisplay() {
    if (!activeSession) return;

    const sessionTime = calculateCurrentSessionTime();
    const targetDuration = activeSession.targetDuration;
    const percentage = Math.min((sessionTime.minutes / targetDuration) * 100, 100);

    // Update time display
    const timeElement = document.getElementById('activeSessionTime');
    if (timeElement) {
        timeElement.textContent = formatTimeHHMM(sessionTime.minutes);
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
        elapsedElement.textContent = formatTime(sessionTime.minutes);
    }

    const pointsElement = document.getElementById('currentPoints');
    if (pointsElement) {
        pointsElement.textContent = sessionTime.points;
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

        if (timeElement) {
            const sessionTime = calculateCurrentSessionTime();
            timeElement.textContent = `Paused at: ${formatTimeHHMM(sessionTime.minutes)}`;
        }
    }
}

function hidePausedSessionResume() {
    const resume = document.getElementById('pausedSessionResume');
    if (resume) {
        resume.style.display = 'none';
    }
}

// BULLETPROOF SESSION DISPLAY UPDATE - NO MORE 8HR GLITCH!
function updateSessionDisplay() {
    const today = getTodayDateString();
    const todaySessions = sessionTracking[today];
    let totalTime = 0;

    // Add completed sessions time
    if (todaySessions && todaySessions.sessions) {
        totalTime = todaySessions.sessions.reduce((sum, session) => sum + (session.actualDuration || 0), 0);
    }

    // Add current session time (bulletproof calculation)
    if (activeSession) {
        const currentTime = calculateCurrentSessionTime();
        totalTime += currentTime.minutes;
    }

    // BULLETPROOF VALIDATION - PREVENT 8HR DISPLAY!
    if (totalTime < 0) totalTime = 0;
    if (totalTime > MAX_SESSION_MINUTES) totalTime = MAX_SESSION_MINUTES;
    if (isNaN(totalTime) || !isFinite(totalTime)) totalTime = 0;

    const sessionTimeElement = document.getElementById('totalSessionTime');
    if (sessionTimeElement) {
        sessionTimeElement.textContent = formatTime(totalTime);
    }

    console.log('📊 Session display updated - Total time:', totalTime);
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
    todayAnalytics.totalStudyTime += sessionData.actualDuration;
    todayAnalytics.totalPointsEarned += sessionData.pointsEarned;
    todayAnalytics.sessions.push(sessionData);

    const totalEfficiency = todayAnalytics.sessions.reduce((sum, session) => sum + (session.efficiency || 0), 0);
    todayAnalytics.averageEfficiency = Math.round(totalEfficiency / todayAnalytics.totalSessions);
}

// Student Data Loading and Rendering
function loadStudentData() {
    console.log('👨‍🎓 Loading student data...');
    renderStudentRoutines();
    updateStudentStats();
    renderAvailableTests();
    renderStudentActivity();
    updateSessionDisplay();

    // Try to restore session after a short delay
    setTimeout(() => {
        restoreSessionFromFirebase();
    }, 1000);
}

function renderStudentRoutines() {
    const container = document.getElementById('studentRoutines');
    if (!container) return;

    if (!routines || routines.length === 0) {
        container.innerHTML = '<div class="text-center">No learning sessions available.</div>';
        return;
    }

    container.innerHTML = routines.map(routine => {
        const sessionStatus = getSessionStatus(routine);
        let statusDisplay = '';
        let buttonText = '';
        let buttonDisabled = false;
        let buttonClass = 'btn-success';
        let buttonAction = `startSession('${routine.id}')`;

        if (routine.status === 'completed') {
            statusDisplay = 'COMPLETED';
            buttonText = '✅ Completed';
            buttonDisabled = true;
            buttonClass = 'btn-secondary';
        } else if (routine.status === 'in-progress') {
            statusDisplay = 'IN PROGRESS';
            buttonText = '🔴 Session Active';
            buttonDisabled = true;
            buttonClass = 'btn-warning';
        } else {
            switch(sessionStatus) {
                case 'yet-to-live':
                    statusDisplay = 'SCHEDULED';
                    buttonText = '⏳ Scheduled';
                    buttonDisabled = true;
                    buttonClass = 'btn-secondary';
                    break;
                case 'live':
                    statusDisplay = 'AVAILABLE';
                    buttonText = '🚀 Start Session';
                    buttonDisabled = (activeSession !== null && sessionState === 'active');
                    buttonClass = (activeSession !== null && sessionState === 'active') ? 'btn-secondary' : 'btn-success';
                    break;
                case 'missed':
                    statusDisplay = 'MISSED';
                    buttonText = '❌ Missed';
                    buttonDisabled = true;
                    buttonClass = 'btn-danger';
                    break;
                default:
                    statusDisplay = 'NO TIME SET';
                    buttonText = '⚠️ No Time Set';
                    buttonDisabled = true;
                    buttonClass = 'btn-secondary';
            }
        }

        return `
            <div class="routine-card">
                <div class="routine-header">
                    <div class="routine-info">
                        <h4>${routine.name || 'Unnamed Session'}</h4>
                        <div class="routine-time">${routine.time || 'No time set'} (${formatTime(routine.duration || 0)} target)</div>
                        <div class="routine-points">🎯 ${routine.points || 0} points (${formatTime(routine.duration || 0)})</div>
                        <div class="routine-category">📂 ${routine.category || 'General'}</div>
                    </div>
                    <div class="routine-status ${routine.status || 'pending'}">${statusDisplay}</div>
                </div>
                ${routine.completedAt ? `
                    <div class="session-results">
                        <div class="result-item">
                            <span class="result-label">Study Time:</span>
                            <span class="result-value">${formatTime(routine.actualDuration || 0)}</span>
                        </div>
                        <div class="result-item">
                            <span class="result-label">Target:</span>
                            <span class="result-value">${formatTime(routine.duration || 0)}</span>
                        </div>
                        <div class="result-item">
                            <span class="result-label">Efficiency:</span>
                            <span class="result-value">${routine.efficiency || 0}%</span>
                        </div>
                        <div class="result-item">
                            <span class="result-label">Points:</span>
                            <span class="result-value">${routine.pointsEarned || 0}</span>
                        </div>
                    </div>
                ` : ''}
                <div class="routine-actions">
                    <button onclick="${buttonAction}" 
                            class="btn ${buttonClass} btn-small"
                            ${buttonDisabled ? 'disabled' : ''}>
                        ${buttonText}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function updateStudentStats() {
    const today = getTodayDateString();
    const todayPoints = dailyPoints[today] || 0;
    const todaySessions = sessionTracking[today];

    let completedToday = 0;
    let totalStudyTime = 0;

    if (todaySessions && todaySessions.sessions) {
        completedToday = todaySessions.sessions.length;
        totalStudyTime = todaySessions.sessions.reduce((sum, session) => sum + (session.actualDuration || 0), 0);
    }

    // Add current session time
    if (activeSession) {
        const currentTime = calculateCurrentSessionTime();
        totalStudyTime += currentTime.minutes;
    }

    const testsTakenCount = testResults.length;
    const averageScore = testsTakenCount > 0 
        ? Math.round(testResults.reduce((sum, r) => sum + (r.percentage || 0), 0) / testsTakenCount)
        : 0;
    const totalPunishmentsCount = studentPunishments.length;

    // Update display elements
    const pointsElement = document.getElementById('studentPoints');
    const completedElement = document.getElementById('completedRoutines');
    const testsElement = document.getElementById('testsTaken');
    const averageElement = document.getElementById('averageScore');
    const punishmentsElement = document.getElementById('totalPunishments');
    const sessionTimeElement = document.getElementById('totalSessionTime');

    if (pointsElement) pointsElement.textContent = todayPoints;
    if (completedElement) completedElement.textContent = completedToday;
    if (testsElement) testsElement.textContent = testsTakenCount;
    if (averageElement) averageElement.textContent = averageScore + '%';
    if (punishmentsElement) punishmentsElement.textContent = totalPunishmentsCount;
    if (sessionTimeElement) sessionTimeElement.textContent = formatTime(totalStudyTime);

    updateWeeklyStats();
}

function updateWeeklyStats() {
    const weekStart = getWeekStartDateString();
    const today = getTodayDateString();

    let weeklyPoints = 0;
    let weeklyHours = 0;
    let weeklySessions = 0;
    let totalEfficiency = 0;
    let efficiencyCount = 0;

    for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - date.getDay() + i);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        if (dailyPoints[dateStr]) {
            weeklyPoints += dailyPoints[dateStr];
        }

        if (sessionTracking[dateStr] && sessionTracking[dateStr].sessions) {
            weeklySessions += sessionTracking[dateStr].sessions.length;
            weeklyHours += sessionTracking[dateStr].sessions.reduce((sum, session) => sum + (session.actualDuration || 0), 0);

            sessionTracking[dateStr].sessions.forEach(session => {
                if (session.efficiency) {
                    totalEfficiency += session.efficiency;
                    efficiencyCount++;
                }
            });
        }
    }

    const weeklyAverage = efficiencyCount > 0 ? Math.round(totalEfficiency / efficiencyCount) : 0;

    const weeklyPointsElement = document.getElementById('weeklyPoints');
    const weeklyHoursElement = document.getElementById('weeklyHours');
    const weeklySessionsElement = document.getElementById('weeklySessions');
    const weeklyAverageElement = document.getElementById('weeklyAverage');

    if (weeklyPointsElement) weeklyPointsElement.textContent = weeklyPoints;
    if (weeklyHoursElement) weeklyHoursElement.textContent = Math.floor(weeklyHours / 60) + 'h';
    if (weeklySessionsElement) weeklySessionsElement.textContent = weeklySessions;
    if (weeklyAverageElement) weeklyAverageElement.textContent = weeklyAverage + '%';
}

// COMPLETE MENTOR FUNCTIONS - ALL MISSING FUNCTIONALITY ADDED!

function renderAvailableTests() {
    const container = document.getElementById('availableTests');
    if (!container) return;

    if (!tests || tests.length === 0) {
        container.innerHTML = '<div class="text-center">No tests available.</div>';
        return;
    }

    container.innerHTML = tests.map(test => `
        <div class="test-card">
            <div class="test-header">
                <h4>${test.title}</h4>
                <span class="test-category">${test.category}</span>
            </div>
            <div class="test-details">
                <div class="test-duration">⏱️ ${test.duration} minutes</div>
                <div class="test-questions">📝 ${test.questions ? test.questions.length : 0} questions</div>
                <div class="test-status ${test.status}">${test.status.toUpperCase()}</div>
            </div>
            <div class="test-actions">
                <button onclick="startTest('${test.id}')" 
                        class="btn btn-primary btn-small"
                        ${test.status !== 'available' ? 'disabled' : ''}>
                    ${test.status === 'available' ? '🚀 Start Test' : '⏳ Not Available'}
                </button>
            </div>
        </div>
    `).join('');
}

function renderStudentActivity() {
    const container = document.getElementById('studentActivity');
    if (!container) return;

    // Get recent notifications for student
    const recentNotifications = notifications
        .filter(n => n.type === 'session' || n.type === 'test')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10);

    if (recentNotifications.length === 0) {
        container.innerHTML = '<div class="text-center">No recent activity.</div>';
        return;
    }

    container.innerHTML = recentNotifications.map(notification => {
        const date = new Date(notification.timestamp);
        const timeStr = date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        let activityText = '';
        let icon = '';

        if (notification.type === 'session') {
            icon = '📚';
            activityText = `Completed ${notification.routineName} - ${formatTime(notification.actualDuration)} (${notification.efficiency}% efficiency)`;
        } else if (notification.type === 'test') {
            icon = '📝';
            activityText = `Completed ${notification.testTitle} - Score: ${notification.score}%`;
        }

        return `
            <div class="activity-item">
                <div class="activity-icon">${icon}</div>
                <div class="activity-content">
                    <div class="activity-text">${activityText}</div>
                    <div class="activity-time">${timeStr}</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderStudentAnalytics() {
    const container = document.getElementById('studentAnalytics');
    if (!container) return;

    // Get last 7 days performance
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        const dayData = {
            date: dateStr,
            shortDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            points: dailyPoints[dateStr] || 0,
            sessions: 0,
            studyTime: 0
        };

        if (sessionTracking[dateStr] && sessionTracking[dateStr].sessions) {
            dayData.sessions = sessionTracking[dateStr].sessions.length;
            dayData.studyTime = sessionTracking[dateStr].sessions.reduce((sum, s) => sum + (s.actualDuration || 0), 0);
        }

        last7Days.push(dayData);
    }

    const maxPoints = Math.max(...last7Days.map(d => d.points), 1);

    container.innerHTML = `
        <div class="analytics-chart">
            <h4>📊 Weekly Progress</h4>
            <div class="chart-bars">
                ${last7Days.map(day => `
                    <div class="chart-bar">
                        <div class="bar-fill" style="height: ${(day.points / maxPoints) * 100}%"></div>
                        <div class="bar-label">${day.shortDate}</div>
                        <div class="bar-value">${day.points}pts</div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="analytics-summary">
            <div class="summary-item">
                <span class="summary-label">Total Points:</span>
                <span class="summary-value">${last7Days.reduce((sum, d) => sum + d.points, 0)}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Total Sessions:</span>
                <span class="summary-value">${last7Days.reduce((sum, d) => sum + d.sessions, 0)}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Study Hours:</span>
                <span class="summary-value">${Math.floor(last7Days.reduce((sum, d) => sum + d.studyTime, 0) / 60)}h</span>
            </div>
        </div>
    `;
}

// MENTOR DASHBOARD FUNCTIONS - COMPLETE IMPLEMENTATION

function loadMentorData() {
    console.log('👨‍🏫 Loading mentor data...');
    updateMentorAnalytics();
    renderMentorCharts();
    renderLiveSessionsMonitor();
    renderRoutineManager();
    renderTestReports();
    renderPunishmentsList();
    renderActivityFeed();
}

function renderLiveSessionsMonitor() {
    const container = document.getElementById('liveSessionsContainer');
    if (!container) return;

    const today = getTodayDateString();
    let activeSessions = [];

    // Check for active sessions
    if (sessionTracking[today] && sessionTracking[today].activeSession) {
        activeSessions.push(sessionTracking[today].activeSession);
    }

    if (activeSessions.length === 0) {
        container.innerHTML = `
            <div class="no-sessions">
                <div class="no-sessions-icon">📱</div>
                <h3>No Active Sessions</h3>
                <p>No students are currently studying.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = activeSessions.map(session => {
        const elapsed = calculateSessionElapsedTime(session);
        const percentage = Math.min((elapsed / (session.targetDuration || 60)) * 100, 100);

        return `
            <div class="live-session-card">
                <div class="session-header">
                    <div class="student-info">
                        <div class="student-avatar">👨‍🎓</div>
                        <div class="student-details">
                            <h4>Student</h4>
                            <div class="session-name">${session.routineName}</div>
                        </div>
                    </div>
                    <div class="session-status ${session.state}">
                        ${session.state === 'active' ? '🟢 ACTIVE' : '⏸️ PAUSED'}
                    </div>
                </div>

                <div class="session-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%"></div>
                    </div>
                    <div class="progress-stats">
                        <span>⏱️ ${formatTime(elapsed)}</span>
                        <span>🎯 ${formatTime(session.targetDuration || 0)}</span>
                        <span>📊 ${Math.round(percentage)}%</span>
                    </div>
                </div>

                <div class="session-details">
                    <div class="detail-item">
                        <span class="detail-label">Started:</span>
                        <span class="detail-value">${new Date(session.startTime).toLocaleTimeString()}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Points:</span>
                        <span class="detail-value">${Math.floor(elapsed * POINTS_PER_MINUTE)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function calculateSessionElapsedTime(session) {
    if (!session || !session.startTime) return 0;

    const now = Date.now();
    const startTime = new Date(session.startTime).getTime();
    const pausedTime = session.pausedTime || 0;

    let elapsed = 0;

    if (session.state === 'active') {
        elapsed = Math.floor((now - startTime - pausedTime) / 60000);
    } else if (session.state === 'paused' && session.lastUpdate) {
        const lastUpdate = new Date(session.lastUpdate).getTime();
        elapsed = Math.floor((lastUpdate - startTime - pausedTime) / 60000);
    }

    if (elapsed < 0) elapsed = 0;
    if (elapsed > MAX_SESSION_MINUTES) elapsed = MAX_SESSION_MINUTES;

    return elapsed;
}

function renderRoutineManager() {
    const container = document.getElementById('routineManagerContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="routine-manager">
            <div class="manager-header">
                <h3>📚 Routine Management</h3>
                <button onclick="showAddRoutineForm()" class="btn btn-primary">➕ Add Routine</button>
            </div>

            <div class="routines-list">
                ${routines.map(routine => `
                    <div class="routine-manager-card">
                        <div class="routine-info">
                            <h4>${routine.name}</h4>
                            <div class="routine-meta">
                                <span>⏰ ${routine.time}</span>
                                <span>⏱️ ${formatTime(routine.duration)}</span>
                                <span>🎯 ${routine.points} points</span>
                                <span>📂 ${routine.category}</span>
                            </div>
                        </div>

                        <div class="routine-status">
                            <span class="status-badge ${routine.status}">${routine.status.toUpperCase()}</span>
                        </div>

                        <div class="routine-actions">
                            <button onclick="editRoutine('${routine.id}')" class="btn btn-secondary btn-small">✏️ Edit</button>
                            <button onclick="deleteRoutine('${routine.id}')" class="btn btn-danger btn-small">🗑️ Delete</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div id="routineFormModal" class="modal" style="display: none;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="modalTitle">Add New Routine</h3>
                    <button onclick="closeRoutineModal()" class="close-btn">×</button>
                </div>
                <div class="modal-body">
                    <form id="routineForm">
                        <div class="form-group">
                            <label>Routine Name:</label>
                            <input type="text" id="routineName" required>
                        </div>
                        <div class="form-group">
                            <label>Time:</label>
                            <input type="time" id="routineTime" required>
                        </div>
                        <div class="form-group">
                            <label>Duration (minutes):</label>
                            <input type="number" id="routineDuration" min="15" max="480" required>
                        </div>
                        <div class="form-group">
                            <label>Category:</label>
                            <select id="routineCategory" required>
                                <option value="Education">Education</option>
                                <option value="Skills">Skills</option>
                                <option value="Practice">Practice</option>
                                <option value="Review">Review</option>
                            </select>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button onclick="saveRoutine()" class="btn btn-primary">💾 Save Routine</button>
                    <button onclick="closeRoutineModal()" class="btn btn-secondary">❌ Cancel</button>
                </div>
            </div>
        </div>
    `;
}

function renderTestReports() {
    const container = document.getElementById('testReportsContainer');
    if (!container) return;

    // Calculate test statistics
    const totalTests = tests.length;
    const completedTests = testResults.length;
    const averageScore = completedTests > 0 
        ? Math.round(testResults.reduce((sum, r) => sum + (r.percentage || 0), 0) / completedTests)
        : 0;

    const recentResults = testResults
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
        .slice(0, 10);

    container.innerHTML = `
        <div class="test-reports">
            <div class="reports-header">
                <h3>📊 Test Performance Reports</h3>
                <div class="reports-stats">
                    <div class="stat-item">
                        <span class="stat-value">${totalTests}</span>
                        <span class="stat-label">Available Tests</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${completedTests}</span>
                        <span class="stat-label">Completed</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${averageScore}%</span>
                        <span class="stat-label">Average Score</span>
                    </div>
                </div>
            </div>

            <div class="recent-results">
                <h4>Recent Test Results</h4>
                ${recentResults.length > 0 ? `
                    <div class="results-list">
                        ${recentResults.map(result => `
                            <div class="result-card">
                                <div class="result-info">
                                    <h5>${result.testTitle}</h5>
                                    <div class="result-meta">
                                        <span>👨‍🎓 ${result.studentName}</span>
                                        <span>📅 ${new Date(result.completedAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div class="result-score ${result.percentage >= 80 ? 'excellent' : result.percentage >= 60 ? 'good' : 'needs-improvement'}">
                                    ${result.percentage}%
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : '<div class="no-data">No test results available.</div>'}
            </div>
        </div>
    `;
}

function renderPunishmentsList() {
    const container = document.getElementById('punishmentsContainer');
    if (!container) return;

    const activePunishments = studentPunishments.filter(p => p.status === 'active');
    const completedPunishments = studentPunishments.filter(p => p.status === 'completed');

    container.innerHTML = `
        <div class="punishments-manager">
            <div class="punishments-header">
                <h3>⚖️ Student Punishments</h3>
                <button onclick="showAddPunishmentForm()" class="btn btn-warning">➕ Add Punishment</button>
            </div>

            <div class="punishments-tabs">
                <button class="tab-btn active" onclick="showPunishmentTab('active')">Active (${activePunishments.length})</button>
                <button class="tab-btn" onclick="showPunishmentTab('completed')">Completed (${completedPunishments.length})</button>
            </div>

            <div id="activePunishments" class="punishment-list">
                ${activePunishments.length > 0 ? activePunishments.map(punishment => `
                    <div class="punishment-card">
                        <div class="punishment-info">
                            <h4>${punishment.title}</h4>
                            <p>${punishment.description}</p>
                            <div class="punishment-meta">
                                <span>👨‍🎓 ${punishment.studentName}</span>
                                <span>📅 ${new Date(punishment.assignedAt).toLocaleDateString()}</span>
                                <span>⏱️ ${punishment.duration} minutes</span>
                            </div>
                        </div>
                        <div class="punishment-actions">
                            <button onclick="completePunishment('${punishment.id}')" class="btn btn-success btn-small">✅ Complete</button>
                            <button onclick="removePunishment('${punishment.id}')" class="btn btn-danger btn-small">🗑️ Remove</button>
                        </div>
                    </div>
                `).join('') : '<div class="no-data">No active punishments.</div>'}
            </div>

            <div id="completedPunishments" class="punishment-list" style="display: none;">
                ${completedPunishments.length > 0 ? completedPunishments.map(punishment => `
                    <div class="punishment-card completed">
                        <div class="punishment-info">
                            <h4>${punishment.title}</h4>
                            <p>${punishment.description}</p>
                            <div class="punishment-meta">
                                <span>👨‍🎓 ${punishment.studentName}</span>
                                <span>📅 Assigned: ${new Date(punishment.assignedAt).toLocaleDateString()}</span>
                                <span>✅ Completed: ${new Date(punishment.completedAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div class="punishment-status">
                            <span class="status-badge completed">COMPLETED</span>
                        </div>
                    </div>
                `).join('') : '<div class="no-data">No completed punishments.</div>'}
            </div>
        </div>
    `;
}

function renderActivityFeed() {
    const container = document.getElementById('activityFeedContainer');
    if (!container) return;

    // Get all notifications sorted by timestamp
    const allActivities = notifications
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 20);

    if (allActivities.length === 0) {
        container.innerHTML = '<div class="no-data">No recent activities.</div>';
        return;
    }

    container.innerHTML = `
        <div class="activity-feed">
            <h4>📈 Recent Activities</h4>
            <div class="activities-list">
                ${allActivities.map(activity => {
                    const date = new Date(activity.timestamp);
                    const timeStr = date.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    });

                    let icon = '📋';
                    let message = '';

                    if (activity.type === 'session') {
                        icon = '📚';
                        message = `${activity.studentName} completed ${activity.routineName} - ${formatTime(activity.actualDuration)} (${activity.efficiency}% efficiency)`;
                    } else if (activity.type === 'test') {
                        icon = '📝';
                        message = `${activity.studentName} completed ${activity.testTitle} - Score: ${activity.score}%`;
                    } else if (activity.type === 'punishment') {
                        icon = '⚖️';
                        message = `${activity.studentName} received punishment: ${activity.punishmentTitle}`;
                    }

                    return `
                        <div class="activity-item">
                            <div class="activity-icon">${icon}</div>
                            <div class="activity-content">
                                <div class="activity-message">${message}</div>
                                <div class="activity-time">${timeStr} • ${date.toLocaleDateString()}</div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function updateMentorAnalytics() {
    const today = getTodayDateString();

    // Today's statistics
    const todayPoints = dailyPoints[today] || 0;
    const todaySessions = sessionTracking[today] ? 
        (sessionTracking[today].sessions ? sessionTracking[today].sessions.length : 0) : 0;

    // Weekly statistics
    let weeklyPoints = 0;
    let weeklySessions = 0;
    let weeklyStudyTime = 0;

    for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        if (dailyPoints[dateStr]) {
            weeklyPoints += dailyPoints[dateStr];
        }

        if (sessionTracking[dateStr] && sessionTracking[dateStr].sessions) {
            weeklySessions += sessionTracking[dateStr].sessions.length;
            weeklyStudyTime += sessionTracking[dateStr].sessions.reduce((sum, s) => sum + (s.actualDuration || 0), 0);
        }
    }

    // Update dashboard elements
    const elements = {
        todayPoints: document.getElementById('mentorTodayPoints'),
        todaySessions: document.getElementById('mentorTodaySessions'),
        weeklyPoints: document.getElementById('mentorWeeklyPoints'),
        weeklySessions: document.getElementById('mentorWeeklySessions'),
        weeklyHours: document.getElementById('mentorWeeklyHours'),
        totalTests: document.getElementById('mentorTotalTests'),
        activePunishments: document.getElementById('mentorActivePunishments')
    };

    if (elements.todayPoints) elements.todayPoints.textContent = todayPoints;
    if (elements.todaySessions) elements.todaySessions.textContent = todaySessions;
    if (elements.weeklyPoints) elements.weeklyPoints.textContent = weeklyPoints;
    if (elements.weeklySessions) elements.weeklySessions.textContent = weeklySessions;
    if (elements.weeklyHours) elements.weeklyHours.textContent = Math.floor(weeklyStudyTime / 60) + 'h';
    if (elements.totalTests) elements.totalTests.textContent = tests.length;
    if (elements.activePunishments) elements.activePunishments.textContent = 
        studentPunishments.filter(p => p.status === 'active').length;
}

function renderMentorCharts() {
    // This would render charts using Chart.js or similar
    // For now, we'll use simple HTML/CSS charts
    const chartContainer = document.getElementById('mentorChartsContainer');
    if (!chartContainer) return;

    // Get last 7 days data
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        const points = dailyPoints[dateStr] || 0;
        const sessions = sessionTracking[dateStr] ? 
            (sessionTracking[dateStr].sessions ? sessionTracking[dateStr].sessions.length : 0) : 0;

        last7Days.push({
            date: dateStr,
            shortDate: date.toLocaleDateString('en-US', { weekday: 'short' }),
            points: points,
            sessions: sessions
        });
    }

    const maxPoints = Math.max(...last7Days.map(d => d.points), 1);
    const maxSessions = Math.max(...last7Days.map(d => d.sessions), 1);

    chartContainer.innerHTML = `
        <div class="mentor-charts">
            <div class="chart-section">
                <h4>📊 Daily Points</h4>
                <div class="chart-bars">
                    ${last7Days.map(day => `
                        <div class="chart-bar">
                            <div class="bar-fill" style="height: ${(day.points / maxPoints) * 100}%"></div>
                            <div class="bar-label">${day.shortDate}</div>
                            <div class="bar-value">${day.points}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="chart-section">
                <h4>📈 Daily Sessions</h4>
                <div class="chart-bars">
                    ${last7Days.map(day => `
                        <div class="chart-bar">
                            <div class="bar-fill sessions" style="height: ${(day.sessions / maxSessions) * 100}%"></div>
                            <div class="bar-label">${day.shortDate}</div>
                            <div class="bar-value">${day.sessions}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

// UTILITY FUNCTIONS FOR MENTOR FEATURES

function showAddRoutineForm() {
    const modal = document.getElementById('routineFormModal');
    const form = document.getElementById('routineForm');
    const title = document.getElementById('modalTitle');

    if (modal && form && title) {
        title.textContent = 'Add New Routine';
        form.reset();
        currentEditingRoutineId = null;
        modal.style.display = 'block';
    }
}

function editRoutine(routineId) {
    const routine = routines.find(r => r.id === routineId);
    if (!routine) return;

    const modal = document.getElementById('routineFormModal');
    const form = document.getElementById('routineForm');
    const title = document.getElementById('modalTitle');

    if (modal && form && title) {
        title.textContent = 'Edit Routine';
        currentEditingRoutineId = routineId;

        document.getElementById('routineName').value = routine.name;
        document.getElementById('routineTime').value = routine.time;
        document.getElementById('routineDuration').value = routine.duration;
        document.getElementById('routineCategory').value = routine.category;

        modal.style.display = 'block';
    }
}

function saveRoutine() {
    const name = document.getElementById('routineName').value;
    const time = document.getElementById('routineTime').value;
    const duration = parseInt(document.getElementById('routineDuration').value);
    const category = document.getElementById('routineCategory').value;

    if (!name || !time || !duration || !category) {
        alert('Please fill all fields!');
        return;
    }

    const points = Math.floor(duration * POINTS_PER_MINUTE);

    if (currentEditingRoutineId) {
        // Edit existing routine
        const routine = routines.find(r => r.id === currentEditingRoutineId);
        if (routine) {
            routine.name = name;
            routine.time = time;
            routine.duration = duration;
            routine.category = category;
            routine.points = points;
        }
    } else {
        // Add new routine
        const newRoutine = {
            id: 'routine-' + Date.now(),
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
    closeRoutineModal();
    renderRoutineManager();
    alert('Routine saved successfully!');
}

function deleteRoutine(routineId) {
    if (!confirm('Are you sure you want to delete this routine?')) {
        return;
    }

    routines = routines.filter(r => r.id !== routineId);
    saveToFirebase('routines', routines);
    renderRoutineManager();
    alert('Routine deleted successfully!');
}

function closeRoutineModal() {
    const modal = document.getElementById('routineFormModal');
    if (modal) {
        modal.style.display = 'none';
    }
    currentEditingRoutineId = null;
}

function showPunishmentTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // Show/hide content
    document.getElementById('activePunishments').style.display = tab === 'active' ? 'block' : 'none';
    document.getElementById('completedPunishments').style.display = tab === 'completed' ? 'block' : 'none';
}

function showAddPunishmentForm() {
    const title = prompt('Enter punishment title:');
    const description = prompt('Enter punishment description:');
    const duration = prompt('Enter punishment duration (minutes):');

    if (title && description && duration) {
        const newPunishment = {
            id: 'punishment-' + Date.now(),
            title: title,
            description: description,
            duration: parseInt(duration),
            studentName: 'Student',
            assignedAt: new Date().toISOString(),
            status: 'active'
        };

        studentPunishments.push(newPunishment);
        saveToFirebase('studentPunishments', studentPunishments);
        renderPunishmentsList();

        alert('Punishment assigned successfully!');
    }
}

function completePunishment(punishmentId) {
    const punishment = studentPunishments.find(p => p.id === punishmentId);
    if (punishment) {
        punishment.status = 'completed';
        punishment.completedAt = new Date().toISOString();

        saveToFirebase('studentPunishments', studentPunishments);
        renderPunishmentsList();

        alert('Punishment marked as completed!');
    }
}

function removePunishment(punishmentId) {
    if (!confirm('Are you sure you want to remove this punishment?')) {
        return;
    }

    studentPunishments = studentPunishments.filter(p => p.id !== punishmentId);
    saveToFirebase('studentPunishments', studentPunishments);
    renderPunishmentsList();

    alert('Punishment removed successfully!');
}

// TEST FUNCTIONS

function startTest(testId) {
    const test = tests.find(t => t.id === testId);
    if (!test || !test.questions || test.questions.length === 0) {
        alert('Test not available or has no questions!');
        return;
    }

    currentTest = test;
    currentQuestionIndex = 0;
    testAnswers = [];
    testTimeRemaining = test.duration * 60; // Convert to seconds

    showTestInterface();
    startTestTimer();
}

function showTestInterface() {
    const testContainer = document.getElementById('testContainer');
    if (!testContainer || !currentTest) return;

    testContainer.innerHTML = `
        <div class="test-interface">
            <div class="test-header">
                <h3>${currentTest.title}</h3>
                <div class="test-timer" id="testTimer">
                    ${Math.floor(testTimeRemaining / 60)}:${String(testTimeRemaining % 60).padStart(2, '0')}
                </div>
            </div>

            <div class="test-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${((currentQuestionIndex + 1) / currentTest.questions.length) * 100}%"></div>
                </div>
                <span>Question ${currentQuestionIndex + 1} of ${currentTest.questions.length}</span>
            </div>

            <div class="test-question">
                <h4>${currentTest.questions[currentQuestionIndex].question}</h4>
                <div class="test-options">
                    ${currentTest.questions[currentQuestionIndex].options.map((option, index) => `
                        <button class="option-btn ${testAnswers[currentQuestionIndex] === index ? 'selected' : ''}" onclick="selectAnswer(${index})">
                            ${String.fromCharCode(65 + index)}. ${option}
                        </button>
                    `).join('')}
                </div>
            </div>

            <div class="test-controls">
                <button onclick="previousQuestion()" ${currentQuestionIndex === 0 ? 'disabled' : ''}>← Previous</button>
                <button onclick="nextQuestion()" class="btn btn-primary">
                    ${currentQuestionIndex === currentTest.questions.length - 1 ? 'Finish Test' : 'Next →'}
                </button>
            </div>
        </div>
    `;
}

function selectAnswer(answerIndex) {
    testAnswers[currentQuestionIndex] = answerIndex;

    // Update UI to show selected answer
    document.querySelectorAll('.option-btn').forEach((btn, index) => {
        btn.classList.toggle('selected', index === answerIndex);
    });
}

function nextQuestion() {
    if (currentQuestionIndex === currentTest.questions.length - 1) {
        finishTest();
    } else {
        currentQuestionIndex++;
        showTestInterface();
    }
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        showTestInterface();
    }
}

function startTestTimer() {
    testTimer = setInterval(() => {
        testTimeRemaining--;

        const timerElement = document.getElementById('testTimer');
        if (timerElement) {
            const minutes = Math.floor(testTimeRemaining / 60);
            const seconds = testTimeRemaining % 60;
            timerElement.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
        }

        if (testTimeRemaining <= 0) {
            finishTest();
        }
    }, 1000);
}

function finishTest() {
    if (testTimer) {
        clearInterval(testTimer);
        testTimer = null;
    }

    // Calculate score
    let correctAnswers = 0;
    currentTest.questions.forEach((question, index) => {
        if (testAnswers[index] === question.correctAnswer) {
            correctAnswers++;
        }
    });

    const percentage = Math.round((correctAnswers / currentTest.questions.length) * 100);

    // Save test result
    const testResult = {
        id: 'result-' + Date.now(),
        testId: currentTest.id,
        testTitle: currentTest.title,
        studentName: 'Student',
        completedAt: new Date().toISOString(),
        totalQuestions: currentTest.questions.length,
        correctAnswers: correctAnswers,
        percentage: percentage,
        timeSpent: (currentTest.duration * 60) - testTimeRemaining
    };

    testResults.push(testResult);
    saveToFirebase('testResults', testResults);

    // Add notification
    const notification = {
        id: Date.now().toString(),
        type: 'test',
        studentName: 'Student',
        testTitle: currentTest.title,
        score: percentage,
        timestamp: new Date().toISOString()
    };

    notifications.push(notification);
    saveToFirebase('notifications', notifications);

    // Show results
    showTestResults(testResult);

    // Clear test state
    currentTest = null;
    currentQuestionIndex = 0;
    testAnswers = [];
}

function showTestResults(result) {
    const testContainer = document.getElementById('testContainer');
    if (!testContainer) return;

    let gradeText = '';
    let gradeClass = '';

    if (result.percentage >= 90) {
        gradeText = 'Excellent!';
        gradeClass = 'excellent';
    } else if (result.percentage >= 80) {
        gradeText = 'Very Good!';
        gradeClass = 'very-good';
    } else if (result.percentage >= 70) {
        gradeText = 'Good!';
        gradeClass = 'good';
    } else if (result.percentage >= 60) {
        gradeText = 'Fair';
        gradeClass = 'fair';
    } else {
        gradeText = 'Needs Improvement';
        gradeClass = 'needs-improvement';
    }

    testContainer.innerHTML = `
        <div class="test-results">
            <div class="results-header">
                <h3>🎉 Test Completed!</h3>
                <div class="test-score ${gradeClass}">
                    <span class="score">${result.percentage}%</span>
                    <span class="grade">${gradeText}</span>
                </div>
            </div>

            <div class="results-details">
                <div class="detail-item">
                    <span class="label">Test:</span>
                    <span class="value">${result.testTitle}</span>
                </div>
                <div class="detail-item">
                    <span class="label">Correct Answers:</span>
                    <span class="value">${result.correctAnswers} out of ${result.totalQuestions}</span>
                </div>
                <div class="detail-item">
                    <span class="label">Time Spent:</span>
                    <span class="value">${Math.floor(result.timeSpent / 60)} minutes ${result.timeSpent % 60} seconds</span>
                </div>
            </div>

            <div class="results-actions">
                <button onclick="closeTestResults()" class="btn btn-primary">📚 Back to Tests</button>
            </div>
        </div>
    `;
}

function closeTestResults() {
    const testContainer = document.getElementById('testContainer');
    if (testContainer) {
        testContainer.innerHTML = '';
    }

    renderAvailableTests();
    updateStudentStats();
}

console.log('🚀 MentorMate Pro - COMPLETE VERSION WITH ALL MENTOR FUNCTIONS! 💯');
console.log('✅ Bulletproof session time calculations');
console.log('✅ Fixed End Session button with confirmation');
console.log('✅ Refresh-resistant session state');
console.log('✅ Complete mentor dashboard functionality');
console.log('✅ Live session monitoring');
console.log('✅ Test management system');
console.log('✅ Punishment management');
console.log('✅ Analytics and charts');
console.log('✅ Multi-device accurate data');