const { getUserSaldo, getHargaPaketDynamic, getKonfigurasi } = require('../../../db');

// === DYNAMIC KEYBOARD GENERATOR UNTUK BULANAN GLOBAL ===
// Generate keyboard berdasarkan response API secara dinamis
async function generateDynamicBulananGlobalKeyboard() {
  try {
    const { fetchRawStokData } = require('../../cek_stok_global');
    const rawData = await fetchRawStokData();
    
    // Filter hanya paket bulanan (non-BPA) yang tersedia
    const availablePackages = rawData.filter(product => 
      !product.kode_produk.includes('BPA') && 
      product.kosong === 0 && 
      product.gangguan === 0
    );
    
    // Generate keyboard buttons dinamis
    const keyboard = [];
    
    availablePackages.forEach(product => {
      // Normalize nama produk untuk callback_data (huruf kecil, tanpa spasi)
      const callbackData = `bulanan_global_${product.kode_produk.toLowerCase()}`;
      
      keyboard.push([{
        text: product.nama_produk.toUpperCase(),
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
    console.error('Error generating dynamic keyboard:', error);
    
    // Fallback ke keyboard static jika API gagal
    return [
      [{ text: 'API ERROR - MAINTENANCE', callback_data: 'maintenance' }],
      [
        { text: 'KEMBALI', callback_data: 'akrab_global' },
        { text: 'STOK GLOBAL', callback_data: 'cek_stok_global' }
      ]
    ];
  }
}

// === DYNAMIC PRODUCT MAPPING ===
// Mapping kode produk ke nama paket berdasarkan API response
async function getDynamicProductMapping() {
  try {
    const { fetchRawStokData } = require('../../cek_stok_global');
    const rawData = await fetchRawStokData();
    
    const mapping = {};
    rawData.forEach(product => {
      // Map kode produk ke data lengkap
      mapping[product.kode_produk.toLowerCase()] = {
        kode: product.kode_produk,
        nama: product.nama_produk,
        available: (product.kosong === 0 && product.gangguan === 0),
        deskripsi: product.deskripsi || '',
        harga: product.harga_final || 0
      };
    });
    
    return mapping;
  } catch (error) {
    console.error('Error getting dynamic product mapping:', error);
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

// Preload template pesan untuk detail paket global (dynamic)
const generateDetailPaketGlobal = async (productData, stokCount = 0) => {
  const statusStok = stokCount > 0 ? `✅ Tersedia` : '❌ Habis';
  
  // Priority untuk harga: database berdasarkan kode produk -> API harga -> fallback 'Hubungi admin'
  let hargaDisplay = 'Hubungi admin';
  let finalHarga = 0;
  
  try {
    // Gunakan fungsi database dinamis untuk cek harga berdasarkan kode produk
    // console.log(`🔍 Checking price for product: ${productData.kode}, fallback: ${productData.nama?.toLowerCase()}`);
    finalHarga = await getHargaPaketDynamic(productData.kode, productData.nama?.toLowerCase());
    // console.log(`💰 Database price result: ${finalHarga}`);
    
    if (finalHarga > 0) {
      hargaDisplay = finalHarga.toLocaleString('id-ID');
      // console.log(`✅ Using database price: ${hargaDisplay}`);
    } else if (productData.harga > 0) {
      finalHarga = productData.harga;
      hargaDisplay = productData.harga.toLocaleString('id-ID');
      // console.log(`🔄 Using API price: ${hargaDisplay}`);
    }
  } catch (error) {
    console.error('Error getting price from database:', error);
    if (productData.harga > 0) {
      finalHarga = productData.harga;
      hargaDisplay = productData.harga.toLocaleString('id-ID');
    }
  }
  
  return {
    message: `🌍 <b>Detail BULANAN GLOBAL ${productData.nama.toUpperCase()}</b>\n\n` +
      `📦 <b>Kode Produk:</b> ${productData.kode}\n\n` +
      `📝 <b>Detail Paket:</b>\n` +
      `${productData.deskripsi || 'Deskripsi tidak tersedia'}\n\n` +
      `💰 <b>Detail Harga:</b>\n` +
      `💸 Rp. ${hargaDisplay}\n\n` +
      `📊 <b>Status Stok:</b> ${statusStok}\n\n` +
      `📝 <b>Catatan:</b>\n` +
      `• ✅Kuota sesuai area coverage\n` +
      `• ✅Aktif segera setelah pembelian\n` +
      `• ✅Full garansi AKRAB GLOBAL\n` +
      `• ✅Berlaku untuk XL,Axis,Live-on✨`,
    finalHarga: finalHarga // Return harga untuk proses transaksi
  };
};

// Preload template user detail (sama seperti main.js)
const generateUserDetail = (userId, username, saldo, uptime) => {
  return '💌 <b>ID</b>           : <code>' + userId + '</code>\n' +
         '💌 <b>User</b>       : <code>' + (username || '-') + '</code>\n' +
         '📧 <b>Saldo</b>     : <code>Rp. ' + saldo.toLocaleString('id-ID') + '</code>\n' +
         '⌚ <b>Uptime</b>  : <code>' + uptime + '</code>';
};

// Function untuk fetch stok global dan ambil hanya paket bulanan (bukan BPA) - Updated untuk KHFY API
async function fetchStokPaketBulanan() {
  try {
    const { fetchRawStokData } = require('../../cek_stok_global');
    
    // Fetch raw data dari KHFY API
    const rawData = await fetchRawStokData();
    
    // Convert ke format yang dibutuhkan sistem existing
    const paketBulanan = {};
    rawData.forEach(product => {
      if (!product.kode_produk.includes('BPA')) {
        // Hanya ambil paket yang TIDAK mengandung BPA
        const stok = (product.kosong === 0 && product.gangguan === 0) ? 1 : 0;
        paketBulanan[product.kode_produk] = {
          nama: product.nama_produk,
          jumlah: stok
        };
      }
    });
    
    return paketBulanan;
  } catch (error) {
    console.error('Error fetching stok paket bulanan:', error);
    return {};
  }
}

// Function untuk mapping kode produk - Updated untuk dynamic
async function getProductByCode(kodeProduK) {
  try {
    const mapping = await getDynamicProductMapping();
    return mapping[kodeProduK.toLowerCase()] || null;
  } catch (error) {
    console.error('Error getting product by code:', error);
    return null;
  }
}

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
        const minSaldoValue = minSaldo ? parseInt(minSaldo) : 150000;

        // Pop-up alert untuk penolakan akses
        if (saldo < minSaldoValue) {
          const pesanTolak = await getKonfigurasi('pesan_tolak_global') || 'Saldo tidak cukup untuk akses menu bulanan global\n\n⏤͟͟ᴍᴀʏᴜɢᴏʀᴏ';
          
          return bot.answerCallbackQuery(id, {
            text: pesanTolak,
            show_alert: true
          });
        }

        // Generate keyboard secara dinamis berdasarkan API response
        const keyboard = await generateDynamicBulananGlobalKeyboard();

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
          // Get product data dari mapping dinamis
          const productData = await getProductByCode(kodeProduK);
          
          if (!productData) {
            return bot.answerCallbackQuery(id, {
              text: `❌ Produk dengan kode ${kodeProduK} tidak ditemukan.`,
              show_alert: true
            });
          }
          
          // Fetch stok paket bulanan dari API global
          const stokPaketBulanan = await fetchStokPaketBulanan();
          const stokCount = stokPaketBulanan[kodeProduK]?.jumlah || 0;
          
          // Generate detail paket secara dinamis (await karena sekarang async)
          const detailResult = await generateDetailPaketGlobal(productData, stokCount);
          const keyboard = generateDetailPaketGlobalKeyboard(kodeProduK);

          // Edit message dengan detail paket
          await bot.editMessageCaption(detailResult.message, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
          
        } catch (error) {
          console.error('Error fetching dynamic product info:', error);
          
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
          // Get product data dari mapping dinamis
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
          
          if (stokCount === 0 || !productData.available) {
            return bot.answerCallbackQuery(id, {
              text: `❌ Stok paket ${productData.nama} habis atau sedang gangguan.\n\nSilakan pilih paket lain yang masih tersedia.`,
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
// Function untuk mendapatkan data produk berdasarkan kode
async function getProductByCode(kodeProduK) {
  const mapping = await getDynamicProductMapping();
  return mapping[kodeProduK.toLowerCase()] || null;
}

// Export functions untuk digunakan di tempat lain
module.exports.fetchStokPaketBulanan = fetchStokPaketBulanan;
module.exports.getProductByCode = getProductByCode;
module.exports.getDynamicProductMapping = getDynamicProductMapping;
module.exports.generateDynamicBulananGlobalKeyboard = generateDynamicBulananGlobalKeyboard;
module.exports.generateDetailPaketGlobal = generateDetailPaketGlobal;

// === END OF DYNAMIC BULANAN GLOBAL HANDLER ===
