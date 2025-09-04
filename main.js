const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config({ debug: false, quiet: true });
const { getUserSaldo } = require('./db');

// Deteksi mode: polling untuk development, webhook untuk production
const useWebhook = process.env.NODE_ENV === 'production' || process.argv.includes('--webhook');
const bot = useWebhook ? 
  new TelegramBot(process.env.BOT_TOKEN, { webHook: true }) : 
  new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Override bot methods untuk silent error handling
const originalEditMessageCaption = bot.editMessageCaption;
bot.editMessageCaption = function(caption, options = {}) {
  return originalEditMessageCaption.call(this, caption, options).catch(error => {
    // Silent ignore untuk error editing yang umum
    if (error.message && 
        (error.message.includes('message to edit not found') ||
         error.message.includes('there is no caption in the message to edit'))) {
      return Promise.resolve(); // Return resolved promise instead of rejection
    }
    throw error; // Re-throw error lain yang penting
  });
};

// Global error handler untuk menangani error non-kritis
bot.on('polling_error', (error) => {
  // Suppress common non-critical errors
  if (error.code === 'ETELEGRAM' && 
      (error.message.includes('query is too old') || 
       error.message.includes('response timeout expired') ||
       error.message.includes('query ID is invalid'))) {
    return; // Silent ignore untuk error callback query timeout
  }
  console.error('Polling error:', error);
});

// Override bot answerCallbackQuery untuk silent error handling
const originalAnswerCallbackQuery = bot.answerCallbackQuery;
bot.answerCallbackQuery = function(callbackQueryId, options = {}) {
  return originalAnswerCallbackQuery.call(this, callbackQueryId, options).catch(error => {
    // Silent ignore untuk callback query errors yang umum
    if (error.message && 
        (error.message.includes('query is too old and response timeout expired') ||
         error.message.includes('query ID is invalid'))) {
      return Promise.resolve(); // Return resolved promise instead of rejection
    }
    throw error; // Re-throw error lain yang penting
  });
};

// Suppress console errors untuk editing caption yang mengganggu
const originalError = console.error;
console.error = function(message, ...args) {
  // Filter error messages yang mengganggu
  if (typeof message === 'string' && 
      (message.includes('Error editing caption: ETELEGRAM') ||
       message.includes('message to edit not found') ||
       message.includes('there is no caption in the message to edit') ||
       message.includes('query is too old and response timeout expired') ||
       message.includes('query ID is invalid'))) {
    return; // Silent ignore
  }
  originalError.apply(console, [message, ...args]);
};

// Tangkap unhandled promise rejections untuk error editing
process.on('unhandledRejection', (reason, promise) => {
  if (reason && reason.message && 
      (reason.message.includes('message to edit not found') ||
       reason.message.includes('there is no caption in the message to edit') ||
       reason.message.includes('query is too old and response timeout expired') ||
       reason.message.includes('query ID is invalid'))) {
    return; // Silent ignore untuk error umum yang tidak kritis
  }
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Simpan waktu bot start
const BOT_START_TIME = Date.now();

// Initialize transaction logger
(async () => {
  try {
    const { testLogging } = require('./transaction_logger');
    await testLogging(bot);
  } catch (error) {
    console.error('Transaction logger initialization failed:', error.message);
  }
})();

// Initialize stok monitoring logger
(async () => {
  try {
    const { startStokMonitoring, testStokLogging, STOK_LOG_ENABLED, STOK_LOG_CHAT_ID, STOK_LOG_MESSAGE_ID } = require('./stok_logger');
    
    // Test stok logging configuration
    const stokTestResult = await testStokLogging(bot);
    
    if (stokTestResult && STOK_LOG_ENABLED && STOK_LOG_CHAT_ID && STOK_LOG_MESSAGE_ID) {
      // Start monitoring with 30 second interval
      startStokMonitoring(bot, 30000);
      console.log('✅ Stok monitoring started');
    }
  } catch (error) {
    console.error('Stok monitoring initialization failed:', error.message);
  }
})();

// === PRELOAD INLINE KEYBOARDS ===
// Function untuk generate main keyboard berdasarkan user ID
const generateMainKeyboard = (userId) => {
  const baseKeyboard = [
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

  // Tambahkan tombol ADMIN hanya untuk admin
  if (userId && userId.toString() === process.env.ADMIN_ID) {
    baseKeyboard.push([
      { text: '🛠️ ADMIN', callback_data: 'menu_admin' }
    ]);
  }

  return baseKeyboard;
};

// Legacy MAIN_KEYBOARD untuk backward compatibility (tanpa admin button)
const MAIN_KEYBOARD = [
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

// Preload template pesan untuk performa yang lebih baik
const generateUserDetail = (userId, username, saldo, uptime) => {
  return '💌 <b>ID</b>           : <code>' + userId + '</code>\n' +
         '💌 <b>User</b>       : <code>' + (username || '-') + '</code>\n' +
         '📧 <b>Saldo</b>     : <code>Rp. ' + saldo.toLocaleString('id-ID') + '</code>\n' +
         '⌚ <b>Uptime</b>  : <code>' + uptime + '</code>';
};

// Fungsi format uptime
function formatUptime(ms) {
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
}

// === /start ===
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Halo 🗿');
});

// === /menu ===
bot.onText(/\/menu/, async (msg) => {
  let saldo = 0;
  try {
    saldo = await getUserSaldo(msg.from.id, msg.from.username);
  } catch (e) {}

  const uptime = formatUptime(Date.now() - BOT_START_TIME);
  const detail = generateUserDetail(msg.from.id, msg.from.username, saldo, uptime);

  await bot.sendPhoto(msg.chat.id, './welcome.jpg', {
    caption: detail,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: generateMainKeyboard(msg.from.id) }
  }, {
    filename: 'welcome.jpg',
    contentType: 'image/jpeg'
  });

  // Auto-delete command message setelah respons dikirim
  setTimeout(async () => {
    try {
      await bot.deleteMessage(msg.chat.id, msg.message_id);
    } catch (e) {
      // Ignore delete error
    }
  }, 1000);
});

// === Handler callback_query universal ===
bot.on('callback_query', async (query) => {
  const { data, message, id, from } = query;
  const chatId = message?.chat?.id;
  const msgId = message?.message_id;
  const userId = from?.id;

  // Handler untuk CEK SIDOMPUL
  if (data === 'cek_sidompul') {
    try {
      // Require dompul module untuk akses fungsi internal
      const dompulModule = require('./dompul');
      
      // Cek apakah fitur dompul aktif
      const { isDompulEnabled, isAuthorized } = dompulModule;
      
      if (typeof isDompulEnabled === 'function') {
        const enabled = await isDompulEnabled();
        const isAdmin = typeof isAuthorized === 'function' ? isAuthorized(userId) : false;
        
        if (!enabled && !isAdmin) {
          return bot.answerCallbackQuery(id, {
            text: "❌ Fitur CEK SIDOMPUL sedang ditutup!",
            show_alert: true
          });
        }
      }

      // Set state untuk input nomor
      const dompulStates = require('./dompul').dompulStates || new Map();
      dompulStates.set(chatId, { 
        step: 'input_nomor',
        inputMessageId: msgId  // Gunakan message ID yang ada
      });
      
      // Edit pesan yang ada menjadi form input CEK SIDOMPUL
      const dompulText = '💌 <b>CEK SIDOMPUL</b> 💌\n\n' +
        '<i>Masukan nomor . . .\n' +
        'Bisa massal, pisahkan dengan Enter.</i>';
      
      const dompulKeyboard = [
        [{ text: '🔙 KEMBALI', callback_data: 'back_to_menu' }]
      ];

      // Edit message (baik caption maupun text)
      try {
        if (message.caption !== undefined) {
          // Message punya caption (photo message)
          await bot.editMessageCaption(dompulText, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: dompulKeyboard }
          });
        } else {
          // Message punya text (text message)
          await bot.editMessageText(dompulText, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: dompulKeyboard }
          });
        }
      } catch (editError) {
        // Jika edit gagal, kirim pesan baru
        await bot.sendMessage(chatId, dompulText, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: dompulKeyboard }
        });
      }

      await bot.answerCallbackQuery(id, {
        text: "✅ CEK SIDOMPUL siap!",
        show_alert: false
      });
      return;

    } catch (error) {
      console.error('Error in cek_sidompul callback:', error);
      
      return bot.answerCallbackQuery(id, {
        text: "❌ Terjadi kesalahan saat memulai CEK SIDOMPUL",
        show_alert: true
      });
    }
  }

  // Handler untuk paket lainnya (memanggil produk.js)
  if (data === 'menu_akrab_global') {
    try {
      // Panggil handler produk untuk menampilkan daftar produk
      const produkModule = require('./produk_lainnya');
      await produkModule.showProductList(bot, chatId, msgId, userId, from.username);
      
      await bot.answerCallbackQuery(id);
      return;

    } catch (error) {
      console.error('Error in menu_akrab_global callback:', error);
      return bot.answerCallbackQuery(id, {
        text: "❌ Terjadi kesalahan saat memuat produk",
        show_alert: true
      });
    }
  }

  if (data === 'back_to_menu') {
    // Cek jika sedang dalam dompul state, hapus state tersebut
    const dompulStates = require('./dompul').dompulStates || new Map();
    if (dompulStates.has(chatId)) {
      dompulStates.delete(chatId);
    }

    let saldo = 0;
    try {
      saldo = await getUserSaldo(from.id, from.username);
    } catch (e) {}

    const uptime = formatUptime(Date.now() - BOT_START_TIME);
    const detail = generateUserDetail(from.id, from.username, saldo, uptime);

    // PENGECEKAN LEBIH KETAT - Pastikan tidak edit jika sudah sama persis
    if (message.caption === detail && 
        message.reply_markup?.inline_keyboard && 
        JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(generateMainKeyboard(query.from.id))) {
      return bot.answerCallbackQuery(id, {
        text: 'Jangan lupa isi saldo🗿.',
        show_alert: false
      });
    }

    try {
      // Cek apakah message memiliki caption atau text
      if (message.caption !== undefined) {
        // Message punya caption (photo message)
        await bot.editMessageCaption(detail, {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: generateMainKeyboard(query.from.id) }
        });
      } else {
        // Message punya text (text message) - langsung ganti ke photo message
        await bot.deleteMessage(chatId, msgId);
        await bot.sendPhoto(chatId, './welcome.jpg', {
          caption: detail,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: generateMainKeyboard(query.from.id) }
        }, {
          filename: 'welcome.jpg',
          contentType: 'image/jpeg'
        });
      }
    } catch (error) {
      // Silent handling untuk error yang umum terjadi
      if (error.message && (error.message.includes('message to edit not found') || 
          error.message.includes('message is not modified') ||
          error.message.includes('there is no caption in the message to edit'))) {
        return bot.answerCallbackQuery(id, {
          text: 'Jangan lupa isi saldo🗿.',
          show_alert: false
        });
      }
      
      // Jika edit gagal, coba kirim menu baru tanpa log error yang mengganggu
      try {
        await bot.sendPhoto(chatId, './welcome.jpg', {
          caption: detail,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: generateMainKeyboard(query.from.id) }
        }, {
          filename: 'welcome.jpg',
          contentType: 'image/jpeg'
        });
      } catch (e) {
        // Silent ignore untuk error sekunder
      }
      
      return bot.answerCallbackQuery(id, {
        text: '✅ Menu dimuat ulang.',
        show_alert: false
      });
    }
    
    await bot.answerCallbackQuery(id);
    return;
  }
});

// Load semua handler
require('./menu/cek_stok')(bot);
require('./menu/bekasan/list_bekasan')(bot, formatUptime, BOT_START_TIME);
require('./menu/bekasan/handler_bekasan')(bot);
require('./menu/bulanan/list_bulanan')(bot, formatUptime, BOT_START_TIME);
require('./menu/bulanan/handler_bulanan')(bot);
require('./menu/admin/tambah_saldo')(bot);
require('./menu/admin/kurangi_saldo')(bot);
require('./menu/admin/tambah_stok')(bot);
require('./menu/admin/hapus_stok')(bot);
require('./menu/admin/atur_produk')(bot);
require('./menu/admin/massal')(bot);
require('./broadcast')(bot);
require('./getalluser')(bot);
require('./kickanggota')(bot);
require('./setbanner')(bot);
require('./allstok')(bot);
require('./trxid')(bot);
require('./cmd')(bot);
require('./saldo_panel')(bot);
require('./code')(bot);
require('./code/create')(bot);
require('./code/redeem')(bot);
require('./delete')(bot);
require('./produk_lainnya')(bot);
require('./dompul')(bot);

// Transaction logger sudah berjalan otomatis, tidak perlu admin commands

console.log('🤖 Bot berhasil dimulai...');

// Export bot untuk digunakan di webhook
module.exports = bot;
