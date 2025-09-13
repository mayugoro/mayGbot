// Daftar paket hardcode untuk produk global
// Mapping display name ke kode produk untuk sistem AKRAB GLOBAL
// Digunakan sebagai alternatif dari sistem API dinamis

const PAKET_GLOBAL = {
  // Mapping berdasarkan display name ke kode produk (BAGIAN BULANAN GLOBAL)
  'SUPERMINI': {
    kode_produk: 'XLA14',
    nama_display: 'SUPERMINI',
    kategori: 'bulanan_global'
  },
  'MINI': {
    kode_produk: 'XLA32', 
    nama_display: 'MINI',
    kategori: 'bulanan_global'
  },
  'BIG L': {
    kode_produk: 'XLA39',
    nama_display: 'BIG L', 
    kategori: 'bulanan_global'
  },
  'JUMBO': {
    kode_produk: 'XLA65',
    nama_display: 'JUMBO',
    kategori: 'bulanan_global'
  },
  'JUMBO V2': {
    kode_produk: 'XLA51',
    nama_display: 'JUMBO V2',
    kategori: 'bulanan_global'
  },
  'MEGABIG': {
    kode_produk: 'XLA89',
    nama_display: 'MEGABIG',
    kategori: 'bulanan_global'
  },
  'BIG PLUS': {
    kode_produk: 'XX',
    nama_display: 'BIG PLUS',
    kategori: 'bulanan_global'
  },

  // Mapping berdasarkan display name ke kode produk (BAGIAN BEKASAN GLOBAL)
  // BEKASAN GLOBAL L
  'L 3H': {
    kode_produk: 'BPAL3',
    nama_display: 'L 3H',
    kategori: 'bekasan_global',
    tipe: 'l',
    durasi: '3'
  },
  'L 5H': {
    kode_produk: 'BPAL5',
    nama_display: 'L 5H',
    kategori: 'bekasan_global',
    tipe: 'l',
    durasi: '5'
  },
  'L 7H': {
    kode_produk: 'BPAL7',
    nama_display: 'L 7H',
    kategori: 'bekasan_global',
    tipe: 'l',
    durasi: '7'
  },
  'L 9H': {
    kode_produk: 'BPAL9',
    nama_display: 'L 9H',
    kategori: 'bekasan_global',
    tipe: 'l',
    durasi: '9'
  },
  'L 11H': {
    kode_produk: 'BPAL11',
    nama_display: 'L 11H',
    kategori: 'bekasan_global',
    tipe: 'l',
    durasi: '11'
  },
  'L 13H': {
    kode_produk: 'BPAL13',
    nama_display: 'L 13H',
    kategori: 'bekasan_global',
    tipe: 'l',
    durasi: '13'
  },
  'L 15H': {
    kode_produk: 'BPAL15',
    nama_display: 'L 15H',
    kategori: 'bekasan_global',
    tipe: 'l',
    durasi: '15'
  },
  'L 17H': {
    kode_produk: 'BPAL17',
    nama_display: 'L 17H',
    kategori: 'bekasan_global',
    tipe: 'l',
    durasi: '17'
  },
  'L 19H': {
    kode_produk: 'BPAL19',
    nama_display: 'L 19H',
    kategori: 'bekasan_global',
    tipe: 'l',
    durasi: '19'
  },

  // BEKASAN GLOBAL XL
  'XL 3H': {
    kode_produk: 'BPAXL3',
    nama_display: 'XL 3H',
    kategori: 'bekasan_global',
    tipe: 'xl',
    durasi: '3'
  },
  'XL 5H': {
    kode_produk: 'BPAXL5',
    nama_display: 'XL 5H',
    kategori: 'bekasan_global',
    tipe: 'xl',
    durasi: '5'
  },
  'XL 7H': {
    kode_produk: 'BPAXL7',
    nama_display: 'XL 7H',
    kategori: 'bekasan_global',
    tipe: 'xl',
    durasi: '7'
  },
  'XL 9H': {
    kode_produk: 'BPAXL9',
    nama_display: 'XL 9H',
    kategori: 'bekasan_global',
    tipe: 'xl',
    durasi: '9'
  },
  'XL 11H': {
    kode_produk: 'BPAXL11',
    nama_display: 'XL 11H',
    kategori: 'bekasan_global',
    tipe: 'xl',
    durasi: '11'
  },
  'XL 13H': {
    kode_produk: 'BPAXL13',
    nama_display: 'XL 13H',
    kategori: 'bekasan_global',
    tipe: 'xl',
    durasi: '13'
  },
  'XL 15H': {
    kode_produk: 'BPAXL15',
    nama_display: 'XL 15H',
    kategori: 'bekasan_global',
    tipe: 'xl',
    durasi: '15'
  },
  'XL 17H': {
    kode_produk: 'BPAXL17',
    nama_display: 'XL 17H',
    kategori: 'bekasan_global',
    tipe: 'xl',
    durasi: '17'
  },
  'XL 19H': {
    kode_produk: 'BPAXL19',
    nama_display: 'XL 19H',
    kategori: 'bekasan_global',
    tipe: 'xl',
    durasi: '19'
  },

  // BEKASAN GLOBAL XXL
  'XXL 3H': {
    kode_produk: 'BPAXXL3',
    nama_display: 'XXL 3H',
    kategori: 'bekasan_global',
    tipe: 'xxl',
    durasi: '3'
  },
  'XXL 5H': {
    kode_produk: 'BPAXXL5',
    nama_display: 'XXL 5H',
    kategori: 'bekasan_global',
    tipe: 'xxl',
    durasi: '5'
  },
  'XXL 7H': {
    kode_produk: 'BPAXXL7',
    nama_display: 'XXL 7H',
    kategori: 'bekasan_global',
    tipe: 'xxl',
    durasi: '7'
  },
  'XXL 9H': {
    kode_produk: 'BPAXXL9',
    nama_display: 'XXL 9H',
    kategori: 'bekasan_global',
    tipe: 'xxl',
    durasi: '9'
  },
  'XXL 11H': {
    kode_produk: 'BPAXXL11',
    nama_display: 'XXL 11H',
    kategori: 'bekasan_global',
    tipe: 'xxl',
    durasi: '11'
  },
  'XXL 13H': {
    kode_produk: 'BPAXXL13',
    nama_display: 'XXL 13H',
    kategori: 'bekasan_global',
    tipe: 'xxl',
    durasi: '13'
  },
  'XXL 15H': {
    kode_produk: 'BPAXXL15',
    nama_display: 'XXL 15H',
    kategori: 'bekasan_global',
    tipe: 'xxl',
    durasi: '15'
  },
  'XXL 17H': {
    kode_produk: 'BPAXXL17',
    nama_display: 'XXL 17H',
    kategori: 'bekasan_global',
    tipe: 'xxl',
    durasi: '17'
  },
  'XXL 19H': {
    kode_produk: 'BPAXXL19',
    nama_display: 'XXL 19H',
    kategori: 'bekasan_global',
    tipe: 'xxl',
    durasi: '19'
  }
};

// Mapping terbalik dari kode produk ke display name
const KODE_TO_DISPLAY = {};
Object.keys(PAKET_GLOBAL).forEach(display => {
  const paket = PAKET_GLOBAL[display];
  KODE_TO_DISPLAY[paket.kode_produk] = display;
});

// Mapping untuk callback data (lowercase, no spaces)
const CALLBACK_MAPPING = {};
Object.keys(PAKET_GLOBAL).forEach(display => {
  const paket = PAKET_GLOBAL[display];
  const callbackKey = display.toLowerCase().replace(/\s+/g, '_');
  CALLBACK_MAPPING[callbackKey] = paket;
});

/**
 * Mendapatkan data paket berdasarkan display name
 * @param {string} displayName - Nama display paket (contoh: 'SUPERMINI', 'BIG L')
 * @returns {object|null} - Data paket atau null jika tidak ditemukan
 */
function getPaketByDisplay(displayName) {
  return PAKET_GLOBAL[displayName.toUpperCase()] || null;
}

/**
 * Mendapatkan display name berdasarkan kode produk
 * @param {string} kodeProduk - Kode produk (contoh: 'XLA14', 'XLA32')
 * @returns {string|null} - Display name atau null jika tidak ditemukan
 */
function getDisplayByKode(kodeProduk) {
  return KODE_TO_DISPLAY[kodeProduk.toUpperCase()] || null;
}

/**
 * Mendapatkan data paket berdasarkan callback data
 * @param {string} callbackData - Callback data (contoh: 'supermini', 'big_l')
 * @returns {object|null} - Data paket atau null jika tidak ditemukan
 */
function getPaketByCallback(callbackData) {
  return CALLBACK_MAPPING[callbackData.toLowerCase()] || null;
}

/**
 * Mendapatkan semua paket dalam format array
 * @returns {array} - Array berisi semua data paket
 */
function getAllPaket() {
  return Object.keys(PAKET_GLOBAL).map(display => ({
    display_name: display,
    ...PAKET_GLOBAL[display]
  }));
}

/**
 * Generate inline keyboard untuk Telegram Bot
 * @returns {array} - Array keyboard untuk Telegram Bot
 */
function generatePaketKeyboard() {
  const keyboard = [];
  
  Object.keys(PAKET_GLOBAL).forEach(display => {
    const paket = PAKET_GLOBAL[display];
    const callbackData = `bulanan_global_${paket.kode_produk.toLowerCase()}`;
    
    keyboard.push([{
      text: display,
      callback_data: callbackData
    }]);
  });
  
  // Tambah tombol navigasi
  keyboard.push([
    { text: 'KEMBALI', callback_data: 'akrab_global' },
    { text: 'STOK GLOBAL', callback_data: 'cek_stok_global' }
  ]);
  
  return keyboard;
}

/**
 * Validasi apakah kode produk valid
 * @param {string} kodeProduk - Kode produk yang akan divalidasi
 * @returns {boolean} - True jika valid, false jika tidak
 */
function isValidKodeProduk(kodeProduk) {
  return Object.values(PAKET_GLOBAL).some(paket => 
    paket.kode_produk.toLowerCase() === kodeProduk.toLowerCase()
  );
}

/**
 * Mendapatkan daftar semua kode produk
 * @returns {array} - Array berisi semua kode produk
 */
function getAllKodeProduk() {
  return Object.values(PAKET_GLOBAL).map(paket => paket.kode_produk);
}

/**
 * Mendapatkan paket bekasan global berdasarkan tipe
 * @param {string} tipe - Tipe bekasan (l, xl, xxl)
 * @returns {array} - Array berisi paket bekasan sesuai tipe
 */
function getPaketBekasanByTipe(tipe) {
  return Object.values(PAKET_GLOBAL).filter(paket => 
    paket.kategori === 'bekasan_global' && paket.tipe === tipe.toLowerCase()
  );
}

/**
 * Mendapatkan paket bekasan berdasarkan kode produk (format BPAL/BPAXL/BPAXXL + durasi)
 * @param {string} kodeProduk - Kode produk bekasan (contoh: 'BPAL3', 'BPAXL5')
 * @returns {object|null} - Data paket atau null jika tidak ditemukan
 */
function getPaketBekasanByKode(kodeProduk) {
  return Object.values(PAKET_GLOBAL).find(paket => 
    paket.kode_produk.toLowerCase() === kodeProduk.toLowerCase()
  ) || null;
}

/**
 * Generate keyboard untuk bekasan global berdasarkan tipe
 * @param {string} tipe - Tipe bekasan (l, xl, xxl)
 * @returns {array} - Array keyboard untuk Telegram Bot
 */
function generateBekasanKeyboard(tipe) {
  const keyboard = [];
  const paketBekasan = getPaketBekasanByTipe(tipe);
  
  // Sort berdasarkan durasi
  paketBekasan.sort((a, b) => parseInt(a.durasi) - parseInt(b.durasi));
  
  paketBekasan.forEach(paket => {
    const callbackData = `bekasan_global_${tipe.toLowerCase()}_${paket.durasi}`;
    
    keyboard.push([{
      text: `${paket.durasi} HARI`,
      callback_data: callbackData
    }]);
  });
  
  // Tambah tombol kembali
  keyboard.push([
    { text: 'KEMBALI', callback_data: 'menu_bekasan_global' }
  ]);
  
  return keyboard;
}

/**
 * Mendapatkan semua paket bulanan global saja
 * @returns {array} - Array berisi paket bulanan global
 */
function getPaketBulananGlobal() {
  return Object.values(PAKET_GLOBAL).filter(paket => 
    paket.kategori === 'bulanan_global'
  );
}

/**
 * Mendapatkan semua paket bekasan global saja
 * @returns {array} - Array berisi paket bekasan global
 */
function getPaketBekasanGlobal() {
  return Object.values(PAKET_GLOBAL).filter(paket => 
    paket.kategori === 'bekasan_global'
  );
}

/**
 * Validasi apakah kode produk bekasan valid
 * @param {string} kodeProduk - Kode produk bekasan yang akan divalidasi
 * @returns {boolean} - True jika valid, false jika tidak
 */
function isValidKodeBekasan(kodeProduk) {
  return getPaketBekasanGlobal().some(paket => 
    paket.kode_produk.toLowerCase() === kodeProduk.toLowerCase()
  );
}

// Export semua functions dan data
module.exports = {
  PAKET_GLOBAL,
  KODE_TO_DISPLAY,
  CALLBACK_MAPPING,
  getPaketByDisplay,
  getDisplayByKode,
  getPaketByCallback,
  getAllPaket,
  generatePaketKeyboard,
  isValidKodeProduk,
  getAllKodeProduk,
  // Functions untuk bekasan global
  getPaketBekasanByTipe,
  getPaketBekasanByKode,
  generateBekasanKeyboard,
  getPaketBulananGlobal,
  getPaketBekasanGlobal,
  isValidKodeBekasan
};

// Test function untuk debugging (hanya jalan jika file dijalankan langsung)
if (require.main === module) {
  console.log('🧪 Testing daftar-paket.js...\n');
  
  console.log('📦 Semua Paket:');
  console.log(`Total: ${getAllPaket().length} paket`);
  
  console.log('\n� Paket Bulanan Global:');
  console.log(getPaketBulananGlobal());
  
  console.log('\n📦 Paket Bekasan Global:');
  console.log(`Total: ${getPaketBekasanGlobal().length} paket bekasan`);
  
  console.log('\n�🔍 Test getPaketByDisplay("SUPERMINI"):');
  console.log(getPaketByDisplay('SUPERMINI'));
  
  console.log('\n🔍 Test getDisplayByKode("XLA32"):');
  console.log(getDisplayByKode('XLA32'));
  
  console.log('\n🔍 Test getPaketBekasanByKode("BPAL7"):');
  console.log(getPaketBekasanByKode('BPAL7'));
  
  console.log('\n🔍 Test getPaketBekasanByTipe("l"):');
  console.log(getPaketBekasanByTipe('l'));
  
  console.log('\n⌨️ Generated Keyboard (Bulanan):');
  console.log(JSON.stringify(generatePaketKeyboard(), null, 2));
  
  console.log('\n⌨️ Generated Keyboard (Bekasan L):');
  console.log(JSON.stringify(generateBekasanKeyboard('l'), null, 2));
  
  console.log('\n✅ Test completed!');
}
