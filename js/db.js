/**
 * RamadanReady - IndexedDB Data Layer
 * Handles all calendar storage and retrieval operations
 */

class RamadanDB {
    constructor() {
        this.dbName = 'RamadanReadyDB';
        this.dbVersion = 1;
        this.db = null;
        this.STORE_NAME = 'calendars';
        this.ACTIVE_KEY = 'activeCalendarId';
    }

    /**
     * Initialize the database connection
     * @returns {Promise<IDBDatabase>}
     */
    async init() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create calendars object store
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('name', 'name', { unique: false });
                    store.createIndex('year', 'year', { unique: false });
                    store.createIndex('updatedAt', 'updatedAt', { unique: false });
                }
            };
        });
    }

    /**
     * Create a new calendar
     * @param {Object} calendarData - Calendar data
     * @returns {Promise<number>} - ID of created calendar
     */
    async createCalendar(calendarData) {
        await this.init();
        
        const calendar = {
            name: calendarData.name,
            year: calendarData.year,
            days: calendarData.days || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.add(calendar);

            request.onsuccess = () => {
                const id = request.result;
                // Set as active if it's the first calendar
                this.getAllCalendars().then(calendars => {
                    if (calendars.length === 1) {
                        this.setActiveCalendar(id);
                    }
                });
                resolve(id);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get a calendar by ID
     * @param {number} id - Calendar ID
     * @returns {Promise<Object|null>}
     */
    async getCalendar(id) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all calendars
     * @returns {Promise<Array>}
     */
    async getAllCalendars() {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update a calendar
     * @param {number} id - Calendar ID
     * @param {Object} updates - Updated fields
     * @returns {Promise<void>}
     */
    async updateCalendar(id, updates) {
        await this.init();

        const calendar = await this.getCalendar(id);
        if (!calendar) throw new Error('Calendar not found');

        const updated = {
            ...calendar,
            ...updates,
            id: id, // Ensure ID is preserved
            updatedAt: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.put(updated);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete a calendar
     * @param {number} id - Calendar ID
     * @returns {Promise<void>}
     */
    async deleteCalendar(id) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => {
                // If deleted calendar was active, clear active
                const activeId = this.getActiveCalendarId();
                if (activeId === id) {
                    localStorage.removeItem(this.ACTIVE_KEY);
                }
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Duplicate a calendar
     * @param {number} id - Calendar ID to duplicate
     * @returns {Promise<number>} - ID of new calendar
     */
    async duplicateCalendar(id) {
        const calendar = await this.getCalendar(id);
        if (!calendar) throw new Error('Calendar not found');

        const duplicate = {
            name: `${calendar.name} (Copy)`,
            year: calendar.year,
            days: [...calendar.days],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        return this.createCalendar(duplicate);
    }

    /**
     * Set the active calendar ID
     * @param {number} id - Calendar ID
     */
    setActiveCalendar(id) {
        localStorage.setItem(this.ACTIVE_KEY, id.toString());
    }

    /**
     * Get the active calendar ID
     * @returns {number|null}
     */
    getActiveCalendarId() {
        const id = localStorage.getItem(this.ACTIVE_KEY);
        return id ? parseInt(id, 10) : null;
    }

    /**
     * Get the active calendar object
     * @returns {Promise<Object|null>}
     */
    async getActiveCalendar() {
        const id = this.getActiveCalendarId();
        if (!id) return null;
        return this.getCalendar(id);
    }

    /**
     * Check if a calendar is complete (has all required data)
     * @param {Object} calendar - Calendar object
     * @returns {boolean}
     */
    isCalendarComplete(calendar) {
        if (!calendar) return false;
        if (!calendar.name || !calendar.year) return false;
        if (!Array.isArray(calendar.days)) return false;
        if (calendar.days.length !== 29 && calendar.days.length !== 30) return false;
        
        // Check each day has required fields
        return calendar.days.every(day => 
            day.date && day.saharTime && day.iftarTime
        );
    }

    /**
     * Get today's fasting data from active calendar
     * @returns {Promise<Object|null>} - Today's day data or null
     */
    async getTodayData() {
        const calendar = await this.getActiveCalendar();
        if (!calendar || !calendar.days) return null;

        const today = new Date();
        const todayStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        
        return calendar.days.find(day => day.date === todayStr) || null;
    }

    /**
     * Create sample calendar for new users
     * @returns {Promise<number>} - ID of created sample calendar
     */
    async createSampleCalendar() {
        const currentYear = new Date().getFullYear();
        
        // Generate sample 30-day calendar with realistic times
        const days = [];
        const baseSaharHour = 5;
        const baseSaharMinute = 30;
        const baseIftarHour = 18;
        const baseIftarMinute = 30;
        
        for (let i = 1; i <= 30; i++) {
            // Vary times slightly for realism (Sahar gets earlier, Iftar gets later)
            const dayOffset = i - 1;
            const saharMinute = (baseSaharMinute - dayOffset) % 60;
            const saharHour = baseSaharHour + Math.floor((baseSaharMinute - dayOffset) / 60);
            const iftarMinute = (baseIftarMinute + dayOffset) % 60;
            const iftarHour = baseIftarHour + Math.floor((baseIftarMinute + dayOffset) / 60);
            
            // Calculate date (assuming Ramadan starts March 1st for demo)
            const dayOfMonth = i;
            const month = 3; // March
            
            days.push({
                date: `${String(dayOfMonth).padStart(2, '0')}-${String(month).padStart(2, '0')}`,
                saharTime: `${String(saharHour).padStart(2, '0')}:${String(Math.abs(saharMinute)).padStart(2, '0')}`,
                iftarTime: `${String(iftarHour).padStart(2, '0')}:${String(iftarMinute).padStart(2, '0')}`
            });
        }
        
        const sampleCalendar = {
            name: 'Sample Calendar (Example Data)',
            year: currentYear,
            days: days,
            isSample: true
        };
        
        return this.createCalendar(sampleCalendar);
    }

    /**
     * Check if we should create a sample calendar (first time user)
     * @returns {Promise<boolean>}
     */
    async shouldCreateSample() {
        const calendars = await this.getAllCalendars();
        return calendars.length === 0;
    }

    /**
     * Clear all data (for testing/debugging)
     * @returns {Promise<void>}
     */
    async clearAll() {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => {
                localStorage.removeItem(this.ACTIVE_KEY);
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }
}

// Create global instance
const ramadanDB = new RamadanDB();