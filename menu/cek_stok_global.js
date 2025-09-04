// Handler untuk cek stok global
// Berinteraksi dengan API AKRAB GLOBAL untuk mendapatkan stok akrab
// Hanya menampilkan paket bulanan (non-BPA)

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

    // === CEK STOK BULANAN GLOBAL ===
    if (data === 'cek_stok_global') {
      try {
        // Fetch stok dari API
        const stokString = await fetchStokGlobal();
        const stokData = parseStokGlobal(stokString);
        
        // Hanya tampilkan paket bulanan (BUKAN mengandung BPA)
        let info = '🌍 STOK BULANAN GLOBAL\n\n';
        
        // Filter hanya paket bulanan (non-BPA)
        const paketBulanan = {};
        Object.keys(stokData).forEach(kode => {
          if (!kode.includes('BPA')) {
            paketBulanan[kode] = stokData[kode];
          }
        });

        // Tampilkan detail paket bulanan
        const bulananKeys = Object.keys(paketBulanan);
        if (bulananKeys.length > 0) {
          bulananKeys.forEach(kode => {
            const stok = paketBulanan[kode];
            const nama = stok.nama.trim();
            info += `${nama} = ${stok.jumlah === 0 ? '-' : stok.jumlah}\n`;
          });
        } else {
          info += 'Tidak ada paket bulanan tersedia\n';
        }

        info += '\n✅ Tekan OK untuk keluar';

        await bot.answerCallbackQuery(id, {
          text: info,
          show_alert: true
        });

      } catch (err) {
        console.error('Error cek stok global:', err);
        await bot.answerCallbackQuery(id, {
          text: '❌ Gagal mengambil stok global.\n\nPesan error: ' + err.message,
          show_alert: true
        });
      }
    }
  });
};

// Export functions untuk digunakan di file lain
module.exports.fetchStokGlobal = fetchStokGlobal;
module.exports.parseStokGlobal = parseStokGlobal;