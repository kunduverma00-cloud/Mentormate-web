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

// SESSION TRACKING VARIABLES - FIXED STATE MANAGEMENT
let activeSession = null;
let sessionTimer = null;
let sessionCheckpointTimer = null; // NEW: For 30-second checkpoints
let sessionStartTime = null;
let sessionPauseTime = null;
let totalPausedTime = 0;
let sessionElapsedTime = 0;
let sessionPointsEarned = 0;
let sessionState = 'none'; // 'none', 'active', 'paused'

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
const CHECKPOINT_INTERVAL = 30000; // 30 seconds in milliseconds

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

function getWeekStartDateString() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    return `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;
}

function formatTime(minutes) {
    // FIXED: Add validation to prevent crazy values
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
    // FIXED: Add validation to prevent crazy values
    if (!minutes || minutes < 0 || minutes > MAX_SESSION_TIME * 60) {
        return '00:00';
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${String(Math.min(hours, 99)).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// FIXED: Validate session time to prevent explosions
function validateSessionTime(elapsedMinutes) {
    if (!elapsedMinutes || isNaN(elapsedMinutes) || elapsedMinutes < 0) {
        return 0;
    }
    // Cap at maximum reasonable session time (8 hours)
    return Math.min(elapsedMinutes, MAX_SESSION_TIME);
}

// FIXED: Validate points to prevent explosions
function validatePoints(points) {
    if (!points || isNaN(points) || points < 0) {
        return 0;
    }
    // Cap at maximum reasonable points (8 hours * 12 points = 96)
    return Math.min(points, MAX_SESSION_TIME * POINTS_PER_MINUTE);
}

// NEW: Session checkpoint functions for periodic saving
function startSessionCheckpointTimer() {
    if (sessionCheckpointTimer) {
        clearInterval(sessionCheckpointTimer);
    }
    console.log('🔄 Starting session checkpoint timer');
    sessionCheckpointTimer = setInterval(saveSessionCheckpoint, CHECKPOINT_INTERVAL);
}

function stopSessionCheckpointTimer() {
    if (sessionCheckpointTimer) {
        clearInterval(sessionCheckpointTimer);
        sessionCheckpointTimer = null;
        console.log('⏹️ Stopped session checkpoint timer');
    }
}

function saveSessionCheckpoint() {
    if (!activeSession || sessionState !== 'active' || !sessionValidated) {
        return;
    }

    console.log('💾 Saving session checkpoint');

    // Update the active session with current elapsed time in minutes
    activeSession.elapsedMinutes = sessionElapsedTime;
    activeSession.pointsEarned = sessionPointsEarned;
    activeSession.lastCheckpoint = new Date().toISOString();

    // Save to Firebase
    saveSessionToFirebase();
}

// FIXED: DATABASE RESET UTILITIES
function resetAllData() {
    if (confirm('⚠️ WARNING! This will completely reset all data. Are you sure?')) {
        const confirmReset = prompt('Type "RESET" to confirm complete data reset:');
        if (confirmReset === 'RESET') {
            console.log('🔄 Resetting all data...');

            // Clear all data
            dailyPoints = {};
            sessionTracking = {};
            performanceAnalytics = {};
            testResults = [];
            notifications = [];
            studentPunishments = [];

            // Clear session state
            clearActiveSession();

            // Save to Firebase
            saveToFirebase('dailyPoints', {});
            saveToFirebase('sessionTracking', {});
            saveToFirebase('performanceAnalytics', {});
            saveToFirebase('testResults', []);
            saveToFirebase('notifications', []);
            saveToFirebase('studentPunishments', []);

            alert('✅ All data has been reset successfully!');

            // Reload page to refresh UI
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
    }
}

function resetTodayData() {
    if (confirm('⚠️ This will reset today\'s points and session data. Continue?')) {
        const today = getTodayDateString();

        // Reset today's data
        if (dailyPoints[today]) {
            dailyPoints[today] = 0;
        }
        if (sessionTracking[today]) {
            sessionTracking[today] = {
                sessions: [],
                activeSession: null
            };
        }
        if (performanceAnalytics[today]) {
            performanceAnalytics[today] = {
                totalSessions: 0,
                totalStudyTime: 0,
                totalPointsEarned: 0,
                averageEfficiency: 0,
                sessions: []
            };
        }

        // Clear current session
        clearActiveSession();

        // Save to Firebase
        saveToFirebase('dailyPoints', dailyPoints);
        saveToFirebase('sessionTracking', sessionTracking);
        saveToFirebase('performanceAnalytics', performanceAnalytics);

        alert('✅ Today\'s data has been reset!');

        // Update UI
        updateStudentStats();
        updateSessionDisplay();
    }
}

function clearActiveSession() {
    if (sessionTimer) {
        clearInterval(sessionTimer);
        sessionTimer = null;
    }

    // NEW: Stop checkpoint timer
    stopSessionCheckpointTimer();

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

// Initialize App
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

    // FIXED: Check for active/paused sessions on page load with validation
    setTimeout(() => {
        checkSessionStateWithValidation();
    }, 2000);
});

// FIXED: Session State Management with Validation - UPDATED FOR CHECKPOINT RESTORE
function checkSessionStateWithValidation() {
    const today = getTodayDateString();

    // Check for active session in Firebase
    if (sessionTracking[today] && sessionTracking[today].activeSession) {
        const savedSession = sessionTracking[today].activeSession;
        console.log('🔍 Found saved session:', savedSession);

        // FIXED: Validate saved session data
        if (validateSavedSession(savedSession)) {
            // Restore session state
            activeSession = savedSession;

            // FORCE AUTO-PAUSE: Any restored session is automatically paused
            sessionState = 'paused';
            activeSession.status = 'paused';

            // RESTORE FROM SAVED STATE: Use elapsedMinutes if available, don't recalculate
            if (savedSession.elapsedMinutes !== undefined && savedSession.elapsedMinutes !== null) {
                // Use saved elapsed time directly - NO recalculation from startTime
                sessionElapsedTime = validateSessionTime(savedSession.elapsedMinutes);
                console.log('⏱️ Restored elapsed time from checkpoint:', sessionElapsedTime, 'minutes');
            } else {
                // Fallback: calculate safely but this shouldn't be the normal path
                if (savedSession.startTime) {
                    const startTime = new Date(savedSession.startTime).getTime();
                    const currentTime = Date.now();
                    const rawElapsed = Math.floor((currentTime - startTime - (savedSession.totalPausedTime || 0)) / 60000);
                    sessionElapsedTime = validateSessionTime(rawElapsed);
                    console.log('⚠️ Fallback: calculated elapsed time:', sessionElapsedTime, 'minutes');
                }
            }

            // Update points based on elapsed time
            sessionPointsEarned = validatePoints(sessionElapsedTime * POINTS_PER_MINUTE);

            // Restore other session properties
            if (savedSession.totalPausedTime) {
                totalPausedTime = savedSession.totalPausedTime;
            }
            if (savedSession.startTime) {
                sessionStartTime = new Date(savedSession.startTime).getTime();
            }

            // Show paused session UI - user must manually resume
            showPausedSessionResume();
            hideActiveSessionMonitor();
            console.log('⏸️ Restored session in PAUSED state - user must resume manually');

            sessionValidated = true;
        } else {
            console.log('⚠️ Invalid saved session data - clearing');
            clearActiveSession();

            // Clear invalid data from Firebase
            sessionTracking[today].activeSession = null;
            saveToFirebase('sessionTracking', sessionTracking);
        }
    }

    // Update UI
    if (currentUser && currentUser.role === 'student') {
        updateSessionDisplay();
        renderStudentRoutines();
    }
}

// FIXED: Validate saved session data
function validateSavedSession(session) {
    if (!session || typeof session !== 'object') {
        return false;
    }

    // Check required fields
    if (!session.routineId || !session.startTime || !session.targetDuration) {
        return false;
    }

    // Validate start time
    const startTime = new Date(session.startTime);
    if (isNaN(startTime.getTime())) {
        return false;
    }

    // Check if session is from today
    const sessionDate = startTime.toISOString().split('T')[0];
    const today = getTodayDateString();
    if (sessionDate !== today) {
        return false;
    }

    // Check if session is not too old (max 24 hours)
    const sessionAge = (Date.now() - startTime.getTime()) / (1000 * 60 * 60);
    if (sessionAge > 24) {
        return false;
    }

    // Validate target duration
    if (session.targetDuration > MAX_SESSION_TIME) {
        return false;
    }

    return true;
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

    // Session Tracking listener - FIXED with validation
    database.ref('sessionTracking').on('value', (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            sessionTracking = data || {};
            console.log('🔄 Session tracking updated');

            // FIXED: Validate session tracking data
            validateSessionTrackingData();

            // FIXED: Only update UI if user is logged in
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

    // Daily Points listener - FIXED with validation
    database.ref('dailyPoints').on('value', (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            // FIXED: Validate daily points data
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

    // Other listeners (tests, notifications, etc.)
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

// FIXED: Validate session tracking data to prevent explosions
function validateSessionTrackingData() {
    for (const date in sessionTracking) {
        const dayData = sessionTracking[date];

        if (dayData.sessions) {
            dayData.sessions = dayData.sessions.map(session => {
                return {
                    ...session,
                    actualDuration: validateSessionTime(session.actualDuration || 0),
                    pointsEarned: validatePoints(session.pointsEarned || 0),
                    efficiency: Math.min(Math.max(session.efficiency || 0, 0), 200) // Cap efficiency
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

// FIXED: Validate daily points data
function validateDailyPointsData(data) {
    const validatedData = {};
    for (const date in data) {
        const points = data[date];
        // Validate points value
        if (typeof points === 'number' && points >= 0 && points <= MAX_SESSION_TIME * 12) {
            validatedData[date] = Math.floor(points); // Round to integer
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

    console.log('✅ Default data initialized');
}

// SCREEN MANAGEMENT - FIXED
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

    // FIXED: Clear any existing session state when switching roles
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
    // FIXED: Properly cleanup session state
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

// FIXED SESSION TRACKING SYSTEM
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
    } else if (currentTime < routineStartTime + 60) { // Extended window for flexibility
        return 'live';
    } else {
        return 'missed';
    }
}

// FIXED SESSION FUNCTIONS - WITH CHECKPOINT FUNCTIONALITY
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
        alert('Please end your current session before starting a new one!');
        return;
    }

    // FIXED: Clear any existing paused session
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
        targetDuration: Math.min(routine.duration, MAX_SESSION_TIME), // Cap target duration
        pointsPerMinute: POINTS_PER_MINUTE,
        startTime: new Date().toISOString(),
        status: 'active',
        totalPausedTime: 0,
        elapsedMinutes: 0 // NEW: Initialize elapsed time for checkpoints
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

    // Start session timer - FIXED with validation
    if (sessionTimer) {
        clearInterval(sessionTimer);
    }
    sessionTimer = setInterval(updateSessionTimerSafely, 1000);

    // NEW: Start checkpoint timer for periodic saving
    startSessionCheckpointTimer();

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

    // Pause the session
    sessionPauseTime = Date.now();
    sessionState = 'paused';
    activeSession.status = 'paused';

    // Stop timers
    if (sessionTimer) {
        clearInterval(sessionTimer);
        sessionTimer = null;
    }

    // NEW: Stop checkpoint timer when paused
    stopSessionCheckpointTimer();

    // Save current state with final checkpoint
    saveSessionCheckpoint();

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

    // NEW: Restart checkpoint timer when resumed
    startSessionCheckpointTimer();

    // Save state
    saveSessionToFirebase();

    // Update display
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

    // Stop timers
    if (sessionTimer) {
        clearInterval(sessionTimer);
        sessionTimer = null;
    }

    // NEW: Stop checkpoint timer
    stopSessionCheckpointTimer();

    // Calculate final session time and points with validation
    const endTime = Date.now();
    const rawTotalTime = Math.floor((endTime - sessionStartTime - totalPausedTime) / 60000);
    const totalSessionTime = validateSessionTime(rawTotalTime); // FIXED: Validate time
    const targetDuration = activeSession.targetDuration;

    // Calculate points based on actual study time with validation
    const pointsEarned = validatePoints(totalSessionTime * POINTS_PER_MINUTE); // FIXED: Validate points

    // Update routine
    const routine = routines.find(r => r.id === activeSession.routineId);
    if (routine) {
        routine.status = 'completed';
        routine.completedAt = new Date().toISOString();
        routine.actualDuration = totalSessionTime;
        routine.pointsEarned = pointsEarned;
        routine.completedDate = getTodayDateString();
        routine.efficiency = Math.min(Math.round((totalSessionTime / targetDuration) * 100), 200); // Cap efficiency
    }

    // Update daily points with validation
    const today = getTodayDateString();
    if (!dailyPoints[today]) {
        dailyPoints[today] = 0;
    }
    dailyPoints[today] = validatePoints(dailyPoints[today] + pointsEarned); // FIXED: Validate points

    // Save session data for analytics
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

    // FIXED: Clear session state completely
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

// FIXED: Safe session timer update with validation
function updateSessionTimerSafely() {
    if (!activeSession || sessionState !== 'active' || !sessionValidated) return;

    const now = Date.now();

    // FIXED: Validate time progression
    if (lastUpdateTime && (now - lastUpdateTime) > 5000) { // If more than 5 seconds since last update, something is wrong
        console.log('⚠️ Timer anomaly detected - resetting');
        lastUpdateTime = now;
        return;
    }

    lastUpdateTime = now;
    const elapsed = now - sessionStartTime - totalPausedTime;
    const elapsedMinutes = Math.floor(elapsed / 60000);

    // FIXED: Validate elapsed time to prevent explosions
    sessionElapsedTime = validateSessionTime(elapsedMinutes);
    sessionPointsEarned = validatePoints(sessionElapsedTime * POINTS_PER_MINUTE);

    // Update display
    updateActiveSessionDisplay();
}

// Legacy function for compatibility
function updateSessionTimer() {
    updateSessionTimerSafely();
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
        const circumference = 2 * Math.PI * 54; // radius = 54
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

// FIXED: Session Display Updates with Validation
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

    // FIXED: Validate total time to prevent display explosions
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

    // Calculate average efficiency
    const totalEfficiency = todayAnalytics.sessions.reduce((sum, session) => sum + Math.min(session.efficiency || 0, 200), 0);
    todayAnalytics.averageEfficiency = Math.round(totalEfficiency / todayAnalytics.totalSessions);
}

// Student Data Loading and Rendering
function loadStudentData() {
    console.log('👨🎓 Loading student data...');

    renderStudentRoutines();
    updateStudentStats();
    renderAvailableTests();
    renderStudentActivity();
    updateSessionDisplay();

    // FIXED: Check for saved session state after a delay
    setTimeout(() => {
        checkSessionStateWithValidation();
    }, 1000);
}

function renderStudentRoutines() {
    const container = document.getElementById('studentRoutines');
    if (!container) return;

    if (!routines || routines.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No Routines Found</h3>
                <p>Your mentor hasn't assigned any routines yet.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = routines.map(routine => {
        const status = getSessionStatus(routine);
        const isActive = activeSession && activeSession.routineId === routine.id;
        const canStart = status === 'live' && !activeSession && routine.status === 'pending';

        let statusClass = 'routine-pending';
        let statusText = 'Pending';
        let actionButton = '';

        if (routine.status === 'completed') {
            statusClass = 'routine-completed';
            statusText = 'Completed';
        } else if (routine.status === 'in-progress' || isActive) {
            statusClass = 'routine-active';
            statusText = 'In Progress';
        } else if (status === 'missed') {
            statusClass = 'routine-missed';
            statusText = 'Missed';
        } else if (canStart) {
            actionButton = `<button class="btn-primary" onclick="startSession('${routine.id}')">Start Session</button>`;
        }

        return `
            <div class="routine-card ${statusClass}">
                <div class="routine-header">
                    <h3>${routine.name}</h3>
                    <span class="routine-status">${statusText}</span>
                </div>
                <div class="routine-details">
                    <div class="routine-info">
                        <span class="routine-time">⏰ ${routine.time}</span>
                        <span class="routine-duration">⏱️ ${routine.duration} min</span>
                        <span class="routine-points">🏆 ${routine.points} pts</span>
                    </div>
                    ${routine.actualDuration ? `<p class="completion-details">Completed in ${formatTime(routine.actualDuration)} (${routine.efficiency}% efficiency)</p>` : ''}
                </div>
                <div class="routine-actions">
                    ${actionButton}
                </div>
            </div>
        `;
    }).join('');
}

function updateStudentStats() {
    const today = getTodayDateString();
    const todayPoints = dailyPoints[today] || 0;

    // Update today's points
    const pointsElement = document.getElementById('todayPoints');
    if (pointsElement) {
        pointsElement.textContent = Math.floor(todayPoints);
    }

    // Update week total
    const weekStart = getWeekStartDateString();
    let weekTotal = 0;
    for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        weekTotal += dailyPoints[dateStr] || 0;
    }

    const weekPointsElement = document.getElementById('weekPoints');
    if (weekPointsElement) {
        weekPointsElement.textContent = Math.floor(weekTotal);
    }

    // Update completion rate
    const completedToday = routines.filter(r => r.status === 'completed').length;
    const totalRoutines = routines.length;
    const completionRate = totalRoutines > 0 ? Math.round((completedToday / totalRoutines) * 100) : 0;

    const completionElement = document.getElementById('completionRate');
    if (completionElement) {
        completionElement.textContent = `${completionRate}%`;
    }

    // Update session time
    updateSessionDisplay();
}

function renderAvailableTests() {
    const container = document.getElementById('availableTests');
    if (!container) return;

    if (!tests || tests.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No Tests Available</h3>
                <p>Your mentor hasn't assigned any tests yet.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = tests.map(test => {
        return `
            <div class="test-card">
                <div class="test-header">
                    <h3>${test.title}</h3>
                    <span class="test-category">${test.category}</span>
                </div>
                <div class="test-details">
                    <p>Duration: ${test.duration} minutes</p>
                    <p>Questions: ${test.questions?.length || 0}</p>
                </div>
                <div class="test-actions">
                    <button class="btn-primary" onclick="startTest('${test.id}')">Start Test</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderStudentActivity() {
    const container = document.getElementById('studentActivity');
    if (!container) return;

    if (!notifications || notifications.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No recent activity</p>
            </div>
        `;
        return;
    }

    const recentNotifications = notifications
        .filter(n => n.type === 'session')
        .slice(-5)
        .reverse();

    container.innerHTML = recentNotifications.map(notification => {
        return `
            <div class="activity-item">
                <div class="activity-icon">📚</div>
                <div class="activity-details">
                    <h4>${notification.routineName}</h4>
                    <p>Study Time: ${formatTime(notification.actualDuration)} | Points: ${notification.pointsEarned}</p>
                    <span class="activity-time">${new Date(notification.timestamp).toLocaleString()}</span>
                </div>
            </div>
        `;
    }).join('');
}

function renderStudentAnalytics() {
    const today = getTodayDateString();
    const todayAnalytics = performanceAnalytics[today];

    if (!todayAnalytics) {
        const container = document.getElementById('studentAnalytics');
        if (container) {
            container.innerHTML = '<p>No analytics data available for today.</p>';
        }
        return;
    }

    const container = document.getElementById('studentAnalytics');
    if (container) {
        container.innerHTML = `
            <div class="analytics-grid">
                <div class="analytics-card">
                    <h4>Sessions Today</h4>
                    <span class="analytics-value">${todayAnalytics.totalSessions}</span>
                </div>
                <div class="analytics-card">
                    <h4>Study Time</h4>
                    <span class="analytics-value">${formatTime(todayAnalytics.totalStudyTime)}</span>
                </div>
                <div class="analytics-card">
                    <h4>Average Efficiency</h4>
                    <span class="analytics-value">${todayAnalytics.averageEfficiency}%</span>
                </div>
                <div class="analytics-card">
                    <h4>Points Earned</h4>
                    <span class="analytics-value">${todayAnalytics.totalPointsEarned}</span>
                </div>
            </div>
        `;
    }
}

// Mentor Functions (simplified versions)
function loadMentorData() {
    console.log('👩‍🏫 Loading mentor data...');
    renderRoutineManager();
    renderLiveSessionsMonitor();
    updateMentorAnalytics();
    renderActivityFeed();
    renderTestReports();
    renderPunishmentsList();
}

function renderRoutineManager() {
    const container = document.getElementById('routineManager');
    if (!container) return;

    container.innerHTML = `
        <div class="routine-manager">
            <h3>Routine Management</h3>
            <div class="routines-list">
                ${routines.map(routine => `
                    <div class="routine-item">
                        <span>${routine.name}</span>
                        <span>${routine.time}</span>
                        <span>${routine.duration}min</span>
                        <span class="status-${routine.status}">${routine.status}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderLiveSessionsMonitor() {
    const container = document.getElementById('liveSessionsMonitor');
    if (!container) return;

    const today = getTodayDateString();
    const todayTracking = sessionTracking[today];

    let content = '<h3>Live Sessions Monitor</h3>';

    if (todayTracking && todayTracking.activeSession) {
        const session = todayTracking.activeSession;
        content += `
            <div class="live-session">
                <h4>Active Session</h4>
                <p><strong>Student:</strong> Student</p>
                <p><strong>Routine:</strong> ${session.routineName}</p>
                <p><strong>Status:</strong> ${session.status}</p>
                <p><strong>Started:</strong> ${new Date(session.startTime).toLocaleString()}</p>
            </div>
        `;
    } else {
        content += '<p>No active sessions</p>';
    }

    container.innerHTML = content;
}

function updateMentorAnalytics() {
    const today = getTodayDateString();
    const todayPoints = dailyPoints[today] || 0;
    const todayAnalytics = performanceAnalytics[today];

    // Update today's statistics
    const pointsElement = document.getElementById('mentorTodayPoints');
    if (pointsElement) {
        pointsElement.textContent = Math.floor(todayPoints);
    }

    if (todayAnalytics) {
        const sessionsElement = document.getElementById('mentorTodaySessions');
        if (sessionsElement) {
            sessionsElement.textContent = todayAnalytics.totalSessions;
        }

        const timeElement = document.getElementById('mentorTodayTime');
        if (timeElement) {
            timeElement.textContent = formatTime(todayAnalytics.totalStudyTime);
        }

        const efficiencyElement = document.getElementById('mentorTodayEfficiency');
        if (efficiencyElement) {
            efficiencyElement.textContent = `${todayAnalytics.averageEfficiency}%`;
        }
    }
}

function renderActivityFeed() {
    const container = document.getElementById('activityFeed');
    if (!container) return;

    if (!notifications || notifications.length === 0) {
        container.innerHTML = '<p>No recent activity</p>';
        return;
    }

    const recentNotifications = notifications.slice(-10).reverse();

    container.innerHTML = recentNotifications.map(notification => {
        return `
            <div class="activity-item">
                <div class="activity-icon">📚</div>
                <div class="activity-details">
                    <h4>${notification.routineName}</h4>
                    <p>Study Time: ${formatTime(notification.actualDuration)} | Efficiency: ${notification.efficiency}%</p>
                    <span class="activity-time">${new Date(notification.timestamp).toLocaleString()}</span>
                </div>
            </div>
        `;
    }).join('');
}

function renderTestReports() {
    const container = document.getElementById('testReports');
    if (!container) return;

    if (!testResults || testResults.length === 0) {
        container.innerHTML = '<p>No test results available</p>';
        return;
    }

    container.innerHTML = testResults.map(result => {
        return `
            <div class="test-result">
                <h4>${result.testTitle}</h4>
                <p><strong>Student:</strong> ${result.studentName}</p>
                <p><strong>Score:</strong> ${result.percentage}% (${result.correctAnswers}/${result.totalQuestions})</p>
                <p><strong>Completed:</strong> ${new Date(result.completedAt).toLocaleString()}</p>
            </div>
        `;
    }).join('');
}

function renderPunishmentsList() {
    const container = document.getElementById('punishmentsList');
    if (!container) return;

    if (!studentPunishments || studentPunishments.length === 0) {
        container.innerHTML = '<p>No punishments assigned</p>';
        return;
    }

    container.innerHTML = studentPunishments.map(punishment => {
        return `
            <div class="punishment-item">
                <h4>${punishment.reason}</h4>
                <p><strong>Type:</strong> ${punishment.type}</p>
                <p><strong>Duration:</strong> ${punishment.duration} minutes</p>
                <p><strong>Assigned:</strong> ${new Date(punishment.assignedAt).toLocaleString()}</p>
                <span class="status-${punishment.status}">${punishment.status}</span>
            </div>
        `;
    }).join('');
}

function renderMentorCharts() {
    // Simplified chart rendering - in a real app you'd use a charting library
    console.log('📊 Rendering mentor charts...');
}

// Test Functions (simplified)
function startTest(testId) {
    alert('Test functionality not fully implemented in this demo');
}

function startTestTimer() {
    // Test timer functionality
}

function updateTestTimer() {
    // Test timer update functionality
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validateSessionTime,
        validatePoints,
        saveSessionCheckpoint,
        checkSessionStateWithValidation
    };
}