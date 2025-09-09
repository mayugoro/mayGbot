/**
 * Ekstrak dan normalisasi nomor telepon dari teks yang mengandung simbol/teks lain
 * @param {string} text - Teks yang mungkin mengandung nomor telepon
 * @returns {string[]} - Array nomor telepon yang sudah dinormalisasi dan valid
 */
const extractAndNormalizePhones = (text) => {
  if (!text || typeof text !== 'string') return [];
  
  // Regex untuk mendeteksi nomor 9-16 digit di mana saja dalam teks
  const numberMatches = text.match(/\d{9,16}/g);
  
  if (!numberMatches) return [];
  
  const validNumbers = [];
  
  for (const match of numberMatches) {
    // Normalize nomor menggunakan fungsi yang ada
    const normalizedNumber = normalizePhoneNumber(match);
    
    // Validasi dan tambahkan jika valid
    if (normalizedNumber && isValidIndonesianPhone(normalizedNumber)) {
      validNumbers.push(normalizedNumber);
    }
  }
  
  return validNumbers;
};

/**
 * Ekstrak nomor telepon dari multiple lines dengan simbol/teks
 * @param {string} text - Teks multi-line yang mungkin mengandung nomor telepon
 * @returns {string[]} - Array nomor telepon unik yang sudah dinormalisasi dan valid
 */
const extractPhonesFromMultilineText = (text) => {
  if (!text || typeof text !== 'string') return [];
  
  // Split by lines dan filter empty lines
  const lines = text.split(/\n|\r/).map(line => line.trim()).filter(line => line);
  const allNumbers = [];
  
  for (const line of lines) {
    const numbersFromLine = extractAndNormalizePhones(line);
    allNumbers.push(...numbersFromLine);
  }
  
  // Remove duplicates menggunakan Set
  return [...new Set(allNumbers)];
};

/**
 * Normalisasi nomor telepon ke format 08xxxxxxxxxx
 * @param {string} nomor - Nomor telepon input
 * @returns {string} - Nomor dalam format 08xxxxxxxxxx atau null jika invalid
 */
const normalizePhoneNumber = (nomor) => {
  if (!nomor || typeof nomor !== 'string') return null;
  
  // Hapus semua karakter non-digit
  const cleanNumber = nomor.replace(/\D/g, '');
  
  // Cek berbagai format dan konversi ke 08
  if (cleanNumber.startsWith('628')) {
    // Format 628xxxxxxxxx -> 08xxxxxxxxx
    return '0' + cleanNumber.substring(2);
  } else if (cleanNumber.startsWith('62')) {
    // Format 62xxxxxxxxx -> 08xxxxxxxxx (jika ada yang input tanpa 8 di depan)
    return '08' + cleanNumber.substring(2);
  } else if (cleanNumber.startsWith('08')) {
    // Sudah format 08xxxxxxxxx
    return cleanNumber;
  } else if (cleanNumber.startsWith('8') && cleanNumber.length >= 10) {
    // Format 8xxxxxxxxx -> 08xxxxxxxxx
    return '0' + cleanNumber;
  }
  
  // Format tidak dikenali
  return null;
};

/**
 * Validasi nomor telepon format Indonesia
 * @param {string} nomor - Nomor telepon yang sudah dinormalisasi
 * @returns {boolean} - True jika valid
 */
const isValidIndonesianPhone = (nomor) => {
  if (!nomor) return false;
  
  // Harus dimulai dengan 08 dan panjang 10-15 digit
  const phoneRegex = /^08\d{8,13}$/;
  return phoneRegex.test(nomor);
};

/**
 * Konversi nomor telepon ke format lokal 08 untuk tampilan logger
 * @param {string} nomor - Nomor telepon dalam berbagai format
 * @returns {string} - Nomor dalam format 08xxxxxxxxx untuk display logger
 */
const formatForLogger = (nomor) => {
  if (!nomor || typeof nomor !== 'string') return nomor;
  
  // Hapus semua karakter non-digit
  const cleanNumber = nomor.replace(/\D/g, '');
  
  // Jika format 628xxxxxxxxx, ubah ke 08xxxxxxxxx
  if (cleanNumber.startsWith('628')) {
    return '0' + cleanNumber.substring(2);
  }
  // Jika format 62xxxxxxxxx (tanpa 8), ubah ke 08xxxxxxxxx
  else if (cleanNumber.startsWith('62') && !cleanNumber.startsWith('628')) {
    return '08' + cleanNumber.substring(2);
  }
  // Jika sudah format 08xxxxxxxxx, kembalikan as is
  else if (cleanNumber.startsWith('08')) {
    return cleanNumber;
  }
  // Jika format 8xxxxxxxxx (tanpa 0), tambah 0 di depan
  else if (cleanNumber.startsWith('8') && cleanNumber.length >= 10) {
    return '0' + cleanNumber;
  }
  
  // Format lain kembalikan as is
  return nomor;
};

module.exports = {
  normalizePhoneNumber,
  isValidIndonesianPhone,
  formatForLogger,
  extractAndNormalizePhones,
  extractPhonesFromMultilineText
};
