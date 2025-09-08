// Handler untuk cek stok akrab menggunakan API khfy-store
// URL: https://panel.khfy-store.com/api/api-xl-v7/cek_stock_akrab
// Method: GET, Content-Type: application/json

const axios = require('axios');

// Konfigurasi API AKRAB (KHFY-STORE)
const KHFY_AKRAB_API_URL = 'https://panel.khfy-store.com/api/api-xl-v7/cek_stock_akrab';
const APIKEYG = process.env.APIKEYG;

// Function untuk fetch stok akrab dari API KHFY-STORE
async function fetchStokAkrab() {
  try {
    if (!APIKEYG) {
      throw new Error('APIKEYG tidak dikonfigurasi di .env');
    }

    console.log('🔍 Fetching stock from KHFY AKRAB API...');
    
    const response = await axios.get(KHFY_AKRAB_API_URL, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${APIKEYG}`, // Jika menggunakan Bearer token
        // Atau gunakan parameter query jika API membutuhkan token sebagai parameter
      },
      // Alternatif: gunakan params jika token dikirim sebagai query parameter
      params: {
        token: APIKEYG
      },
      timeout: 10000 // 10 detik timeout
    });

    console.log('📦 Raw API Response:', JSON.stringify(response.data, null, 2));

    if (response.data) {
      return response.data;
    } else {
      throw new Error('Response kosong dari KHFY AKRAB API');
    }

  } catch (error) {
    console.error('❌ Error fetching stok akrab:', error.message);
    if (error.response) {
      console.error('📋 Response status:', error.response.status);
      console.error('📋 Response data:', error.response.data);
    }
    throw error;
  }
}

// Function untuk format stok akrab menjadi string yang readable
function formatStokAkrab(apiResponse) {
  try {
    let formattedText = '🌍 STOK AKRAB GLOBAL\n\n';
    
    if (apiResponse && apiResponse.message) {
      // Parse message yang berisi informasi stok dalam format string
      const message = apiResponse.message;
      
      // Split berdasarkan newline dan parse setiap baris
      const lines = message.split('\\n').filter(line => line.trim());
      
      lines.forEach(line => {
        // Parse format: "(KODE) Nama Paket : jumlah"
        const match = line.match(/\(([^)]+)\)\s*([^:]+):\s*(\d+)/);
        if (match) {
          const kode = match[1].trim();
          const nama = match[2].trim();
          const stok = parseInt(match[3]);
          
          // Skip paket BPA (bekasan) dan tampilkan hanya bulanan
          if (!kode.includes('BPA')) {
            const status = stok > 0 ? stok : '❌';
            formattedText += `${nama} = ${status}\n`;
          }
        }
      });
      
      // Jika tidak ada data dari message, coba dari field data
      if (apiResponse.data && Object.keys(apiResponse.data).length > 0) {
        const data = apiResponse.data;
        
        // Mapping nama yang lebih user-friendly
        const nameMapping = {
          'xxl_rw_v2': 'Jumbo V2',
          'xl_rw': 'Big',
          'xl_no_rw': 'Mini', 
          'xl_only_v2': 'SuperMini',
          'xl_rw_mega': 'MegaBig',
          'xl_big_plus': 'Big Plus',
          'xxl_rw': 'Jumbo'
        };
        
        Object.keys(data).forEach(key => {
          const value = data[key];
          const nama = nameMapping[key] || key;
          
          if (value && value !== "" && value !== "0") {
            formattedText += `${nama} = ${value}\n`;
          }
        });
      }
    }
    
    formattedText += '\n✅ Tekan OK untuk keluar';
    return formattedText;
    
  } catch (error) {
    console.error('❌ Error formatting stok akrab:', error.message);
    return '❌ Error memformat data stok\n\n✅ Tekan OK untuk keluar';
  }
}

// Function untuk parse stok akrab menjadi object (untuk keperluan internal)
function parseStokAkrab(apiResponse) {
  const stokData = {};
  
  try {
    if (Array.isArray(apiResponse)) {
      apiResponse.forEach(item => {
        const kode = item.kode || item.code || item.id;
        const nama = item.nama || item.name || item.paket;
        const jumlah = item.stok || item.stock || item.jumlah || item.available || 0;
        
        if (kode) {
          stokData[kode] = {
            nama: nama,
            jumlah: parseInt(jumlah) || 0
          };
        }
      });
    } else if (apiResponse.data && Array.isArray(apiResponse.data)) {
      apiResponse.data.forEach(item => {
        const kode = item.kode || item.code || item.id;
        const nama = item.nama || item.name || item.paket;
        const jumlah = item.stok || item.stock || item.jumlah || item.available || 0;
        
        if (kode) {
          stokData[kode] = {
            nama: nama,
            jumlah: parseInt(jumlah) || 0
          };
        }
      });
    }

    return stokData;
  } catch (error) {
    console.error('❌ Error parsing stok akrab:', error.message);
    return {};
  }
}

// Bot handler function
function initBotHandlers(bot) {
  bot.on('callback_query', async (query) => {
    const { data, id } = query;

    // === CEK STOK AKRAB GLOBAL ===
    if (data === 'cek_stok_akrab') {
      try {
        const stokResponse = await fetchStokAkrab();
        const formattedStok = formatStokAkrab(stokResponse);

        await bot.answerCallbackQuery(id, {
          text: formattedStok,
          show_alert: true
        });

      } catch (err) {
        console.error('Error cek stok akrab:', err);
        await bot.answerCallbackQuery(id, {
          text: '❌ Error mengambil data stok akrab: ' + err.message,
          show_alert: true
        });
      }
    }
  });
}

// Export functions dan bot handler
module.exports = initBotHandlers;
module.exports.fetchStokAkrab = fetchStokAkrab;
module.exports.formatStokAkrab = formatStokAkrab;
module.exports.parseStokAkrab = parseStokAkrab;
