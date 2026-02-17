/**
 * RamadanReady - Main Application Logic
 */

// Global app state
const app = {
    currentScreen: 'home',
    countdownInterval: null,
    todayData: null
};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    await initApp();
    setupNavigation();
    setupServiceWorker();
});

/**
 * Initialize the application
 */
async function initApp() {
    try {
        // Initialize database
        await ramadanDB.init();
        
        // Check if first-time user and create sample calendar
        const shouldCreateSample = await ramadanDB.shouldCreateSample();
        if (shouldCreateSample) {
            await ramadanDB.createSampleCalendar();
            showToast('Welcome! A sample calendar has been created for you. Edit or replace it with your own data.', 'info');
        }
        
        // Load screens
        renderHomeScreen();
        renderCalendarsScreen();
        renderEditorScreen();
        renderSettingsScreen();
        renderImportExportScreen();
        
        // Show default screen
        showScreen('home');
        
        // Check for missed alarms
        if (typeof checkMissedAlarms === 'function') {
            checkMissedAlarms();
        }
        
    } catch (error) {
        console.error('Failed to initialize app:', error);
        showToast('Failed to initialize app. Please refresh.', 'error');
    }
}

/**
 * Setup navigation between screens
 */
function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const screen = btn.dataset.screen;
            if (screen) {
                showScreen(screen);
            }
        });
    });
}

/**
 * Show a specific screen
 * @param {string} screenName - Name of screen to show
 */
function showScreen(screenName) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show target screen
    const targetScreen = document.getElementById(`screen-${screenName}`);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
    
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.screen === screenName) {
            btn.classList.add('active');
        }
    });
    
    app.currentScreen = screenName;
    
    // Refresh data for certain screens
    if (screenName === 'home') {
        updateHomeScreen();
    } else if (screenName === 'calendars') {
        refreshCalendarsList();
    }
}

/**
 * Render the Home screen
 */
function renderHomeScreen() {
    const container = document.getElementById('screen-home');
    container.innerHTML = `
        <div class="home-container">
            <div class="date-display">
                <h2 id="current-date">Loading...</h2>
                <p id="islamic-date">Ramadan Mubarak</p>
            </div>
            
            <div class="calendar-info" id="calendar-info">
                <p>No calendar selected</p>
                <button class="btn-primary" onclick="showScreen('calendars')">Select Calendar</button>
            </div>
            
            <div class="fasting-times hidden" id="fasting-times">
                <div class="time-card sahar">
                    <div class="time-icon">🌙</div>
                    <div class="time-label">Sahar Ends</div>
                    <div class="time-value" id="sahar-time">--:--</div>
                </div>
                
                <div class="countdown-container">
                    <div class="countdown-label" id="countdown-label">Time until Iftar</div>
                    <div class="countdown" id="countdown">00:00:00</div>
                </div>
                
                <div class="time-card iftar">
                    <div class="time-icon">🌅</div>
                    <div class="time-label">Iftar Begins</div>
                    <div class="time-value" id="iftar-time">--:--</div>
                </div>
            </div>
            
            <div class="alarm-status" id="alarm-status">
                <span class="status-indicator disabled" id="alarm-indicator"></span>
                <span id="alarm-text">Alarms disabled</span>
            </div>
        </div>
    `;
    
    // Start countdown
    updateHomeScreen();
    startCountdown();
}

/**
 * Update home screen with current data
 */
async function updateHomeScreen() {
    const now = new Date();
    
    // Update date display
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', dateOptions);
    
    // Check for active calendar
    const activeCalendar = await ramadanDB.getActiveCalendar();
    const todayData = await ramadanDB.getTodayData();
    
    const calendarInfo = document.getElementById('calendar-info');
    const fastingTimes = document.getElementById('fasting-times');
    
    if (!activeCalendar) {
        calendarInfo.classList.remove('hidden');
        fastingTimes.classList.add('hidden');
        return;
    }
    
    if (!todayData) {
        calendarInfo.innerHTML = `<p>Today's date not found in calendar "${activeCalendar.name}"</p>`;
        calendarInfo.classList.remove('hidden');
        fastingTimes.classList.add('hidden');
        return;
    }
    
    // Show fasting times
    calendarInfo.classList.add('hidden');
    fastingTimes.classList.remove('hidden');
    
    document.getElementById('sahar-time').textContent = todayData.saharTime;
    document.getElementById('iftar-time').textContent = todayData.iftarTime;
    
    // Update alarm status
    updateAlarmStatus();
}

/**
 * Start countdown timer
 */
function startCountdown() {
    if (app.countdownInterval) {
        clearInterval(app.countdownInterval);
    }
    
    app.countdownInterval = setInterval(async () => {
        const now = new Date();
        const todayData = await ramadanDB.getTodayData();
        
        if (!todayData) return;
        
        const [saharHours, saharMinutes] = todayData.saharTime.split(':').map(Number);
        const [iftarHours, iftarMinutes] = todayData.iftarTime.split(':').map(Number);
        
        const saharTime = new Date(now);
        saharTime.setHours(saharHours, saharMinutes, 0, 0);
        
        const iftarTime = new Date(now);
        iftarTime.setHours(iftarHours, iftarMinutes, 0, 0);
        
        let targetTime;
        let label;
        
        if (now < saharTime) {
            // Before sahar
            targetTime = saharTime;
            label = 'Time until Sahar ends';
        } else if (now < iftarTime) {
            // Between sahar and iftar (fasting)
            targetTime = iftarTime;
            label = 'Time until Iftar';
        } else {
            // After iftar
            label = 'Fasting complete for today';
            document.getElementById('countdown').textContent = '00:00:00';
            document.getElementById('countdown-label').textContent = label;
            return;
        }
        
        const diff = targetTime - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        document.getElementById('countdown').textContent = 
            `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        document.getElementById('countdown-label').textContent = label;
        
    }, 1000);
}

/**
 * Update alarm status display
 */
function updateAlarmStatus() {
    const settings = getAlarmSettings();
    const indicator = document.getElementById('alarm-indicator');
    const text = document.getElementById('alarm-text');
    
    if (settings.enabled) {
        indicator.classList.remove('disabled');
        indicator.classList.add('enabled');
        text.textContent = `Alarms enabled (${settings.saharMinutes}m / ${settings.iftarMinutes}m before)`;
    } else {
        indicator.classList.remove('enabled');
        indicator.classList.add('disabled');
        text.textContent = 'Alarms disabled';
    }
}

/**
 * Get alarm settings from LocalStorage
 * @returns {Object}
 */
function getAlarmSettings() {
    const defaults = {
        enabled: false,
        saharMinutes: 15,
        iftarMinutes: 15
    };
    
    try {
        const stored = localStorage.getItem('alarmSettings');
        return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch {
        return defaults;
    }
}

/**
 * Render Calendars screen
 */
function renderCalendarsScreen() {
    const container = document.getElementById('screen-calendars');
    container.innerHTML = `
        <div class="calendars-container">
            <h2>Your Calendars</h2>
            <button class="btn-primary btn-create" onclick="showEditor()">+ Create New Calendar</button>
            <div class="calendars-list" id="calendars-list">
                <p class="loading-text">Loading calendars...</p>
            </div>
        </div>
    `;
}

/**
 * Refresh the calendars list
 */
async function refreshCalendarsList() {
    const listContainer = document.getElementById('calendars-list');
    if (!listContainer) return;
    
    try {
        const calendars = await ramadanDB.getAllCalendars();
        const activeId = ramadanDB.getActiveCalendarId();
        
        if (calendars.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <p>No calendars yet</p>
                    <button class="btn-primary" onclick="showEditor()">Create Your First Calendar</button>
                </div>
            `;
            return;
        }
        
        listContainer.innerHTML = calendars.map(cal => `
            <div class="calendar-item ${cal.id === activeId ? 'active' : ''}">
                <div class="calendar-info">
                    <h3>${escapeHtml(cal.name)}</h3>
                    <p>${cal.year} • ${cal.days?.length || 0} days</p>
                </div>
                <div class="calendar-actions">
                    ${cal.id !== activeId ? 
                        `<button class="btn-icon" onclick="selectCalendar(${cal.id})" title="Make Active">✓</button>` : 
                        '<span class="active-badge">Active</span>'
                    }
                    <button class="btn-icon" onclick="editCalendar(${cal.id})" title="Edit">✎</button>
                    <button class="btn-icon" onclick="duplicateCalendar(${cal.id})" title="Duplicate">⎘</button>
                    <button class="btn-icon btn-danger" onclick="deleteCalendar(${cal.id})" title="Delete">✕</button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        listContainer.innerHTML = '<p class="error-text">Failed to load calendars</p>';
    }
}

/**
 * Select a calendar as active
 * @param {number} id - Calendar ID
 */
async function selectCalendar(id) {
    ramadanDB.setActiveCalendar(id);
    showToast('Calendar selected', 'success');
    refreshCalendarsList();
    updateHomeScreen();
}

/**
 * Edit a calendar
 * @param {number} id - Calendar ID
 */
async function editCalendar(id) {
    const calendar = await ramadanDB.getCalendar(id);
    if (calendar) {
        showEditor(calendar);
    }
}

/**
 * Duplicate a calendar
 * @param {number} id - Calendar ID
 */
async function duplicateCalendar(id) {
    try {
        await ramadanDB.duplicateCalendar(id);
        showToast('Calendar duplicated', 'success');
        refreshCalendarsList();
    } catch (error) {
        showToast('Failed to duplicate calendar', 'error');
    }
}

/**
 * Delete a calendar
 * @param {number} id - Calendar ID
 */
async function deleteCalendar(id) {
    if (!confirm('Are you sure you want to delete this calendar?')) return;
    
    try {
        await ramadanDB.deleteCalendar(id);
        showToast('Calendar deleted', 'success');
        refreshCalendarsList();
        updateHomeScreen();
    } catch (error) {
        showToast('Failed to delete calendar', 'error');
    }
}

/**
 * Render Editor screen
 */
function renderEditorScreen() {
    const container = document.getElementById('screen-editor');
    container.innerHTML = `
        <div class="editor-container">
            <h2 id="editor-title">Create Calendar</h2>
            
            <form id="calendar-form" class="calendar-form">
                <div class="form-group">
                    <label for="cal-name">Calendar Name</label>
                    <input type="text" id="cal-name" required placeholder="e.g., Ramadan 2026">
                </div>
                
                <div class="form-group">
                    <label for="cal-year">Year</label>
                    <input type="number" id="cal-year" required min="2000" max="2100" value="${new Date().getFullYear()}">
                </div>
                
                <div class="days-table-container">
                    <table class="days-table" id="days-table">
                        <thead>
                            <tr>
                                <th>Day</th>
                                <th>Date (DD-MM)</th>
                                <th>Sahar Time</th>
                                <th>Iftar Time</th>
                            </tr>
                        </thead>
                        <tbody id="days-tbody">
                            <!-- Rows generated dynamically -->
                        </tbody>
                    </table>
                </div>
                
                <div class="progress-bar">
                    <div class="progress-fill" id="progress-fill"></div>
                    <span class="progress-text" id="progress-text">0 of 30 days filled</span>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="cancelEdit()">Cancel</button>
                    <button type="submit" class="btn-primary">Save Calendar</button>
                </div>
            </form>
        </div>
    `;
    
    // Generate 30 rows
    const tbody = document.getElementById('days-tbody');
    for (let i = 1; i <= 30; i++) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${i}</td>
            <td><input type="text" class="day-date" placeholder="DD-MM" pattern="\\d{2}-\\d{2}" maxlength="5"></td>
            <td><input type="time" class="day-sahar"></td>
            <td><input type="time" class="day-iftar"></td>
        `;
        tbody.appendChild(row);
    }
    
    // Setup form submission
    document.getElementById('calendar-form').addEventListener('submit', handleCalendarSave);
    
    // Setup progress tracking
    document.querySelectorAll('#days-tbody input').forEach(input => {
        input.addEventListener('input', updateProgress);
    });
}

/**
 * Show the editor with optional calendar data
 * @param {Object} calendar - Calendar to edit (optional)
 */
function showEditor(calendar = null) {
    const form = document.getElementById('calendar-form');
    if (form) form.reset();
    
    if (calendar) {
        document.getElementById('editor-title').textContent = 'Edit Calendar';
        document.getElementById('cal-name').value = calendar.name;
        document.getElementById('cal-year').value = calendar.year;
        
        // Fill in days
        const rows = document.querySelectorAll('#days-tbody tr');
        calendar.days.forEach((day, index) => {
            if (rows[index]) {
                rows[index].querySelector('.day-date').value = day.date || '';
                rows[index].querySelector('.day-sahar').value = day.saharTime || '';
                rows[index].querySelector('.day-iftar').value = day.iftarTime || '';
            }
        });
        
        // Store editing ID
        form.dataset.editingId = calendar.id;
    } else {
        document.getElementById('editor-title').textContent = 'Create Calendar';
        delete form.dataset.editingId;
    }
    
    updateProgress();
    showScreen('editor');
}

/**
 * Cancel editing
 */
function cancelEdit() {
    if (confirm('Discard changes?')) {
        showScreen('calendars');
    }
}

/**
 * Handle calendar form submission
 * @param {Event} e - Form event
 */
async function handleCalendarSave(e) {
    e.preventDefault();
    
    const name = document.getElementById('cal-name').value.trim();
    const year = parseInt(document.getElementById('cal-year').value);
    const editingId = e.target.dataset.editingId;
    
    // Collect days data
    const days = [];
    const rows = document.querySelectorAll('#days-tbody tr');
    
    rows.forEach(row => {
        const date = row.querySelector('.day-date').value.trim();
        const saharTime = row.querySelector('.day-sahar').value;
        const iftarTime = row.querySelector('.day-iftar').value;
        
        if (date && saharTime && iftarTime) {
            days.push({ date, saharTime, iftarTime });
        }
    });
    
    if (days.length === 0) {
        showToast('Please add at least one day', 'error');
        return;
    }
    
    try {
        if (editingId) {
            await ramadanDB.updateCalendar(parseInt(editingId), { name, year, days });
            showToast('Calendar updated', 'success');
        } else {
            await ramadanDB.createCalendar({ name, year, days });
            showToast('Calendar created', 'success');
        }
        
        showScreen('calendars');
        refreshCalendarsList();
        updateHomeScreen();
    } catch (error) {
        showToast('Failed to save calendar', 'error');
    }
}

/**
 * Update progress bar
 */
function updateProgress() {
    const rows = document.querySelectorAll('#days-tbody tr');
    let filled = 0;
    
    rows.forEach(row => {
        const date = row.querySelector('.day-date').value.trim();
        const sahar = row.querySelector('.day-sahar').value;
        const iftar = row.querySelector('.day-iftar').value;
        
        if (date && sahar && iftar) {
            filled++;
        }
    });
    
    const percentage = (filled / 30) * 100;
    document.getElementById('progress-fill').style.width = `${percentage}%`;
    document.getElementById('progress-text').textContent = `${filled} of 30 days filled`;
}

/**
 * Render Settings screen
 */
function renderSettingsScreen() {
    const container = document.getElementById('screen-settings');
    const settings = getAlarmSettings();
    
    container.innerHTML = `
        <div class="settings-container">
            <h2>Settings</h2>
            
            <div class="settings-section">
                <h3>Alarm Settings</h3>
                
                <div class="setting-item">
                    <label class="toggle">
                        <input type="checkbox" id="alarm-enabled" ${settings.enabled ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                        <span class="toggle-label">Enable Alarms</span>
                    </label>
                </div>
                
                <div class="setting-item" id="alarm-options">
                    <div class="form-group">
                        <label for="sahar-minutes">Minutes before Sahar</label>
                        <input type="number" id="sahar-minutes" min="1" max="60" value="${settings.saharMinutes}">
                    </div>
                    
                    <div class="form-group">
                        <label for="iftar-minutes">Minutes before Iftar</label>
                        <input type="number" id="iftar-minutes" min="1" max="60" value="${settings.iftarMinutes}">
                    </div>
                </div>
                
                <button class="btn-primary" onclick="saveSettings()">Save Settings</button>
            </div>
            
            <div class="settings-section">
                <h3>About</h3>
                <p>RamadanReady v1.0</p>
                <p>A PWA for managing Ramadan fasting calendars</p>
                <p>Works offline • No data collection</p>
            </div>
            
            <div class="settings-section danger-zone">
                <h3>Danger Zone</h3>
                <button class="btn-danger" onclick="clearAllData()">Clear All Data</button>
            </div>
        </div>
    `;
    
    // Toggle alarm options visibility
    const alarmToggle = document.getElementById('alarm-enabled');
    const alarmOptions = document.getElementById('alarm-options');
    
    alarmToggle.addEventListener('change', () => {
        alarmOptions.style.display = alarmToggle.checked ? 'block' : 'none';
    });
    
    if (!settings.enabled) {
        alarmOptions.style.display = 'none';
    }
}

/**
 * Save settings
 */
async function saveSettings() {
    const enabled = document.getElementById('alarm-enabled').checked;
    const saharMinutes = parseInt(document.getElementById('sahar-minutes').value) || 15;
    const iftarMinutes = parseInt(document.getElementById('iftar-minutes').value) || 15;
    
    const settings = {
        enabled,
        saharMinutes: Math.max(1, Math.min(60, saharMinutes)),
        iftarMinutes: Math.max(1, Math.min(60, iftarMinutes))
    };
    
    localStorage.setItem('alarmSettings', JSON.stringify(settings));
    
    if (enabled) {
        // Request notification permission
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                showToast('Notification permission required for alarms', 'error');
                return;
            }
        }
        
        // Schedule alarms
        if (typeof scheduleAlarms === 'function') {
            scheduleAlarms();
        }
    }
    
    showToast('Settings saved', 'success');
    updateAlarmStatus();
}

/**
 * Clear all data
 */
async function clearAllData() {
    if (!confirm('WARNING: This will delete ALL calendars and settings. This cannot be undone. Continue?')) return;
    if (!confirm('Are you absolutely sure? All your data will be lost.')) return;
    
    try {
        await ramadanDB.clearAll();
        localStorage.removeItem('alarmSettings');
        showToast('All data cleared', 'success');
        showScreen('home');
        updateHomeScreen();
    } catch (error) {
        showToast('Failed to clear data', 'error');
    }
}

/**
 * Render Import/Export screen
 */
function renderImportExportScreen() {
    const container = document.getElementById('screen-import-export');
    container.innerHTML = `
        <div class="import-export-container">
            <h2>Import / Export</h2>
            
            <div class="section">
                <h3>Export Calendars</h3>
                <p>Download your calendars as JSON files to share or backup.</p>
                
                <div class="button-group">
                    <button class="btn-primary" onclick="exportActiveCalendar()">Export Active Calendar</button>
                    <button class="btn-secondary" onclick="exportAllCalendars()">Export All Calendars</button>
                </div>
            </div>
            
            <div class="section">
                <h3>Import Calendars</h3>
                <p>Import calendars from JSON files.</p>
                
                <div class="file-input-wrapper">
                    <input type="file" id="import-file" accept=".json" hidden>
                    <label for="import-file" class="btn-primary">Choose File</label>
                    <span id="file-name">No file selected</span>
                </div>
                
                <div id="import-preview" class="import-preview hidden">
                    <h4>Preview</h4>
                    <div id="preview-content"></div>
                    <button class="btn-primary" onclick="confirmImport()">Import Calendar</button>
                    <button class="btn-secondary" onclick="cancelImport()">Cancel</button>
                </div>
            </div>
            
            <div class="section info">
                <h3>How to Share</h3>
                <p>1. Export your calendar as JSON</p>
                <p>2. Share the file via WhatsApp, Email, or Bluetooth</p>
                <p>3. Recipient imports the file in their app</p>
            </div>
        </div>
    `;
    
    // Setup file input
    const fileInput = document.getElementById('import-file');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type: 'success', 'error', 'info'
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string}
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Setup service worker
 */
function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('Service Worker registered:', registration);
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    }
}