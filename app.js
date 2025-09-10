// Firebase Configuration (EXACT as provided)
const firebaseConfig = {
    apiKey: "AIzaSyAICGaYzy1Skev2fcrokHLZ8ahGwt9evQI",
    authDomain: "mentormate-2d25d.firebaseapp.com",
    databaseURL: "https://mentormate-2d25d-default-rtdb.firebaseio.com",
    projectId: "mentormate-2d25d",
    storageBucket: "mentormate-2d25d.firebasestorage.app",
    messagingSenderId: "573223618824",
    appId: "1:573223618824:web:07ec16275d61b7f6fd44bd",
    measurementId: "G-FDV9D91N67"
};

// Global Variables
let currentUser = null;
let database = null;
let routines = [];
let tests = [];
let testResults = [];
let notifications = [];
let currentEditingRoutineId = null;
let isFirebaseConnected = false;

// Constants
const MENTOR_PASSWORD = "SHARU";
const POINTS_DEDUCTION_RATE = 1; // 1 point per 5 minutes late

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing MentorMate...');
    initializeFirebase();
    requestNotificationPermission();
    startTimeUpdates();
    initializeDefaultData();
});

// Firebase Initialization
function initializeFirebase() {
    try {
        firebase.initializeApp(firebaseConfig);
        database = firebase.database();
        console.log('Firebase initialized successfully');

        // Listen for connection state
        database.ref('.info/connected').on('value', function(snapshot) {
            isFirebaseConnected = snapshot.val() === true;
            updateFirebaseStatus(isFirebaseConnected);
            if (isFirebaseConnected) {
                console.log('Firebase connected');
                loadFromFirebase();
            }
        });

    } catch (error) {
        console.error('Firebase initialization failed:', error);
        isFirebaseConnected = false;
        updateFirebaseStatus(false);
    }
}

// Update Firebase Connection Status
function updateFirebaseStatus(connected) {
    const statusElement = document.getElementById('firebaseStatus');
    if (!statusElement) return;

    const statusDot = statusElement.querySelector('.status-dot');
    const statusText = statusElement.querySelector('.status-text');

    if (connected) {
        statusElement.classList.add('connected');
        statusText.textContent = 'Firebase Connected';
    } else {
        statusElement.classList.remove('connected');
        statusText.textContent = 'Firebase Disconnected';
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

// Screen Management
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
}

// Role Selection
function selectRole(role) {
    if (role === 'mentor') {
        showScreen('mentorLoginScreen');
        const passwordInput = document.getElementById('mentorPasswordInput');
        if (passwordInput) passwordInput.focus();
    } else {
        currentUser = { role: 'student', name: 'Student' };
        loadStudentData();
        showScreen('studentDashboard');
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
        loadMentorData();
        showScreen('mentorDashboard');
        errorElement.textContent = '';
        errorElement.style.display = 'none';
        passwordInput.value = '';
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

// Initialize Default Data
function initializeDefaultData() {
    // Sample Routines
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
        }
    ];

    // Sample Tests
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
                },
                {
                    question: 'What is the chemical symbol for gold?',
                    options: ['Go', 'Gd', 'Au', 'Ag'],
                    correctAnswer: 2
                },
                {
                    question: 'Which continent is the largest?',
                    options: ['Africa', 'Asia', 'North America', 'Europe'],
                    correctAnswer: 1
                },
                {
                    question: 'What is 8 × 7?',
                    options: ['54', '56', '58', '60'],
                    correctAnswer: 1
                },
                {
                    question: 'Who wrote "Romeo and Juliet"?',
                    options: ['Charles Dickens', 'William Shakespeare', 'Mark Twain', 'Jane Austen'],
                    correctAnswer: 1
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

    // Sample Test Results (For demonstration)
    testResults = [
        {
            id: 'result-1',
            testId: 'weekly-assessment',
            testTitle: 'Weekly Assessment',
            studentName: 'Student',
            totalQuestions: 9,
            correctAnswers: 8,
            percentage: 89,
            answers: [
                { question: 'What is the capital of France?', selectedAnswer: 'Paris', correctAnswer: 'Paris', isCorrect: true },
                { question: 'What is 15 + 27?', selectedAnswer: '41', correctAnswer: '42', isCorrect: false },
                { question: 'Which planet is known as the Red Planet?', selectedAnswer: 'Mars', correctAnswer: 'Mars', isCorrect: true },
                { question: 'What is the largest mammal?', selectedAnswer: 'Blue Whale', correctAnswer: 'Blue Whale', isCorrect: true },
                { question: 'In which year did World War II end?', selectedAnswer: '1945', correctAnswer: '1945', isCorrect: true },
                { question: 'What is the chemical symbol for gold?', selectedAnswer: 'Au', correctAnswer: 'Au', isCorrect: true },
                { question: 'Which continent is the largest?', selectedAnswer: 'Asia', correctAnswer: 'Asia', isCorrect: true },
                { question: 'What is 8 × 7?', selectedAnswer: '56', correctAnswer: '56', isCorrect: true },
                { question: 'Who wrote "Romeo and Juliet"?', selectedAnswer: 'William Shakespeare', correctAnswer: 'William Shakespeare', isCorrect: true }
            ],
            completedAt: new Date().toISOString()
        }
    ];

    // Initialize notifications array
    notifications = [];
}

// Firebase Data Operations
function loadFromFirebase() {
    if (!database) return;

    // Load routines
    database.ref('routines').once('value').then(snapshot => {
        if (snapshot.exists()) {
            const firebaseRoutines = snapshot.val();
            if (Array.isArray(firebaseRoutines)) {
                routines = firebaseRoutines;
            } else if (typeof firebaseRoutines === 'object') {
                routines = Object.values(firebaseRoutines);
            }
            console.log('Loaded routines from Firebase:', routines);
        }
        if (currentUser) {
            currentUser.role === 'student' ? loadStudentData() : loadMentorData();
        }
    }).catch(error => {
        console.error('Error loading routines:', error);
    });

    // Load tests
    database.ref('tests').once('value').then(snapshot => {
        if (snapshot.exists()) {
            const firebaseTests = snapshot.val();
            if (Array.isArray(firebaseTests)) {
                tests = firebaseTests;
            } else if (typeof firebaseTests === 'object') {
                tests = Object.values(firebaseTests);
            }
            console.log('Loaded tests from Firebase:', tests);
        }
        if (currentUser) {
            currentUser.role === 'student' ? loadStudentData() : loadMentorData();
        }
    }).catch(error => {
        console.error('Error loading tests:', error);
    });

    // Load test results
    database.ref('testResults').once('value').then(snapshot => {
        if (snapshot.exists()) {
            const firebaseResults = snapshot.val();
            if (Array.isArray(firebaseResults)) {
                testResults = firebaseResults;
            } else if (typeof firebaseResults === 'object') {
                testResults = Object.values(firebaseResults);
            }
            console.log('Loaded test results from Firebase:', testResults);
        }
        if (currentUser && currentUser.role === 'mentor') {
            loadMentorData();
        }
    }).catch(error => {
        console.error('Error loading test results:', error);
    });

    // Load notifications
    database.ref('notifications').once('value').then(snapshot => {
        if (snapshot.exists()) {
            const firebaseNotifications = snapshot.val();
            if (Array.isArray(firebaseNotifications)) {
                notifications = firebaseNotifications;
            } else if (typeof firebaseNotifications === 'object') {
                notifications = Object.values(firebaseNotifications);
            }
            console.log('Loaded notifications from Firebase:', notifications);
        }
        if (currentUser && currentUser.role === 'mentor') {
            loadMentorData();
        }
    }).catch(error => {
        console.error('Error loading notifications:', error);
    });
}

function saveToFirebase(path, data) {
    if (database && isFirebaseConnected) {
        database.ref(path).set(data).then(() => {
            console.log(`Data saved to Firebase: ${path}`);
        }).catch(error => {
            console.error(`Error saving to Firebase ${path}:`, error);
        });
    } else {
        console.log('Firebase not connected, data saved locally only');
    }
}

// Student Data Loading
function loadStudentData() {
    renderStudentRoutines();
    updateStudentStats();
    renderAvailableTests();
}

function renderStudentRoutines() {
    const container = document.getElementById('studentRoutines');
    if (!container || !routines.length) return;

    container.innerHTML = routines.map(routine => `
        <div class="routine-card">
            <div class="routine-header">
                <div class="routine-info">
                    <h4>${routine.name}</h4>
                    <div class="routine-time">${routine.time || 'No time set'} (${routine.duration || 0} min)</div>
                    <div class="routine-points">⭐ ${routine.points || 0} points</div>
                    <div class="routine-category">📂 ${routine.category || 'General'}</div>
                </div>
                <div class="routine-status ${routine.status || 'pending'}">${routine.status || 'pending'}</div>
            </div>
            ${routine.checkedInAt ? `
                <div class="checkin-details">
                    <div class="checkin-time">✅ Checked in: ${new Date(routine.checkedInAt).toLocaleString()}</div>
                    ${routine.minutesLate > 0 ? `<div class="late-info">⏰ ${routine.minutesLate} minutes late</div>` : '<div class="ontime-info">✅ On time</div>'}
                    <div class="points-earned">🎯 Points earned: ${routine.pointsEarned || routine.points || 0}</div>
                </div>
            ` : ''}
            <div class="routine-actions">
                <button onclick="checkInToRoutine('${routine.id}')" 
                        class="btn btn-success btn-small"
                        ${routine.status === 'completed' ? 'disabled' : ''}>
                    ${routine.status === 'completed' ? '✅ Completed' : '🏃 Check In'}
                </button>
            </div>
        </div>
    `).join('');
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

function updateStudentStats() {
    const completedToday = routines.filter(r => r.status === 'completed').length;
    const totalPoints = routines.reduce((sum, r) => {
        return sum + (r.status === 'completed' ? (r.pointsEarned || r.points || 0) : 0);
    }, 0);
    const testsTakenCount = testResults.length;
    const averageScore = testsTakenCount > 0 
        ? Math.round(testResults.reduce((sum, r) => sum + (r.percentage || 0), 0) / testsTakenCount)
        : 0;

    const pointsElement = document.getElementById('studentPoints');
    const completedElement = document.getElementById('completedRoutines');
    const testsElement = document.getElementById('testsTaken');
    const averageElement = document.getElementById('averageScore');

    if (pointsElement) pointsElement.textContent = totalPoints;
    if (completedElement) completedElement.textContent = completedToday;
    if (testsElement) testsElement.textContent = testsTakenCount;
    if (averageElement) averageElement.textContent = averageScore + '%';
}

// Student Actions
function checkInToRoutine(routineId) {
    const routine = routines.find(r => r.id === routineId);
    if (!routine || routine.status === 'completed') return;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const scheduledTime = timeStringToMinutes(routine.time);
    const minutesLate = Math.max(0, currentTime - scheduledTime);

    // Calculate points with deduction for lateness
    const pointsDeducted = Math.floor(minutesLate / 5) * POINTS_DEDUCTION_RATE;
    const pointsEarned = Math.max(1, (routine.points || 0) - pointsDeducted);

    // Update routine status
    routine.status = 'completed';
    routine.checkedInAt = now.toISOString();
    routine.minutesLate = minutesLate;
    routine.pointsEarned = pointsEarned;

    // Save to Firebase
    saveToFirebase('routines', routines);

    // Add to activity feed for mentor
    const activity = {
        id: Date.now().toString(),
        type: 'checkin',
        studentName: 'Student',
        routineName: routine.name,
        timestamp: now.toISOString(),
        minutesLate: minutesLate,
        pointsEarned: pointsEarned,
        originalPoints: routine.points || 0
    };

    notifications.push(activity);
    saveToFirebase('notifications', notifications);

    // Update UI
    loadStudentData();

    // Show detailed success message
    let message = `✅ Checked in to ${routine.name}!\n`;
    message += `🎯 Points earned: ${pointsEarned}`;
    if (minutesLate > 0) {
        message += `\n⏰ You were ${minutesLate} minutes late`;
        message += `\n📉 Points deducted: ${pointsDeducted}`;
    } else {
        message += `\n✅ Right on time!`;
    }

    alert(message);
}

// Test Taking Functions
function startTest(testId) {
    // Implement test taking functionality here
    alert('Test taking functionality will be implemented next!');
}

// Mentor Data Loading
function loadMentorData() {
    renderTestReports();
    renderActivityFeed();
    renderRoutineManager();
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

// Mentor Actions
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
    saveToFirebase('tests', tests);

    closeModal('createTestModal');
    loadMentorData();

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
    saveToFirebase('routines', routines);

    closeModal('addRoutineModal');
    loadMentorData();

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

    saveToFirebase('routines', routines);

    closeModal('editRoutineModal');
    loadMentorData();

    alert(`Routine "${name}" updated successfully!`);

    currentEditingRoutineId = null;
}

function deleteRoutine(routineId) {
    if (confirm('Are you sure you want to delete this routine?')) {
        const index = routines.findIndex(r => r.id === routineId);
        if (index !== -1) {
            const deletedRoutine = routines[index];
            routines.splice(index, 1);
            saveToFirebase('routines', routines);
            loadMentorData();
            alert(`Routine "${deletedRoutine.name}" deleted successfully!`);
        } else {
            alert('Routine not found!');
        }
    }
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
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';

        // Remove dynamically created modals
        if (modalId === 'detailedReportModal' || modalId === 'analyticsModal' || modalId === 'notificationsModal') {
            modal.remove();
        }
    }
}