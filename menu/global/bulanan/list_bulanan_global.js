const { getUserSaldo, getKonfigurasi } = require('../../../db');

// === PRELOAD INLINE KEYBOARDS UNTUK BULANAN GLOBAL ===
const BULANAN_GLOBAL_MENU_KEYBOARD = [
  [{ text: 'SUPERMINI PROMO', callback_data: 'bulanan_global_supermini' }],
  [{ text: 'MEGABIG', callback_data: 'bulanan_global_megabig' }],
  [{ text: 'MINI', callback_data: 'bulanan_global_mini' }],
  [{ text: 'BIG', callback_data: 'bulanan_global_big' }],
  [{ text: 'JUMBO V2', callback_data: 'bulanan_global_jumbo' }],
  [{ text: 'BIG PLUS', callback_data: 'bulanan_global_bigplus' }],
  [
    { text: 'KEMBALI', callback_data: 'akrab_global' },
    { text: 'STOK GLOBAL', callback_data: 'cek_stok_global' }
  ]
];

// Preload keyboard untuk detail paket global
const generateDetailPaketGlobalKeyboard = (paket) => [
  [
    { text: 'KEMBALI', callback_data: 'cek_stok_bulanan_global' },
    { text: '✅LANJUT BELI', callback_data: `proses_bulanan_global_${paket}` }
  ]
];

// Preload template pesan untuk detail paket global
const generateDetailPaketGlobal = (paket, deskripsi, hargaValue, kuotaText, stokCount = 0) => {
  const paketNames = {
    'supermini': 'SUPERMINI PROMO',
    'megabig': 'MEGABIG', 
    'mini': 'MINI',
    'big': 'BIG',
    'jumbo': 'JUMBO V2',
    'bigplus': 'BIG PLUS'
  };
  
  const paketName = paketNames[paket] || paket.toUpperCase();
  const statusStok = stokCount > 0 ? `✅ Tersedia (${stokCount})` : '❌ Habis';
  
  return `🌍 <b>Detail BULANAN GLOBAL ${paketName}</b>\n\n` +
    `📦 <b>Detail Paket:</b>\n` +
    `${deskripsi || 'Deskripsi tidak tersedia'}\n\n` +
    `💰 <b>Detail Harga:</b>\n` +
    `💸 Rp. ${hargaValue.toLocaleString('id-ID')}\n\n` +
    `📊 <b>Status Stok:</b> ${statusStok}\n\n` +
    `📝 <b>Catatan:</b>\n` +
    `• ✅Kuota bersama : ${kuotaText || 'Tidak tersedia'}\n` +
    `• ✅Aktif segera setelah pembelian\n` +
    `• ✅Full garansi AKRAB GLOBAL\n` +
    `• ✅Berlaku untuk XL,Axis,Live-on✨`;
};

// Preload template user detail (sama seperti main.js)
const generateUserDetail = (userId, username, saldo, uptime) => {
  return '💌 <b>ID</b>           : <code>' + userId + '</code>\n' +
         '💌 <b>User</b>       : <code>' + (username || '-') + '</code>\n' +
         '📧 <b>Saldo</b>     : <code>Rp. ' + saldo.toLocaleString('id-ID') + '</code>\n' +
         '⌚ <b>Uptime</b>  : <code>' + uptime + '</code>';
};

// Function untuk fetch stok global dan ambil hanya paket bulanan (bukan BPA)
async function fetchStokPaketBulanan() {
  try {
    const { fetchStokGlobal, parseStokGlobal } = require('../../cek_stok_global');
    
    // Fetch dan parse stok global
    const stokString = await fetchStokGlobal();
    const stokData = parseStokGlobal(stokString);
    
    // Filter hanya paket bulanan (BUKAN mengandung BPA)
    const paketBulanan = {};
    Object.keys(stokData).forEach(kode => {
      if (!kode.includes('BPA')) {
        // Hanya ambil paket yang TIDAK mengandung BPA (L/XL/XXL)
        paketBulanan[kode] = stokData[kode];
      }
    });
    
    return paketBulanan;
  } catch (error) {
    console.error('Error fetching stok paket bulanan:', error);
    return {};
  }
}

// Function untuk mapping nama paket ke kode API
function getKodePaket(paket) {
  const mapping = {
    'supermini': 'XLA14',    // SuperMini PROMO
    'megabig': 'XLA89',      // MegaBig  
    'mini': 'XLA32',         // mini
    'big': 'XLA39',          // big
    'jumbo': 'XLA51',        // jumbo v2
    'bigplus': 'XX'          // big plus (note: ada 2 XX, ini yang kedua)
  };
  
  return mapping[paket] || paket.toUpperCase();
}

module.exports = (bot, formatUptime, BOT_START_TIME) => {
  bot.on('callback_query', async (query) => {
    const { data, message, id, from } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    if (!chatId || !msgId) return;

    try {
      // === BULANAN GLOBAL MENU ===
      if (data === 'cek_stok_bulanan_global') {
        // Cek saldo user sebelum masuk menu bulanan global
        let saldo = 0;
        try {
          saldo = await getUserSaldo(from.id, from.username);
        } catch (e) {}

        // Ambil minimal saldo dari database (gunakan config bulanan)
        const minSaldo = await getKonfigurasi('min_saldo_bulanan');
        const minSaldoValue = minSaldo ? parseInt(minSaldo) : 100000;

        // Pop-up alert untuk penolakan akses
        if (saldo < minSaldoValue) {
          const pesanTolak = await getKonfigurasi('pesan_tolak_bulanan') || 'Saldo tidak cukup untuk akses menu bulanan global\n\n⏤͟͟ᴍᴀʏᴜɢᴏʀᴏ';
          
          return bot.answerCallbackQuery(id, {
            text: pesanTolak,
            show_alert: true
          });
        }

        const keyboard = BULANAN_GLOBAL_MENU_KEYBOARD;

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

      // === PILIH PAKET BULANAN GLOBAL ===
      if (/^bulanan_global_(supermini|megabig|mini|big|jumbo|bigplus)$/i.test(data)) {
        const paket = data.split('_')[2].toLowerCase();
        
        try {
          // Fetch stok paket bulanan dari API global
          const stokPaketBulanan = await fetchStokPaketBulanan();
          const kodePaket = getKodePaket(paket);
          const stokCount = stokPaketBulanan[kodePaket]?.jumlah || 0;
          
          // Ambil harga, deskripsi, dan kuota dari database (gunakan config yang sama dengan bulanan biasa)
          const { getKonfigurasi, getKuotaPaket } = require('../../../db');
          const harga = await getKonfigurasi(`harga_global_${paket}`) || await getKonfigurasi(`harga_${paket}`);
          const deskripsi = await getKonfigurasi(`deskripsi_global_${paket}`) || await getKonfigurasi(`deskripsi_${paket}`);
          const kuota = await getKuotaPaket(paket);
          
          const hargaValue = harga ? parseInt(harga) : 0;
          const kuotaText = kuota ? `${kuota}gb` : 'Tidak tersedia';
          
          // Gunakan template preload untuk detail paket global
          const detailPaket = generateDetailPaketGlobal(paket, deskripsi, hargaValue, kuotaText, stokCount);
          const keyboard = generateDetailPaketGlobalKeyboard(paket);

          // Edit message dengan detail paket
          await bot.editMessageCaption(detailPaket, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
          
        } catch (error) {
          console.error('Error fetching global stock:', error);
          
          // Fallback jika gagal fetch stok
          const { getKonfigurasi, getKuotaPaket } = require('../../../db');
          const harga = await getKonfigurasi(`harga_global_${paket}`) || await getKonfigurasi(`harga_${paket}`);
          const deskripsi = await getKonfigurasi(`deskripsi_global_${paket}`) || await getKonfigurasi(`deskripsi_${paket}`);
          const kuota = await getKuotaPaket(paket);
          
          const hargaValue = harga ? parseInt(harga) : 0;
          const kuotaText = kuota ? `${kuota}gb` : 'Tidak tersedia';
          
          const detailPaket = generateDetailPaketGlobal(paket, deskripsi, hargaValue, kuotaText, 0);
          const keyboard = generateDetailPaketGlobalKeyboard(paket);

          await bot.editMessageCaption(detailPaket, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        }
        
        await bot.answerCallbackQuery(id);
        return;
      }

      // === PROSES PEMBELIAN BULANAN GLOBAL ===
      if (/^proses_bulanan_global_(supermini|megabig|mini|big|jumbo|bigplus)$/i.test(data)) {
        const paket = data.split('_')[3].toLowerCase();
        
        try {
          // Cek stok global sebelum proses
          const stokPaketBulanan = await fetchStokPaketBulanan();
          const kodePaket = getKodePaket(paket);
          const stokCount = stokPaketBulanan[kodePaket]?.jumlah || 0;
          
          if (stokCount === 0) {
            return bot.answerCallbackQuery(id, {
              text: `❌ Stok paket ${paket.toUpperCase()} habis.\n\nSilakan pilih paket lain yang masih tersedia.`,
              show_alert: true
            });
          }
          
          // Kirim loading message
          const loadingMsg = await bot.sendMessage(chatId, '🌍 <b>Mengecek slot global...</b> 🌍', { parse_mode: 'HTML' });
          
          // Import handler bulanan global
          const handlerBulananGlobal = require('./handler_bulanan_global');
          const setStateBulananGlobal = handlerBulananGlobal.setStateBulananGlobal;
          
          // Set state untuk handler bulanan global
          setStateBulananGlobal(chatId, {
            step: 'pilih_slot_global',
            paket,
            kodePaket,
            userId: from.id,
            loadingMessageId: loadingMsg.message_id,
            originalMessageId: msgId,
            stokCount
          });

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

// Export functions untuk digunakan di tempat lain
module.exports.fetchStokPaketBulanan = fetchStokPaketBulanan;
module.exports.getKodePaket = getKodePaket;

// === END OF BULANAN GLOBAL HANDLER ===
