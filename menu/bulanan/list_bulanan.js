const { getUserSaldo, getKonfigurasi } = require('../../db');

// === PRELOAD INLINE KEYBOARDS ===
const BULANAN_MENU_KEYBOARD = [
  [{ text: 'SUPERMINI', callback_data: 'bulanan_supermini' }],
  [{ text: 'SUPERBIG', callback_data: 'bulanan_superbig' }],
  [{ text: 'MINI', callback_data: 'bulanan_mini' }],
  [{ text: 'BIG', callback_data: 'bulanan_big' }],
  [{ text: 'LITE', callback_data: 'bulanan_lite' }],
  [{ text: 'JUMBO', callback_data: 'bulanan_jumbo' }],
  [{ text: 'MEGABIG', callback_data: 'bulanan_megabig' }],
  [{ text: 'SUPER JUMBO', callback_data: 'bulanan_superjumbo' }],
  [
    { text: 'KEMBALI', callback_data: 'back_to_menu' },
    { text: 'STOK BULANAN', callback_data: 'cek_stok_bulanan' }
  ]
];

// Preload keyboard untuk detail paket (akan digunakan dengan callback_data dinamis)
const generateDetailPaketKeyboard = (paket) => [
  [
    { text: 'KEMBALI', callback_data: 'menu_bulanan' },
    { text: '✅LANJUT BELI', callback_data: `proses_bulanan_${paket}` }
  ]
];

// Preload template pesan untuk detail paket
const generateDetailPaket = (paket, deskripsi, hargaValue, kuotaText) => {
  return `🌙 <b>Detail BULANAN ${paket.toUpperCase()}</b>\n\n` +
    `📦 <b>Detail Paket:</b>\n` +
    `${deskripsi || 'Deskripsi tidak tersedia'}\n\n` +
    `💰 <b>Detail Harga:</b>\n` +
    `💸 Rp. ${hargaValue.toLocaleString('id-ID')}\n\n` +
    `📝 <b>Catatan:</b>\n` +
    `• ✅Kuota bersama : ${kuotaText || 'Tidak tersedia'}\n` +
    `• ✅Aktif segera setelah pembelian\n` +
    `• ✅Full garansi\n` +
    `• ✅Berlaku untuk XL,Axis,Live-on✨`;
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
      // === BULANAN MENU ===
      if (data === 'menu_bulanan') {
        // Cek saldo user sebelum masuk menu bulanan
        let saldo = 0;
        try {
          saldo = await getUserSaldo(from.id, from.username);
        } catch (e) {}

        // Ambil minimal saldo dari database
        const minSaldo = await getKonfigurasi('min_saldo_bulanan');
        const minSaldoValue = minSaldo ? parseInt(minSaldo) : 100000;

        // Pop-up alert untuk penolakan akses, dengan acuan saldo minimal
        if (saldo < minSaldoValue) {
          // Ambil pesan penolakan custom dari database
          const pesanTolak = await getKonfigurasi('pesan_tolak_bulanan') || 'Saldo tidak cukup untuk akses menu ini\n\n⏤͟͟ᴍᴀʏᴜɢᴏʀᴏ';
          
          return bot.answerCallbackQuery(id, {
            text: pesanTolak,
            show_alert: true
          });
        }

        const keyboard = BULANAN_MENU_KEYBOARD;

        // Cek jika ini adalah message biasa (text), edit keyboard saja
        if (!message.caption && !message.photo) {
          // Cek apakah keyboard sudah sama
          const currentReplyMarkup = message.reply_markup?.inline_keyboard;
          if (JSON.stringify(currentReplyMarkup) === JSON.stringify(keyboard)) {
            return bot.answerCallbackQuery(id, {
              text: '✅ Menu bulanan aktif.',
              show_alert: false
            });
          }

          await bot.editMessageReplyMarkup({
            inline_keyboard: keyboard
          }, {
            chat_id: chatId,
            message_id: msgId
          });
        } else {
          // Ambil data user untuk ditampilkan
          const uptime = formatUptime(Date.now() - BOT_START_TIME);
          const detail = generateUserDetail(from.id, from.username, saldo, uptime);

          // Cek apakah caption dan keyboard sudah sama
          if (message.caption === detail && 
              message.reply_markup?.inline_keyboard && 
              JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
            return bot.answerCallbackQuery(id, {
              text: '✅ Menu bulanan aktif.',
              show_alert: false
            });
          }

          await bot.editMessageCaption(detail, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        }

        await bot.answerCallbackQuery(id);
        return;
      }

      // === PILIH PAKET BULANAN ===
      if (/^bulanan_(supermini|superbig|mini|big|lite|jumbo|megabig|superjumbo)$/i.test(data)) {
        const paket = data.split('_')[1].toLowerCase();
        
        // Ambil harga, deskripsi, dan kuota dari database
        const { getKonfigurasi, getKuotaPaket } = require('../../db');
        const harga = await getKonfigurasi(`harga_${paket}`);
        const deskripsi = await getKonfigurasi(`deskripsi_${paket}`);
        const kuota = await getKuotaPaket(paket);
        
        const hargaValue = harga ? parseInt(harga) : 0;
        const kuotaText = kuota ? `${kuota}gb` : 'Tidak tersedia';
        
        // Gunakan template preload untuk detail paket
        const detailPaket = generateDetailPaket(paket, deskripsi, hargaValue, kuotaText);
        const keyboard = generateDetailPaketKeyboard(paket);

        // Cek apakah message memiliki caption (untuk photo message)
        if (message.caption) {
          await bot.editMessageCaption(detailPaket, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } else {
          // Edit message text untuk text message
          await bot.editMessageText(detailPaket, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        }
        return;
      }

      // === PROSES PEMBELIAN BULANAN ===
      if (/^proses_bulanan_(supermini|superbig|mini|big|lite|jumbo|megabig|superjumbo)$/i.test(data)) {
        const paket = data.split('_')[2].toLowerCase();
        
        // Cek stok bulanan sebelum proses
        try {
          const { getStok } = require('../../db');
          const list = await getStok(paket.toUpperCase());
          
          if (!list.length) {
            return bot.answerCallbackQuery(id, {
              text: `❌ Stok paket ${paket.toUpperCase()} kosong.\n\nCek stok dan pilih paket yang tersedia.`,
              show_alert: true
            });
          }
          
          const nomor_hp = list[Math.floor(Math.random() * list.length)];
          
          // Kirim loading message dan simpan message ID
          const loadingMsg = await bot.sendMessage(chatId, '📧 <b>Mengecek slot kosong...</b> 📧', { parse_mode: 'HTML' });
          
          // Import setStateBulanan dengan cara yang benar
          const handlerBulanan = require('./handler_bulanan');
          const setStateBulanan = handlerBulanan.setStateBulanan;
          
          // Set state langsung ke handler_bulanan
          setStateBulanan(chatId, {
            step: 'pilih_slot',
            paket,
            nomor_hp,
            userId: from.id,
            loadingMessageId: loadingMsg.message_id,
            originalMessageId: msgId  // Simpan message ID detail bulanan untuk dihapus nanti
          });

        } catch (err) {
          return bot.answerCallbackQuery(id, {
            text: `_Sedang me-refresh token...\n\nSilahkan klik lagi *✅ LANJUT BELI!*_`,
            show_alert: true
          });
        }
        return;
      }

    } catch (err) {
      console.error(`Error processing bulanan callback query: ${err.message}`);
    }
  });
};
// === END OF BULANAN HANDLER ===