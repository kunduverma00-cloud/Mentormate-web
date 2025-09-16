// Firebase Configuration - NEW CONFIG
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

// Real-time listeners
let routinesRef = null;
let testsRef = null;
let testResultsRef = null;
let notificationsRef = null;
let studentPunishmentsRef = null;
let dailyPointsRef = null;

// Test Taking Variables
let currentTest = null;
let currentQuestionIndex = 0;
let testAnswers = [];
let testTimer = null;
let testTimeRemaining = 0;

// Constants
const MENTOR_PASSWORD = "SHARU";
const POINTS_DEDUCTION_RATE = 1; // 1 point per 5 minutes late

// Helper function to get today's date string
function getTodayDateString() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

// Helper function to get yesterday's date string
function getYesterdayDateString() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
}

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing MentorMate with NEW Firebase...');
    initializeFirebase();
    requestNotificationPermission();
    startTimeUpdates();
    // Daily routine reset check
    checkAndResetDailyRoutines();
});

// FIXED: Firebase Initialization with REAL-TIME LISTENERS
function initializeFirebase() {
    try {
        firebase.initializeApp(firebaseConfig);
        database = firebase.database();
        console.log('✅ Firebase initialized with NEW config');

        // Listen for connection state
        database.ref('.info/connected').on('value', function(snapshot) {
            const connected = snapshot.val() === true;
            isFirebaseConnected = connected;
            updateFirebaseStatus(connected);

            if (connected) {
                console.log('🔥 Firebase connected - setting up real-time listeners...');
                setupRealTimeListeners();
                if (!dataLoaded) {
                    loadInitialData();
                }
            } else {
                console.log('❌ Firebase disconnected');
            }
        });

    } catch (error) {
        console.error('❌ Firebase initialization failed:', error);
        isFirebaseConnected = false;
        updateFirebaseStatus(false);
        initializeDefaultData(); // Fallback to default data
    }
}

// NEW: Setup Real-time Listeners for ALL data INCLUDING DAILY POINTS
function setupRealTimeListeners() {
    console.log('🎯 Setting up real-time listeners...');

    // Routines real-time listener
    routinesRef = database.ref('routines');
    routinesRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            routines = Array.isArray(data) ? data : Object.values(data || {});
            console.log('🔄 Routines updated:', routines.length);
            // Check for daily reset
            checkAndResetDailyRoutines();
            if (currentUser && currentUser.role === 'student') {
                renderStudentRoutines();
                updateStudentStats();
            } else if (currentUser && currentUser.role === 'mentor') {
                renderRoutineManager();
            }
        }
    });

    // Daily Points real-time listener
    dailyPointsRef = database.ref('dailyPoints');
    dailyPointsRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            dailyPoints = data || {};
            console.log('🔄 Daily points updated:', dailyPoints);
            if (currentUser && currentUser.role === 'student') {
                updateStudentStats();
                renderDailyPointsBreakdown();
            }
        } else {
            dailyPoints = {};
        }
    });

    // Tests real-time listener
    testsRef = database.ref('tests');
    testsRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            tests = Array.isArray(data) ? data : Object.values(data || {});
            console.log('🔄 Tests updated:', tests.length);
            if (currentUser) {
                renderAvailableTests();
                if (currentUser.role === 'mentor') {
                    renderTestReports();
                }
            }
        }
    });

    // Test Results real-time listener
    testResultsRef = database.ref('testResults');
    testResultsRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            testResults = Array.isArray(data) ? data : Object.values(data || {});
            console.log('🔄 Test results updated:', testResults.length);
            if (currentUser) {
                updateStudentStats();
                if (currentUser.role === 'mentor') {
                    renderTestReports();
                }
            }
        }
    });

    // Notifications real-time listener
    notificationsRef = database.ref('notifications');
    notificationsRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            notifications = Array.isArray(data) ? data : Object.values(data || {});
            console.log('🔄 Notifications updated:', notifications.length);
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

    // Student Punishments real-time listener
    studentPunishmentsRef = database.ref('studentPunishments');
    studentPunishmentsRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            studentPunishments = Array.isArray(data) ? data : Object.values(data || {});
            console.log('🔄 Punishments updated:', studentPunishments.length);
            if (currentUser) {
                updateStudentStats();
                if (currentUser.role === 'mentor') {
                    renderPunishmentsList();
                }
            }
        }
    });

    console.log('✅ All real-time listeners set up!');
}

// NEW: Check and Reset Daily Routines
function checkAndResetDailyRoutines() {
    const today = getTodayDateString();
    let resetNeeded = false;

    routines.forEach(routine => {
        // If routine was completed on a different date, reset it
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

// NEW: Update Daily Points
function updateDailyPoints(dateString, points) {
    if (!dailyPoints[dateString]) {
        dailyPoints[dateString] = 0;
    }
    dailyPoints[dateString] += points;
    saveToFirebase('dailyPoints', dailyPoints);
}

// NEW: Render Daily Points Breakdown
function renderDailyPointsBreakdown() {
    const today = getTodayDateString();
    const yesterday = getYesterdayDateString();

    const todayPoints = dailyPoints[today] || 0;
    const yesterdayPoints = dailyPoints[yesterday] || 0;

    // Update today's points display
    const todayPointsElement = document.getElementById('todayPoints');
    const yesterdayPointsElement = document.getElementById('yesterdayPoints');

    if (todayPointsElement) todayPointsElement.textContent = todayPoints;
    if (yesterdayPointsElement) yesterdayPointsElement.textContent = yesterdayPoints;
}

// Load initial data (only once)
function loadInitialData() {
    console.log('📥 Loading initial data...');

    // Load punishment rules (static data)
    database.ref('punishmentRules').once('value').then(snapshot => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            punishmentRules = Array.isArray(data) ? data : Object.values(data || {});
        }
    });

    // Initialize default data if nothing exists
    database.ref('routines').once('value').then(snapshot => {
        if (!snapshot.exists() || !snapshot.val()) {
            console.log('🆕 No data found, initializing defaults...');
            initializeDefaultData();
        }
        dataLoaded = true;
    });
}

// IMPROVED: Immediate Save to Firebase with better error handling
function saveToFirebase(path, data) {
    if (!database || !isFirebaseConnected) {
        console.error('❌ Firebase not connected, cannot save:', path);
        return Promise.reject('Firebase not connected');
    }

    // Ensure data is in correct format
    const dataToSave = Array.isArray(data) ? data : (data || {});

    console.log(`💾 Saving to Firebase: ${path}`, dataToSave);

    return database.ref(path).set(dataToSave).then(() => {
        console.log(`✅ Successfully saved to Firebase: ${path}`);
        return true;
    }).catch(error => {
        console.error(`❌ Error saving to Firebase ${path}:`, error);

        // Immediate retry
        return database.ref(path).set(dataToSave).then(() => {
            console.log(`✅ Retry successful for: ${path}`);
            return true;
        }).catch(retryError => {
            console.error(`❌ Retry failed for ${path}:`, retryError);
            return false;
        });
    });
}

// Update Firebase Connection Status
function updateFirebaseStatus(connected) {
    const statusElement = document.getElementById('firebaseStatus');
    if (!statusElement) return;

    const statusDot = statusElement.querySelector('.status-dot');
    const statusText = statusElement.querySelector('.status-text');

    if (connected) {
        statusElement.classList.add('connected');
        if (statusText) statusText.textContent = 'Firebase Connected';
    } else {
        statusElement.classList.remove('connected');
        if (statusText) statusText.textContent = 'Firebase Disconnected';
    }
}

// Request Notification Permission
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(function(permission) {
            console.log('Notification permission:', permission);
        });
    }
}

// Send Browser Notification
function sendNotification(title, body, icon = '🔔') {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${icon}</text></svg>`,
            requireInteraction: true
        });
    }
}

// Time Management
function startTimeUpdates() {
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    setInterval(checkActiveRoutines, 60000); // Check every minute
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

// Check for Active Routines (Notifications)
function checkActiveRoutines() {
    if (!routines.length) return;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    routines.forEach(routine => {
        if (!routine.time) return;
        const routineTime = timeStringToMinutes(routine.time);
        const timeDiff = routineTime - currentTime;

        // Notify 5 minutes before
        if (timeDiff === 5) {
            sendNotification(
                `${routine.name} Starting Soon!`,
                `Your routine starts in 5 minutes at ${routine.time}`,
                '⏰'
            );
        }

        // Notify when routine goes live
        if (timeDiff === 0) {
            sendNotification(
                `${routine.name} is Live!`,
                `Time to start: ${routine.name}`,
                '🔥'
            );
        }
    });
}

function timeStringToMinutes(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
}

// Get Session Status
function getSessionStatus(routine) {
    if (!routine.time) return 'no-time';

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const routineStartTime = timeStringToMinutes(routine.time);
    const routineEndTime = routineStartTime + (routine.duration || 30);

    if (currentTime < routineStartTime - 10) {
        return 'yet-to-live'; // More than 10 minutes before
    } else if (currentTime < routineStartTime + 30) {
        return 'live'; // Up to 30 minutes after start time
    } else {
        return 'missed'; // Session is over
    }
}

// Screen Management - FIXED
function showScreen(screenId) {
    console.log('Switching to screen:', screenId);

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
        console.log('Screen switched to:', screenId);
    } else {
        console.error('Screen not found:', screenId);
    }
}

// Section Management for Student Dashboard
function showSection(sectionName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Update content sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });

    const targetSection = document.getElementById(`${sectionName}Section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Load section-specific data
    if (sectionName === 'routines') {
        renderStudentRoutines();
        updateStudentStats();
    } else if (sectionName === 'tests') {
        renderAvailableTests();
    } else if (sectionName === 'progress') {
        updateStudentStats();
        renderStudentActivity();
        renderDailyPointsBreakdown();
    }
}

// Section Management for Mentor Dashboard
function showMentorSection(sectionName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Update content sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });

    const targetSection = document.getElementById(`mentor${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)}Section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Load section-specific data
    if (sectionName === 'overview') {
        renderActivityFeed();
        updateNotificationCount();
    } else if (sectionName === 'routines') {
        renderRoutineManager();
    } else if (sectionName === 'tests') {
        renderTestReports();
    } else if (sectionName === 'punishments') {
        renderPunishmentsList();
    }
}

// Role Selection
function selectRole(role) {
    console.log('Role selected:', role);
    if (role === 'mentor') {
        showScreen('mentorLoginScreen');
        setTimeout(() => {
            const passwordInput = document.getElementById('mentorPasswordInput');
            if (passwordInput) passwordInput.focus();
        }, 100);
    } else {
        currentUser = { role: 'student', name: 'Student' };
        showScreen('studentDashboard');
        // Load data immediately if available
        setTimeout(() => {
            loadStudentData();
        }, 100);
    }
}

// Mentor Authentication
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

        // Load mentor data immediately
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

// Initialize Default Data ONLY if no data exists
function initializeDefaultData() {
    console.log('🆕 Initializing default data...');

    // Only initialize if arrays are empty
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
            },
            {
                id: 'family-time',
                name: 'Family Time + Dinner',
                time: '22:30',
                duration: 60,
                points: 8,
                category: 'Personal',
                status: 'pending'
            },
            {
                id: 'vc-mentor',
                name: 'VC with Mentor',
                time: '22:45',
                duration: 30,
                points: 10,
                category: 'Education',
                status: 'pending'
            },
            {
                id: 'evening-balance',
                name: 'Evening Balance',
                time: '21:00',
                duration: 45,
                points: 5,
                category: 'Personal',
                status: 'pending'
            },
            {
                id: 'deep-focus-study',
                name: 'Deep Focus Study',
                time: '10:00',
                duration: 60,
                points: 15,
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
                    },
                    {
                        question: 'What is 15 + 27?',
                        options: ['41', '42', '43', '44'],
                        correctAnswer: 1
                    },
                    {
                        question: 'Which planet is known as the Red Planet?',
                        options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
                        correctAnswer: 1
                    },
                    {
                        question: 'What is the largest mammal?',
                        options: ['Elephant', 'Blue Whale', 'Giraffe', 'Hippo'],
                        correctAnswer: 1
                    },
                    {
                        question: 'In which year did World War II end?',
                        options: ['1943', '1944', '1945', '1946'],
                        correctAnswer: 2
                    }
                ],
                status: 'available'
            },
            {
                id: 'mathematics-quiz',
                title: 'Mathematics Quiz',
                category: 'Academic',
                duration: 20,
                questions: [
                    {
                        question: 'What is √64?',
                        options: ['6', '7', '8', '9'],
                        correctAnswer: 2
                    },
                    {
                        question: 'What is 25% of 80?',
                        options: ['15', '20', '25', '30'],
                        correctAnswer: 1
                    }
                ],
                status: 'available'
            }
        ];
        saveToFirebase('tests', tests);
    }

    // Initialize other arrays if empty
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

    if (punishmentRules.length === 0) {
        punishmentRules = [];
        saveToFirebase('punishmentRules', punishmentRules);
    }

    // Initialize daily points if empty
    if (Object.keys(dailyPoints).length === 0) {
        dailyPoints = {};
        saveToFirebase('dailyPoints', dailyPoints);
    }

    console.log('✅ Default data initialized and saved to Firebase');
}

// Student Data Loading
function loadStudentData() {
    console.log('👨‍🎓 Loading student data...');
    renderStudentRoutines();
    updateStudentStats();
    renderAvailableTests();
    renderStudentActivity();
    renderDailyPointsBreakdown();
}

function renderStudentRoutines() {
    const container = document.getElementById('studentRoutines');
    if (!container) return;

    if (!routines || routines.length === 0) {
        container.innerHTML = '<div class="text-center">No routines available.</div>';
        return;
    }

    container.innerHTML = routines.map(routine => {
        const sessionStatus = getSessionStatus(routine);
        let statusDisplay = '';
        let buttonText = '';
        let buttonDisabled = false;
        let buttonClass = 'btn-success';

        if (routine.status === 'completed') {
            statusDisplay = 'COMPLETED';
            buttonText = '✅ Completed';
            buttonDisabled = true;
            buttonClass = 'btn-secondary';
        } else {
            switch(sessionStatus) {
                case 'yet-to-live':
                    statusDisplay = 'YET TO LIVE';
                    buttonText = '⏳ Yet to Live';
                    buttonDisabled = true;
                    buttonClass = 'btn-secondary';
                    break;
                case 'live':
                    statusDisplay = 'LIVE';
                    buttonText = '🏃 Check In';
                    buttonDisabled = false;
                    buttonClass = 'btn-success';
                    break;
                case 'missed':
                    statusDisplay = 'SESSION MISSED';
                    buttonText = '❌ Session Missed';
                    buttonDisabled = true;
                    buttonClass = 'btn-danger';
                    break;
                case 'no-time':
                    statusDisplay = 'NO TIME SET';
                    buttonText = '⚠️ No Time Set';
                    buttonDisabled = true;
                    buttonClass = 'btn-secondary';
                    break;
            }
        }

        return `
            <div class="routine-card">
                <div class="routine-header">
                    <div class="routine-info">
                        <h4>${routine.name || 'Unnamed Routine'}</h4>
                        <div class="routine-time">${routine.time || 'No time set'} (${routine.duration || 0} min)</div>
                        <div class="routine-points">⭐ ${routine.points || 0} points</div>
                        <div class="routine-category">📂 ${routine.category || 'General'}</div>
                    </div>
                    <div class="routine-status ${routine.status || 'pending'}">${statusDisplay}</div>
                </div>
                ${routine.checkedInAt ? `
                    <div class="checkin-details">
                        <div class="checkin-time">✅ Checked in: ${new Date(routine.checkedInAt).toLocaleString()}</div>
                        ${routine.minutesLate > 0 ? `<div class="late-info">⏰ ${routine.minutesLate} minutes late</div>` : '<div class="ontime-info">✅ On time</div>'}
                        <div class="points-earned">🎯 Points earned: ${routine.pointsEarned || routine.points || 0}</div>
                        ${routine.punishmentAssigned ? `<div class="punishment-assigned">⚖️ Punishment: ${routine.punishmentAssigned}</div>` : ''}
                    </div>
                ` : ''}
                <div class="routine-actions">
                    <button onclick="checkInToRoutine('${routine.id}')" 
                            class="btn ${buttonClass} btn-small"
                            ${buttonDisabled ? 'disabled' : ''}>
                        ${buttonText}
                    </button>
                </div>
            </div>
        `;
    }).join('');
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
                ${notification.type === 'checkin' ? '✅' : '📝'}
            </div>
            <div class="activity-content">
                <div class="activity-title">
                    ${notification.type === 'checkin' 
                        ? `Checked in to ${notification.routineName}` 
                        : `Completed ${notification.testTitle}`
                    }
                </div>
                <div class="activity-details">
                    ${new Date(notification.timestamp).toLocaleString()}
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

function updateStudentStats() {
    const today = getTodayDateString();
    const completedToday = routines.filter(r => r.status === 'completed' && r.completedDate === today).length;
    const todayPoints = dailyPoints[today] || 0;
    const testsTakenCount = testResults.length;
    const averageScore = testsTakenCount > 0 
        ? Math.round(testResults.reduce((sum, r) => sum + (r.percentage || 0), 0) / testsTakenCount)
        : 0;
    const totalPunishmentsCount = studentPunishments.length;

    const pointsElement = document.getElementById('studentPoints');
    const completedElement = document.getElementById('completedRoutines');
    const testsElement = document.getElementById('testsTaken');
    const averageElement = document.getElementById('averageScore');
    const punishmentsElement = document.getElementById('totalPunishments');

    if (pointsElement) pointsElement.textContent = todayPoints; // Show today's points only
    if (completedElement) completedElement.textContent = completedToday;
    if (testsElement) testsElement.textContent = testsTakenCount;
    if (averageElement) averageElement.textContent = averageScore + '%';
    if (punishmentsElement) punishmentsElement.textContent = totalPunishmentsCount;
}

// AUTOMATIC CHECK-IN WITH REAL TIME CALCULATION AND DAILY RESET
function checkInToRoutine(routineId) {
    const routine = routines.find(r => r.id === routineId);
    if (!routine || routine.status === 'completed') return;

    const sessionStatus = getSessionStatus(routine);
    if (sessionStatus !== 'live') {
        alert('This session is not currently live for check-in!');
        return;
    }

    const now = new Date();
    const today = getTodayDateString();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const scheduledTime = timeStringToMinutes(routine.time);

    // AUTOMATIC CALCULATION - NO MANUAL SELECTION
    const minutesLate = Math.max(0, currentTime - scheduledTime);

    // Calculate points with deduction for lateness
    const pointsDeducted = Math.floor(minutesLate / 5) * POINTS_DEDUCTION_RATE;
    const pointsEarned = Math.max(1, (routine.points || 0) - pointsDeducted);

    // DETERMINE PUNISHMENT BASED ON AUTOMATIC LATENESS DETECTION
    let punishmentMessage = '';
    let punishmentAssigned = null;

    if (minutesLate < 5) {
        // ON TIME - No punishment
        punishmentMessage = '✅ Perfect! On time check-in.';
    } else if (minutesLate >= 1 && minutesLate < 5) {
        // 1MIN = 1 SCALE
        punishmentAssigned = '1 Scale';
        punishmentMessage = '⚖️ Punishment: 1 Scale (1 minute late)';
    } else if (minutesLate >= 5 && minutesLate < 10) {
        // 5MIN = 2MIN MULGI
        punishmentAssigned = '2 Min Mulgi';
        punishmentMessage = '⚖️ Punishment: 2 Min Mulgi (5+ minutes late)';
    } else if (minutesLate >= 10 && minutesLate < 20) {
        // 10MIN = 2MIN MULGI AND 5 SCALE
        punishmentAssigned = '2 Min Mulgi + 5 Scale';
        punishmentMessage = '⚖️ Punishment: 2 Min Mulgi + 5 Scale (10+ minutes late)';
    } else if (minutesLate >= 20 && minutesLate < 30) {
        // 20MIN = Heavy Punishment
        punishmentAssigned = 'Heavy Punishment';
        punishmentMessage = '⚖️ Punishment: Heavy Punishment (20+ minutes late)';
    } else if (minutesLate >= 30) {
        // 30MIN = Maximum Punishment
        punishmentAssigned = 'Maximum Punishment';
        punishmentMessage = '⚖️ Punishment: Maximum Punishment (30+ minutes late)';
    }

    // Record punishment if assigned
    if (punishmentAssigned) {
        const punishment = {
            id: Date.now().toString(),
            studentName: 'Student',
            routineName: routine.name,
            punishmentName: punishmentAssigned,
            minutesLate: minutesLate,
            assignedAt: now.toISOString(),
            status: 'pending'
        };

        studentPunishments.push(punishment);
        // IMMEDIATE SAVE
        saveToFirebase('studentPunishments', studentPunishments);
    }

    // Update routine status with date tracking
    routine.status = 'completed';
    routine.checkedInAt = now.toISOString();
    routine.minutesLate = minutesLate;
    routine.pointsEarned = pointsEarned;
    routine.punishmentAssigned = punishmentAssigned;
    routine.completedDate = today; // Track completion date

    // IMMEDIATE SAVE to Firebase
    console.log('💾 Immediately saving routine data...');
    saveToFirebase('routines', routines).then(() => {
        console.log('✅ Routine data saved successfully');
    });

    // Update daily points
    updateDailyPoints(today, pointsEarned);

    // Add to activity feed for mentor
    const activity = {
        id: Date.now().toString(),
        type: 'checkin',
        studentName: 'Student',
        routineName: routine.name,
        timestamp: now.toISOString(),
        minutesLate: minutesLate,
        pointsEarned: pointsEarned,
        originalPoints: routine.points || 0,
        punishmentReceived: punishmentAssigned,
        date: today
    };

    notifications.push(activity);
    // IMMEDIATE SAVE
    saveToFirebase('notifications', notifications);

    // SHOW AUTOMATIC POPUP BASED ON LATENESS
    let message = '';

    if (minutesLate < 5) {
        // ON TIME POPUP
        message = `🎉 Perfect Check-in!\n\n`;
        message += `✅ Routine: ${routine.name}\n`;
        message += `🎯 Points earned: ${pointsEarned}/${routine.points}\n`;
        message += `⏰ Status: ON TIME\n`;
        message += `${punishmentMessage}\n\n`;
        message += `🏆 Excellent work! Keep it up!`;
    } else {
        // LATE POPUP WITH PUNISHMENT
        message = `🔔 Check-in Completed\n\n`;
        message += `✅ Routine: ${routine.name}\n`;
        message += `🎯 Points earned: ${pointsEarned}/${routine.points}\n`;
        message += `⏰ You were ${minutesLate} minutes late\n`;
        message += `📉 Points deducted: ${pointsDeducted}\n`;
        message += `${punishmentMessage}\n\n`;
        message += `💪 Try to be on time next time!`;
    }

    alert(message);

    // Send notification
    sendNotification(
        'Check-in Completed!',
        `${routine.name}: ${pointsEarned} points${punishmentAssigned ? ` | Punishment: ${punishmentAssigned}` : ' | On time!'}`,
        minutesLate < 5 ? '🎉' : '⚖️'
    );

    console.log('🎯 Check-in completed and saved immediately!');
}

// Continue with all other functions (tests, mentor functions, etc.)
// For brevity, I'll include just the essential remaining functions

// Test functions (keeping them the same but with daily tracking)
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

    sendNotification(
        'Test Completed!',
        `You scored ${percentage}% on ${currentTest.title}`,
        '🎉'
    );
}

function showTestResult(result) {
    const modal = document.getElementById('testResultModal');
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

    if (breakdownElement) {
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

// Mentor Functions
function loadMentorData() {
    console.log('👨‍🏫 Loading mentor data...');
    renderTestReports();
    renderActivityFeed();
    renderRoutineManager();
    renderPunishmentsList();
    updateNotificationCount();
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

function renderActivityFeed() {
    const container = document.getElementById('activityFeed');
    if (!container) return;

    if (notifications.length === 0) {
        container.innerHTML = '<div class="text-center">No recent activity.</div>';
        return;
    }

    const sortedNotifications = notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    container.innerHTML = sortedNotifications.slice(0, 10).map(notification => `
        <div class="activity-item">
            <div class="activity-icon ${notification.type}">
                ${notification.type === 'checkin' ? '✅' : '📝'}
            </div>
            <div class="activity-content">
                <div class="activity-title">
                    ${notification.type === 'checkin' 
                        ? `${notification.studentName} checked in to ${notification.routineName}` 
                        : `${notification.studentName} completed ${notification.testTitle}`
                    }
                </div>
                <div class="activity-details">
                    ${new Date(notification.timestamp).toLocaleString()}
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

function renderRoutineManager() {
    const container = document.getElementById('routineManager');
    if (!container) return;

    container.innerHTML = `
        <div class="routine-list">
            ${routines.map(routine => `
                <div class="routine-item">
                    <div class="routine-item-info">
                        <h4>${routine.name || 'Unnamed Routine'}</h4>
                        <div class="routine-item-meta">
                            <span>⏰ ${routine.time || 'No time'}</span>
                            <span>⏱️ ${routine.duration || 0} min</span>
                            <span>⭐ ${routine.points || 0} points</span>
                            <span>📂 ${routine.category || 'General'}</span>
                            <span>🎯 ${routine.status || 'pending'}</span>
                        </div>
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
                                    <div><strong>Routine:</strong> ${punishment.routineName}</div>
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

            <div class="section">
                <h3>📋 Punishment Rules (Automatic System)</h3>
                <div class="punishment-rules-info">
                    <div class="rule-info-card">
                        <h4>Current Auto-Assignment Rules:</h4>
                        <ul>
                            <li><strong>< 5 min late:</strong> No punishment (On time)</li>
                            <li><strong>1-4 min late:</strong> 1 Scale</li>
                            <li><strong>5-9 min late:</strong> 2 Min Mulgi</li>
                            <li><strong>10-19 min late:</strong> 2 Min Mulgi + 5 Scale</li>
                            <li><strong>20-29 min late:</strong> Heavy Punishment</li>
                            <li><strong>30+ min late:</strong> Maximum Punishment</li>
                        </ul>
                        <p><em>These rules are automatically applied when students check in late.</em></p>
                    </div>
                </div>
            </div>
        </div>
    `;
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

        // Remove dynamically created modals
        if (modalId === 'detailedReportModal' || modalId === 'analyticsModal' || modalId === 'notificationsModal') {
            modal.remove();
        }
    }
}

// Punishment Management Functions
function markPunishmentCompleted(punishmentId) {
    const punishment = studentPunishments.find(p => p.id === punishmentId);
    if (punishment) {
        punishment.status = 'completed';
        punishment.completedAt = new Date().toISOString();
        saveToFirebase('studentPunishments', studentPunishments);
        alert('Punishment marked as completed!');
    }
}

function removePunishment(punishmentId) {
    if (confirm('Are you sure you want to remove this punishment?')) {
        const index = studentPunishments.findIndex(p => p.id === punishmentId);
        if (index !== -1) {
            studentPunishments.splice(index, 1);
            saveToFirebase('studentPunishments', studentPunishments);
            alert('Punishment removed successfully!');
        }
    }
}

function updateNotificationCount() {
    const count = notifications.filter(n => {
        if (!n.timestamp) return false;
        const notificationTime = new Date(n.timestamp);
        const now = new Date();
        const diffHours = (now - notificationTime) / (1000 * 60 * 60);
        return diffHours < 24;
    }).length;

    const notificationCountElement = document.getElementById('notificationCount');
    if (notificationCountElement) {
        notificationCountElement.textContent = count > 0 ? `${count} new alerts` : 'No new alerts';
    }
}

console.log('🚀 MentorMate with Daily Reset and Daily Points Tracking loaded!');