const { getUserSaldo, getKonfigurasi } = require('../../../db');

// === PRELOAD INLINE KEYBOARDS UNTUK BEKASAN GLOBAL ===
// Bekasan global hanya mengambil dari paket L, XL, XXL (bukan paket lain)
const BEKASAN_GLOBAL_MENU_KEYBOARD = [
  [{ text: '📱 ANGGOTA L', callback_data: 'bekasan_global_anggota_l' }],
  [{ text: '📱 ANGGOTA XL', callback_data: 'bekasan_global_anggota_xl' }],
  [{ text: '📱 ANGGOTA XXL', callback_data: 'bekasan_global_anggota_xxl' }],
  [
    { text: 'KEMBALI', callback_data: 'akrab_global' },
    { text: 'STOK GLOBAL', callback_data: 'cek_stok_bekasan_global_redirect' }
  ]
];

// Function untuk generate keyboard paket berdasarkan tipe
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
    'l': 'ANGGOTA L',
    'xl': 'ANGGOTA XL',
    'xxl': 'ANGGOTA XXL'
  };
  
  const tipeName = tipeNames[tipe] || tipe.toUpperCase();
  const statusStok = stokCount > 0 ? `✅ Tersedia (${stokCount})` : '❌ Habis';
  
  return `🌍 <b>Detail BEKASAN GLOBAL</b>\n\n` +
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

        const keyboard = BEKASAN_GLOBAL_MENU_KEYBOARD;

        // Ambil data user untuk ditampilkan
        const uptime = formatUptime(Date.now() - BOT_START_TIME);
        const detail = generateUserDetail(from.id, from.username, saldo, uptime);

        // Edit message dengan menu bekasan global
        await bot.editMessageCaption(detail, {
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
        
        try {
          // Fetch stok bekasan dari API global
          const stokBekasan = await fetchStokBekasan();
          
          // Generate keyboard paket berdasarkan tipe
          const keyboard = generatePaketKeyboard(tipe, stokBekasan);
          
          const tipeNames = {
            'l': 'ANGGOTA L',
            'xl': 'ANGGOTA XL', 
            'xxl': 'ANGGOTA XXL'
          };
          
          const menuText = `🌍 <b>BEKASAN GLOBAL - ${tipeNames[tipe]}</b>\n\n` +
            `📋 Pilih paket yang tersedia:\n\n` +
            `✅ = Tersedia | ❌ = Habis\n` +
            `(angka) = jumlah stok`;

          await bot.editMessageCaption(menuText, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
          
        } catch (error) {
          console.error('Error fetching bekasan stock:', error);
          await bot.answerCallbackQuery(id, {
            text: '❌ Gagal memuat stok bekasan global',
            show_alert: true
          });
        }
        
        await bot.answerCallbackQuery(id);
        return;
      }

      // === PILIH PAKET BEKASAN SPESIFIK ===
      if (/^bekasan_global_(l|xl|xxl)_(\d+)$/i.test(data)) {
        const matches = data.match(/^bekasan_global_(l|xl|xxl)_(\d+)$/i);
        const tipe = matches[1].toLowerCase();
        const hari = matches[2];
        
        try {
          // Fetch stok untuk validasi
          const stokBekasan = await fetchStokBekasan();
          const kodePaket = `BPA${tipe.toUpperCase()}${hari}`;
          const stokCount = stokBekasan[kodePaket]?.jumlah || 0;
          
          // Ambil harga dan deskripsi dari database
          const { getKonfigurasi } = require('../../../db');
          const harga = await getKonfigurasi(`harga_bekasan_global_${tipe}_${hari}`) || 
                       await getKonfigurasi(`harga_bekasan_${tipe}_${hari}`) ||
                       await getKonfigurasi(`harga_bekasan_${hari}`);
          const deskripsi = await getKonfigurasi(`deskripsi_bekasan_global_${tipe}`) || 
                           await getKonfigurasi(`deskripsi_bekasan_${tipe}`);
          
          const hargaValue = harga ? parseInt(harga) : 0;
          
          // Generate detail paket
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
          // Cek stok global sebelum proses
          const stokBekasan = await fetchStokBekasan();
          const kodePaket = `BPA${tipe.toUpperCase()}${hari}`;
          const stokCount = stokBekasan[kodePaket]?.jumlah || 0;
          
          if (stokCount === 0) {
            return bot.answerCallbackQuery(id, {
              text: `❌ Stok paket ${tipe.toUpperCase()} ${hari} hari habis.\n\nSilakan pilih paket lain.`,
              show_alert: true
            });
          }
          
          // Kirim loading message
          const loadingMsg = await bot.sendMessage(chatId, '🌍 <b>Mengecek slot bekasan global...</b> 🌍', { parse_mode: 'HTML' });
          
          // Import handler bekasan global
          const handlerBekasanGlobal = require('./handler_bekasan_global');
          const setStateBekasanGlobal = handlerBekasanGlobal.setStateBekasanGlobal;
          
          // Set state untuk handler bekasan global
          setStateBekasanGlobal(chatId, {
            step: 'pilih_slot_bekasan_global',
            tipe,
            hari,
            kodePaket,
            userId: from.id,
            loadingMessageId: loadingMsg.message_id,
            originalMessageId: msgId,
            stokCount
          });

        } catch (err) {
          console.error('Error in proses bekasan global:', err);
          return bot.answerCallbackQuery(id, {
            text: `❌ Terjadi kesalahan saat mengecek stok global.\n\nSilakan coba lagi.`,
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

// === END OF BEKASAN GLOBAL HANDLER ===
