// Bot main handler yang bisa digunakan untuk polling atau webhook
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config({ debug: false, quiet: true });
const { getUserSaldo } = require('./db');

// Function untuk setup bot handlers
function setupBot(bot) {
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

  const originalEditMessageText = bot.editMessageText;
  bot.editMessageText = function(text, options = {}) {
    return originalEditMessageText.call(this, text, options).catch(error => {
      if (error.message && 
          (error.message.includes('message to edit not found') ||
           error.message.includes('message is not modified'))) {
        return Promise.resolve();
      }
      throw error;
    });
  };

  // Import dan setup semua handlers
  require('./allstok')(bot);
  require('./saldo_panel')(bot);
  require('./dompul')(bot);
  require('./menu/cek_stok')(bot);
  require('./menu/admin/atur_produk')(bot);
  require('./menu/admin/hapus_stok')(bot);
  require('./menu/admin/kurangi_saldo')(bot);
  require('./menu/admin/tambah_saldo')(bot);
  require('./menu/admin/tambah_stok')(bot);
  require('./menu/admin/massal')(bot);
  require('./menu/admin/pengaturan/atur_deskripsi')(bot);
  require('./menu/admin/pengaturan/atur_harga')(bot);
  require('./menu/admin/pengaturan/atur_kuota')(bot);
  require('./menu/admin/pengaturan/atur_lainnya')(bot);
  require('./menu/admin/pengaturan/biaya_operasi')(bot);
  require('./menu/admin/pengaturan/biaya/biaya_gagal')(bot);
  require('./menu/admin/pengaturan/biaya/minimal_bekasan')(bot);
  require('./menu/admin/pengaturan/biaya/minimal_bulanan')(bot);
  require('./menu/admin/pengaturan/biaya/tolak_bekasan')(bot);
  require('./menu/admin/pengaturan/biaya/tolak_bulanan')(bot);
  require('./menu/bekasan/handler_bekasan')(bot);
  require('./menu/bekasan/list_bekasan')(bot);
  require('./menu/bulanan/handler_bulanan')(bot);
  require('./menu/bulanan/list_bulanan')(bot);
  require('./produk_lainnya')(bot);

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

  // Template user detail
  const generateUserDetail = (userId, username, saldo, uptime) => {
    return '💌 <b>ID</b>           : <code>' + userId + '</code>\n' +
           '💌 <b>User</b>       : <code>' + (username || '-') + '</code>\n' +
           '📧 <b>Saldo</b>     : <code>Rp. ' + saldo.toLocaleString('id-ID') + '</code>\n' +
           '⌚ <b>Uptime</b>  : <code>' + uptime + '</code>';
  };

  const BOT_START_TIME = Date.now();

  // Main menu handler
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username;

    try {
      let saldo = 0;
      try {
        saldo = await getUserSaldo(userId, username);
      } catch (e) {}

      const uptime = formatUptime(Date.now() - BOT_START_TIME);
      const userDetail = generateUserDetail(userId, username, saldo, uptime);

      const mainMenuText = userDetail + '\n\n🏪 <b>SELAMAT DATANG DI TOKO KAMI</b>\n\n' +
                          'Pilih menu dibawah ini untuk melanjutkan:';

      const mainKeyboard = [
        [
          { text: "📊 CEK STOK", callback_data: "cek_stok" },
          { text: "🔄 DOMPUL", callback_data: "dompul" }
        ],
        [
          { text: "📅 BULANAN", callback_data: "bulanan" },
          { text: "📈 BEKASAN", callback_data: "bekasan" }
        ],
        [
          { text: "✨ PAKET LAINNYA ✨", callback_data: "paket_lainnya" }
        ]
      ];

      const responseMsg = await bot.sendPhoto(chatId, './welcome.jpg', {
        caption: mainMenuText,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: mainKeyboard
        }
      }, {
        filename: 'welcome.jpg',
        contentType: 'image/jpeg'
      });

      setTimeout(async () => {
        try {
          await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {}
      }, 1000);

    } catch (error) {
      console.error('Error in /start command:', error);
      try {
        await bot.sendMessage(chatId, '❌ <b>Terjadi kesalahan saat memuat menu utama</b>', {
          parse_mode: 'HTML'
        });
      } catch (e) {}
    }
  });

  // Callback query handlers
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const messageId = message?.message_id;
    const userId = from?.id;

    try {
      // Handle main menu callbacks
      if (data === 'paket_lainnya') {
        const produkLainnya = require('./produk_lainnya');
        await produkLainnya.showProductList(bot, chatId, messageId, userId, from.username);
        await bot.answerCallbackQuery(id);
        return;
      }

      if (data === 'back_to_menu') {
        let saldo = 0;
        try {
          saldo = await getUserSaldo(userId, from.username);
        } catch (e) {}

        const uptime = formatUptime(Date.now() - BOT_START_TIME);
        const userDetail = generateUserDetail(userId, from.username, saldo, uptime);

        const mainMenuText = userDetail + '\n\n🏪 <b>SELAMAT DATANG DI TOKO KAMI</b>\n\n' +
                            'Pilih menu dibawah ini untuk melanjutkan:';

        const mainKeyboard = [
          [
            { text: "📊 CEK STOK", callback_data: "cek_stok" },
            { text: "🔄 DOMPUL", callback_data: "dompul" }
          ],
          [
            { text: "📅 BULANAN", callback_data: "bulanan" },
            { text: "📈 BEKASAN", callback_data: "bekasan" }
          ],
          [
            { text: "✨ PAKET LAINNYA ✨", callback_data: "paket_lainnya" }
          ]
        ];

        if (message && (message.caption || message.photo)) {
          await bot.editMessageCaption(mainMenuText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: mainKeyboard
            }
          });
        } else {
          await bot.editMessageText(mainMenuText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: mainKeyboard
            }
          });
        }

        await bot.answerCallbackQuery(id);
        return;
      }

    } catch (error) {
      console.error('Error in main callback_query:', error);
      try {
        await bot.answerCallbackQuery(id, {
          text: "Terjadi kesalahan",
          show_alert: true
        });
      } catch (e) {}
    }
  });

  return bot;
}

// Export function untuk digunakan di webhook atau polling
module.exports = setupBot;

// Jika file ini dijalankan langsung (polling mode)
if (require.main === module) {
  const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
  setupBot(bot);
  console.log('🤖 Bot berhasil dimulai (Polling Mode)...');
}
