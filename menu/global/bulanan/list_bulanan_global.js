const { getUserSaldo, getHargaPaketDynamic, getKonfigurasi } = require('../../../db');
// Import hardcode paket data sebagai pengganti API dinamis untuk menghindari rate limit
const { getPaketBulananGlobal, getPaketByDisplay } = require('../../daftar-paket');

// === STATIC KEYBOARD GENERATOR UNTUK BULANAN GLOBAL ===
// Generate keyboard berdasarkan data hardcode dari daftar-paket.js (menghindari rate limit)
// UPDATE: Hanya mengambil data BULANAN GLOBAL saja (tidak termasuk bekasan)
async function generateStaticBulananGlobalKeyboard() {
  try {
    // Gunakan data BULANAN GLOBAL saja (tidak semua paket)
    const paketBulanan = getPaketBulananGlobal();
    
    if (!paketBulanan || paketBulanan.length === 0) {
      // Fallback manual jika tidak ada data bulanan
      return [
        [{ text: 'SUPERMINI', callback_data: 'bulanan_global_xla14' }],
        [{ text: 'MINI', callback_data: 'bulanan_global_xla32' }],
        [{ text: 'BIG L', callback_data: 'bulanan_global_xla39' }],
        [{ text: 'JUMBO', callback_data: 'bulanan_global_xla65' }],
        [{ text: 'JUMBO V2', callback_data: 'bulanan_global_xla51' }],
        [{ text: 'MEGABIG', callback_data: 'bulanan_global_xla89' }],
        [
          { text: 'KEMBALI', callback_data: 'akrab_global' },
          { text: 'STOK GLOBAL', callback_data: 'cek_stok_global' }
        ]
      ];
    }

    const keyboard = [];
    
    // Generate keyboard hanya untuk paket bulanan global
    paketBulanan.forEach(paket => {
      const callbackData = `bulanan_global_${paket.kode_produk.toLowerCase()}`;
      
      keyboard.push([{
        text: paket.nama_display,
        callback_data: callbackData
      }]);
    });
    
    // Tambah tombol navigasi
    keyboard.push([
      { text: 'KEMBALI', callback_data: 'akrab_global' },
      { text: 'STOK GLOBAL', callback_data: 'cek_stok_global' }
    ]);
    
    return keyboard;
  } catch (error) {
    console.error('Error generating static bulanan keyboard:', error);
    
    // Fallback manual jika ada error
    return [
      [{ text: 'SUPERMINI', callback_data: 'bulanan_global_xla14' }],
      [{ text: 'MINI', callback_data: 'bulanan_global_xla32' }],
      [{ text: 'BIG L', callback_data: 'bulanan_global_xla39' }],
      [{ text: 'JUMBO', callback_data: 'bulanan_global_xla65' }],
      [{ text: 'JUMBO V2', callback_data: 'bulanan_global_xla51' }],
      [{ text: 'MEGABIG', callback_data: 'bulanan_global_xla89' }],
      [
        { text: 'KEMBALI', callback_data: 'akrab_global' },
        { text: 'STOK GLOBAL', callback_data: 'cek_stok_global' }
      ]
    ];
  }
}

// === STATIC PRODUCT MAPPING ===
// Mapping kode produk ke nama paket berdasarkan daftar-paket.js (menghindari rate limit)
// UPDATE: Hanya mengambil data BULANAN GLOBAL saja (tidak termasuk bekasan)
async function getStaticProductMapping() {
  try {
    // Gunakan data hardcode BULANAN GLOBAL saja dari daftar-paket.js
    const paketBulanan = getPaketBulananGlobal();
    
    const mapping = {};
    paketBulanan.forEach(paket => {
      mapping[paket.kode_produk.toLowerCase()] = {
        kode: paket.kode_produk,
        nama: paket.nama_display,
        stok: 999, // Default stok tinggi karena tidak ada realtime check
        deskripsi: 'Detail kuota sesuai area coverage', // Default deskripsi
        harga: 0, // Akan diambil dari database
        kosong: false, // Default tidak kosong
        gangguan: false // Default tidak gangguan
      };
    });
    
    return mapping;
  } catch (error) {
    console.error('Error getting static product mapping:', error);
    return {};
  }
}

// Preload keyboard untuk detail paket global (dynamic)
const generateDetailPaketGlobalKeyboard = (kodeProduK) => [
  [
    { text: 'KEMBALI', callback_data: 'menu_bulanan_global' },
    { text: '✅LANJUT BELI', callback_data: `proses_bulanan_global_${kodeProduK.toLowerCase()}` }
  ]
];

// Preload template pesan untuk detail paket global (optimized - tanpa status stok)
const generateDetailPaketGlobal = async (productData) => {
  // Priority untuk harga: database berdasarkan kode produk -> fallback 'Hubungi admin'
  let hargaDisplay = 'Hubungi admin';
  let finalHarga = 0;
  
  try {
    finalHarga = await getHargaPaketDynamic(productData.kode, productData.nama?.toLowerCase());
    
    if (finalHarga > 0) {
      hargaDisplay = finalHarga.toLocaleString('id-ID');
    }
  } catch (error) {
    console.error('Error getting price from database:', error);
  }
  
  // Default deskripsi per paket bulanan global dengan detail area coverage
  const defaultDeskripsi = {
    'SUPERMINI': 'AREA 1 = 13 GB\nAREA 2 = 15 GB\nAREA 3 = 20 GB\nAREA 4 = 30 GB',
    'MINI': 'AREA 1 : 23 GB\nAREA 2 : 25 GB\nAREA 3 : 34 GB\nAREA 4 : 49 GB',
    'BIG L': 'AREA 1 : 38 GB\nAREA 2 : 40 GB\nAREA 3 : 45 GB\nAREA 4 : 55 GB',
    'JUMBO': 'AREA 1 : 66 GB\nAREA 2 : 70 GB\nAREA 3 : 83 GB\nAREA 4 : 123 GB',
    'JUMBO V2': 'AREA 1 = 50 GB\nAREA 2 = 52 GB\nAREA 3 = 57 GB\nAREA 4 = 67 GB',
    'MEGABIG': 'AREA 1 : 88 GB\nAREA 2 : 90 GB\nAREA 3 : 95 GB\nAREA 4 : 105 GB',
    'BIG PLUS': 'AREA 1 : 33 GB\nAREA 2 : 36 GB\nAREA 3 : 47 GB\nAREA 4 : 71 GB'
  };
  
  const paketName = (productData.nama || 'UNKNOWN').toUpperCase();
  // FORCE menggunakan area coverage yang baru (ignoring database deskripsi untuk sementara)
  const finalDeskripsi = defaultDeskripsi[paketName] || 'Detail kuota sesuai area coverage operator';
  
  return {
    message: `🌍 Detail BULANAN GLOBAL\n\n` +
      `📦 <b>Paket:</b> ${paketName}\n` +
      `📝 <b>Deskripsi:</b>\n${finalDeskripsi}\n\n` +
      `💰 <b>Detail Harga:</b>\n` +
      `💸 Rp. ${hargaDisplay}\n\n` +
      `📝 <b>Catatan:</b>\n` +
      `• ✅ Paket bulanan akrab global\n` +
      `• ✅ Aktif segera setelah pembelian\n` +
      `• ✅ Full garansi AKRAB GLOBAL\n` +
      `• ✅ Berlaku untuk XL,Axis,Live-on✨`,
    finalHarga: finalHarga
  };
};

// Preload template user detail (sama seperti main.js)
const generateUserDetail = (userId, username, saldo, uptime) => {
  return '💌 <b>ID</b>           : <code>' + userId + '</code>\n' +
         '💌 <b>User</b>       : <code>' + (username || '-') + '</code>\n' +
         '📧 <b>Saldo</b>     : <code>Rp. ' + saldo.toLocaleString('id-ID') + '</code>\n' +
         '⌚ <b>Uptime</b>  : <code>' + uptime + '</code>';
};

module.exports = (bot, formatUptime, BOT_START_TIME) => {
  bot.on('callback_query', async (query) => {
    const { data, message, id, from } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    if (!chatId || !msgId) return;

    try {
      // === BULANAN GLOBAL MENU ===
      if (data === 'menu_bulanan_global') {
        // Cek saldo user sebelum masuk menu bulanan global
        let saldo = 0;
        try {
          saldo = await getUserSaldo(from.id, from.username);
        } catch (e) {}

        // Ambil minimal saldo dari database (gunakan config global)
        const minSaldo = await getKonfigurasi('min_saldo_global');
        const minSaldoValue = minSaldo ? (parseInt(minSaldo) || 150000) : 150000;

        // Pop-up alert untuk penolakan akses
        if (saldo < minSaldoValue) {
          const pesanTolak = await getKonfigurasi('pesan_tolak_global') || 'Saldo tidak cukup untuk akses menu bulanan global\n\n⏤͟͟ᴍᴀʏᴜɢᴏʀᴏ';
          
          return bot.answerCallbackQuery(id, {
            text: pesanTolak,
            show_alert: true
          });
        }

        // Generate keyboard secara statis berdasarkan daftar-paket.js (menghindari rate limit)
        const keyboard = await generateStaticBulananGlobalKeyboard();

        // Ambil data user untuk ditampilkan
        const uptime = formatUptime(Date.now() - BOT_START_TIME);
        const detail = generateUserDetail(from.id, from.username, saldo, uptime);

        // Edit message dengan menu bulanan global
        await bot.editMessageCaption(detail, {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });

        await bot.answerCallbackQuery(id);
        return;
      }

      // === PILIH PAKET BULANAN GLOBAL (DYNAMIC) ===
      if (/^bulanan_global_[a-zA-Z0-9]+$/i.test(data)) {
        const kodeProduK = data.replace('bulanan_global_', '').toUpperCase();
        
        try {
          // Get product data dari mapping statis (tidak ada API call)
          const productData = await getProductByCode(kodeProduK);
          
          if (!productData) {
            return bot.answerCallbackQuery(id, {
              text: `❌ Produk dengan kode ${kodeProduK} tidak ditemukan.`,
              show_alert: true
            });
          }
          
          // TIDAK PERLU FETCH STOK UNTUK TAMPILAN DETAIL - OPTIMIZED
          // Stok akan divalidasi real-time hanya saat klik "LANJUT BELI"
          
          // Generate detail paket tanpa status stok (untuk performa)
          const detailResult = await generateDetailPaketGlobal(productData);
          const keyboard = generateDetailPaketGlobalKeyboard(kodeProduK);

          // Edit message dengan detail paket
          await bot.editMessageCaption(detailResult.message, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
          
        } catch (error) {
          console.error('Error fetching static product info:', error);
          
          return bot.answerCallbackQuery(id, {
            text: '❌ Terjadi kesalahan saat mengambil informasi produk.',
            show_alert: true
          });
        }
        
        await bot.answerCallbackQuery(id);
        return;
      }

      // === PROSES PEMBELIAN BULANAN GLOBAL (DYNAMIC) ===
      if (/^proses_bulanan_global_[a-zA-Z0-9]+$/i.test(data)) {
        const kodeProduK = data.replace('proses_bulanan_global_', '').toUpperCase();
        
        try {
          // Get product data dari mapping statis (tidak ada API call)
          const productData = await getProductByCode(kodeProduK);
          
          if (!productData) {
            return bot.answerCallbackQuery(id, {
              text: `❌ Produk dengan kode ${kodeProduK} tidak ditemukan.`,
              show_alert: true
            });
          }
          
          // Cek stok global sebelum proses
          const stokPaketBulanan = await fetchStokPaketBulanan();
          const stokCount = stokPaketBulanan[kodeProduK]?.jumlah || 0;
          
          if (stokCount === 0) {
            return bot.answerCallbackQuery(id, {
              text: `❌ Stok paket ${productData.nama || 'UNKNOWN'} habis.\n\nSilakan pilih paket lain yang masih tersedia.`,
              show_alert: true
            });
          }
          
          // Import handler bulanan global
          const handlerBulananGlobal = require('./handler_bulanan_global');
          const setStateBulananGlobal = handlerBulananGlobal.setStateBulananGlobal;
          
          // Priority untuk harga: gunakan harga dari database dinamis
          let finalHarga = productData.harga;
          try {
            finalHarga = await getHargaPaketDynamic(kodeProduK, productData.nama?.toLowerCase()) || 
                        productData.harga || 0;
          } catch (error) {
            console.error('Error getting price from database for purchase:', error);
            finalHarga = productData.harga || 0;
          }
          
          // Set state untuk handler bulanan global
          setStateBulananGlobal(chatId, {
            step: 'input_nomor_global', // Langsung ke input nomor
            kodeProduK: kodeProduK,
            namaProduK: productData.nama,
            hargaProduK: finalHarga,
            userId: from.id,
            originalMessageId: msgId,
            stokCount,
            productData // Kirim semua data produk
          });

          // Handler akan mengirim pesan input nomor sendiri
          await bot.answerCallbackQuery(id);

        } catch (err) {
          console.error('Error in proses bulanan global:', err);
          return bot.answerCallbackQuery(id, {
            text: `❌ Terjadi kesalahan saat mengecek stok global.\n\nSilakan coba lagi.`,
            show_alert: true
          });
        }
        return;
      }

    } catch (err) {
      console.error(`Error processing bulanan global callback query: ${err.message}`);
      await bot.answerCallbackQuery(id, {
        text: '❌ Terjadi kesalahan sistem',
        show_alert: true
      });
    }
  });
};

// === HELPER FUNCTIONS FOR PRODUCT DATA ===
// Function untuk mendapatkan data produk berdasarkan kode (menggunakan data statis)
async function getProductByCode(kodeProduK) {
  const mapping = await getStaticProductMapping();
  return mapping[kodeProduK.toLowerCase()] || null;
}

// Function untuk fetch stok paket bulanan (simplified - tidak ada API call)
// UPDATE: Hanya mengambil data BULANAN GLOBAL saja (tidak termasuk bekasan)
async function fetchStokPaketBulanan() {
  try {
    // Return data statis BULANAN GLOBAL saja untuk menghindari rate limit
    const paketBulanan = getPaketBulananGlobal();
    const stokMapping = {};
    
    paketBulanan.forEach(paket => {
      stokMapping[paket.kode_produk] = {
        nama: paket.nama_display,
        jumlah: 999, // Default stok tinggi
        harga: 0, // Akan diambil dari database
        deskripsi: 'Detail kuota sesuai area coverage'
      };
    });
    
    return stokMapping;
  } catch (error) {
    console.error('Error fetching static stok paket bulanan:', error);
    return {};
  }
}

// Export functions untuk digunakan di tempat lain
module.exports.fetchStokPaketBulanan = fetchStokPaketBulanan;
module.exports.getProductByCode = getProductByCode;
module.exports.getStaticProductMapping = getStaticProductMapping;
module.exports.generateStaticBulananGlobalKeyboard = generateStaticBulananGlobalKeyboard;
module.exports.generateDetailPaketGlobal = generateDetailPaketGlobal;

// === END OF STATIC BULANAN GLOBAL HANDLER ===
