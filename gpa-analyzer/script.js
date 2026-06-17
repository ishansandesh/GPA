/* ===========================
   GPA ANALYZER - JAVASCRIPT
   =========================== */

// ===== DATA MANAGEMENT =====

const GRADE_SCALE = {
    'A': { min: 80, max: 100, points: 4.0 },
    'B+': { min: 70, max: 79, points: 3.7 },
    'B': { min: 60, max: 69, points: 3.0 },
    'C': { min: 50, max: 59, points: 2.0 },
    'F': { min: 0, max: 49, points: 0.0 }
};

const DIFFICULTY_RANGES = {
    easy: { min: 75, max: 90 },
    medium: { min: 60, max: 75 },
    hard: { min: 45, max: 65 }
};

let appData = {
    semesters: {},
    currentSemester: '1'
};

let chartInstances = {
    marks: null,
    performance: null
};

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', function() {
    loadFromLocalStorage();
    initializeEventListeners();
    renderSubjects();
    calculateGPA();
});

function initializeEventListeners() {
    // Form submission
    document.getElementById('subjectForm').addEventListener('submit', handleAddSubject);
    
    // Calculate button
    document.getElementById('calculateBtn').addEventListener('click', calculateGPA);
    
    // Reset button
    document.getElementById('resetAllBtn').addEventListener('click', resetAll);
    
    // Export button
    document.getElementById('exportBtn').addEventListener('click', openExportModal);
    
    // Semester buttons
    document.querySelectorAll('.semester-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            switchSemester(this.dataset.semester);
        });
    });
}

// ===== SUBJECT MANAGEMENT =====

function handleAddSubject(e) {
    e.preventDefault();
    
    const name = document.getElementById('subjectName').value.trim();
    const credits = parseInt(document.getElementById('credits').value);
    const difficulty = document.getElementById('difficulty').value;
    const marks = document.getElementById('marks').value;
    
    if (!name) {
        showToast('Please enter subject name', 'error');
        return;
    }
    
    const subject = {
        id: Date.now(),
        name,
        credits,
        difficulty,
        marks: marks ? parseInt(marks) : null,
        estimatedMarks: marks ? null : estimateMarks(difficulty)
    };
    
    if (!appData.semesters[appData.currentSemester]) {
        appData.semesters[appData.currentSemester] = [];
    }
    
    appData.semesters[appData.currentSemester].push(subject);
    
    saveToLocalStorage();
    renderSubjects();
    calculateGPA();
    
    document.getElementById('subjectForm').reset();
    showToast(`${name} added successfully`, 'success');
}

function estimateMarks(difficulty) {
    const range = DIFFICULTY_RANGES[difficulty];
    const base = Math.random() * (range.max - range.min) + range.min;
    const variation = (Math.random() - 0.5) * 10; // ±5
    return Math.round(Math.min(100, Math.max(0, base + variation)));
}

function removeSubject(id) {
    const subjects = appData.semesters[appData.currentSemester];
    const index = subjects.findIndex(s => s.id === id);
    
    if (index > -1) {
        const removed = subjects[index];
        subjects.splice(index, 1);
        saveToLocalStorage();
        renderSubjects();
        calculateGPA();
        showToast(`${removed.name} removed`, 'success');
    }
}

function editSubjectMarks(id) {
    const subject = appData.semesters[appData.currentSemester].find(s => s.id === id);
    if (!subject) return;
    
    const newMarks = prompt(`Enter marks for ${subject.name} (0-100):`, subject.marks || '');
    
    if (newMarks !== null) {
        const marks = parseInt(newMarks);
        
        if (isNaN(marks) || marks < 0 || marks > 100) {
            showToast('Please enter valid marks (0-100)', 'error');
            return;
        }
        
        subject.marks = marks;
        subject.estimatedMarks = null;
        saveToLocalStorage();
        renderSubjects();
        calculateGPA();
        showToast('Marks updated', 'success');
    }
}

function renderSubjects() {
    const container = document.getElementById('subjectsContainer');
    const subjects = appData.semesters[appData.currentSemester] || [];
    
    document.getElementById('subjectCount').textContent = subjects.length;
    
    if (subjects.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📚</span>
                <p>No subjects added yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = subjects.map(subject => {
        const marks = subject.marks !== null ? subject.marks : subject.estimatedMarks;
        const isEstimated = subject.marks === null;
        
        return `
            <div class="subject-item">
                <div class="subject-header">
                    <span class="subject-name">${subject.name}</span>
                    <span class="subject-difficulty difficulty-${subject.difficulty}">
                        ${subject.difficulty.toUpperCase()}
                    </span>
                </div>
                <div class="subject-details">
                    <div class="subject-detail">
                        <span>Credits:</span>
                        <strong>${subject.credits}</strong>
                    </div>
                    <div class="subject-detail">
                        <span>Marks:</span>
                        <strong>${marks} ${isEstimated ? '(Est.)' : ''}</strong>
                    </div>
                </div>
                <div class="subject-actions">
                    <button class="btn-small" onclick="editSubjectMarks(${subject.id})">
                        ✏️ Edit
                    </button>
                    <button class="btn-small btn-delete" onclick="removeSubject(${subject.id})">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ===== SEMESTER MANAGEMENT =====

function switchSemester(semesterNum) {
    appData.currentSemester = semesterNum;
    
    document.querySelectorAll('.semester-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.semester === semesterNum) {
            btn.classList.add('active');
        }
    });
    
    if (!appData.semesters[semesterNum]) {
        appData.semesters[semesterNum] = [];
    }
    
    renderSubjects();
    calculateGPA();
    saveToLocalStorage();
}

// ===== GPA CALCULATIONS =====

function convertMarksToGrade(marks) {
    for (const [grade, range] of Object.entries(GRADE_SCALE)) {
        if (marks >= range.min && marks <= range.max) {
            return { grade, points: range.points };
        }
    }
    return { grade: 'F', points: 0.0 };
}

function calculateGPA() {
    const subjects = appData.semesters[appData.currentSemester] || [];
    
    if (subjects.length === 0) {
        updateGPADisplay(0, 0);
        updateCharts([]);
        updateSuggestions([]);
        return;
    }
    
    let totalCredits = 0;
    let totalGradePoints = 0;
    let totalMarks = 0;
    const subjectsData = [];
    
    subjects.forEach(subject => {
        const marks = subject.marks !== null ? subject.marks : subject.estimatedMarks;
        const gradeInfo = convertMarksToGrade(marks);
        
        totalCredits += subject.credits;
        totalGradePoints += gradeInfo.points * subject.credits;
        totalMarks += marks;
        
        subjectsData.push({
            name: subject.name,
            marks,
            credits: subject.credits,
            difficulty: subject.difficulty,
            gradePoints: gradeInfo.points,
            grade: gradeInfo.grade,
            isRisky: marks < 50 || (marks < 60 && subject.credits > 3)
        });
    });
    
    const sgpa = totalCredits > 0 ? totalGradePoints / totalCredits : 0;
    const averageMarks = totalMarks / subjects.length;
    
    updateGPADisplay(sgpa, averageMarks);
    updateStatsDisplay(totalCredits, averageMarks, totalGradePoints, subjectsData);
    updateCharts(subjectsData);
    updateSuggestions(subjectsData);
    updateRiskAnalysis(subjectsData);
}

function updateGPADisplay(sgpa, averageMarks) {
    const sgpaValue = sgpa.toFixed(2);
    const cgpa = calculateCGPA();
    
    document.getElementById('sgpaValue').textContent = sgpaValue;
    document.getElementById('cgpaValue').textContent = cgpa.toFixed(2);
    
    // Update status color and message
    let sgpaStatus = 'Keep it up!';
    if (sgpa >= 3.5) sgpaStatus = '🌟 Excellent Performance';
    else if (sgpa >= 3.0) sgpaStatus = '⭐ Good Performance';
    else if (sgpa >= 2.5) sgpaStatus = '📈 Average Performance';
    else sgpaStatus = '⚠️ Needs Improvement';
    
    document.getElementById('sgpaStatus').textContent = sgpaStatus;
    document.getElementById('cgpaStatus').textContent = 'All semesters combined';
}

function calculateCGPA() {
    let totalGradePoints = 0;
    let totalCredits = 0;
    
    Object.values(appData.semesters).forEach(subjects => {
        subjects.forEach(subject => {
            const marks = subject.marks !== null ? subject.marks : subject.estimatedMarks;
            const gradeInfo = convertMarksToGrade(marks);
            
            totalGradePoints += gradeInfo.points * subject.credits;
            totalCredits += subject.credits;
        });
    });
    
    return totalCredits > 0 ? totalGradePoints / totalCredits : 0;
}

function updateStatsDisplay(totalCredits, averageMarks, totalGradePoints, subjectsData) {
    document.getElementById('totalCredits').textContent = totalCredits;
    document.getElementById('averageMarks').textContent = averageMarks.toFixed(1);
    document.getElementById('totalGradePoints').textContent = totalGradePoints.toFixed(2);
    
    const riskCount = subjectsData.filter(s => s.isRisky).length;
    document.getElementById('riskSubjects').textContent = riskCount;
}

// ===== CHART VISUALIZATION =====

function updateCharts(subjectsData) {
    if (subjectsData.length === 0) {
        if (chartInstances.marks) chartInstances.marks.destroy();
        if (chartInstances.performance) chartInstances.performance.destroy();
        return;
    }
    
    updateMarksChart(subjectsData);
    updatePerformanceChart(subjectsData);
}

function updateMarksChart(subjectsData) {
    const ctx = document.getElementById('marksChart');
    
    if (chartInstances.marks) {
        chartInstances.marks.destroy();
    }
    
    chartInstances.marks = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: subjectsData.map(s => s.name),
            datasets: [{
                label: 'Marks',
                data: subjectsData.map(s => s.marks),
                backgroundColor: subjectsData.map(() => 'rgba(255, 255, 255, 0.55)'),
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        color: '#cbd5e1'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: '#cbd5e1'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function updatePerformanceChart(subjectsData) {
    const ctx = document.getElementById('performanceChart');
    
    if (chartInstances.performance) {
        chartInstances.performance.destroy();
    }
    
    const difficultyData = {
        'Easy': [],
        'Medium': [],
        'Hard': []
    };
    
    subjectsData.forEach(s => {
        const key = s.difficulty.charAt(0).toUpperCase() + s.difficulty.slice(1);
        difficultyData[key].push(s.marks);
    });
    
    const avgByDifficulty = {
        'Easy': difficultyData['Easy'].length > 0 ? 
            (difficultyData['Easy'].reduce((a, b) => a + b) / difficultyData['Easy'].length) : 0,
        'Medium': difficultyData['Medium'].length > 0 ? 
            (difficultyData['Medium'].reduce((a, b) => a + b) / difficultyData['Medium'].length) : 0,
        'Hard': difficultyData['Hard'].length > 0 ? 
            (difficultyData['Hard'].reduce((a, b) => a + b) / difficultyData['Hard'].length) : 0
    };
    
    chartInstances.performance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Easy', 'Medium', 'Hard'],
            datasets: [{
                label: 'Average Marks',
                data: [avgByDifficulty['Easy'], avgByDifficulty['Medium'], avgByDifficulty['Hard']],
                borderColor: '#ffffff',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#cbd5e1'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        color: '#cbd5e1'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: '#cbd5e1'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// ===== SMART SUGGESTIONS =====

function updateSuggestions(subjectsData) {
    const container = document.getElementById('suggestionsContainer');
    
    if (subjectsData.length === 0) {
        container.innerHTML = '<p class="empty-suggestion">Add subjects to receive personalized study suggestions</p>';
        return;
    }
    
    const suggestions = [];
    
    // Low performing subjects
    const lowPerformers = subjectsData.filter(s => s.marks < 60);
    if (lowPerformers.length > 0) {
        suggestions.push({
            title: '📚 Focus on Weak Areas',
            text: `You're struggling in ${lowPerformers.map(s => s.name).join(', ')}. Allocate more study time to these subjects.`
        });
    }
    
    // Hard subjects
    const hardSubjects = subjectsData.filter(s => s.difficulty === 'hard' && s.marks < 70);
    if (hardSubjects.length > 0) {
        suggestions.push({
            title: '🔥 Hard Subject Strategy',
            text: `${hardSubjects.map(s => s.name).join(', ')} are challenging. Try forming study groups or seeking tutoring help.`
        });
    }
    
    // Strong subjects
    const strongSubjects = subjectsData.filter(s => s.marks >= 80);
    if (strongSubjects.length > 0) {
        suggestions.push({
            title: '⭐ Maintain Excellence',
            text: `Keep up the excellent work in ${strongSubjects.map(s => s.name).join(', ')}. Consistency is key!`
        });
    }
    
    // Credit management
    const highCreditLow = subjectsData.filter(s => s.credits > 3 && s.marks < 70);
    if (highCreditLow.length > 0) {
        suggestions.push({
            title: '⚠️ High-Impact Subjects',
            text: `${highCreditLow.map(s => s.name).join(', ')} have high credits. Prioritize these for better GPA.`
        });
    }
    
    // Average performers
    const average = subjectsData.filter(s => s.marks >= 60 && s.marks < 75);
    if (average.length > 0) {
        suggestions.push({
            title: '📈 Improvement Opportunity',
            text: `You can push your score in ${average.map(s => s.name).join(', ')} from good to great with focused effort.`
        });
    }
    
    if (suggestions.length === 0) {
        container.innerHTML = '<p class="empty-suggestion">🎉 You\'re doing great! Keep maintaining your performance.</p>';
        return;
    }
    
    container.innerHTML = suggestions.map(suggestion => `
        <div class="suggestion-item">
            <div class="suggestion-title">${suggestion.title}</div>
            <div class="suggestion-text">${suggestion.text}</div>
        </div>
    `).join('');
}

function updateRiskAnalysis(subjectsData) {
    const container = document.getElementById('riskContainer');
    
    const riskSubjects = subjectsData.filter(s => 
        s.marks < 50 || (s.marks < 60 && s.credits > 3)
    );
    
    if (riskSubjects.length === 0) {
        container.innerHTML = '<p class="empty-suggestion">✅ No high-risk subjects detected. You\'re on track!</p>';
        return;
    }
    
    container.innerHTML = riskSubjects.map(subject => `
        <div class="risk-item">
            <div class="suggestion-title">🚨 ${subject.name}</div>
            <div class="suggestion-text">
                Marks: ${subject.marks}/100 | Credits: ${subject.credits} | Difficulty: ${subject.difficulty.toUpperCase()}
                <br><strong>Action:</strong> Immediate intervention required. Consider extra classes or tutoring.
            </div>
        </div>
    `).join('');
}

// ===== UTILITY FUNCTIONS =====

function resetAll() {
    if (confirm('This will clear all subjects and data. Are you sure?')) {
        appData.semesters = { '1': [] };
        appData.currentSemester = '1';
        localStorage.removeItem('gpaAnalyzerData');
        renderSubjects();
        calculateGPA();
        showToast('All data cleared', 'success');
    }
}

function openExportModal() {
    const subjects = appData.semesters[appData.currentSemester] || [];
    
    if (subjects.length === 0) {
        showToast('Add subjects to export', 'error');
        return;
    }
    
    const sgpa = calculateSGPA();
    const cgpa = calculateCGPA();
    
    let content = `UNIVERSITY GPA ANALYZER - RESULTS EXPORT\n`;
    content += `${'='.repeat(50)}\n\n`;
    content += `SEMESTER ${appData.currentSemester}\n`;
    content += `${'='.repeat(50)}\n\n`;
    
    content += `SEMESTER GPA (SGPA): ${sgpa.toFixed(2)}\n`;
    content += `CUMULATIVE GPA (CGPA): ${cgpa.toFixed(2)}\n\n`;
    
    content += `SUBJECT DETAILS:\n`;
    content += `${'-'.repeat(50)}\n`;
    
    subjects.forEach(subject => {
        const marks = subject.marks !== null ? subject.marks : subject.estimatedMarks;
        const gradeInfo = convertMarksToGrade(marks);
        content += `\n${subject.name}\n`;
        content += `  Credits: ${subject.credits}\n`;
        content += `  Marks: ${marks}/100\n`;
        content += `  Grade: ${gradeInfo.grade}\n`;
        content += `  Grade Points: ${gradeInfo.points.toFixed(2)}\n`;
        content += `  Difficulty: ${subject.difficulty.toUpperCase()}\n`;
    });
    
    let stats = {
        totalCredits: subjects.reduce((sum, s) => sum + s.credits, 0),
        avgMarks: subjects.reduce((sum, s) => {
            const marks = s.marks !== null ? s.marks : s.estimatedMarks;
            return sum + marks;
        }, 0) / subjects.length
    };
    
    content += `\n${'-'.repeat(50)}\n`;
    content += `STATISTICS:\n`;
    content += `Total Credits: ${stats.totalCredits}\n`;
    content += `Average Marks: ${stats.avgMarks.toFixed(2)}\n`;
    content += `\nGenerated on: ${new Date().toLocaleString()}\n`;
    
    document.getElementById('exportContent').textContent = content;
    document.getElementById('exportModal').classList.add('active');
}

function closeModal() {
    document.getElementById('exportModal').classList.remove('active');
}

function downloadExport() {
    const content = document.getElementById('exportContent').textContent;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gpa-report-semester-${appData.currentSemester}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('Report downloaded', 'success');
}

function calculateSGPA() {
    const subjects = appData.semesters[appData.currentSemester] || [];
    if (subjects.length === 0) return 0;
    
    let totalGradePoints = 0;
    let totalCredits = 0;
    
    subjects.forEach(subject => {
        const marks = subject.marks !== null ? subject.marks : subject.estimatedMarks;
        const gradeInfo = convertMarksToGrade(marks);
        totalGradePoints += gradeInfo.points * subject.credits;
        totalCredits += subject.credits;
    });
    
    return totalCredits > 0 ? totalGradePoints / totalCredits : 0;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} active`;
    
    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}

// ===== LOCAL STORAGE =====

function saveToLocalStorage() {
    localStorage.setItem('gpaAnalyzerData', JSON.stringify(appData));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('gpaAnalyzerData');
    if (saved) {
        appData = JSON.parse(saved);
    } else {
        appData.semesters['1'] = [];
    }
}

// ===== KEYBOARD SHORTCUTS =====

document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + S to save (prevent default)
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        calculateGPA();
    }
    
    // Escape to close modal
    if (e.key === 'Escape') {
        closeModal();
    }
});

// ===== AUTO-SAVE =====

setInterval(() => {
    saveToLocalStorage();
}, 30000); // Auto-save every 30 seconds
