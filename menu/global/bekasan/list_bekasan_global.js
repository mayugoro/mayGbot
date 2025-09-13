const { getUserSaldo, getKonfigurasi } = require('../../../db');
// Import hardcode paket data untuk bekasan global (menghindari rate limit)
const { 
  getPaketBekasanByTipe, 
  getPaketBekasanByKode, 
  generateBekasanKeyboard,
  getPaketBekasanGlobal 
} = require('../../daftar-paket');

// === PRELOAD INLINE KEYBOARDS UNTUK BEKASAN GLOBAL ===
// Bekasan global berdasarkan tipe L, XL, XXL (menggunakan data hardcode)
const BEKASAN_GLOBAL_MENU_KEYBOARD = [
  [{ text: '📱 BEKASAN L', callback_data: 'bekasan_global_anggota_l' }],
  [{ text: '📱 BEKASAN XL', callback_data: 'bekasan_global_anggota_xl' }],
  [{ text: '📱 BEKASAN XXL', callback_data: 'bekasan_global_anggota_xxl' }],
  [
    { text: 'KEMBALI', callback_data: 'akrab_global' },
    { text: 'STOK GLOBAL', callback_data: 'cek_stok_bekasan_global_redirect' }
  ]
];

// Function untuk generate keyboard paket berdasarkan tipe (BY KODE_PRODUK VERSION)
// Menggunakan data hardcode dari daftar-paket.js dengan generate by kode_produk seperti bulanan
function generateStaticPaketKeyboard(tipe, stokData = {}) {
  const keyboard = [];
  
  // Ambil paket dari data hardcode berdasarkan tipe
  const paketStatis = getPaketBekasanByTipe(tipe);
  
  if (!paketStatis || paketStatis.length === 0) {
    // Fallback ke method lama jika tidak ada data statis
    return generatePaketKeyboard(tipe, stokData);
  }

  // Generate keyboard berdasarkan data statis, diurutkan berdasarkan durasi
  // GENERATE BY KODE_PRODUK seperti sistem bulanan
  paketStatis
    .sort((a, b) => parseInt(a.durasi) - parseInt(b.durasi)) // Sort by durasi
    .forEach(paket => {
      const { durasi, kode_produk, nama_display } = paket;
      
      // Generate callback_data by kode_produk (seperti bulanan)
      const callbackData = `bekasan_global_${kode_produk.toLowerCase()}`;
      
      keyboard.push([{ 
        text: nama_display, // Gunakan nama_display langsung (tanpa stok count)
        callback_data: callbackData 
      }]);
    });

  // Tambahkan tombol navigasi dengan CEK STOK berdasarkan tipe
  keyboard.push([
    { text: 'KEMBALI', callback_data: 'menu_bekasan_global' },
    { text: 'CEK STOK', callback_data: `cek_stok_bekasan_${tipe}` }
  ]);

  return keyboard;
}

// Function untuk generate keyboard paket berdasarkan tipe (LEGACY VERSION - DYNAMIC API)
function generatePaketKeyboard(tipe, stokData) {
  const keyboard = [];
  
  // Filter paket berdasarkan tipe
  const paketKeys = Object.keys(stokData).filter(kode => {
    if (tipe === 'l') return kode.includes('BPAL');
    if (tipe === 'xl') return kode.includes('BPAXL') && !kode.includes('BPAXXL');
    if (tipe === 'xxl') return kode.includes('BPAXXL');
    return false;
  });

  // Sort berdasarkan hari
  paketKeys.sort((a, b) => {
    const dayA = parseInt(a.replace(/BPA(XXL|XL|L)/, ''));
    const dayB = parseInt(b.replace(/BPA(XXL|XL|L)/, ''));
    return dayA - dayB;
  });

  // Generate keyboard
  paketKeys.forEach(kode => {
    const stok = stokData[kode];
    const days = kode.replace(/BPA(XXL|XL|L)/, '');
    const statusIcon = stok.jumlah > 0 ? '✅' : '❌';
    const text = `${statusIcon} ${days} HARI (${stok.jumlah})`;
    
    keyboard.push([{ text: text, callback_data: `bekasan_global_${tipe}_${days}` }]);
  });

  // Tambahkan tombol kembali saja (hapus tombol CEK STOK)
  keyboard.push([
    { text: 'KEMBALI', callback_data: 'menu_bekasan_global' }
  ]);

  return keyboard;
}

// Preload template user detail
const generateUserDetail = (userId, username, saldo, uptime) => {
  return '💌 <b>ID</b>           : <code>' + userId + '</code>\n' +
         '💌 <b>User</b>       : <code>' + (username || '-') + '</code>\n' +
         '📧 <b>Saldo</b>     : <code>Rp. ' + saldo.toLocaleString('id-ID') + '</code>\n' +
         '⌚ <b>Uptime</b>  : <code>' + uptime + '</code>';
};

// Function untuk fetch stok global dan ambil hanya bekasan (mengandung BPA)
async function fetchStokBekasan() {
  try {
    const { fetchStokGlobal, parseStokGlobal } = require('../../cek_stok_global');
    
    // Fetch dan parse stok global
    const stokString = await fetchStokGlobal();
    const stokData = parseStokGlobal(stokString);
    
    // Filter hanya bekasan (mengandung BPA: BPAL, BPAXL, BPAXXL)
    const bekasanData = {};
    Object.keys(stokData).forEach(kode => {
      if (kode.includes('BPA')) {
        // Hanya ambil paket yang mengandung BPA (L/XL/XXL)
        bekasanData[kode] = stokData[kode];
      }
    });
    
    return bekasanData;
  } catch (error) {
    console.error('Error fetching stok bekasan:', error);
    return {};
  }
}

// Function untuk generate detail paket bekasan
const generateDetailPaketBekasan = (tipe, hari, deskripsi, hargaValue, stokCount = 0) => {
  const tipeNames = {
    'l': 'BEKASAN L',
    'xl': 'BEKASAN XL',
    'xxl': 'BEKASAN XXL'
  };
  
  const tipeName = tipeNames[tipe] || tipe.toUpperCase();
  const statusStok = stokCount > 0 ? `✅ Tersedia (${stokCount})` : '❌ Habis';
  
  return `🌍 Detail BEKASAN GLOBAL\n\n` +
    `📦 <b>Paket:</b> ${tipeName} ${hari} HARI\n` +
    `📝 <b>Deskripsi:</b>\n${deskripsi || 'Paket bekasan akrab global'}\n\n` +
    `💰 <b>Detail Harga:</b>\n` +
    `💸 Rp. ${hargaValue.toLocaleString('id-ID')}\n\n` +
    `📊 <b>Status Stok:</b> ${statusStok}\n\n` +
    `📝 <b>Catatan:</b>\n` +
    `• ✅ Paket bekasan akrab global\n` +
    `• ✅ Aktif segera setelah pembelian\n` +
    `• ✅ Full garansi AKRAB GLOBAL\n` +
    `• ✅ Berlaku untuk XL,Axis,Live-on✨`;
};

module.exports = (bot, formatUptime, BOT_START_TIME) => {
  bot.on('callback_query', async (query) => {
    const { data, message, id, from } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    if (!chatId || !msgId) return;

    try {
      // === BEKASAN GLOBAL MENU ===
      if (data === 'menu_bekasan_global') {
        // Cek saldo user
        let saldo = 0;
        try {
          saldo = await getUserSaldo(from.id, from.username);
        } catch (e) {}

        // Ambil minimal saldo dari database (gunakan config global)
        const minSaldo = await getKonfigurasi('min_saldo_global');
        const minSaldoValue = minSaldo ? parseInt(minSaldo) : 150000;

        // Pop-up alert untuk penolakan akses
        if (saldo < minSaldoValue) {
          const pesanTolak = await getKonfigurasi('pesan_tolak_global') || 'Saldo tidak cukup untuk akses menu bekasan global\n\n⏤͟͟ᴍᴀʏᴜɢᴏʀᴏ';
          
          return bot.answerCallbackQuery(id, {
            text: pesanTolak,
            show_alert: true
          });
        }

        // Gunakan keyboard statis untuk menu utama bekasan global
        const keyboard = BEKASAN_GLOBAL_MENU_KEYBOARD;

        // Ambil data user untuk ditampilkan
        const uptime = formatUptime(Date.now() - BOT_START_TIME);
        const detail = generateUserDetail(from.id, from.username, saldo, uptime);

        // Content untuk menu utama bekasan global - sama seperti bulanan global (hanya detail user)
        const menuContent = detail;

        // Edit message dengan menu bekasan global
        await bot.editMessageCaption(menuContent, {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });

        await bot.answerCallbackQuery(id);
        return;
      }

      // === PILIH TIPE BEKASAN GLOBAL ===
      if (/^bekasan_global_anggota_(l|xl|xxl)$/i.test(data)) {
        const tipe = data.split('_')[3].toLowerCase(); // l, xl, atau xxl
        
        // Generate detail user untuk submenu - sama seperti bulanan global
        const saldo = await getUserSaldo(from.id);
        const uptime = formatUptime(Date.now() - BOT_START_TIME);
        const detail = generateUserDetail(from.id, from.username, saldo, uptime);
        
        try {
          // GUNAKAN DATA STATIS SAJA - TIDAK ADA FETCH API
          // Display name diambil dari daftar-paket.js, tidak perlu fetch stok untuk menu
          console.log(`Info: Generating menu ${tipe.toUpperCase()} menggunakan data statis`);
          
          // Generate keyboard menggunakan data statis murni (tanpa fetch API)
          const keyboard = generateStaticPaketKeyboard(tipe, {});
          
          const tipeNames = {
            'l': 'BEKASAN L',
            'xl': 'BEKASAN XL', 
            'xxl': 'BEKASAN XXL'
          };
          
          // Content untuk submenu bekasan tipe - sama seperti bulanan global (hanya detail user)
          const menuText = detail;

          await bot.editMessageCaption(menuText, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
          
        } catch (error) {
          console.error('Error generating static bekasan keyboard:', error);
          await bot.answerCallbackQuery(id, {
            text: '❌ Gagal memuat menu bekasan global',
            show_alert: true
          });
        }
        
        await bot.answerCallbackQuery(id);
        return;
      }

      // === PILIH PAKET BEKASAN BY KODE_PRODUK (NEW HANDLER) ===
      if (/^bekasan_global_bpa[lx]{1,2}\d+$/i.test(data)) {
        const kodeProduk = data.replace('bekasan_global_', '').toUpperCase(); // Extract kode produk
        
        try {
          // Gunakan data statis untuk mendapatkan info paket
          const paketStatis = getPaketBekasanByKode(kodeProduk);
          
          if (!paketStatis) {
            await bot.answerCallbackQuery(id, {
              text: `❌ Paket ${kodeProduk} tidak ditemukan dalam sistem`,
              show_alert: true
            });
            return;
          }
          
          const { tipe, durasi } = paketStatis;
          
          // Coba fetch stok real-time untuk validasi (optional)
          let stokCount = 0;
          try {
            const stokBekasan = await fetchStokBekasan();
            stokCount = stokBekasan[kodeProduk]?.jumlah || 0;
          } catch (error) {
            console.log('Info: Menggunakan data statis, stok akan divalidasi saat pembelian');
            // Set default stok untuk testing (akan divalidasi saat proses pembelian)
            stokCount = 1;
          }
          
          // Ambil harga dan deskripsi dari database
          const { getKonfigurasi } = require('../../../db');
          const harga = await getKonfigurasi(`harga_bekasan_global_${tipe}_${durasi}h`) || 
                       await getKonfigurasi(`harga_bekasan_${tipe}_${durasi}h`) ||
                       await getKonfigurasi(`harga_bekasan_${durasi}h`);
          const deskripsi = await getKonfigurasi(`deskripsi_bekasan_global_${tipe}`) || 
                           await getKonfigurasi(`deskripsi_bekasan_${tipe}`);
          
          const hargaValue = harga ? parseInt(harga) : 0;
          
          // Generate detail paket menggunakan data statis
          const detailPaket = generateDetailPaketBekasan(tipe, durasi, deskripsi, hargaValue, stokCount);
          const keyboard = [
            [
              { text: 'KEMBALI', callback_data: `bekasan_global_anggota_${tipe}` },
              { text: '✅LANJUT BELI', callback_data: `proses_bekasan_global_${kodeProduk.toLowerCase()}` }
            ]
          ];

          await bot.editMessageCaption(detailPaket, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
          
        } catch (error) {
          console.error('Error showing bekasan detail by kode:', error);
          await bot.answerCallbackQuery(id, {
            text: '❌ Gagal memuat detail paket',
            show_alert: true
          });
        }
        
        await bot.answerCallbackQuery(id);
        return;
      }

      // === PROSES PEMBELIAN BEKASAN GLOBAL BY KODE_PRODUK (NEW HANDLER) ===
      if (/^proses_bekasan_global_bpa[lx]{1,2}\d+$/i.test(data)) {
        const kodeProduk = data.replace('proses_bekasan_global_', '').toUpperCase(); // Extract kode produk
        
        try {
          // Validasi paket dari data statis
          const paketStatis = getPaketBekasanByKode(kodeProduk);
          
          if (!paketStatis) {
            return bot.answerCallbackQuery(id, {
              text: `❌ Paket ${kodeProduk} tidak tersedia dalam sistem.\n\nSilakan pilih paket lain.`,
              show_alert: true
            });
          }
          
          const { tipe, durasi } = paketStatis;
          
          // Cek stok global sebelum proses (validasi real-time)
          let stokCount = 1; // Default untuk testing
          try {
            const stokBekasan = await fetchStokBekasan();
            stokCount = stokBekasan[kodeProduk]?.jumlah || 0;
            
            if (stokCount === 0) {
              return bot.answerCallbackQuery(id, {
                text: `❌ Stok paket ${kodeProduk} habis.\n\nSilakan pilih paket lain.`,
                show_alert: true
              });
            }
          } catch (error) {
            console.log('Info: Tidak dapat validasi stok real-time, lanjut dengan validasi di handler');
            // Validasi stok akan dilakukan di handler bekasan global
          }
          
          // Import handler bekasan global
          const handlerBekasanGlobal = require('./handler_bekasan_global');
          const setStateBekasanGlobal = handlerBekasanGlobal.setStateBekasanGlobal;
          
          // Set state untuk handler bekasan global (by kode_produk)
          setStateBekasanGlobal(chatId, {
            step: 'input_nomor_bekasan_global', // Langsung ke input nomor
            tipe,
            hari: durasi,
            kodePaket: kodeProduk, // Gunakan kode produk langsung
            userId: from.id,
            originalMessageId: msgId,
            stokCount,
            paketStatis // Tambahkan referensi ke data statis
          });

          // Handler akan mengirim pesan input nomor sendiri
          await bot.answerCallbackQuery(id);

        } catch (err) {
          console.error('Error in proses bekasan global by kode:', err);
          return bot.answerCallbackQuery(id, {
            text: `❌ Terjadi kesalahan sistem.\n\nSilakan coba lagi.`,
            show_alert: true
          });
        }
        return;
      }

      // === PILIH PAKET BEKASAN SPESIFIK (OLD HANDLER - BACKUP) ===
      if (/^bekasan_global_(l|xl|xxl)_(\d+)$/i.test(data)) {
        const matches = data.match(/^bekasan_global_(l|xl|xxl)_(\d+)$/i);
        const tipe = matches[1].toLowerCase();
        const hari = matches[2];
        
        try {
          // Gunakan data statis untuk mendapatkan kode produk
          const kodePaket = `BPA${tipe.toUpperCase()}${hari}`;
          const paketStatis = getPaketBekasanByKode(kodePaket);
          
          if (!paketStatis) {
            await bot.answerCallbackQuery(id, {
              text: `❌ Paket ${tipe.toUpperCase()} ${hari} hari tidak ditemukan dalam sistem`,
              show_alert: true
            });
            return;
          }
          
          // Coba fetch stok real-time untuk validasi (optional)
          let stokCount = 0;
          try {
            const stokBekasan = await fetchStokBekasan();
            stokCount = stokBekasan[kodePaket]?.jumlah || 0;
          } catch (error) {
            console.log('Info: Menggunakan data statis, stok akan divalidasi saat pembelian');
            // Set default stok untuk testing (akan divalidasi saat proses pembelian)
            stokCount = 1;
          }
          
          // Ambil harga dan deskripsi dari database
          const { getKonfigurasi } = require('../../../db');
          const harga = await getKonfigurasi(`harga_bekasan_global_${tipe}_${hari}h`) || 
                       await getKonfigurasi(`harga_bekasan_${tipe}_${hari}h`) ||
                       await getKonfigurasi(`harga_bekasan_${hari}h`);
          const deskripsi = await getKonfigurasi(`deskripsi_bekasan_global_${tipe}`) || 
                           await getKonfigurasi(`deskripsi_bekasan_${tipe}`);
          
          const hargaValue = harga ? parseInt(harga) : 0;
          
          // Generate detail paket menggunakan data statis
          const detailPaket = generateDetailPaketBekasan(tipe, hari, deskripsi, hargaValue, stokCount);
          const keyboard = [
            [
              { text: 'KEMBALI', callback_data: `bekasan_global_anggota_${tipe}` },
              { text: '✅LANJUT BELI', callback_data: `proses_bekasan_global_${tipe}_${hari}` }
            ]
          ];

          await bot.editMessageCaption(detailPaket, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
          
        } catch (error) {
          console.error('Error showing bekasan detail:', error);
          await bot.answerCallbackQuery(id, {
            text: '❌ Gagal memuat detail paket',
            show_alert: true
          });
        }
        
        await bot.answerCallbackQuery(id);
        return;
      }

      // === PROSES PEMBELIAN BEKASAN GLOBAL ===
      if (/^proses_bekasan_global_(l|xl|xxl)_(\d+)$/i.test(data)) {
        const matches = data.match(/^proses_bekasan_global_(l|xl|xxl)_(\d+)$/i);
        const tipe = matches[1].toLowerCase();
        const hari = matches[2];
        
        try {
          // Validasi paket dari data statis
          const kodePaket = `BPA${tipe.toUpperCase()}${hari}`;
          const paketStatis = getPaketBekasanByKode(kodePaket);
          
          if (!paketStatis) {
            return bot.answerCallbackQuery(id, {
              text: `❌ Paket ${tipe.toUpperCase()} ${hari} hari tidak tersedia dalam sistem.\n\nSilakan pilih paket lain.`,
              show_alert: true
            });
          }
          
          // Cek stok global sebelum proses (validasi real-time)
          let stokCount = 1; // Default untuk testing
          try {
            const stokBekasan = await fetchStokBekasan();
            stokCount = stokBekasan[kodePaket]?.jumlah || 0;
            
            if (stokCount === 0) {
              return bot.answerCallbackQuery(id, {
                text: `❌ Stok paket ${tipe.toUpperCase()} ${hari} hari habis.\n\nSilakan pilih paket lain.`,
                show_alert: true
              });
            }
          } catch (error) {
            console.log('Info: Tidak dapat validasi stok real-time, lanjut dengan validasi di handler');
            // Validasi stok akan dilakukan di handler bekasan global
          }
          
          // Import handler bekasan global
          const handlerBekasanGlobal = require('./handler_bekasan_global');
          const setStateBekasanGlobal = handlerBekasanGlobal.setStateBekasanGlobal;
          
          // Set state untuk handler bekasan global
          setStateBekasanGlobal(chatId, {
            step: 'input_nomor_bekasan_global', // Langsung ke input nomor
            tipe,
            hari,
            kodePaket,
            userId: from.id,
            originalMessageId: msgId,
            stokCount,
            paketStatis // Tambahkan referensi ke data statis
          });

          // Handler akan mengirim pesan input nomor sendiri
          await bot.answerCallbackQuery(id);

        } catch (err) {
          console.error('Error in proses bekasan global:', err);
          return bot.answerCallbackQuery(id, {
            text: `❌ Terjadi kesalahan sistem.\n\nSilakan coba lagi.`,
            show_alert: true
          });
        }
        return;
      }

      // === CEK STOK BEKASAN BY TIPE ===
      if (/^cek_stok_bekasan_(l|xl|xxl)$/i.test(data)) {
        const tipe = data.split('_')[3].toLowerCase(); // l, xl, atau xxl
        
        try {
          // Fetch stok real-time dari API
          const stokBekasan = await fetchStokBekasan();
          
          // Ambil daftar paket berdasarkan tipe dari hardcode
          const paketStatis = getPaketBekasanByTipe(tipe);
          
          if (!paketStatis || paketStatis.length === 0) {
            await bot.answerCallbackQuery(id, {
              text: `❌ Tidak ada data paket untuk tipe ${tipe.toUpperCase()}`,
              show_alert: true
            });
            return;
          }
          
          let info = `🌍 STOK BEKASAN GLOBAL - ${tipe.toUpperCase()}\n\n`;
          
          // Tampilkan stok berdasarkan urutan dari daftar-paket.js (HANYA untuk tipe ini)
          paketStatis
            .sort((a, b) => parseInt(a.durasi) - parseInt(b.durasi)) // Sort by durasi
            .forEach(paket => {
              const kode = paket.kode_produk;
              const namaDisplay = paket.nama_display;
              
              if (stokBekasan[kode]) {
                const stok = stokBekasan[kode];
                const jumlahStok = stok.jumlah === 0 ? '-' : stok.jumlah;
                // HANYA tampilkan nama display tanpa kode produk
                info += `${namaDisplay} = ${jumlahStok}\n`;
              } else {
                // Jika tidak ada di API, tampilkan sebagai tidak tersedia
                info += `${namaDisplay} = -\n`;
              }
            });

          info += '\n✅ Tekan OK untuk keluar';

          await bot.answerCallbackQuery(id, {
            text: info,
            show_alert: true
          });

        } catch (err) {
          console.error(`Error cek stok bekasan ${tipe}:`, err);
          await bot.answerCallbackQuery(id, {
            text: `❌ Error mengambil data stok bekasan ${tipe.toUpperCase()}: ` + err.message,
            show_alert: true
          });
        }
        
        return;
      }

    } catch (err) {
      console.error(`Error processing bekasan global callback query: ${err.message}`);
      await bot.answerCallbackQuery(id, {
        text: '❌ Terjadi kesalahan sistem',
        show_alert: true
      });
    }
  });
};

// Export functions
module.exports.fetchStokBekasan = fetchStokBekasan;
module.exports.generateStaticPaketKeyboard = generateStaticPaketKeyboard;
module.exports.generatePaketKeyboard = generatePaketKeyboard;

// === END OF BEKASAN GLOBAL HANDLER ===
