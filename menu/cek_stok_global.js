// Handler untuk cek stok global
// Berinteraksi dengan API AKRAB GLOBAL untuk mendapatkan stok akrab
// Handler untuk stok bulanan (non-BPA) dan backup redirect message

const axios = require('axios');

// Konfigurasi API Global
const APIG_LISTPRODUK = process.env.APIG_LISTPRODUK;

// Function untuk fetch stok akrab global dari API
async function fetchStokGlobal() {
  try {
    if (!APIG_LISTPRODUK) {
      throw new Error('APIG_LISTPRODUK tidak dikonfigurasi di .env');
    }

    const response = await axios.get(APIG_LISTPRODUK, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 detik timeout
    });

    if (response.data && response.data.status && response.data.message) {
      return response.data.message; // String dengan format stok
    } else {
      throw new Error('Format response tidak sesuai');
    }

  } catch (error) {
    console.error('❌ Error fetching stok global:', error.message);
    throw error;
  }
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