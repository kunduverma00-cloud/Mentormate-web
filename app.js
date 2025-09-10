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
let currentEditingRoutineId = null;
let isFirebaseConnected = false;
let dataLoaded = false;

// Real-time listeners
let routinesRef = null;
let testsRef = null;
let testResultsRef = null;
let notificationsRef = null;
let studentPunishmentsRef = null;

// Test Taking Variables
let currentTest = null;
let currentQuestionIndex = 0;
let testAnswers = [];
let testTimer = null;
let testTimeRemaining = 0;

// Constants
const MENTOR_PASSWORD = "SHARU";
const POINTS_DEDUCTION_RATE = 1; // 1 point per 5 minutes late

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing MentorMate with NEW Firebase...');
    initializeFirebase();
    requestNotificationPermission();
    startTimeUpdates();
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

// NEW: Setup Real-time Listeners for ALL data
function setupRealTimeListeners() {
    console.log('🎯 Setting up real-time listeners...');

    // Routines real-time listener
    routinesRef = database.ref('routines');
    routinesRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            routines = Array.isArray(data) ? data : Object.values(data || {});
            console.log('🔄 Routines updated:', routines.length);
            if (currentUser && currentUser.role === 'student') {
                renderStudentRoutines();
                updateStudentStats();
            } else if (currentUser && currentUser.role === 'mentor') {
                renderRoutineManager();
            }
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
    const dataToSave = Array.isArray(data) ? data : (data || []);

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

    console.log('✅ Default data initialized and saved to Firebase');
}

// Student Data Loading
function loadStudentData() {
    console.log('👨‍🎓 Loading student data...');
    renderStudentRoutines();
    updateStudentStats();
    renderAvailableTests();
    renderStudentActivity();
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
    const completedToday = routines.filter(r => r.status === 'completed').length;
    const totalPoints = routines.reduce((sum, r) => {
        return sum + (r.status === 'completed' ? (r.pointsEarned || r.points || 0) : 0);
    }, 0);
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

    if (pointsElement) pointsElement.textContent = totalPoints;
    if (completedElement) completedElement.textContent = completedToday;
    if (testsElement) testsElement.textContent = testsTakenCount;
    if (averageElement) averageElement.textContent = averageScore + '%';
    if (punishmentsElement) punishmentsElement.textContent = totalPunishmentsCount;
}

// AUTOMATIC CHECK-IN WITH REAL TIME CALCULATION AND IMMEDIATE SAVE
function checkInToRoutine(routineId) {
    const routine = routines.find(r => r.id === routineId);
    if (!routine || routine.status === 'completed') return;

    const sessionStatus = getSessionStatus(routine);
    if (sessionStatus !== 'live') {
        alert('This session is not currently live for check-in!');
        return;
    }

    const now = new Date();
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

    // Update routine status
    routine.status = 'completed';
    routine.checkedInAt = now.toISOString();
    routine.minutesLate = minutesLate;
    routine.pointsEarned = pointsEarned;
    routine.punishmentAssigned = punishmentAssigned;

    // IMMEDIATE SAVE to Firebase
    console.log('💾 Immediately saving routine data...');
    saveToFirebase('routines', routines).then(() => {
        console.log('✅ Routine data saved successfully');
    });

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
        punishmentReceived: punishmentAssigned
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

// Test Taking Functions - COMPLETE IMPLEMENTATION
function startTest(testId) {
    currentTest = tests.find(t => t.id === testId);
    if (!currentTest || !currentTest.questions || currentTest.questions.length === 0) {
        alert('Test not found or has no questions!');
        return;
    }

    // Initialize test variables
    currentQuestionIndex = 0;
    testAnswers = new Array(currentTest.questions.length).fill(null);
    testTimeRemaining = currentTest.duration * 60; // Convert to seconds

    // Set up test modal
    document.getElementById('testTakingTitle').textContent = currentTest.title;
    updateTestTimer();
    renderCurrentQuestion();
    updateTestProgress();

    // Start timer
    startTestTimer();

    // Show test modal
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

        // Change color when time is running low
        if (testTimeRemaining < 300) { // Less than 5 minutes
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

    // Check for unanswered questions
    const unanswered = testAnswers.filter(a => a === null).length;
    if (unanswered > 0 && testTimeRemaining > 0) {
        if (!confirm(`You have ${unanswered} unanswered questions. Do you want to submit anyway?`)) {
            // Restart timer if user cancels
            startTestTimer();
            return;
        }
    }

    // Calculate results
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

    // Save result
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
    // IMMEDIATE SAVE
    saveToFirebase('testResults', testResults);

    // Add to notifications
    const notification = {
        id: Date.now().toString(),
        type: 'test',
        studentName: 'Student',
        testTitle: currentTest.title,
        score: percentage,
        timestamp: new Date().toISOString()
    };

    notifications.push(notification);
    // IMMEDIATE SAVE
    saveToFirebase('notifications', notifications);

    // Close test modal
    closeModal('testTakingModal');

    // Show result modal with detailed breakdown
    showTestResult(result);

    // Update stats
    updateStudentStats();

    // Send notification
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

    // Set message based on score
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

    // Show detailed breakdown
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

// Punishment Management Functions
function markPunishmentCompleted(punishmentId) {
    const punishment = studentPunishments.find(p => p.id === punishmentId);
    if (punishment) {
        punishment.status = 'completed';
        punishment.completedAt = new Date().toISOString();
        // IMMEDIATE SAVE
        saveToFirebase('studentPunishments', studentPunishments);
        alert('Punishment marked as completed!');
    }
}

function removePunishment(punishmentId) {
    if (confirm('Are you sure you want to remove this punishment?')) {
        const index = studentPunishments.findIndex(p => p.id === punishmentId);
        if (index !== -1) {
            studentPunishments.splice(index, 1);
            // IMMEDIATE SAVE
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
        return diffHours < 24; // Show notifications from last 24 hours
    }).length;

    const notificationCountElement = document.getElementById('notificationCount');
    if (notificationCountElement) {
        notificationCountElement.textContent = count > 0 ? `${count} new alerts` : 'No new alerts';
    }
}

// Remaining mentor functions (create test, routine management, etc.)
function showCreateTestModal() {
    const container = document.getElementById('questionsContainer');
    if (container) {
        container.innerHTML = '';
        addQuestion(); // Add first question by default
    }
    showModal('createTestModal');
}

function addQuestion() {
    const container = document.getElementById('questionsContainer');
    if (!container) return;

    const questionCount = container.children.length + 1;

    const questionHtml = `
        <div class="question-item" data-question="${questionCount}">
            <div class="question-header">
                <span class="question-number">Question ${questionCount}</span>
                <button onclick="removeQuestion(this)" class="remove-question" type="button">×</button>
            </div>
            <div class="form-group">
                <input type="text" class="form-input question-text" placeholder="Enter your question">
            </div>
            <div class="options-grid">
                <div class="option-item">
                    <input type="radio" name="correct-${questionCount}" value="0" checked>
                    <input type="text" class="form-input" placeholder="Option A">
                </div>
                <div class="option-item">
                    <input type="radio" name="correct-${questionCount}" value="1">
                    <input type="text" class="form-input" placeholder="Option B">
                </div>
                <div class="option-item">
                    <input type="radio" name="correct-${questionCount}" value="2">
                    <input type="text" class="form-input" placeholder="Option C">
                </div>
                <div class="option-item">
                    <input type="radio" name="correct-${questionCount}" value="3">
                    <input type="text" class="form-input" placeholder="Option D">
                </div>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', questionHtml);
}

function removeQuestion(button) {
    button.closest('.question-item').remove();

    // Renumber remaining questions
    const questions = document.querySelectorAll('.question-item');
    questions.forEach((question, index) => {
        const number = index + 1;
        question.setAttribute('data-question', number);
        question.querySelector('.question-number').textContent = `Question ${number}`;

        // Update radio button names
        const radios = question.querySelectorAll('input[type="radio"]');
        radios.forEach(radio => {
            radio.name = `correct-${number}`;
        });
    });
}

function saveTest() {
    const titleElement = document.getElementById('testTitle');
    const durationElement = document.getElementById('testDuration');
    const categoryElement = document.getElementById('testCategory');

    if (!titleElement || !durationElement || !categoryElement) {
        alert('Form elements not found!');
        return;
    }

    const title = titleElement.value.trim();
    const duration = parseInt(durationElement.value) || 30;
    const category = categoryElement.value;

    if (!title) {
        alert('Please enter a test title.');
        return;
    }

    const questions = [];
    const questionItems = document.querySelectorAll('.question-item');

    questionItems.forEach((questionDiv, index) => {
        const questionTextElement = questionDiv.querySelector('.question-text');
        const optionElements = questionDiv.querySelectorAll('.option-item input[type="text"]');
        const correctAnswerElement = questionDiv.querySelector('input[type="radio"]:checked');

        if (!questionTextElement || !correctAnswerElement) return;

        const questionText = questionTextElement.value.trim();
        const options = Array.from(optionElements).map(input => input.value.trim());

        if (questionText && options.every(opt => opt)) {
            questions.push({
                question: questionText,
                options: options,
                correctAnswer: parseInt(correctAnswerElement.value)
            });
        }
    });

    if (questions.length === 0) {
        alert('Please add at least one complete question.');
        return;
    }

    const test = {
        id: Date.now().toString(),
        title: title,
        category: category,
        duration: duration,
        questions: questions,
        status: 'available',
        createdAt: new Date().toISOString()
    };

    tests.push(test);
    // IMMEDIATE SAVE
    saveToFirebase('tests', tests);

    closeModal('createTestModal');

    alert(`Test "${title}" created successfully with ${questions.length} questions!`);

    // Clear form
    titleElement.value = '';
    durationElement.value = '30';
    categoryElement.value = 'Academic';
    document.getElementById('questionsContainer').innerHTML = '';
}

function showAddRoutineModal() {
    showModal('addRoutineModal');
}

function saveRoutine() {
    const nameElement = document.getElementById('routineName');
    const startTimeElement = document.getElementById('routineStartTime');
    const durationElement = document.getElementById('routineDuration');
    const pointsElement = document.getElementById('routinePoints');
    const categoryElement = document.getElementById('routineCategory');

    if (!nameElement || !startTimeElement || !durationElement || !pointsElement || !categoryElement) {
        alert('Form elements not found!');
        return;
    }

    const name = nameElement.value.trim();
    const startTime = startTimeElement.value;
    const duration = parseInt(durationElement.value) || 30;
    const points = parseInt(pointsElement.value) || 10;
    const category = categoryElement.value;

    if (!name || !startTime) {
        alert('Please fill in all required fields.');
        return;
    }

    const routine = {
        id: Date.now().toString(),
        name: name,
        time: startTime,
        duration: duration,
        points: points,
        category: category,
        status: 'pending'
    };

    routines.push(routine);
    // IMMEDIATE SAVE
    saveToFirebase('routines', routines);

    closeModal('addRoutineModal');

    alert(`Routine "${name}" added successfully!`);

    // Clear form
    nameElement.value = '';
    startTimeElement.value = '';
    durationElement.value = '30';
    pointsElement.value = '10';
    categoryElement.value = 'Health';
}

function editRoutine(routineId) {
    const routine = routines.find(r => r.id === routineId);
    if (!routine) {
        alert('Routine not found!');
        return;
    }

    currentEditingRoutineId = routineId;

    // Populate edit form
    document.getElementById('editRoutineName').value = routine.name || '';
    document.getElementById('editRoutineStartTime').value = routine.time || '';
    document.getElementById('editRoutineDuration').value = routine.duration || 30;
    document.getElementById('editRoutinePoints').value = routine.points || 10;
    document.getElementById('editRoutineCategory').value = routine.category || 'Health';

    showModal('editRoutineModal');
}

function updateRoutine() {
    if (!currentEditingRoutineId) {
        alert('No routine selected for editing!');
        return;
    }

    const routine = routines.find(r => r.id === currentEditingRoutineId);
    if (!routine) {
        alert('Routine not found!');
        return;
    }

    const nameElement = document.getElementById('editRoutineName');
    const startTimeElement = document.getElementById('editRoutineStartTime');
    const durationElement = document.getElementById('editRoutineDuration');
    const pointsElement = document.getElementById('editRoutinePoints');
    const categoryElement = document.getElementById('editRoutineCategory');

    if (!nameElement || !startTimeElement || !durationElement || !pointsElement || !categoryElement) {
        alert('Form elements not found!');
        return;
    }

    const name = nameElement.value.trim();
    const startTime = startTimeElement.value;
    const duration = parseInt(durationElement.value) || 30;
    const points = parseInt(pointsElement.value) || 10;
    const category = categoryElement.value;

    if (!name || !startTime) {
        alert('Please fill in all required fields.');
        return;
    }

    // Update routine
    routine.name = name;
    routine.time = startTime;
    routine.duration = duration;
    routine.points = points;
    routine.category = category;

    // IMMEDIATE SAVE
    saveToFirebase('routines', routines);

    closeModal('editRoutineModal');

    alert(`Routine "${name}" updated successfully!`);

    currentEditingRoutineId = null;
}

function deleteRoutine(routineId) {
    if (confirm('Are you sure you want to delete this routine?')) {
        const index = routines.findIndex(r => r.id === routineId);
        if (index !== -1) {
            const deletedRoutine = routines[index];
            routines.splice(index, 1);
            // IMMEDIATE SAVE
            saveToFirebase('routines', routines);
            alert(`Routine "${deletedRoutine.name}" deleted successfully!`);
        } else {
            alert('Routine not found!');
        }
    }
}

// Additional helper functions
function viewDetailedReport(resultId) {
    const result = testResults.find(r => r.id === resultId);
    if (!result || !result.answers) return;

    const detailsHtml = result.answers.map((answer, index) => `
        <div class="question-detail ${answer.isCorrect ? 'correct' : 'incorrect'}">
            <div class="question-header">
                <span class="question-number">Q${index + 1}</span>
                <span class="result-icon">${answer.isCorrect ? '✅' : '❌'}</span>
            </div>
            <div class="question-text">${answer.question || `Question ${index + 1}`}</div>
            <div class="answer-details">
                <div class="selected-answer">
                    <strong>Selected:</strong> ${answer.selectedAnswer || 'No Answer'}
                </div>
                ${!answer.isCorrect ? `
                    <div class="correct-answer">
                        <strong>Correct Answer:</strong> ${answer.correctAnswer || 'Unknown'}
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');

    const modalHtml = `
        <div class="modal active" id="detailedReportModal" style="display: flex;">
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h3>📊 Detailed Test Report</h3>
                    <button onclick="closeModal('detailedReportModal')" class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="report-summary">
                        <h3>${result.testTitle || 'Test Report'}</h3>
                        <div class="score-display">${result.correctAnswers || 0}/${result.totalQuestions || 0} (${result.percentage || 0}%)</div>
                        <div class="completion-date">Completed: ${result.completedAt ? new Date(result.completedAt).toLocaleString() : 'Unknown'}</div>
                    </div>
                    <div class="questions-breakdown">
                        ${detailsHtml}
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="closeModal('detailedReportModal')" class="btn btn-secondary">Close</button>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById('detailedReportModal');
    if (existingModal) {
        existingModal.remove();
    }

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function showStudentAnalytics() {
    const completedRoutines = routines.filter(r => r.status === 'completed');
    const totalPoints = completedRoutines.reduce((sum, r) => sum + (r.pointsEarned || r.points || 0), 0);
    const averageScore = testResults.length > 0 
        ? Math.round(testResults.reduce((sum, r) => sum + (r.percentage || 0), 0) / testResults.length)
        : 0;

    const analyticsHtml = `
        <div class="modal active" id="analyticsModal" style="display: flex;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📊 Student Analytics</h3>
                    <button onclick="closeModal('analyticsModal')" class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="progress-stats">
                        <div class="stat-card">
                            <div class="stat-value">${completedRoutines.length}</div>
                            <div class="stat-label">Completed Routines</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${totalPoints}</div>
                            <div class="stat-label">Total Points</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${testResults.length}</div>
                            <div class="stat-label">Tests Taken</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${averageScore}%</div>
                            <div class="stat-label">Average Score</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${studentPunishments.length}</div>
                            <div class="stat-label">Punishments</div>
                        </div>
                    </div>
                    <div class="recent-activity-section">
                        <h4>Recent Activity Details</h4>
                        <div class="activity-details">
                            ${notifications.slice(0, 10).map(n => `
                                <div class="activity-detail-item">
                                    <div class="activity-detail-header">
                                        <strong>${n.type === 'checkin' ? '✅ Check-in' : '📝 Test'}:</strong>
                                        ${n.type === 'checkin' ? n.routineName : n.testTitle}
                                    </div>
                                    <div class="activity-detail-info">
                                        📅 ${new Date(n.timestamp).toLocaleString()}
                                        ${n.type === 'checkin' && n.minutesLate !== undefined ? `
                                            <br>⏰ ${n.minutesLate > 0 ? `${n.minutesLate} min late` : 'On time'}
                                            <br>🎯 ${n.pointsEarned}/${n.originalPoints} points
                                            ${n.punishmentReceived ? `<br>⚖️ Punishment: ${n.punishmentReceived}` : ''}
                                        ` : ''}
                                        ${n.type === 'test' ? `<br>📊 Score: ${n.score || 0}%` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="closeModal('analyticsModal')" class="btn btn-secondary">Close</button>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById('analyticsModal');
    if (existingModal) {
        existingModal.remove();
    }

    document.body.insertAdjacentHTML('beforeend', analyticsHtml);
}

function showNotifications() {
    const notificationsHtml = `
        <div class="modal active" id="notificationsModal" style="display: flex;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🔔 Notifications</h3>
                    <button onclick="closeModal('notificationsModal')" class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    ${notifications.length === 0 ? '<div class="text-center">No notifications yet.</div>' :
                        notifications.slice(0, 20).map(notification => `
                            <div class="notification-item">
                                <div class="notification-icon ${notification.type}">
                                    ${notification.type === 'checkin' ? '✅' : '📝'}
                                </div>
                                <div class="notification-content">
                                    <div class="notification-title">
                                        ${notification.type === 'checkin' 
                                            ? `${notification.studentName} checked in to ${notification.routineName}` 
                                            : `${notification.studentName} completed ${notification.testTitle}`
                                        }
                                    </div>
                                    <div class="notification-details">
                                        📅 ${new Date(notification.timestamp).toLocaleString()}
                                        ${notification.type === 'checkin' && notification.minutesLate !== undefined ? `
                                            <br>⏰ ${notification.minutesLate > 0 ? `${notification.minutesLate} minutes late` : 'On time'}
                                            <br>🎯 Points: ${notification.pointsEarned}/${notification.originalPoints}
                                            ${notification.punishmentReceived ? `<br>⚖️ Punishment: ${notification.punishmentReceived}` : ''}
                                        ` : ''}
                                        ${notification.type === 'test' ? `<br>📊 Score: ${notification.score || 0}%` : ''}
                                    </div>
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
                <div class="modal-footer">
                    <button onclick="closeModal('notificationsModal')" class="btn btn-secondary">Close</button>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById('notificationsModal');
    if (existingModal) {
        existingModal.remove();
    }

    document.body.insertAdjacentHTML('beforeend', notificationsHtml);
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

console.log('🚀 MentorMate with NEW Firebase Config and Real-time Updates loaded!');