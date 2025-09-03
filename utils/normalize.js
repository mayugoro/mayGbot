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

module.exports = {
  normalizePhoneNumber,
  isValidIndonesianPhone
};
