/**
 * RamadanReady - Alarm System
 * Handles scheduling and triggering of Sahar/Iftar notifications
 */

// Constants
const ALARM_STORAGE_KEY = 'nextAlarmData';
const MAX_MISSED_ALARM_AGE = 60 * 60 * 1000; // 1 hour in milliseconds

// Alarm timers
let alarmTimers = [];

/**
 * Schedule alarms based on active calendar and user settings
 */
async function scheduleAlarms() {
    // Clear existing alarms
    clearAlarms();
    
    const settings = getAlarmSettings();
    
    // If alarms disabled, don't schedule
    if (!settings.enabled) {
        clearStoredAlarmData();
        return;
    }
    
    // Get today's data
    const todayData = await ramadanDB.getTodayData();
    if (!todayData) {
        console.log('No calendar data for today, skipping alarm schedule');
        return;
    }
    
    const now = new Date();
    const calendar = await ramadanDB.getActiveCalendar();
    
    // Calculate alarm times
    const alarms = [];
    
    // Sahar alarm - reminder before
    const [saharHours, saharMinutes] = todayData.saharTime.split(':').map(Number);
    const saharTime = new Date(now);
    saharTime.setHours(saharHours, saharMinutes, 0, 0);
    const saharAlarmTime = new Date(saharTime.getTime() - settings.saharMinutes * 60000);
    
    if (saharAlarmTime > now) {
        alarms.push({
            type: 'sahar-pre',
            time: saharAlarmTime,
            eventTime: todayData.saharTime,
            message: `Sahar ends in ${settings.saharMinutes} minutes`,
            title: 'Sahar Reminder'
        });
    }
    
    // Sahar alarm - at actual time
    if (saharTime > now) {
        alarms.push({
            type: 'sahar',
            time: saharTime,
            eventTime: todayData.saharTime,
            message: 'Time for Sahar! End your meal now.',
            title: 'Sahar Time'
        });
    }
    
    // Iftar alarm - reminder before
    const [iftarHours, iftarMinutes] = todayData.iftarTime.split(':').map(Number);
    const iftarTime = new Date(now);
    iftarTime.setHours(iftarHours, iftarMinutes, 0, 0);
    const iftarAlarmTime = new Date(iftarTime.getTime() - settings.iftarMinutes * 60000);
    
    if (iftarAlarmTime > now) {
        alarms.push({
            type: 'iftar-pre',
            time: iftarAlarmTime,
            eventTime: todayData.iftarTime,
            message: `Iftar begins in ${settings.iftarMinutes} minutes`,
            title: 'Iftar Reminder'
        });
    }
    
    // Iftar alarm - at actual time
    if (iftarTime > now) {
        alarms.push({
            type: 'iftar',
            time: iftarTime,
            eventTime: todayData.iftarTime,
            message: 'Time for Iftar! Break your fast.',
            title: 'Iftar Time'
        });
    }
    
    // Schedule each alarm
    alarms.forEach(alarm => {
        const delay = alarm.time.getTime() - now.getTime();
        
        const timerId = setTimeout(() => {
            triggerAlarm(alarm);
        }, delay);
        
        alarmTimers.push(timerId);
    });
    
    // Store alarm data for missed alarm detection
    if (alarms.length > 0) {
        storeAlarmData({
            alarms: alarms.map(a => ({
                type: a.type,
                time: a.time.toISOString(),
                triggered: false
            })),
            calendarId: calendar?.id,
            date: now.toDateString()
        });
    }
    
    console.log(`Scheduled ${alarms.length} alarm(s)`);
}

/**
 * Clear all scheduled alarms
 */
function clearAlarms() {
    alarmTimers.forEach(timerId => clearTimeout(timerId));
    alarmTimers = [];
}

/**
 * Trigger an alarm
 * @param {Object} alarm - Alarm data
 */
function triggerAlarm(alarm) {
    console.log('Triggering alarm:', alarm);
    
    // Show notification
    showAlarmNotification(alarm);
    
    // Mark as triggered in storage
    const stored = getStoredAlarmData();
    if (stored) {
        const alarmEntry = stored.alarms.find(a => a.type === alarm.type);
        if (alarmEntry) {
            alarmEntry.triggered = true;
            storeAlarmData(stored);
        }
    }
    
    // Update UI
    updateAlarmStatus();
}

/**
 * Show alarm notification
 * @param {Object} alarm - Alarm data
 */
function showAlarmNotification(alarm) {
    // Try service worker notification first
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            title: alarm.title,
            body: alarm.message,
            icon: '/icons/icon-192x192.png',
            tag: alarm.type,
            requireInteraction: true
        });
    } else {
        // Fallback to regular notification
        showNotification(alarm.title, alarm.message, alarm.type);
    }
    
    // Also show in-app toast
    showToast(alarm.message, 'info');
}

/**
 * Show browser notification
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {string} tag - Notification tag
 */
async function showNotification(title, body, tag) {
    // Check permission
    if (!('Notification' in window)) {
        console.log('Notifications not supported');
        return;
    }
    
    if (Notification.permission !== 'granted') {
        console.log('Notification permission not granted');
        return;
    }
    
    try {
        const notification = new Notification(title, {
            body: body,
            icon: '/icons/icon-192x192.png',
            tag: tag,
            requireInteraction: true,
            silent: false
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
        
    } catch (error) {
        console.error('Failed to show notification:', error);
    }
}

/**
 * Check for missed alarms when app opens
 */
function checkMissedAlarms() {
    const stored = getStoredAlarmData();
    if (!stored) return;
    
    const now = new Date();
    const missedAlarms = [];
    
    stored.alarms.forEach(alarm => {
        if (alarm.triggered) return;
        
        const alarmTime = new Date(alarm.time);
        const timeDiff = now.getTime() - alarmTime.getTime();
        
        // If alarm time passed and within acceptable window (not too old)
        if (timeDiff > 0 && timeDiff < MAX_MISSED_ALARM_AGE) {
            missedAlarms.push({
                type: alarm.type,
                time: alarmTime,
                minutesAgo: Math.floor(timeDiff / 60000)
            });
            
            // Mark as triggered
            alarm.triggered = true;
        }
    });
    
    // Update storage
    storeAlarmData(stored);
    
    // Notify about missed alarms
    if (missedAlarms.length > 0) {
        const messages = missedAlarms.map(a => 
            `${a.type === 'sahar' ? 'Sahar' : 'Iftar'} alarm (${a.minutesAgo} min ago)`
        );
        
        showToast(`Missed alarms: ${messages.join(', ')}`, 'warning');
        
        // Show notification for most recent missed alarm
        const mostRecent = missedAlarms[0];
        showNotification(
            'Missed Alarm',
            `You missed the ${mostRecent.type} alarm`,
            'missed-alarm'
        );
    }
    
    // Clear old data if from previous day
    const today = new Date().toDateString();
    if (stored.date !== today) {
        clearStoredAlarmData();
    }
}

/**
 * Store alarm data in LocalStorage
 * @param {Object} data - Alarm data to store
 */
function storeAlarmData(data) {
    try {
        localStorage.setItem(ALARM_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        console.error('Failed to store alarm data:', error);
    }
}

/**
 * Get stored alarm data from LocalStorage
 * @returns {Object|null}
 */
function getStoredAlarmData() {
    try {
        const data = localStorage.getItem(ALARM_STORAGE_KEY);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Failed to get alarm data:', error);
        return null;
    }
}

/**
 * Clear stored alarm data
 */
function clearStoredAlarmData() {
    localStorage.removeItem(ALARM_STORAGE_KEY);
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
 * Request notification permission
 * @returns {Promise<boolean>}
 */
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        return false;
    }
    
    if (Notification.permission === 'granted') {
        return true;
    }
    
    if (Notification.permission === 'denied') {
        return false;
    }
    
    const permission = await Notification.requestPermission();
    return permission === 'granted';
}

/**
 * Initialize alarm system on app load
 */
function initAlarmSystem() {
    // Check for missed alarms
    checkMissedAlarms();
    
    // Schedule new alarms
    const settings = getAlarmSettings();
    if (settings.enabled) {
        scheduleAlarms();
    }
    
    // Reschedule alarms periodically (every hour) to handle day changes
    setInterval(() => {
        const currentSettings = getAlarmSettings();
        if (currentSettings.enabled) {
            scheduleAlarms();
        }
    }, 60 * 60 * 1000); // Every hour
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initAlarmSystem);