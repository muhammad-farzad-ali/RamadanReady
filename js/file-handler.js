/**
 * RamadanReady - File Handler
 * Handles import/export of calendar JSON files
 */

// Store pending import data
let pendingImportData = null;

/**
 * Export the active calendar as JSON
 */
async function exportActiveCalendar() {
    try {
        const calendar = await ramadanDB.getActiveCalendar();
        
        if (!calendar) {
            showToast('No active calendar to export', 'error');
            return;
        }
        
        exportCalendar(calendar);
    } catch (error) {
        console.error('Export error:', error);
        showToast('Failed to export calendar', 'error');
    }
}

/**
 * Export all calendars as JSON
 */
async function exportAllCalendars() {
    try {
        const calendars = await ramadanDB.getAllCalendars();
        
        if (calendars.length === 0) {
            showToast('No calendars to export', 'error');
            return;
        }
        
        const exportData = {
            exportDate: new Date().toISOString(),
            appVersion: '1.0',
            calendars: calendars
        };
        
        downloadJson(exportData, 'ramadan-calendars-all.json');
        showToast(`Exported ${calendars.length} calendars`, 'success');
    } catch (error) {
        console.error('Export error:', error);
        showToast('Failed to export calendars', 'error');
    }
}

/**
 * Export a single calendar
 * @param {Object} calendar - Calendar to export
 */
function exportCalendar(calendar) {
    // Create clean export object (remove internal ID)
    const exportData = {
        name: calendar.name,
        year: calendar.year,
        days: calendar.days,
        exportedAt: new Date().toISOString(),
        appVersion: '1.0'
    };
    
    const filename = `ramadan-calendar-${calendar.year}-${sanitizeFilename(calendar.name)}.json`;
    downloadJson(exportData, filename);
    showToast(`Exported: ${calendar.name}`, 'success');
}

/**
 * Download JSON data as file
 * @param {Object} data - Data to download
 * @param {string} filename - Filename for download
 */
function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Cleanup
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Handle file selection for import
 * @param {Event} event - File input change event
 */
async function handleFileSelect(event) {
    const file = event.target.files[0];
    
    if (!file) return;
    
    // Update file name display
    document.getElementById('file-name').textContent = file.name;
    
    try {
        const text = await readFile(file);
        const data = JSON.parse(text);
        
        // Validate the data
        const validation = validateImportData(data);
        
        if (!validation.valid) {
            showToast(validation.error, 'error');
            pendingImportData = null;
            hideImportPreview();
            return;
        }
        
        pendingImportData = data;
        showImportPreview(data, validation.type);
        
    } catch (error) {
        console.error('Import error:', error);
        showToast('Failed to read file: ' + error.message, 'error');
        pendingImportData = null;
        hideImportPreview();
    }
    
    // Reset file input
    event.target.value = '';
}

/**
 * Read file content
 * @param {File} file - File to read
 * @returns {Promise<string>}
 */
function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Failed to read file'));
        
        reader.readAsText(file);
    });
}

/**
 * Validate import data structure
 * @param {Object} data - Data to validate
 * @returns {Object} - Validation result
 */
function validateImportData(data) {
    // Check if it's a multi-calendar export
    if (data.calendars && Array.isArray(data.calendars)) {
        if (data.calendars.length === 0) {
            return { valid: false, error: 'No calendars found in file' };
        }
        
        for (let i = 0; i < data.calendars.length; i++) {
            const calValidation = validateSingleCalendar(data.calendars[i], i + 1);
            if (!calValidation.valid) {
                return calValidation;
            }
        }
        
        return { valid: true, type: 'multiple', count: data.calendars.length };
    }
    
    // Single calendar
    return validateSingleCalendar(data);
}

/**
 * Validate a single calendar object
 * @param {Object} calendar - Calendar to validate
 * @param {number} index - Calendar index (for error messages)
 * @returns {Object} - Validation result
 */
function validateSingleCalendar(calendar, index = null) {
    const prefix = index ? `Calendar ${index}: ` : '';
    
    // Check required fields
    if (!calendar.name || typeof calendar.name !== 'string') {
        return { valid: false, error: `${prefix}Missing or invalid calendar name` };
    }
    
    if (!calendar.year || typeof calendar.year !== 'number') {
        return { valid: false, error: `${prefix}Missing or invalid year` };
    }
    
    if (!Array.isArray(calendar.days)) {
        return { valid: false, error: `${prefix}Missing days array` };
    }
    
    if (calendar.days.length !== 29 && calendar.days.length !== 30) {
        return { valid: false, error: `${prefix}Invalid day count: expected 29 or 30, got ${calendar.days.length}` };
    }
    
    // Validate each day
    const dates = new Set();
    
    for (let i = 0; i < calendar.days.length; i++) {
        const day = calendar.days[i];
        const dayPrefix = `${prefix}Day ${i + 1}: `;
        
        // Check required day fields
        if (!day.date || typeof day.date !== 'string') {
            return { valid: false, error: `${dayPrefix}Missing date` };
        }
        
        if (!day.saharTime || typeof day.saharTime !== 'string') {
            return { valid: false, error: `${dayPrefix}Missing Sahar time` };
        }
        
        if (!day.iftarTime || typeof day.iftarTime !== 'string') {
            return { valid: false, error: `${dayPrefix}Missing Iftar time` };
        }
        
        // Validate date format (DD-MM)
        if (!isValidDate(day.date)) {
            return { valid: false, error: `${dayPrefix}Invalid date format: ${day.date}. Use DD-MM` };
        }
        
        // Validate time formats (HH:MM)
        if (!isValidTime(day.saharTime)) {
            return { valid: false, error: `${dayPrefix}Invalid Sahar time: ${day.saharTime}. Use HH:MM (24-hour)` };
        }
        
        if (!isValidTime(day.iftarTime)) {
            return { valid: false, error: `${dayPrefix}Invalid Iftar time: ${day.iftarTime}. Use HH:MM (24-hour)` };
        }
        
        // Check for duplicate dates
        if (dates.has(day.date)) {
            return { valid: false, error: `${dayPrefix}Duplicate date: ${day.date}` };
        }
        dates.add(day.date);
    }
    
    return { valid: true, type: 'single', count: 1 };
}

/**
 * Validate date format (DD-MM)
 * @param {string} dateStr - Date string to validate
 * @returns {boolean}
 */
function isValidDate(dateStr) {
    const regex = /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])$/;
    if (!regex.test(dateStr)) return false;
    
    const [day, month] = dateStr.split('-').map(Number);
    
    // Basic validation (doesn't account for month lengths perfectly)
    return day >= 1 && day <= 31 && month >= 1 && month <= 12;
}

/**
 * Validate time format (HH:MM)
 * @param {string} timeStr - Time string to validate
 * @returns {boolean}
 */
function isValidTime(timeStr) {
    const regex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!regex.test(timeStr)) return false;
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * Show import preview
 * @param {Object} data - Import data
 * @param {string} type - Import type ('single' or 'multiple')
 */
function showImportPreview(data, type) {
    const previewContainer = document.getElementById('import-preview');
    const previewContent = document.getElementById('preview-content');
    
    let html = '';
    
    if (type === 'multiple') {
        html = `
            <p><strong>${data.calendars.length} calendars found:</strong></p>
            <ul>
                ${data.calendars.map(cal => `
                    <li>${escapeHtml(cal.name)} (${cal.year}) - ${cal.days.length} days</li>
                `).join('')}
            </ul>
        `;
    } else {
        html = `
            <p><strong>Calendar:</strong> ${escapeHtml(data.name)}</p>
            <p><strong>Year:</strong> ${data.year}</p>
            <p><strong>Days:</strong> ${data.days.length}</p>
        `;
    }
    
    previewContent.innerHTML = html;
    previewContainer.classList.remove('hidden');
}

/**
 * Hide import preview
 */
function hideImportPreview() {
    const previewContainer = document.getElementById('import-preview');
    const fileName = document.getElementById('file-name');
    
    if (previewContainer) previewContainer.classList.add('hidden');
    if (fileName) fileName.textContent = 'No file selected';
}

/**
 * Cancel import
 */
function cancelImport() {
    pendingImportData = null;
    hideImportPreview();
}

/**
 * Confirm and execute import
 */
async function confirmImport() {
    if (!pendingImportData) {
        showToast('No data to import', 'error');
        return;
    }
    
    try {
        let importCount = 0;
        
        if (pendingImportData.calendars && Array.isArray(pendingImportData.calendars)) {
            // Multiple calendars
            for (const calendar of pendingImportData.calendars) {
                await importSingleCalendar(calendar);
                importCount++;
            }
        } else {
            // Single calendar
            await importSingleCalendar(pendingImportData);
            importCount++;
        }
        
        showToast(`Imported ${importCount} calendar(s)`, 'success');
        pendingImportData = null;
        hideImportPreview();
        
        // Refresh calendars list if on that screen
        refreshCalendarsList();
        
    } catch (error) {
        console.error('Import error:', error);
        showToast('Failed to import: ' + error.message, 'error');
    }
}

/**
 * Import a single calendar
 * @param {Object} calendarData - Calendar data to import
 */
async function importSingleCalendar(calendarData) {
    // Check for name conflict
    const existing = await ramadanDB.getAllCalendars();
    let name = calendarData.name;
    
    const existingNames = existing.map(cal => cal.name);
    let counter = 1;
    while (existingNames.includes(name)) {
        name = `${calendarData.name} (Imported ${counter})`;
        counter++;
    }
    
    // Create the calendar
    const newCalendar = {
        name: name,
        year: calendarData.year,
        days: calendarData.days.map(day => ({
            date: day.date,
            saharTime: day.saharTime,
            iftarTime: day.iftarTime
        }))
    };
    
    await ramadanDB.createCalendar(newCalendar);
}

/**
 * Share calendar using Web Share API
 * @param {number} calendarId - Calendar ID to share
 */
async function shareCalendar(calendarId) {
    try {
        const calendar = await ramadanDB.getCalendar(calendarId);
        
        if (!calendar) {
            showToast('Calendar not found', 'error');
            return;
        }
        
        // Create export data
        const exportData = {
            name: calendar.name,
            year: calendar.year,
            days: calendar.days,
            exportedAt: new Date().toISOString(),
            appVersion: '1.0'
        };
        
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const file = new File([blob], `ramadan-calendar-${calendar.year}-${sanitizeFilename(calendar.name)}.json`, { type: 'application/json' });
        
        // Check for Web Share API support
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: `Ramadan Calendar: ${calendar.name}`,
                text: `Ramadan fasting calendar for ${calendar.year}`,
                files: [file]
            });
            showToast('Calendar shared', 'success');
        } else {
            // Fallback: download the file
            downloadJson(exportData, file.name);
            showToast('File downloaded. Share it manually.', 'info');
        }
        
    } catch (error) {
        console.error('Share error:', error);
        
        // If user cancelled, don't show error
        if (error.name === 'AbortError') return;
        
        showToast('Failed to share calendar', 'error');
    }
}

/**
 * Sanitize filename
 * @param {string} name - Name to sanitize
 * @returns {string}
 */
function sanitizeFilename(name) {
    return name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
}