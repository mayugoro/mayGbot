// Handler untuk cek stok global
// Berinteraksi dengan API KHFY-STORE untuk mendapatkan stok akrab global
// Handler untuk stok bulanan (non-BPA) dengan dynamic button generation
// UPDATE: Menggunakan data hardcode dari daftar-paket.js untuk konsistensi nama produk

const axios = require('axios');
// Import hardcode paket data untuk konsistensi nama produk
const { getPaketBulananGlobal, getDisplayByKode } = require('./daftar-paket');

// Konfigurasi API Global (KHFY-STORE AKRAB - Real Stock)
const KHFY_API_URL = 'https://panel.khfy-store.com/api/api-xl-v7/cek_stock_akrab';
const LIST_PRODUCT_URL = 'https://panel.khfy-store.com/api_v2/list_product?provider=KUBER&token=' + process.env.APIKEYG;
const APIKEYG = process.env.APIKEYG;

// Function untuk fetch stok akrab global dari API KHFY-STORE (real stock)
async function fetchStokGlobal() {
  try {
    if (!APIKEYG) {
      throw new Error('APIKEYG tidak dikonfigurasi di .env');
    }

    // Fetch nama dari list_product API untuk konsistensi
    const listProductResponse = await axios.get(LIST_PRODUCT_URL);
    const productNames = {};
    if (listProductResponse.data && listProductResponse.data.data) {
      listProductResponse.data.data.forEach(product => {
        productNames[product.kode_produk] = product.nama_produk.toUpperCase();
      });
    }

    const response = await axios.get(KHFY_API_URL, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      params: {
        token: APIKEYG
      },
      timeout: 10000 // 10 detik timeout
    });

    if (response.data && response.data.status) {
      // Konversi dari format akrab API ke format legacy string untuk backward compatibility
      return convertAkrabToLegacyFormat(response.data, productNames);
    } else {
      throw new Error('Format response tidak sesuai dari KHFY AKRAB API');
    }

  } catch (error) {
    console.error('❌ Error fetching stok global:', error.message);
    throw error;
  }
}

// Function untuk konversi response KHFY AKRAB ke format legacy string
function convertAkrabToLegacyFormat(apiResponse, productNames = {}) {
  const lines = [];
  
  if (apiResponse && apiResponse.message) {
    const message = apiResponse.message;
    
    // Split dengan pattern yang lebih akurat - cari pattern "( space"
    const messageLines = message.split(/ \(/g).filter(line => line.trim());
    
    messageLines.forEach((line, index) => {
      // Add back "(" for lines after the first
      const processLine = index === 0 ? line : (line.startsWith('(') ? line : '(' + line);
      
      // Parse format: "(KODE) Nama Paket : jumlah"
      const match = processLine.match(/\(([^)]+)\)\s*([^:]+):\s*(\d+)/);
      if (match) {
        const kode = match[1].trim();
        const nama = match[2].trim();
        const stok = parseInt(match[3]);
        
        // Skip paket BPA (bekasan) - hanya ambil bulanan
        if (!kode.includes('BPA')) {
          // Gunakan nama dari list_product API untuk konsistensi dengan display
          const consistentName = productNames[kode] || nama.toUpperCase();
          // Format: "(KODE) Nama Produk : stok"
          const formattedLine = `(${kode}) ${consistentName} : ${stok}`;
          lines.push(formattedLine);
        }
      }
    });
  }

  return lines.join('\n');
}

// Function untuk fetch data mentah dari KHFY AKRAB API (untuk dynamic generation)
async function fetchRawStokData() {
  try {
    if (!APIKEYG) {
      throw new Error('APIKEYG tidak dikonfigurasi di .env');
    }

    const response = await axios.get(KHFY_API_URL, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      params: {
        token: APIKEYG
      },
      timeout: 10000
    });

    if (response.data && response.data.status && response.data.message) {
      // Convert akrab message format ke array format untuk compatibility
      return await convertAkrabMessageToArray(response.data.message);
    } else {
      throw new Error('Format response tidak sesuai dari KHFY AKRAB API');
    }

  } catch (error) {
    console.error('❌ Error fetching raw stok data:', error.message);
    throw error;
  }
}

// Function untuk convert message akrab ke array format (untuk compatibility dengan sistem existing)
async function convertAkrabMessageToArray(message) {
  const products = [];
  
  // Fetch nama dari list_product API untuk konsistensi
  let productNames = {};
  try {
    const listProductResponse = await axios.get(LIST_PRODUCT_URL);
    if (listProductResponse.data && listProductResponse.data.data) {
      listProductResponse.data.data.forEach(product => {
        productNames[product.kode_produk] = product.nama_produk.toUpperCase();
      });
    }
  } catch (error) {
    console.error('Warning: Could not fetch product names from list_product API');
  }
  
  // Split dengan pattern yang lebih akurat - cari pattern "( space"
  const lines = message.split(/ \(/g).filter(line => line.trim());
  
  // Process first line as is, others need "(" prefix added back
  lines.forEach((line, index) => {
    // Add back "(" for lines after the first (except if already starts with "(")
    const processLine = index === 0 ? line : (line.startsWith('(') ? line : '(' + line);
    
    // Parse format: "(KODE) Nama Paket : jumlah"
    const match = processLine.match(/\(([^)]+)\)\s*([^:]+):\s*(\d+)/);
    if (match) {
      const kode = match[1].trim();
      const nama = match[2].trim();
      const stok = parseInt(match[3]);
      
      // Skip paket BPA (bekasan) - hanya ambil bulanan
      if (!kode.includes('BPA')) {
        // Gunakan nama dari list_product API untuk konsistensi
        const displayName = productNames[kode] || nama.toUpperCase();
        // Gunakan nama dari list_product API untuk konsistensi
        const consistentDisplayName = productNames[kode] || nama.toUpperCase();
        products.push({
          kode_produk: kode,
          nama_produk: consistentDisplayName,
          kosong: stok === 0 ? 1 : 0,  // Convert stok ke format boolean untuk compatibility
          gangguan: 0,  // Selalu 0 karena data akrab sudah filtered
          stok: stok,   // Tambahkan field stok riil
          harga_final: 0 // Placeholder
        });
      }
    }
  });
  
  return products;
}

// Function untuk parse string stok menjadi object
// UPDATE: Menggunakan data hardcode dari daftar-paket.js untuk konsistensi nama produk
function parseStokGlobal(stokString) {
  const stokData = {};
  
  try {
    // Split berdasarkan newline dan parse setiap baris
    const lines = stokString.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      // Format: "(KODE) Nama paket : jumlah_stok"
      // Atau: "(KODE) Nama paket dengan spasi : jumlah_stok"
      const match = line.match(/\(([^)]+)\)\s*([^:]+?):\s*(\d+)/);
      if (match) {
        const kode = match[1].trim();
        const namaAPI = match[2].trim();
        const jumlah = parseInt(match[3]) || 0;
        
        // Gunakan nama dari daftar-paket.js jika tersedia, fallback ke nama API
        const namaDisplay = getDisplayByKode(kode) || namaAPI.toUpperCase();
        
        stokData[kode] = {
          nama: namaDisplay,
          nama_api: namaAPI.toUpperCase(), // Simpan nama original dari API
          jumlah: jumlah
        };
      }
    });

    return stokData;
  } catch (error) {
    console.error('❌ Error parsing stok:', error.message);
    return {};
  }
}

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id } = query;

    // === CEK STOK BULANAN GLOBAL (NON-BPA) ===
    if (data === 'cek_stok_global') {
      try {
        const stokString = await fetchStokGlobal();
        const stokData = parseStokGlobal(stokString);
        
        let info = '🌍 STOK BULANAN GLOBAL\n\n';
        
        // Ambil daftar paket bulanan dari daftar-paket.js untuk urutan konsisten
        const paketBulanan = getPaketBulananGlobal();
        
        // Tampilkan berdasarkan urutan dari daftar-paket.js (HANYA NAMA DISPLAY)
        paketBulanan.forEach(paket => {
          const kode = paket.kode_produk;
          const namaDisplay = paket.nama_display;
          
          if (stokData[kode]) {
            const stok = stokData[kode];
            const jumlahStok = stok.jumlah === 0 ? '-' : stok.jumlah;
            // HANYA tampilkan nama display tanpa kode produk
            info += `${namaDisplay} = ${jumlahStok}\n`;
          } else {
            // Jika tidak ada di API, tampilkan sebagai tidak tersedia
            info += `${namaDisplay} = -\n`;
          }
        });
        
        // Tambahkan produk dari API yang tidak ada di daftar-paket.js (fallback)
        Object.keys(stokData).forEach(kode => {
          if (!kode.includes('BPA')) { // Skip bekasan
            const isInPaketList = paketBulanan.some(p => p.kode_produk === kode);
            if (!isInPaketList) {
              const stok = stokData[kode];
              const namaDisplay = stok.nama || kode;
              const jumlahStok = stok.jumlah === 0 ? '-' : stok.jumlah;
              // HANYA tampilkan nama display tanpa kode produk
              info += `${namaDisplay} = ${jumlahStok}\n`;
            }
          }
        });

        info += '\n✅ Tekan OK untuk keluar';

        await bot.answerCallbackQuery(id, {
          text: info,
          show_alert: true
        });

      } catch (err) {
        console.error('Error cek stok bulanan global:', err);
        await bot.answerCallbackQuery(id, {
          text: '❌ Error: ' + err.message,
          show_alert: true
        });
      }
    }

    // === CEK STOK BEKASAN GLOBAL (BPA) ===
    if (data === 'cek_stok_bekasan_global') {
      try {
        const stokString = await fetchStokGlobal();
        const stokData = parseStokGlobal(stokString);
        
        let info = '🌍 STOK BEKASAN GLOBAL\n\n';
        
        // Ambil daftar paket bekasan dari daftar-paket.js untuk urutan konsisten
        const { getPaketBekasanGlobal } = require('./daftar-paket');
        const allPaketBekasan = getPaketBekasanGlobal();
        
        // Tampilkan berdasarkan urutan dari daftar-paket.js (HANYA NAMA DISPLAY)
        allPaketBekasan.forEach(paket => {
          const kode = paket.kode_produk;
          const namaDisplay = paket.nama_display;
          
          if (stokData[kode]) {
            const stok = stokData[kode];
            const jumlahStok = stok.jumlah === 0 ? '-' : stok.jumlah;
            // HANYA tampilkan nama display tanpa kode produk
            info += `${namaDisplay} = ${jumlahStok}\n`;
          } else {
            // Jika tidak ada di API, tampilkan sebagai tidak tersedia
            info += `${namaDisplay} = -\n`;
          }
        });
        
        // Tambahkan produk BPA dari API yang tidak ada di daftar-paket.js (fallback)
        Object.keys(stokData).forEach(kode => {
          if (kode.includes('BPA')) {
            const isInPaketList = allPaketBekasan.some(p => p.kode_produk === kode);
            if (!isInPaketList) {
              const stok = stokData[kode];
              const namaDisplay = stok.nama || kode;
              const jumlahStok = stok.jumlah === 0 ? '-' : stok.jumlah;
              // HANYA tampilkan nama display tanpa kode produk
              info += `${namaDisplay} = ${jumlahStok}\n`;
            }
          }
        });

        info += '\n✅ Tekan OK untuk keluar';

        await bot.answerCallbackQuery(id, {
          text: info,
          show_alert: true
        });

      } catch (err) {
        console.error('Error cek stok bekasan global:', err);
        await bot.answerCallbackQuery(id, {
          text: '❌ Error: ' + err.message,
          show_alert: true
        });
      }
    }

    // === REDIRECT MESSAGE (BACKUP) ===
    if (data === 'cek_stok_bekasan_global_redirect') {
      await bot.answerCallbackQuery(id, {
        text: '🌍 BEKASAN GLOBAL\n\nMasuk submenu bekasan untuk melihat stok per tipe (L/XL/XXL).\n\n✅ OK',
        show_alert: true
      });
    }
  });
};

// Export functions untuk digunakan di file lain
module.exports.fetchStokGlobal = fetchStokGlobal;
module.exports.parseStokGlobal = parseStokGlobal;
module.exports.fetchRawStokData = fetchRawStokData; // New: untuk dynamic generation