const { getUserSaldo, getHargaPaketDynamic, getKonfigurasi } = require('../../../db');
const { fetchCombinedProductData } = require('../../../utils/combined_product_data');

// === DYNAMIC KEYBOARD GENERATOR UNTUK BULANAN GLOBAL ===
// Generate keyboard berdasarkan response API secara dinamis
async function generateDynamicBulananGlobalKeyboard() {
  try {
    const products = await fetchCombinedProductData();
    
    // Filter hanya paket yang tersedia dan ada stoknya
    const availablePackages = products.filter(product => {
      // Cek stok riil dari API gabungan
      const stokRiil = product.stok || 0;
      const kosong = product.stok_kosong || product.kosong;
      
      return stokRiil > 0 && !kosong; // Hanya tampilkan jika stok > 0 dan tidak kosong
    });
    
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
    const products = await fetchCombinedProductData();
    
    const mapping = {};
    products.forEach(product => {
      // Map kode produk ke data lengkap dari API gabungan
      mapping[product.kode_produk.toLowerCase()] = {
        kode: product.kode_produk,
        nama: product.nama_produk,
        stok: product.stok || 0, // Stok riil dari API cek_stock
        deskripsi: product.deskripsi || '', // Deskripsi lengkap dari list_product
        harga: product.harga_final || 0, // Harga dari list_product
        kosong: product.stok_kosong || product.kosong,
        gangguan: product.stok_gangguan || product.gangguan
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

// Preload template pesan untuk detail paket global (dynamic) dengan detail berdasarkan kode
const generateDetailPaketGlobal = async (productData, stokCount = 0) => {
  const statusStok = stokCount > 0 ? `✅ Tersedia (${stokCount})` : '❌ Habis';
  
  // Priority untuk harga: database berdasarkan kode produk -> API harga -> fallback 'Hubungi admin'
  let hargaDisplay = 'Hubungi admin';
  let finalHarga = 0;
  
  try {
    finalHarga = await getHargaPaketDynamic(productData.kode, productData.nama?.toLowerCase());
    
    if (finalHarga > 0) {
      hargaDisplay = finalHarga.toLocaleString('id-ID');
    } else if (productData.harga > 0) {
      finalHarga = productData.harga;
      hargaDisplay = productData.harga.toLocaleString('id-ID');
    }
  } catch (error) {
    console.error('Error getting price from database:', error);
    if (productData.harga > 0) {
      finalHarga = productData.harga;
      hargaDisplay = productData.harga.toLocaleString('id-ID');
    }
  }
  
  // Gunakan deskripsi langsung dari API (bukan statis)
  let deskripsiPaket = 'Detail tidak tersedia';
  if (productData.deskripsi && productData.deskripsi.trim()) {
    // Format deskripsi dari API dengan line breaks yang proper
    let cleanDescription = productData.deskripsi
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
    
    // Filter out bagian "noted" dan setelahnya (case insensitive)
    const notedIndex = cleanDescription.toLowerCase().indexOf('noted');
    if (notedIndex !== -1) {
      cleanDescription = cleanDescription.substring(0, notedIndex).trim();
    }
    
    // Jika masih ada isi setelah filtering, gunakan itu
    deskripsiPaket = cleanDescription || 'Detail kuota sesuai area coverage';
  }
  
  return {
    message: `🌍 <b>Detail BULANAN GLOBAL ${(productData.nama || 'UNKNOWN').toUpperCase()}</b>\n\n` +
      `📦 <b>Kode Produk:</b> ${productData.kode}\n\n` +
      `📝 <b>Detail Paket:</b>\n` +
      `${deskripsiPaket}\n\n` +
      `💰 <b>Detail Harga:</b>\n` +
      `💸 Rp. ${hargaDisplay}\n\n` +
      `📊 <b>Status Stok:</b> ${statusStok}\n\n` +
      `📝 <b>Catatan:</b>\n` +
      `✅ Official, resmi, bergaransi\n` +
      `✅ Berlaku untuk XL, Axis, Live-on✨`,
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

// Function untuk fetch stok global dan ambil hanya paket bulanan (bukan BPA) - Updated untuk Combined API
async function fetchStokPaketBulanan() {
  try {
    // Fetch data gabungan dari API list_product + cek_stock
    const products = await fetchCombinedProductData();
    
    // Convert ke format yang dibutuhkan sistem existing
    const paketBulanan = {};
    products.forEach(product => {
      // Data sudah difilter non-BPA dari fetchCombinedProductData
      // Gunakan stok riil dari API gabungan
      const stokRiil = product.stok || 0;
      paketBulanan[product.kode_produk] = {
        nama: product.nama_produk,
        jumlah: stokRiil, // Stok riil dari cek_stock API
        harga: product.harga_final, // Harga dari list_product API
        deskripsi: product.deskripsi // Deskripsi lengkap dari list_product API
      };
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
        const minSaldoValue = minSaldo ? (parseInt(minSaldo) || 150000) : 150000;

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
