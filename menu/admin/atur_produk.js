// === PRELOAD INLINE KEYBOARDS ===
const ADMIN_MENU_KEYBOARD = [
  [{ text: '♻️ SWITCH HANDLER', callback_data: 'switch_api' }],
  [
    { text: '⚪ OTP HIDE', callback_data: 'otp_hide' },
    { text: '🟢 OTP KHFY', callback_data: 'otp_khfy' }
  ],
  [
    { text: '🗑️ HAPUS STOK', callback_data: 'hapus_stok' },
    { text: '➕ TAMBAH STOK', callback_data: 'tambah_stok' }
  ],
  [
    { text: '➖ KURANGI SALDO', callback_data: 'kurangi_saldo' },
    { text: '➕ TAMBAH SALDO', callback_data: 'tambah_saldo' }
  ],
  [
    { text: '⚙️ ATUR PRODUK', callback_data: 'atur_produk' },
    { text: '⚡ MASSAL', callback_data: 'menu_massal' }
  ],
  [{ text: '👺 AKRAB', callback_data: 'manage_akrab' }],
  [{ text: '🔙 KEMBALI', callback_data: 'back_to_menu' }]
];

const ATUR_PRODUK_KEYBOARD = [
  [
    { text: '💰 ATUR HARGA', callback_data: 'atur_harga' },
    { text: '📝 ATUR DESKRIPSI', callback_data: 'atur_deskripsi' }
  ],
  [
    { text: '🌙 SETTING KUOTA', callback_data: 'atur_kuota_bulanan' },
    { text: '⚙️ BIAYA OPERASI', callback_data: 'biaya_operasi' }
  ],
  [
    { text: '👀 LIHAT SEMUA', callback_data: 'lihat_konfigurasi' }
  ],
  [{ text: '🔙 KEMBALI', callback_data: 'menu_admin' }]
];

// Preload template content
const ATUR_PRODUK_CONTENT = '⚙️ <b>ATUR PRODUK</b>\n\nPilih pengaturan yang ingin diubah:';

// Preload template user detail (sama seperti modules lain)
const generateUserDetail = (userId, username, saldo, uptime) => {
  return '💌 <b>ID</b>           : <code>' + userId + '</code>\n' +
         '💌 <b>User</b>       : <code>' + (username || '-') + '</code>\n' +
         '📧 <b>Saldo</b>     : <code>Rp. ' + saldo.toLocaleString('id-ID') + '</code>\n' +
         '⌚ <b>Uptime</b>  : <code>' + uptime + '</code>';
};

// Preload uptime formatter (sama seperti main.js)
const formatUptime = (ms) => {
  let s = Math.floor(ms / 1000);
  const hari = Math.floor(s / 86400);
  s %= 86400;
  const jam = Math.floor(s / 3600);
  s %= 3600;
  const menit = Math.floor(s / 60);
  const detik = s % 60;
  let hasil = [];
  if (hari > 0) hasil.push(`${hari} hari`);
  if (jam > 0) hasil.push(`${jam} jam`);
  if (menit > 0) hasil.push(`${menit} menit`);
  if (detik > 0 || hasil.length === 0) hasil.push(`${detik} detik`);
  return hasil.join(' ');
};

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    // === ADMIN MENU ===
    if (data === 'menu_admin') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, {
          text: 'ente mau ngapain wak🗿',
          show_alert: true
        });
      }
      
      const keyboard = ADMIN_MENU_KEYBOARD;

      // Cek apakah message memiliki caption (dari photo message)
      if (message.caption) {
        // Kembalikan ke caption admin yang benar (dengan data user)
        const { getUserSaldo } = require('../../db');
        let saldo = 0;
        try {
          saldo = await getUserSaldo(from.id, from.username);
        } catch (e) {}

        // Ambil uptime dari main.js (approximate)
        const BOT_START_TIME = Date.now() - (process.uptime() * 1000);
        const uptime = formatUptime(Date.now() - BOT_START_TIME);
        const detail = generateUserDetail(from.id, from.username, saldo, uptime);

        // Cek apakah caption dan keyboard sudah sama
        if (message.caption === detail && 
            message.reply_markup?.inline_keyboard && 
            JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu ADMIN aktif.',
            show_alert: false
          });
        }

        try {
          await bot.editMessageCaption(detail, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } catch (error) {
          // Jika error edit, skip
          if (error.message.includes('message is not modified')) {
            return bot.answerCallbackQuery(id, {
              text: '✅ Menu ADMIN aktif.',
              show_alert: false
            });
          }
          console.error('Error editing admin caption:', error.message);
        }
      } else {
        // Cek jika reply markup sudah sama untuk mencegah error "message is not modified"
        const currentReplyMarkup = message.reply_markup?.inline_keyboard;
        if (JSON.stringify(currentReplyMarkup) === JSON.stringify(keyboard)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu ADMIN aktif.',
            show_alert: false
          });
        }

        try {
          await bot.editMessageReplyMarkup({
            inline_keyboard: keyboard
          }, {
            chat_id: chatId,
            message_id: msgId
          });
        } catch (error) {
          // Jika error edit, skip
          if (error.message.includes('message is not modified')) {
            return bot.answerCallbackQuery(id, {
              text: '✅ Menu ADMIN aktif.',
              show_alert: false
            });
          }
          console.error('Error editing admin markup:', error.message);
        }
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === SWITCH API REDIRECT ===
    if (data === 'switch_api') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, {
          text: 'ente mau ngapain wak🗿',
          show_alert: true
        });
      }
      
      // Redirect ke switch_api_menu handler di switch.js
      // Simulate callback dengan data switch_api_menu
      const simulatedCallback = {
        ...query,
        data: 'switch_api_menu'
      };
      
      // Panggil handler switch_api_menu secara langsung
      const switchContent = `🔄 <b>SWITCH API HANDLER</b>\n\n` +
        `🟢 <b>KHFY API:</b> Menggunakan API KHFY untuk semua operasi\n` +
        `⚪ <b>HIDE API:</b> Menggunakan API HIDE untuk semua operasi\n\n` +
        `💡 <b>Info:</b> Switch akan mengganti handler aktif dan membutuhkan restart bot`;
      
      try {
        if (message.caption) {
          // Message has photo, edit caption
          await bot.editMessageCaption(switchContent, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '⚪ SWITCH KE HIDE', callback_data: 'switch_hide_menu' },
                  { text: '🟢 SWITCH KE KHFY', callback_data: 'switch_khfy_menu' }
                ],
                [
                  { text: '❗ STATUS HANDLER', callback_data: 'status_all_handler' }
                ],
                [ 
                  { text: '🔙 KEMBALI', callback_data: 'menu_admin' }
                ]
              ]
            }
          });
        } else {
          // Message has text, edit text
          await bot.editMessageText(switchContent, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '⚪ SWITCH KE HIDE', callback_data: 'switch_hide_menu' },
                  { text: '🟢 SWITCH KE KHFY', callback_data: 'switch_khfy_menu' }
                ],
                [
                  { text: '❗ STATUS HANDLER', callback_data: 'status_all_handler' }
                ],
                [ 
                  { text: '🔙 KEMBALI', callback_data: 'menu_admin' }
                ]
              ]
            }
          });
        }
      } catch (error) {
        console.error('Error editing switch_api message:', error.message);
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === ATUR PRODUK MENU ===
    if (data === 'atur_produk') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, {
          text: 'ente mau ngapain wak🗿',
          show_alert: true
        });
      }
      
      const keyboard = ATUR_PRODUK_KEYBOARD;
      const content = ATUR_PRODUK_CONTENT;

      // Cek apakah message memiliki caption (dari photo message)
      if (message.caption) {
        // Cek apakah caption dan keyboard sudah sama
        if (message.caption === content && 
            message.reply_markup?.inline_keyboard && 
            JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu Atur Produk aktif.',
            show_alert: false
          });
        }

        try {
          await bot.editMessageCaption(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } catch (error) {
          if (error.message.includes('message is not modified')) {
            return bot.answerCallbackQuery(id, {
              text: '✅ Menu Atur Produk aktif.',
              show_alert: false
            });
          }
          console.error('Error editing atur_produk caption:', error.message);
        }
      } else {
        // Cek apakah text dan keyboard sudah sama
        if (message.text === content && 
            message.reply_markup?.inline_keyboard && 
            JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu Atur Produk aktif.',
            show_alert: false
          });
        }

        try {
          await bot.editMessageText(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } catch (error) {
          if (error.message.includes('message is not modified')) {
            return bot.answerCallbackQuery(id, {
              text: '✅ Menu Atur Produk aktif.',
              show_alert: false
            });
          }
          console.error('Error editing atur_produk text:', error.message);
        }
      }

      await bot.answerCallbackQuery(id);
      return;
    }
  });

  // Load semua sub-pengaturan
  try {
    require('./switch')(bot); // Load SWITCH API handler
    require('./otphide')(bot); // Load OTP HIDE handler
    require('./otpkhfy')(bot); // Load OTP KHFY handler
    require('./manage_akrab')(bot); // Load AKRAB handler
    require('./pengaturan/atur_harga')(bot);
    require('./pengaturan/atur_deskripsi')(bot);
    require('./pengaturan/atur_kuota')(bot);
    require('./pengaturan/atur_lainnya')(bot);
    require('./pengaturan/biaya_operasi')(bot); // Handler baru untuk biaya operasi
  } catch (error) {
    console.error('Error loading pengaturan modules:', error.message);
    console.log('📁 Pastikan folder pengaturan/ dan file-filenya sudah dibuat:');
    console.log('   - ./switch.js');
    console.log('   - ./otphide.js');
    console.log('   - ./otpkhfy.js');
    console.log('   - ./pengaturan/atur_harga.js');
    console.log('   - ./pengaturan/atur_deskripsi.js');
    console.log('   - ./pengaturan/atur_kuota.js');
    console.log('   - ./pengaturan/atur_lainnya.js');
    console.log('   - ./pengaturan/biaya_operasi.js');
  }
};
