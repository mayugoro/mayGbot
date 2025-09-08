// Handler untuk cek stok global
// Berinteraksi dengan API KHFY-STORE untuk mendapatkan stok akrab global
// Handler untuk stok bulanan (non-BPA) dengan dynamic button generation

const axios = require('axios');

// Konfigurasi API Global (KHFY-STORE AKRAB - Real Stock)
const KHFY_API_URL = 'https://panel.khfy-store.com/api/api-xl-v7/cek_stock_akrab';
const APIKEYG = process.env.APIKEYG;

// Function untuk fetch stok akrab global dari API KHFY-STORE (real stock)
async function fetchStokGlobal() {
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
      timeout: 10000 // 10 detik timeout
    });

    if (response.data && response.data.status) {
      // Konversi dari format akrab API ke format legacy string untuk backward compatibility
      return convertAkrabToLegacyFormat(response.data);
    } else {
      throw new Error('Format response tidak sesuai dari KHFY AKRAB API');
    }

  } catch (error) {
    console.error('❌ Error fetching stok global:', error.message);
    throw error;
  }
}

// Function untuk konversi response KHFY AKRAB ke format legacy string
function convertAkrabToLegacyFormat(apiResponse) {
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
          // Format: "(KODE) Nama Produk : stok"
          const formattedLine = `(${kode}) ${nama} : ${stok}`;
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
      return convertAkrabMessageToArray(response.data.message);
    } else {
      throw new Error('Format response tidak sesuai dari KHFY AKRAB API');
    }

  } catch (error) {
    console.error('❌ Error fetching raw stok data:', error.message);
    throw error;
  }
}

// Function untuk convert message akrab ke array format (untuk compatibility dengan sistem existing)
function convertAkrabMessageToArray(message) {
  const products = [];
  
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
        products.push({
          kode_produk: kode,
          nama_produk: nama,
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
        const nama = match[2].trim();
        const jumlah = parseInt(match[3]) || 0;
        
        stokData[kode] = {
          nama: nama,
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
        
        // Filter hanya paket bulanan (non-BPA)
        Object.keys(stokData).forEach(kode => {
          if (!kode.includes('BPA')) {
            const stok = stokData[kode];
            const nama = stok.nama.replace(/\s+/g, ' ').trim();
            info += `${nama} = ${stok.jumlah === 0 ? '-' : stok.jumlah}\n`;
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