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
let sessionStartTime = null;
let sessionPauseTime = null;
let totalPausedTime = 0;
let sessionElapsedTime = 0;
let sessionPointsEarned = 0;
let sessionState = 'none'; // 'none', 'active', 'paused'

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
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
        return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
}

function formatTimeHHMM(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing MentorMate Pro...');
    initializeFirebase();
    startTimeUpdates();
    checkAndResetDailyRoutines();

    // FIXED: Check for active/paused sessions on page load
    setTimeout(() => {
        checkSessionState();
    }, 2000);
});

// FIXED: Session State Management
function checkSessionState() {
    const today = getTodayDateString();

    // Check for active session in Firebase
    if (sessionTracking[today] && sessionTracking[today].activeSession) {
        const savedSession = sessionTracking[today].activeSession;

        console.log('🔍 Found saved session:', savedSession);

        // Restore session state
        activeSession = savedSession;
        sessionState = savedSession.status || 'paused';

        if (sessionState === 'active') {
            // Session was active - treat as paused for safety
            sessionState = 'paused';
            activeSession.status = 'paused';
        }

        // Show appropriate UI
        if (sessionState === 'paused') {
            showPausedSessionResume();
            hideActiveSessionMonitor();
            console.log('⏸️ Restored paused session');
        }
    }

    // Update UI
    if (currentUser && currentUser.role === 'student') {
        updateSessionDisplay();
        renderStudentRoutines();
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

    // Session Tracking listener - FIXED
    database.ref('sessionTracking').on('value', (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            sessionTracking = data || {};
            console.log('🔄 Session tracking updated');

            // FIXED: Only update UI if user is logged in
            if (currentUser) {
                if (currentUser.role === 'student') {
                    updateSessionDisplay();
                    // Don't automatically restore session here to avoid conflicts
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
    // FIXED: Separate session timer management
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
    if (sessionTimer) {
        clearInterval(sessionTimer);
        sessionTimer = null;
    }
    activeSession = null;
    sessionState = 'none';

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
    if (sessionTimer) {
        clearInterval(sessionTimer);
        sessionTimer = null;
    }

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

// FIXED SESSION FUNCTIONS

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

        // Clean up previous session
        clearPreviousSession();
    }

    // Initialize session
    activeSession = {
        routineId: routineId,
        routineName: routine.name,
        targetDuration: routine.duration,
        pointsPerMinute: POINTS_PER_MINUTE,
        startTime: new Date().toISOString(),
        status: 'active',
        totalPausedTime: 0
    };

    sessionStartTime = Date.now();
    sessionPauseTime = null;
    totalPausedTime = 0;
    sessionElapsedTime = 0;
    sessionPointsEarned = 0;
    sessionState = 'active';

    // Update routine status
    routine.status = 'in-progress';
    routine.sessionStarted = new Date().toISOString();

    // Save to Firebase
    saveToFirebase('routines', routines);
    saveSessionToFirebase();

    // Start session timer - FIXED
    if (sessionTimer) {
        clearInterval(sessionTimer);
    }
    sessionTimer = setInterval(updateSessionTimer, 1000);

    // Show session monitor
    showActiveSessionMonitor();
    hidePausedSessionResume();

    console.log('✅ Session started successfully');
}

function clearPreviousSession() {
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

    hideActiveSessionMonitor();
    hidePausedSessionResume();

    // Clear from Firebase
    const today = getTodayDateString();
    if (sessionTracking[today]) {
        sessionTracking[today].activeSession = null;
        saveToFirebase('sessionTracking', sessionTracking);
    }
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

    // Stop timer
    if (sessionTimer) {
        clearInterval(sessionTimer);
        sessionTimer = null;
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

    // Restart timer
    if (sessionTimer) {
        clearInterval(sessionTimer);
    }
    sessionTimer = setInterval(updateSessionTimer, 1000);

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

    // Stop timer
    if (sessionTimer) {
        clearInterval(sessionTimer);
        sessionTimer = null;
    }

    // Calculate final session time and points
    const endTime = Date.now();
    const totalSessionTime = Math.floor((endTime - sessionStartTime - totalPausedTime) / 60000); // in minutes
    const targetDuration = activeSession.targetDuration;

    // Calculate points based on actual study time (not target)
    const pointsEarned = Math.floor(totalSessionTime * POINTS_PER_MINUTE);

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
    clearPreviousSession();

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

function updateSessionTimer() {
    if (!activeSession || sessionState !== 'active') return;

    const now = Date.now();
    const elapsed = now - sessionStartTime - totalPausedTime;
    sessionElapsedTime = Math.floor(elapsed / 60000); // in minutes

    // Calculate current points (real-time)
    sessionPointsEarned = Math.floor(sessionElapsedTime * POINTS_PER_MINUTE);

    // Update display
    updateActiveSessionDisplay();
}

function updateActiveSessionDisplay() {
    if (!activeSession) return;

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

    // FIXED: Update pause button text
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
        pauseBtn.innerHTML = '⏸️ Check Out';
        pauseBtn.onclick = pauseSession;
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

// FIXED: Session Display Updates
function updateSessionDisplay() {
    // Update total session time for today
    const today = getTodayDateString();
    const todaySessions = sessionTracking[today];
    let totalTime = 0;

    if (todaySessions && todaySessions.sessions) {
        totalTime = todaySessions.sessions.reduce((sum, session) => sum + (session.actualDuration || 0), 0);
    }

    // Add current active session time
    if (activeSession && sessionState === 'active') {
        totalTime += sessionElapsedTime;
    }

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
    todayAnalytics.totalStudyTime += sessionData.actualDuration;
    todayAnalytics.totalPointsEarned += sessionData.pointsEarned;
    todayAnalytics.sessions.push(sessionData);

    // Calculate average efficiency
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

    // FIXED: Check for saved session state after a delay
    setTimeout(() => {
        checkSessionState();
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
                    buttonDisabled = (activeSession !== null && sessionState === 'active'); // Disable if another session is active
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

// Continue with remaining functions...
// [The rest of the functions remain the same as in the previous version]
// This includes all the mentor functions, test functions, modal management, etc.

// MENTOR FUNCTIONS
function loadMentorData() {
    console.log('👨‍🏫 Loading mentor data...');
    updateMentorAnalytics();
    renderMentorCharts();
    renderLiveSessionsMonitor();
    renderRoutineManager();
    renderTestReports();
    renderPunishmentsList();
}

function updateStudentStats() {
    const today = getTodayDateString();
    const todayPoints = dailyPoints[today] || 0;
    const todaySessions = sessionTracking[today];

    // Calculate today's stats
    let completedToday = 0;
    let totalStudyTime = 0;

    if (todaySessions && todaySessions.sessions) {
        completedToday = todaySessions.sessions.length;
        totalStudyTime = todaySessions.sessions.reduce((sum, session) => sum + (session.actualDuration || 0), 0);
    }

    // Add active session time
    if (activeSession && sessionState === 'active') {
        totalStudyTime += sessionElapsedTime;
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

    // Update weekly stats for student analytics
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

    // Calculate weekly totals
    for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - date.getDay() + i);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        // Points
        if (dailyPoints[dateStr]) {
            weeklyPoints += dailyPoints[dateStr];
        }

        // Sessions and time
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

    // Update display
    const weeklyPointsElement = document.getElementById('weeklyPoints');
    const weeklyHoursElement = document.getElementById('weeklyHours');
    const weeklySessionsElement = document.getElementById('weeklySessions');
    const weeklyAverageElement = document.getElementById('weeklyAverage');

    if (weeklyPointsElement) weeklyPointsElement.textContent = weeklyPoints;
    if (weeklyHoursElement) weeklyHoursElement.textContent = Math.floor(weeklyHours / 60) + 'h';
    if (weeklySessionsElement) weeklySessionsElement.textContent = weeklySessions;
    if (weeklyAverageElement) weeklyAverageElement.textContent = weeklyAverage + '%';
}

function renderStudentAnalytics() {
    // Render daily chart
    renderDailyChart();
}

function renderDailyChart() {
    const container = document.getElementById('dailyChart');
    if (!container) return;

    // Get last 7 days data
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const points = dailyPoints[dateStr] || 0;
        const studyTime = sessionTracking[dateStr] ? 
            sessionTracking[dateStr].sessions?.reduce((sum, s) => sum + (s.actualDuration || 0), 0) || 0 : 0;

        days.push({ day: dayName, points, studyTime: Math.floor(studyTime / 60) });
    }

    const maxPoints = Math.max(...days.map(d => d.points), 10);
    const maxHours = Math.max(...days.map(d => d.studyTime), 2);

    container.innerHTML = `
        <div class="chart-header">
            <div class="chart-legend">
                <div class="legend-item">
                    <span class="legend-color points"></span>
                    <span>Points</span>
                </div>
                <div class="legend-item">
                    <span class="legend-color hours"></span>
                    <span>Study Hours</span>
                </div>
            </div>
        </div>
        <div class="chart-bars">
            ${days.map(day => `
                <div class="chart-day">
                    <div class="chart-bar-container">
                        <div class="chart-bar points" style="height: ${(day.points / maxPoints) * 100}%">
                            <span class="bar-value">${day.points}</span>
                        </div>
                        <div class="chart-bar hours" style="height: ${(day.studyTime / maxHours) * 100}%">
                            <span class="bar-value">${day.studyTime}h</span>
                        </div>
                    </div>
                    <div class="chart-day-label">${day.day}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderAvailableTests() {
    const container = document.getElementById('availableTests');
    if (!container) return;

    const availableTests = tests.filter(test => test.status === 'available');

    if (availableTests.length === 0) {
        container.innerHTML = '<div class="text-center">No tests available at the moment.</div>';
        return;
    }

    container.innerHTML = availableTests.map(test => `
        <div class="test-card">
            <div class="test-header">
                <div class="test-info">
                    <h4>${test.title || 'Untitled Test'}</h4>
                    <div class="test-meta">
                        <div>📝 ${(test.questions && test.questions.length) || 0} Questions</div>
                        <div>⏱️ ${test.duration || 0} Minutes</div>
                        <div>📚 ${test.category || 'General'}</div>
                    </div>
                </div>
            </div>
            <div class="test-actions">
                <button onclick="startTest('${test.id}')" class="btn btn-primary btn-small">
                    📋 Take Test
                </button>
            </div>
        </div>
    `).join('');
}

function renderStudentActivity() {
    const container = document.getElementById('studentActivity');
    if (!container) return;

    const studentNotifications = notifications.filter(n => n.studentName === 'Student');

    if (studentNotifications.length === 0) {
        container.innerHTML = '<div class="text-center">No recent activity.</div>';
        return;
    }

    const sortedNotifications = studentNotifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    container.innerHTML = sortedNotifications.slice(0, 10).map(notification => `
        <div class="activity-item">
            <div class="activity-icon ${notification.type}">
                ${notification.type === 'session' ? '📚' : notification.type === 'checkin' ? '✅' : '📝'}
            </div>
            <div class="activity-content">
                <div class="activity-title">
                    ${notification.type === 'session' 
                        ? `Completed ${notification.routineName}` 
                        : notification.type === 'checkin'
                        ? `Checked in to ${notification.routineName}`
                        : `Completed ${notification.testTitle}`
                    }
                </div>
                <div class="activity-details">
                    ${new Date(notification.timestamp).toLocaleString()}
                    ${notification.type === 'session' ? `
                        <br>
                        ⏱️ Study time: ${formatTime(notification.actualDuration || 0)} | 🎯 ${notification.pointsEarned || 0} points
                        <br>📊 Efficiency: ${notification.efficiency || 0}%
                    ` : ''}
                    ${notification.type === 'checkin' ? `
                        <br>
                        ${notification.minutesLate > 0 
                            ? `⏰ ${notification.minutesLate} min late | 🎯 ${notification.pointsEarned}/${notification.originalPoints} points` 
                            : `✅ On time | 🎯 ${notification.pointsEarned} points earned`
                        }
                        ${notification.punishmentReceived ? `<br>⚖️ Punishment: ${notification.punishmentReceived}` : ''}
                    ` : ''}
                    ${notification.type === 'test' ? `
                        <br>📊 Score: ${notification.score || 0}%
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function updateMentorAnalytics() {
    const today = getTodayDateString();

    // Today's performance
    const todayPoints = dailyPoints[today] || 0;
    const todaySessions = sessionTracking[today];
    let todaySessionTime = 0;
    let todaySessionsCount = 0;

    if (todaySessions && todaySessions.sessions) {
        todaySessionsCount = todaySessions.sessions.length;
        todaySessionTime = todaySessions.sessions.reduce((sum, session) => sum + (session.actualDuration || 0), 0);
    }

    // Weekly performance
    let weeklyPoints = 0;
    let weeklyStudyTime = 0;

    for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - date.getDay() + i);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        if (dailyPoints[dateStr]) {
            weeklyPoints += dailyPoints[dateStr];
        }

        if (sessionTracking[dateStr] && sessionTracking[dateStr].sessions) {
            weeklyStudyTime += sessionTracking[dateStr].sessions.reduce((sum, session) => sum + (session.actualDuration || 0), 0);
        }
    }

    const weeklyAvgDaily = Math.round(weeklyPoints / 7);

    // Update display
    const todayPointsElement = document.getElementById('todayPointsEarned');
    const todaySessionTimeElement = document.getElementById('todaySessionTime');
    const todaySessionsCountElement = document.getElementById('todaySessionsCount');
    const weeklyPointsTotalElement = document.getElementById('weeklyPointsTotal');
    const weeklyStudyTimeElement = document.getElementById('weeklyStudyTime');
    const weeklyAvgDailyElement = document.getElementById('weeklyAvgDaily');

    if (todayPointsElement) todayPointsElement.textContent = todayPoints;
    if (todaySessionTimeElement) todaySessionTimeElement.textContent = formatTime(todaySessionTime);
    if (todaySessionsCountElement) todaySessionsCountElement.textContent = todaySessionsCount;
    if (weeklyPointsTotalElement) weeklyPointsTotalElement.textContent = weeklyPoints;
    if (weeklyStudyTimeElement) weeklyStudyTimeElement.textContent = Math.floor(weeklyStudyTime / 60) + 'h';
    if (weeklyAvgDailyElement) weeklyAvgDailyElement.textContent = weeklyAvgDaily;

    // Performance trend (simple calculation)
    const lastWeekPoints = getLastWeekPoints();
    const trend = lastWeekPoints > 0 ? Math.round(((weeklyPoints - lastWeekPoints) / lastWeekPoints) * 100) : 0;

    const trendElement = document.getElementById('performanceTrend');
    const trendIndicatorElement = document.getElementById('trendIndicator');

    if (trendElement) {
        trendElement.textContent = (trend >= 0 ? '+' : '') + trend + '%';
    }

    if (trendIndicatorElement) {
        if (trend > 0) {
            trendIndicatorElement.innerHTML = '<span class="trend-arrow">📈</span><span class="trend-text">Improving</span>';
        } else if (trend < 0) {
            trendIndicatorElement.innerHTML = '<span class="trend-arrow">📉</span><span class="trend-text">Declining</span>';
        } else {
            trendIndicatorElement.innerHTML = '<span class="trend-arrow">➡️</span><span class="trend-text">Stable</span>';
        }
    }

    // Update performance table
    renderPerformanceTable();
}

function getLastWeekPoints() {
    let lastWeekPoints = 0;
    for (let i = 7; i < 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (dailyPoints[dateStr]) {
            lastWeekPoints += dailyPoints[dateStr];
        }
    }
    return lastWeekPoints;
}

function renderMentorCharts() {
    renderDailyPointsChart();
    renderStudyTimeChart();
}

function renderDailyPointsChart() {
    const container = document.getElementById('dailyPointsChart');
    if (!container) return;

    // Get last 7 days data
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const points = dailyPoints[dateStr] || 0;

        days.push({ day: dayName, points });
    }

    const maxPoints = Math.max(...days.map(d => d.points), 10);

    container.innerHTML = `
        <div class="chart-bars">
            ${days.map(day => `
                <div class="chart-day">
                    <div class="chart-bar-container">
                        <div class="chart-bar points" style="height: ${(day.points / maxPoints) * 100}%">
                            <span class="bar-value">${day.points}</span>
                        </div>
                    </div>
                    <div class="chart-day-label">${day.day}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderStudyTimeChart() {
    const container = document.getElementById('studyTimeChart');
    if (!container) return;

    // Get last 7 days data
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const studyTime = sessionTracking[dateStr] ? 
            sessionTracking[dateStr].sessions?.reduce((sum, s) => sum + (s.actualDuration || 0), 0) || 0 : 0;

        days.push({ day: dayName, studyTime: Math.round(studyTime / 60 * 10) / 10 }); // Convert to hours with 1 decimal
    }

    const maxHours = Math.max(...days.map(d => d.studyTime), 2);

    container.innerHTML = `
        <div class="chart-bars">
            ${days.map(day => `
                <div class="chart-day">
                    <div class="chart-bar-container">
                        <div class="chart-bar hours" style="height: ${(day.studyTime / maxHours) * 100}%">
                            <span class="bar-value">${day.studyTime}h</span>
                        </div>
                    </div>
                    <div class="chart-day-label">${day.day}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderPerformanceTable() {
    const container = document.getElementById('performanceTableBody');
    if (!container) return;

    // Get last 7 days data
    const rows = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

        const points = dailyPoints[dateStr] || 0;
        const sessions = sessionTracking[dateStr]?.sessions || [];
        const sessionsCount = sessions.length;
        const studyTime = sessions.reduce((sum, s) => sum + (s.actualDuration || 0), 0);
        const avgEfficiency = sessionsCount > 0 ? 
            Math.round(sessions.reduce((sum, s) => sum + (s.efficiency || 0), 0) / sessionsCount) : 0;

        let status = '🔴 No Activity';
        if (sessionsCount > 0) {
            if (avgEfficiency >= 90) status = '🟢 Excellent';
            else if (avgEfficiency >= 75) status = '🟡 Good';
            else if (avgEfficiency >= 50) status = '🟠 Average';
            else status = '🔴 Poor';
        }

        rows.push({
            date: dayName,
            sessions: sessionsCount,
            studyTime: formatTime(studyTime),
            points: points,
            efficiency: avgEfficiency + '%',
            status: status
        });
    }

    container.innerHTML = rows.map(row => `
        <tr>
            <td>${row.date}</td>
            <td>${row.sessions}</td>
            <td>${row.studyTime}</td>
            <td>${row.points}</td>
            <td>${row.efficiency}</td>
            <td>${row.status}</td>
        </tr>
    `).join('');
}

function renderLiveSessionsMonitor() {
    const container = document.getElementById('liveSessionsMonitor');
    if (!container) return;

    const today = getTodayDateString();
    const todaySessions = sessionTracking[today];

    if (!todaySessions || !todaySessions.activeSession || sessionState === 'none') {
        container.innerHTML = `
            <div class="no-active-sessions">
                <div class="no-session-icon">💤</div>
                <h3>No Active Sessions</h3>
                <p>Student is not currently in a learning session.</p>
            </div>
        `;
        return;
    }

    const activeSession = todaySessions.activeSession;
    const startTime = new Date(activeSession.startTime);

    // Calculate elapsed time differently for active vs paused sessions
    let elapsed = 0;
    if (sessionState === 'active') {
        elapsed = Math.floor((Date.now() - startTime.getTime() - totalPausedTime) / 60000);
    } else {
        elapsed = sessionElapsedTime; // Use stored value for paused sessions
    }

    const progress = Math.min((elapsed / activeSession.targetDuration) * 100, 100);

    container.innerHTML = `
        <div class="live-session-card">
            <div class="live-session-header">
                <h3>🔴 Live Session Monitoring</h3>
                <div class="session-status ${activeSession.status}">
                    ${sessionState === 'active' ? '🟢 Active' : '⏸️ Paused'}
                </div>
            </div>
            <div class="live-session-body">
                <div class="session-overview">
                    <h4>${activeSession.routineName}</h4>
                    <div class="session-meta">
                        <span>Started: ${startTime.toLocaleTimeString()}</span>
                        <span>Target: ${formatTime(activeSession.targetDuration)}</span>
                    </div>
                </div>
                <div class="session-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <div class="progress-details">
                        <span>Elapsed: ${formatTime(elapsed)}</span>
                        <span>Progress: ${Math.round(progress)}%</span>
                    </div>
                </div>
                <div class="session-stats">
                    <div class="stat">
                        <span class="stat-label">Current Points:</span>
                        <span class="stat-value">${Math.floor(elapsed * POINTS_PER_MINUTE)}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Paused Time:</span>
                        <span class="stat-value">${formatTime(Math.floor((totalPausedTime || 0) / 60000))}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderRoutineManager() {
    const container = document.getElementById('routineManager');
    if (!container) return;

    container.innerHTML = `
        <div class="routine-list">
            <div class="section-header">
                <h4>📅 Learning Sessions</h4>
                <button onclick="showAddRoutineModal()" class="btn btn-primary btn-small">➕ Add New Session</button>
            </div>
            ${routines.map(routine => `
                <div class="routine-item">
                    <div class="routine-item-info">
                        <h4>${routine.name || 'Unnamed Session'}</h4>
                        <div class="routine-item-meta">
                            <span>⏰ ${routine.time || 'No time'}</span>
                            <span>⏱️ ${formatTime(routine.duration || 0)} target</span>
                            <span>⭐ ${routine.points || 0} points</span>
                            <span>📂 ${routine.category || 'General'}</span>
                            <span>🎯 ${routine.status || 'pending'}</span>
                        </div>
                        ${routine.completedAt ? `
                            <div class="routine-performance">
                                <span>📊 Last: ${formatTime(routine.actualDuration || 0)} (${routine.efficiency || 0}% efficiency)</span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="routine-item-actions">
                        <button onclick="editRoutine('${routine.id}')" class="btn btn-secondary btn-small">✏️ Edit</button>
                        <button onclick="deleteRoutine('${routine.id}')" class="btn btn-danger btn-small">🗑️ Delete</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderTestReports() {
    const container = document.getElementById('testReports');
    if (!container) return;

    if (testResults.length === 0) {
        container.innerHTML = '<div class="text-center">No test results available yet.</div>';
        return;
    }

    container.innerHTML = testResults.map(result => `
        <div class="report-card">
            <div class="report-header">
                <div class="report-title">${result.testTitle || 'Unknown Test'}</div>
                <div class="report-score">${result.percentage || 0}%</div>
            </div>
            <div class="report-details">
                <div class="detail-item">
                    <div class="detail-value">${result.correctAnswers || 0}</div>
                    <div class="detail-label">Correct</div>
                </div>
                <div class="detail-item">
                    <div class="detail-value">${result.totalQuestions || 0}</div>
                    <div class="detail-label">Total</div>
                </div>
                <div class="detail-item">
                    <div class="detail-value">${result.completedAt ? new Date(result.completedAt).toLocaleDateString() : 'N/A'}</div>
                    <div class="detail-label">Completed</div>
                </div>
            </div>
            <button onclick="viewDetailedReport('${result.id}')" class="btn btn-secondary btn-small mt-8">
                📊 View Details
            </button>
        </div>
    `).join('');
}

function renderPunishmentsList() {
    const container = document.getElementById('punishmentsList');
    if (!container) return;

    container.innerHTML = `
        <div class="punishments-content">
            <div class="section">
                <h3>⚖️ Student Punishments (Auto-Assigned)</h3>
                <div class="student-punishments">
                    ${studentPunishments.length === 0 ? '<div class="text-center">No punishments assigned yet.</div>' : 
                        studentPunishments.map(punishment => `
                            <div class="punishment-card">
                                <div class="punishment-header">
                                    <h4>${punishment.studentName}</h4>
                                    <span class="punishment-status ${punishment.status}">${punishment.status}</span>
                                </div>
                                <div class="punishment-details">
                                    <div><strong>Session:</strong> ${punishment.routineName}</div>
                                    <div><strong>Punishment:</strong> ${punishment.punishmentName}</div>
                                    <div><strong>Late by:</strong> ${punishment.minutesLate} minutes</div>
                                    <div><strong>Auto-assigned:</strong> ${new Date(punishment.assignedAt).toLocaleString()}</div>
                                </div>
                                <div class="punishment-actions">
                                    <button onclick="markPunishmentCompleted('${punishment.id}')" class="btn btn-success btn-small">✅ Mark Complete</button>
                                    <button onclick="removePunishment('${punishment.id}')" class="btn btn-danger btn-small">🗑️ Remove</button>
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
            </div>
        </div>
    `;
}

// Modal Functions - SAME AS BEFORE
function showAddRoutineModal() {
    document.getElementById('routineName').value = '';
    document.getElementById('routineStartTime').value = '';
    document.getElementById('routineDuration').value = '60';
    document.getElementById('routinePoints').value = '12';
    document.getElementById('routineCategory').value = 'Education';
    showModal('addRoutineModal');
}

function saveRoutine() {
    const name = document.getElementById('routineName').value.trim();
    const startTime = document.getElementById('routineStartTime').value;
    const duration = parseInt(document.getElementById('routineDuration').value) || 60;
    const points = parseInt(document.getElementById('routinePoints').value) || 12;
    const category = document.getElementById('routineCategory').value;

    if (!name || !startTime) {
        alert('Please fill in all required fields!');
        return;
    }

    const newRoutine = {
        id: Date.now().toString(),
        name: name,
        time: startTime,
        duration: duration,
        points: points,
        category: category,
        status: 'pending'
    };

    routines.push(newRoutine);
    saveToFirebase('routines', routines);
    closeModal('addRoutineModal');
    alert('✅ Learning session added successfully!');
}

function editRoutine(routineId) {
    const routine = routines.find(r => r.id === routineId);
    if (!routine) {
        alert('Session not found!');
        return;
    }

    currentEditingRoutineId = routineId;

    document.getElementById('editRoutineName').value = routine.name || '';
    document.getElementById('editRoutineStartTime').value = routine.time || '';
    document.getElementById('editRoutineDuration').value = routine.duration || 60;
    document.getElementById('editRoutinePoints').value = routine.points || 12;
    document.getElementById('editRoutineCategory').value = routine.category || 'Education';

    showModal('editRoutineModal');
}

function updateRoutine() {
    if (!currentEditingRoutineId) return;

    const routine = routines.find(r => r.id === currentEditingRoutineId);
    if (!routine) return;

    const name = document.getElementById('editRoutineName').value.trim();
    const startTime = document.getElementById('editRoutineStartTime').value;
    const duration = parseInt(document.getElementById('editRoutineDuration').value) || 60;
    const points = parseInt(document.getElementById('editRoutinePoints').value) || 12;
    const category = document.getElementById('editRoutineCategory').value;

    if (!name || !startTime) {
        alert('Please fill in all required fields!');
        return;
    }

    routine.name = name;
    routine.time = startTime;
    routine.duration = duration;
    routine.points = points;
    routine.category = category;

    saveToFirebase('routines', routines);
    closeModal('editRoutineModal');
    currentEditingRoutineId = null;
    alert('✅ Learning session updated successfully!');
}

function deleteRoutine(routineId) {
    if (confirm('Are you sure you want to delete this learning session?')) {
        const index = routines.findIndex(r => r.id === routineId);
        if (index !== -1) {
            routines.splice(index, 1);
            saveToFirebase('routines', routines);
            alert('✅ Learning session deleted successfully!');
        }
    }
}

function markPunishmentCompleted(punishmentId) {
    const punishment = studentPunishments.find(p => p.id === punishmentId);
    if (punishment) {
        punishment.status = 'completed';
        punishment.completedAt = new Date().toISOString();
        saveToFirebase('studentPunishments', studentPunishments);
        alert('✅ Punishment marked as completed!');
    }
}

function removePunishment(punishmentId) {
    if (confirm('Are you sure you want to remove this punishment?')) {
        const index = studentPunishments.findIndex(p => p.id === punishmentId);
        if (index !== -1) {
            studentPunishments.splice(index, 1);
            saveToFirebase('studentPunishments', studentPunishments);
            alert('✅ Punishment removed successfully!');
        }
    }
}

function viewDetailedReport(resultId) {
    const result = testResults.find(r => r.id === resultId);
    if (!result) {
        alert('Report not found!');
        return;
    }

    let detailsHtml = `
        <h3>📊 Detailed Test Report</h3>
        <h4>${result.testTitle}</h4>
        <p><strong>Student:</strong> ${result.studentName}</p>
        <p><strong>Score:</strong> ${result.percentage}% (${result.correctAnswers}/${result.totalQuestions})</p>
        <p><strong>Completed:</strong> ${new Date(result.completedAt).toLocaleString()}</p>
        <hr>
        <h4>Question Details:</h4>
    `;

    if (result.answers) {
        result.answers.forEach((answer, index) => {
            detailsHtml += `
                <div style="margin: 10px 0; padding: 10px; border-left: 4px solid ${answer.isCorrect ? '#10b981' : '#ef4444'};">
                    <strong>Q${index + 1}:</strong> ${answer.question}<br>
                    <strong>Student Answer:</strong> ${answer.selectedAnswer}<br>
                    ${!answer.isCorrect ? `<strong>Correct Answer:</strong> ${answer.correctAnswer}<br>` : ''}
                    <strong>Result:</strong> ${answer.isCorrect ? '✅ Correct' : '❌ Incorrect'}
                </div>
            `;
        });
    }

    const modal = document.createElement('div');
    modal.id = 'detailedReportModal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>📊 Test Report Details</h3>
                <button onclick="closeModal('detailedReportModal')" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">${detailsHtml}</div>
            <div class="modal-footer">
                <button onclick="closeModal('detailedReportModal')" class="btn btn-primary">Close</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    showModal('detailedReportModal');
}

// Test Functions - SAME AS BEFORE (unchanged)
function startTest(testId) {
    currentTest = tests.find(t => t.id === testId);
    if (!currentTest || !currentTest.questions || currentTest.questions.length === 0) {
        alert('Test not found or has no questions!');
        return;
    }

    currentQuestionIndex = 0;
    testAnswers = new Array(currentTest.questions.length).fill(null);
    testTimeRemaining = currentTest.duration * 60;

    document.getElementById('testTakingTitle').textContent = currentTest.title;
    updateTestTimer();
    renderCurrentQuestion();
    updateTestProgress();

    startTestTimer();
    showModal('testTakingModal');
}

function startTestTimer() {
    testTimer = setInterval(() => {
        testTimeRemaining--;
        updateTestTimer();

        if (testTimeRemaining <= 0) {
            alert('Time is up! Submitting test automatically.');
            submitTest();
        }
    }, 1000);
}

function updateTestTimer() {
    const minutes = Math.floor(testTimeRemaining / 60);
    const seconds = testTimeRemaining % 60;
    const timerElement = document.getElementById('testTimeRemaining');
    if (timerElement) {
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (testTimeRemaining < 300) {
            timerElement.style.color = '#ef4444';
        } else {
            timerElement.style.color = 'inherit';
        }
    }
}

function renderCurrentQuestion() {
    if (!currentTest || !currentTest.questions) return;

    const question = currentTest.questions[currentQuestionIndex];
    const container = document.getElementById('testQuestionsContainer');

    container.innerHTML = `
        <div class="test-question">
            <h4>Question ${currentQuestionIndex + 1}: ${question.question}</h4>
            <div class="test-options">
                ${question.options.map((option, index) => `
                    <div class="test-option ${testAnswers[currentQuestionIndex] === index ? 'selected' : ''}" 
                         onclick="selectAnswer(${index})">
                        <input type="radio" name="current-answer" value="${index}" 
                               ${testAnswers[currentQuestionIndex] === index ? 'checked' : ''}>
                        <span>${option}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    updateNavigationButtons();
    updateTestProgress();
}

function selectAnswer(answerIndex) {
    testAnswers[currentQuestionIndex] = answerIndex;
    renderCurrentQuestion();
}

function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevQuestionBtn');
    const nextBtn = document.getElementById('nextQuestionBtn');
    const counterElement = document.getElementById('questionCounter');

    if (prevBtn) prevBtn.disabled = currentQuestionIndex === 0;
    if (nextBtn) nextBtn.disabled = currentQuestionIndex === currentTest.questions.length - 1;
    if (counterElement) {
        counterElement.textContent = `Question ${currentQuestionIndex + 1} of ${currentTest.questions.length}`;
    }
}

function updateTestProgress() {
    const progressFill = document.getElementById('testProgress');
    const progressText = document.getElementById('progressText');

    const progress = ((currentQuestionIndex + 1) / currentTest.questions.length) * 100;

    if (progressFill) progressFill.style.width = `${progress}%`;
    if (progressText) {
        const answered = testAnswers.filter(a => a !== null).length;
        progressText.textContent = `Question ${currentQuestionIndex + 1} of ${currentTest.questions.length} (${answered} answered)`;
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

function submitTest() {
    if (testTimer) {
        clearInterval(testTimer);
        testTimer = null;
    }

    const unanswered = testAnswers.filter(a => a === null).length;
    if (unanswered > 0 && testTimeRemaining > 0) {
        if (!confirm(`You have ${unanswered} unanswered questions. Do you want to submit anyway?`)) {
            startTestTimer();
            return;
        }
    }

    let correctCount = 0;
    const detailedAnswers = currentTest.questions.map((question, index) => {
        const selectedAnswer = testAnswers[index];
        const isCorrect = selectedAnswer === question.correctAnswer;
        if (isCorrect) correctCount++;

        return {
            question: question.question,
            selectedAnswer: selectedAnswer !== null ? question.options[selectedAnswer] : 'No Answer',
            correctAnswer: question.options[question.correctAnswer],
            isCorrect: isCorrect
        };
    });

    const percentage = Math.round((correctCount / currentTest.questions.length) * 100);

    const result = {
        id: Date.now().toString(),
        testId: currentTest.id,
        testTitle: currentTest.title,
        studentName: 'Student',
        totalQuestions: currentTest.questions.length,
        correctAnswers: correctCount,
        percentage: percentage,
        answers: detailedAnswers,
        completedAt: new Date().toISOString()
    };

    testResults.push(result);
    saveToFirebase('testResults', testResults);

    const notification = {
        id: Date.now().toString(),
        type: 'test',
        studentName: 'Student',
        testTitle: currentTest.title,
        score: percentage,
        timestamp: new Date().toISOString(),
        date: getTodayDateString()
    };

    notifications.push(notification);
    saveToFirebase('notifications', notifications);

    closeModal('testTakingModal');
    showTestResult(result);
    updateStudentStats();
}

function showTestResult(result) {
    const scoreElement = document.getElementById('resultScore');
    const detailsElement = document.getElementById('resultDetails');
    const messageElement = document.getElementById('resultMessage');
    const breakdownElement = document.getElementById('resultBreakdown');

    if (scoreElement) scoreElement.textContent = `${result.percentage}%`;
    if (detailsElement) detailsElement.textContent = `${result.correctAnswers}/${result.totalQuestions} Questions Correct`;

    let message = '';
    if (result.percentage >= 90) {
        message = '🌟 Excellent! Outstanding performance!';
    } else if (result.percentage >= 80) {
        message = '🎉 Great job! Well done!';
    } else if (result.percentage >= 70) {
        message = '👍 Good work! Keep it up!';
    } else if (result.percentage >= 60) {
        message = '💪 Not bad! Room for improvement.';
    } else {
        message = '📚 Keep studying! You can do better!';
    }
    if (messageElement) messageElement.textContent = message;

    if (breakdownElement && result.answers) {
        breakdownElement.innerHTML = `
            <h4>Question Breakdown:</h4>
            <div class="breakdown-list">
                ${result.answers.map((answer, index) => `
                    <div class="breakdown-item ${answer.isCorrect ? 'correct' : 'incorrect'}">
                        <div class="breakdown-header">
                            <span class="question-num">Q${index + 1}</span>
                            <span class="result-icon">${answer.isCorrect ? '✅' : '❌'}</span>
                        </div>
                        <div class="breakdown-details">
                            <div><strong>Your answer:</strong> ${answer.selectedAnswer}</div>
                            ${!answer.isCorrect ? `<div><strong>Correct answer:</strong> ${answer.correctAnswer}</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    showModal('testResultModal');
}

function closeTestModal() {
    if (testTimer && confirm('Are you sure you want to exit the test? Your progress will be lost.')) {
        clearInterval(testTimer);
        testTimer = null;
        closeModal('testTakingModal');
    } else if (!testTimer) {
        closeModal('testTakingModal');
    }
}

// Modal Management
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
        console.log('Modal opened:', modalId);
    } else {
        console.error('Modal not found:', modalId);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        console.log('Modal closed:', modalId);

        if (modalId === 'detailedReportModal') {
            modal.remove();
        }
    }
}

console.log('🚀 MentorMate Pro - FIXED Session Tracking System Loaded!');