// Handler untuk AKRAB GLOBAL
const { getUserSaldo } = require('./db');

// Fungsi format uptime (sama seperti main.js)
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

// Template user detail (sama seperti main.js)
const generateUserDetail = (userId, username, saldo, uptime) => {
  return '💌 <b>ID</b>           : <code>' + userId + '</code>\n' +
         '💌 <b>User</b>       : <code>' + (username || '-') + '</code>\n' +
         '📧 <b>Saldo</b>     : <code>Rp. ' + saldo.toLocaleString('id-ID') + '</code>\n' +
         '⌚ <b>Uptime</b>  : <code>' + uptime + '</code>';
};

// Simpan waktu bot start (akan diambil dari main.js)
const BOT_START_TIME = Date.now();

// Fungsi untuk menampilkan menu AKRAB GLOBAL (dipanggil dari main.js)
async function showAkrabGlobalMenu(bot, chatId, messageId, userId, username) {
  try {
    // Ambil saldo user
    let saldo = 0;
    try {
      saldo = await getUserSaldo(userId, username);
    } catch (e) {}

    // Format uptime dan user detail
    const uptime = formatUptime(Date.now() - BOT_START_TIME);
    const userDetail = generateUserDetail(userId, username, saldo, uptime);

    // Keyboard untuk AKRAB GLOBAL
    const akrabGlobalKeyboard = [
      [
        { text: '📦 STOK BULANAN', callback_data: 'cek_stok_bulanan' },
        { text: '📦 STOK BEKASAN', callback_data: 'cek_stok' }
      ],
      [
        { text: '🌙 BELI BULANAN', callback_data: 'menu_bulanan' },
        { text: '⚡ BELI BEKASAN', callback_data: 'menu_bekasan' }
      ],
      [
        { text: '🔙 KEMBALI', callback_data: 'back_to_menu' }
      ]
    ];

    // Format teks untuk AKRAB GLOBAL (hanya user detail)
    const akrabText = userDetail;

    // Edit message dengan menu AKRAB GLOBAL
    await bot.editMessageCaption(akrabText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: akrabGlobalKeyboard
      }
    });

  } catch (error) {
    throw error; // Re-throw untuk ditangani di main.js
  }
}

module.exports = function(bot) {
  
  // Handle callback query untuk AKRAB GLOBAL
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const messageId = message?.message_id;
    const userId = from?.id;

    // Handle callback untuk menampilkan menu AKRAB GLOBAL
    if (data === 'akrab_global') {
      try {
        await showAkrabGlobalMenu(bot, chatId, messageId, userId, from.username);
        await bot.answerCallbackQuery(id);
        return;
      } catch (error) {
        console.error('Error showing AKRAB GLOBAL menu:', error);
        return bot.answerCallbackQuery(id, {
          text: "❌ Terjadi kesalahan saat menampilkan menu AKRAB GLOBAL",
          show_alert: true
        });
      }
    }
  });
};

// Export fungsi untuk digunakan di main.js
module.exports.showAkrabGlobalMenu = showAkrabGlobalMenu;