/**
 * Utility functions untuk handling tanggal dan waktu dengan timezone Jakarta (UTC+7)
 * Digunakan untuk konsistensi timezone di seluruh aplikasi bot
 */

// ===== TIMEZONE UTILITIES =====

/**
 * Mendapatkan waktu saat ini dalam timezone Jakarta (UTC+7)
 * @returns {Date} Date object dengan waktu Jakarta
 */
const getJakartaTime = () => {
  const now = new Date();
  // Convert to Jakarta timezone (UTC+7)
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const jakartaTime = new Date(utc + (7 * 3600000));
  return jakartaTime;
};

/**
 * Membuat Date object dengan timezone Jakarta
 * @param {number} year - Tahun
 * @param {number} month - Bulan (0-based, seperti JavaScript Date)
 * @param {number} date - Tanggal
 * @param {number} hours - Jam (default: 0)
 * @param {number} minutes - Menit (default: 0) 
 * @param {number} seconds - Detik (default: 0)
 * @returns {Date} Date object Jakarta timezone
 */
const createJakartaDate = (year, month, date, hours = 0, minutes = 0, seconds = 0) => {
  // Create date in Jakarta timezone
  const localDate = new Date(year, month, date, hours, minutes, seconds);
  return localDate;
};

/**
 * Format tanggal/waktu ke string dengan timezone Jakarta
 * @param {Date} date - Date object (default: waktu sekarang)
 * @param {Object} options - Format options
 * @returns {string} Formatted date string
 */
const formatJakartaTime = (date = null, options = {}) => {
  const targetDate = date || getJakartaTime();
  
  const defaultOptions = {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  };
  
  const formatOptions = { ...defaultOptions, ...options };
  
  return targetDate.toLocaleString('id-ID', formatOptions);
};

// ===== DATE CALCULATION UTILITIES =====

/**
 * Menghitung selisih hari antara dua tanggal dengan timezone Jakarta
 * @param {Date|string} targetDate - Tanggal target
 * @param {Date} referenceDate - Tanggal referensi (default: hari ini)
 * @returns {number} Selisih hari (positif = masa depan, negatif = masa lalu)
 */
const calculateDaysDiff = (targetDate, referenceDate = null) => {
  // Handle special cases
  if (!targetDate || targetDate === 'Tidak tersedia') {
    return NaN;
  }
  
  const refDate = referenceDate || getJakartaTime();
  
  let target;
  if (typeof targetDate === 'string') {
    // Parse string format YYYY-MM-DD
    const [year, month, day] = targetDate.split('-');
    target = createJakartaDate(parseInt(year), parseInt(month) - 1, parseInt(day));
  } else {
    target = new Date(targetDate);
  }
  
  // Validate target date
  if (isNaN(target.getTime())) {
    return NaN;
  }
  
  // Set time to start/end of day for accurate comparison
  refDate.setHours(0, 0, 0, 0);           // Start of reference day
  target.setHours(23, 59, 59, 999);       // End of target day
  
  const diffTime = target - refDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

/**
 * Format selisih hari ke string yang user-friendly
 * @param {number} diffDays - Selisih hari dari calculateDaysDiff
 * @returns {string} String deskriptif
 */
const formatDaysDiff = (diffDays) => {
  if (diffDays > 0) {
    return `${diffDays} Hari lagi`;
  } else if (diffDays === 0) {
    return 'Hari ini';
  } else {
    return 'Sudah habis';
  }
};

/**
 * Format selisih hari untuk package expiry (dengan emoji)
 * @param {number} diffDays - Selisih hari
 * @returns {string} String dengan emoji
 */
const formatPackageExpiry = (diffDays) => {
  if (diffDays > 0) {
    return `(⚡${diffDays} HARI)`;
  } else if (diffDays === 0) {
    return '(⚡HARI INI)';
  } else {
    return '(⚡EXPIRED)';
  }
};

// ===== DATE PARSING UTILITIES =====

/**
 * Parse tanggal dari berbagai format ke Date object Jakarta
 * @param {string} dateString - String tanggal dalam format YYYY-MM-DD
 * @returns {Date|null} Date object atau null jika invalid
 */
const parseToJakartaDate = (dateString) => {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }
  
  try {
    const [year, month, day] = dateString.split('-');
    if (!year || !month || !day) {
      return null;
    }
    
    return createJakartaDate(parseInt(year), parseInt(month) - 1, parseInt(day));
  } catch (error) {
    return null;
  }
};

/**
 * Format Date object ke string DD/MM/YYYY
 * @param {Date} date - Date object
 * @returns {string} String format DD/MM/YYYY
 */
const formatToDDMMYYYY = (date) => {
  if (!date || !(date instanceof Date)) {
    return '';
  }
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
};

// ===== TIMESTAMP UTILITIES =====

/**
 * Generate timestamp untuk logging dengan format Indonesia
 * @returns {string} Timestamp string format: DD/MM/YYYY HH:MM:SS
 */
const getLogTimestamp = () => {
  return formatJakartaTime(null, {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).replace(',', '');
};

/**
 * Generate timestamp untuk dompul "Last Update"
 * @returns {string} Timestamp format: YYYY-MM-DD HH:MM:SS
 */
const getDompulTimestamp = () => {
  const now = getJakartaTime();
  return now.toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace('T', ' ');
};

// ===== EXPORTS =====

module.exports = {
  // Core timezone functions
  getJakartaTime,
  createJakartaDate,
  formatJakartaTime,
  
  // Date calculation
  calculateDaysDiff,
  formatDaysDiff,
  formatPackageExpiry,
  
  // Date parsing
  parseToJakartaDate,
  formatToDDMMYYYY,
  
  // Timestamps
  getLogTimestamp,
  getDompulTimestamp
};
