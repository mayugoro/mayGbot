const { getUserSaldo, getStok } = require('../../db');

// === PRELOAD INLINE KEYBOARDS ===
const BEKASAN_MENU_KEYBOARD = [
  [{ text: 'BEKASAN 3H', callback_data: 'bekasan_3h' }],
  [{ text: 'BEKASAN 4H', callback_data: 'bekasan_4h' }],
  [{ text: 'BEKASAN 5H', callback_data: 'bekasan_5h' }],
  [{ text: 'BEKASAN 6H', callback_data: 'bekasan_6h' }],
  [{ text: 'BEKASAN 7H', callback_data: 'bekasan_7h' }],
  [{ text: 'BEKASAN 8H', callback_data: 'bekasan_8h' }],
  [{ text: 'BEKASAN 9H', callback_data: 'bekasan_9h' }],
  [{ text: 'BEKASAN 10H', callback_data: 'bekasan_10h' }],
  [
    { text: 'KEMBALI', callback_data: 'back_to_menu' },
    { text: 'STOK BEKASAN', callback_data: 'cek_stok' }
  ]
];

// === MAIN KEYBOARD GENERATOR ===
const generateMainKeyboard = (userId) => {
  const keyboard = [
    [
      { text: '🗒️ REDEEM KODE 🗒️', callback_data: 'redeem_menu' }
    ],
    [
      { text: '📦 STOK BULANAN', callback_data: 'cek_stok_bulanan' },
      { text: '📦 STOK BEKASAN', callback_data: 'cek_stok' }
    ],
    [
      { text: '🌙 BELI BULANAN', callback_data: 'menu_bulanan' },
      { text: '⚡ BELI BEKASAN', callback_data: 'menu_bekasan' }
    ],
    [
      { text: '✨ AKRAB GLOBAL ✨', callback_data: 'menu_akrab_global' }
    ],
    [
      { text: '💌 CEK SIDOMPUL 💌', callback_data: 'cek_sidompul' }
    ]
  ];

  // Only add admin button if user is admin
  if (userId.toString() === process.env.ADMIN_ID) {
    keyboard.push([
      { text: '🛠️ ADMIN', callback_data: 'menu_admin' }
    ]);
  }

  return keyboard;
};

// Preload keyboard untuk detail paket (dengan callback_data dinamis)
const generateDetailBekaasanKeyboard = (kategori) => [
  [
    { text: 'KEMBALI', callback_data: 'menu_bekasan' },
    { text: '✅LANJUT BELI', callback_data: `proses_${kategori.toLowerCase()}` }
  ]
];

// Preload template pesan untuk detail bekasan
const generateDetailBekasan = (kategori, deskripsi, harga) => {
  const getDurasiText = (kat) => {
    const durasi = {
      '3H': '3 Hari', '4H': '4 Hari', '5H': '5 Hari', '6H': '6 Hari',
      '7H': '7 Hari', '8H': '8 Hari', '9H': '9 Hari', '10H': '10 Hari'
    };
    return durasi[kat] || `${kat.replace('H', '')} Hari`;
  };

  return `✨ <b>Detail BEKASAN ${kategori}</b>\n\n` +
    `📦 <b>Detail Paket:</b>\n` +
    `${deskripsi}\n\n` +
    `💰 <b>Detail Harga:</b>\n` +
    `💸 Rp. ${harga.toLocaleString('id-ID')}\n\n` +
    `📝 <b>Catatan:</b>\n` +
    `• Durasi: ${getDurasiText(kategori)}\n` +
    `• Dihitung mulai hari pembelian\n` +
    `• Tidak dapat di-refund!\n` +
    `• Berlaku untuk XL,Axis,Live-on✨`;
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
      // === BEKASAN MENU ===
      if (data === 'menu_bekasan') {
        // Cek saldo user sebelum masuk menu bekasan
        let saldo = 0;
        try {
          saldo = await getUserSaldo(from.id, from.username);
        } catch (e) {}

        // Ambil minimal saldo dari database
        const { getMinSaldoBekasan } = require('../../db');
        const minSaldo = await getMinSaldoBekasan();

        // Jika saldo kurang dari minimal saldo, tampilkan pop-up
        if (saldo < minSaldo) {
          // Ambil pesan penolakan custom dari database
          const { getKonfigurasi } = require('../../db');
          const pesanTolak = await getKonfigurasi('pesan_tolak_bekasan') || 'Saldo tidak cukup untuk akses menu ini\n\n⏤͟͟ᴍᴀʏᴜɢᴏʀᴏ';
          
          return bot.answerCallbackQuery(id, {
            text: pesanTolak,
            show_alert: true
          });
        }

        const keyboard = BEKASAN_MENU_KEYBOARD;

        // Cek jika ini adalah message biasa (text), edit keyboard saja
        if (!message.caption && !message.photo) {
          // Cek apakah keyboard sudah sama
          const currentReplyMarkup = message.reply_markup?.inline_keyboard;
          if (JSON.stringify(currentReplyMarkup) === JSON.stringify(keyboard)) {
            return bot.answerCallbackQuery(id, {
              text: '✅ Menu bekasan aktif.',
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
              text: '✅ Menu bekasan aktif.',
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

      // === PILIH BEKASAN XH ===
      if (/^bekasan_\d+h$/i.test(data)) {
        const kategori = data.split('_')[1].toUpperCase();
        
        // Ambil harga dan deskripsi dari database
        const { getHargaPaket, getDeskripsiPaket } = require('../../db');
        const harga = await getHargaPaket(kategori);
        const deskripsi = await getDeskripsiPaket(kategori);
        
        // Gunakan template preload untuk detail bekasan
        const detailPaket = generateDetailBekasan(kategori, deskripsi, harga);
        const keyboard = generateDetailBekaasanKeyboard(kategori);

        // Cek apakah message memiliki caption (untuk photo message)
        if (message.caption) {
          await bot.editMessageCaption(detailPaket, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } else {
          // Hapus message lama dan kirim message baru
          try {
            await bot.deleteMessage(chatId, msgId);
          } catch (e) {
            // Jika gagal hapus, tidak masalah
          }
          
          await bot.sendMessage(chatId, detailPaket, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        }
        return;
      }

      // === PROSES PEMBELIAN BEKASAN ===
      if (/^proses_\d+h$/i.test(data)) {
        const kategori = data.split('_')[1].toUpperCase();

        try {
          const list = await getStok(kategori);
          if (!list.length) {
            return bot.answerCallbackQuery(id, {
              text: `❌ Stok kategori ${kategori} kosong.\n\nCek stok dan pilih produk yg tersedia.`,
              show_alert: true
            });
          }

          const nomor_hp = list[Math.floor(Math.random() * list.length)];
          
          // Kirim loading message dan simpan message ID
          const loadingMsg = await bot.sendMessage(chatId, '📧 <b>Mengecek slot kosong...</b> 📧', { parse_mode: 'HTML' });

          // Import setStateBekasan dengan cara yang benar
          const handlerBekazan = require('./handler_bekasan');
          const setStateBekasan = handlerBekazan.setStateBekasan;
          
          // Set state langsung ke handler_bekasan
          setStateBekasan(chatId, {
            step: 'pilih_slot',
            kategori,
            nomor_hp,
            userId: from.id,
            loadingMessageId: loadingMsg.message_id,
            originalMessageId: msgId  // Simpan message ID detail bekasan untuk dihapus nanti
          });

        } catch (err) {
          console.error(`Error processing bekasan selection: ${err.message}`);
          return bot.answerCallbackQuery(id, {
            text: `_Sedang me-refresh token...\n\nSilahkan klik lagi *✅ LANJUT BELI!*_`,
            show_alert: true
          });
        }
        return;
      }

      // === BACK TO MENU ===
      if (data === 'back_to_menu') {
        const keyboard = generateMainKeyboard(from.id);

        // Ambil data user untuk ditampilkan
        let saldo = 0;
        try {
          saldo = await getUserSaldo(from.id, from.username);
        } catch (e) {}

        const uptime = formatUptime(Date.now() - BOT_START_TIME);
        const detail = generateUserDetail(from.id, from.username, saldo, uptime);

        // PENGECEKAN LEBIH KETAT - Cek apakah sudah di menu utama
        if (message.caption === detail && 
            message.reply_markup?.inline_keyboard && 
            JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Sudah di menu utama.',
            show_alert: false
          });
        }

        // Hanya edit jika benar-benar berbeda
        try {
          await bot.editMessageCaption(detail, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } catch (error) {
          // Jika error edit (kemungkinan karena sama), skip
          if (error.message.includes('message is not modified')) {
            return bot.answerCallbackQuery(id, {
              text: '✅ Sudah di menu utama.',
              show_alert: false
            });
          }
          console.error('Error editing caption:', error.message);
        }

        await bot.answerCallbackQuery(id);
        return;
      }
    } catch (err) {
      console.error(`Error processing callback query: ${err.message}`);
    }
  });
};
// === END OF BEKASAN HANDLER ===