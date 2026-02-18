/**
 * RamadanReady - Alarm Web Worker
 * Runs in background to check and trigger alarms
 */

const ALARM_CHECK_INTERVAL = 60000; // Check every minute
let alarmSettings = null;
let nextAlarmTime = null;

// Load alarm settings from localStorage (via messages from main thread)
self.onmessage = function(event) {
    if (event.data && event.data.type === 'UPDATE_SETTINGS') {
        alarmSettings = event.data.settings;
        nextAlarmTime = event.data.nextAlarmTime;
        console.log('[Alarm Worker] Settings updated:', alarmSettings);
    }
    
    if (event.data && event.data.type === 'CHECK_NOW') {
        checkAlarms();
    }
};

function checkAlarms() {
    if (!alarmSettings || !alarmSettings.enabled) {
        return;
    }
    
    const now = new Date();
    
    // Check if we should trigger an alarm
    if (nextAlarmTime && nextAlarmTime !== 'none') {
        const alarmDate = new Date(nextAlarmTime);
        const timeDiff = alarmDate.getTime() - now.getTime();
        
        // If alarm time has passed (within last 2 minutes) and not yet triggered
        if (timeDiff <= 0 && timeDiff > -120000) {
            // Trigger notification
            self.postMessage({
                type: 'TRIGGER_ALARM',
                alarmType: alarmSettings.nextAlarmType,
                message: alarmSettings.nextAlarmMessage,
                title: alarmSettings.nextAlarmTitle
            });
            
            nextAlarmTime = 'none';
        }
    }
}

// Check alarms periodically
setInterval(checkAlarms, ALARM_CHECK_INTERVAL);

// Initial check
checkAlarms();

console.log('[Alarm Worker] Started');
