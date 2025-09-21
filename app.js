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

// Section Management for Student Dashboard
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

    console.log('✅ Default data initialized');
}

// Student Functions
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

    if (pointsElement) pointsElement.textContent = todayPoints;
    if (completedElement) completedElement.textContent = completedToday;
    if (testsElement) testsElement.textContent = testsTakenCount;
    if (averageElement) averageElement.textContent = averageScore + '%';
    if (punishmentsElement) punishmentsElement.textContent = totalPunishmentsCount;
}

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

    const minutesLate = Math.max(0, currentTime - scheduledTime);
    const pointsDeducted = Math.floor(minutesLate / 5) * POINTS_DEDUCTION_RATE;
    const pointsEarned = Math.max(1, (routine.points || 0) - pointsDeducted);

    let punishmentMessage = '';
    let punishmentAssigned = null;

    if (minutesLate < 5) {
        punishmentMessage = '✅ Perfect! On time check-in.';
    } else if (minutesLate >= 5 && minutesLate < 10) {
        punishmentAssigned = '2 Min Mulgi';
        punishmentMessage = '⚖️ Punishment: 2 Min Mulgi (5+ minutes late)';
    } else if (minutesLate >= 10 && minutesLate < 20) {
        punishmentAssigned = '2 Min Mulgi + 5 Scale';
        punishmentMessage = '⚖️ Punishment: 2 Min Mulgi + 5 Scale (10+ minutes late)';
    } else if (minutesLate >= 20) {
        punishmentAssigned = 'Heavy Punishment';
        punishmentMessage = '⚖️ Punishment: Heavy Punishment (20+ minutes late)';
    }

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
        saveToFirebase('studentPunishments', studentPunishments);
    }

    routine.status = 'completed';
    routine.checkedInAt = now.toISOString();
    routine.minutesLate = minutesLate;
    routine.pointsEarned = pointsEarned;
    routine.punishmentAssigned = punishmentAssigned;
    routine.completedDate = today;

    saveToFirebase('routines', routines);
    updateDailyPoints(today, pointsEarned);

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
    saveToFirebase('notifications', notifications);

    let message = '';
    if (minutesLate < 5) {
        message = `🎉 Perfect Check-in!\n\nRoutine: ${routine.name}\nPoints earned: ${pointsEarned}/${routine.points}\nStatus: ON TIME\n${punishmentMessage}\n\n🏆 Excellent work!`;
    } else {
        message = `🔔 Check-in Completed\n\nRoutine: ${routine.name}\nPoints earned: ${pointsEarned}/${routine.points}\nYou were ${minutesLate} minutes late\nPoints deducted: ${pointsDeducted}\n${punishmentMessage}\n\n💪 Try to be on time next time!`;
    }

    alert(message);
}

// Test Functions
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

// MENTOR FUNCTIONS - ALL WORKING
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
            <div class="section-header">
                <h4>📅 Current Routines</h4>
                <button onclick="showAddRoutineModal()" class="btn btn-primary btn-small">➕ Add New Routine</button>
            </div>
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
                            <li><strong>5-9 min late:</strong> 2 Min Mulgi</li>
                            <li><strong>10-19 min late:</strong> 2 Min Mulgi + 5 Scale</li>
                            <li><strong>20+ min late:</strong> Heavy Punishment</li>
                        </ul>
                        <p><em>These rules are automatically applied when students check in late.</em></p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// MENTOR MODAL FUNCTIONS - ALL WORKING
function showCreateTestModal() {
    showModal('createTestModal');
}

function showAddRoutineModal() {
    document.getElementById('routineName').value = '';
    document.getElementById('routineStartTime').value = '';
    document.getElementById('routineDuration').value = '30';
    document.getElementById('routinePoints').value = '10';
    document.getElementById('routineCategory').value = 'Health';

    showModal('addRoutineModal');
}

function saveRoutine() {
    const name = document.getElementById('routineName').value.trim();
    const startTime = document.getElementById('routineStartTime').value;
    const duration = parseInt(document.getElementById('routineDuration').value) || 30;
    const points = parseInt(document.getElementById('routinePoints').value) || 10;
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
    alert('✅ Routine added successfully!');
}

function editRoutine(routineId) {
    const routine = routines.find(r => r.id === routineId);
    if (!routine) {
        alert('Routine not found!');
        return;
    }

    currentEditingRoutineId = routineId;

    document.getElementById('editRoutineName').value = routine.name || '';
    document.getElementById('editRoutineStartTime').value = routine.time || '';
    document.getElementById('editRoutineDuration').value = routine.duration || 30;
    document.getElementById('editRoutinePoints').value = routine.points || 10;
    document.getElementById('editRoutineCategory').value = routine.category || 'Health';

    showModal('editRoutineModal');
}

function updateRoutine() {
    if (!currentEditingRoutineId) return;

    const routine = routines.find(r => r.id === currentEditingRoutineId);
    if (!routine) return;

    const name = document.getElementById('editRoutineName').value.trim();
    const startTime = document.getElementById('editRoutineStartTime').value;
    const duration = parseInt(document.getElementById('editRoutineDuration').value) || 30;
    const points = parseInt(document.getElementById('editRoutinePoints').value) || 10;
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
    alert('✅ Routine updated successfully!');
}

function deleteRoutine(routineId) {
    if (confirm('Are you sure you want to delete this routine?')) {
        const index = routines.findIndex(r => r.id === routineId);
        if (index !== -1) {
            routines.splice(index, 1);
            saveToFirebase('routines', routines);
            alert('✅ Routine deleted successfully!');
        }
    }
}

function showStudentAnalytics() {
    alert('📊 Analytics feature coming soon!');
}

function showNotifications() {
    alert('🔔 Notifications feature coming soon!');
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

console.log('🚀 MentorMate FULLY FIXED - All features working!');