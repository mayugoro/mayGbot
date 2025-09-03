// Preload keyboard untuk menu utama code
const mainCodeKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [{ text: 'BUAT CODE REDEEM', callback_data: 'create_code' }],
      [{ text: 'BACK TO MENU', callback_data: 'back_to_menu' }]
    ]
  }
};

// Function untuk cek admin
const isAdmin = (userId) => {
  return userId.toString() === process.env.ADMIN_ID;
};

module.exports = (bot) => {
  // Command handler untuk /code
  bot.onText(/^\/code$/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Cek apakah user adalah admin
    if (!isAdmin(userId)) {
      await bot.sendMessage(chatId, '❌ <b>Akses ditolak!</b>\n\nPerintah ini khusus untuk admin.', {
        parse_mode: 'HTML'
      });
      return;
    }

    const teksMenu = `🎫 <b>SISTEM CODE REDEEM</b>\n\n` +
      `Pilih opsi di bawah ini:`;

    await bot.sendMessage(chatId, teksMenu, {
      parse_mode: 'HTML',
      ...mainCodeKeyboard
    });
  });

  // Handler untuk teks biasa (code, kode, buat kode)
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text?.toLowerCase().trim();

    // Skip jika bukan text message atau command
    if (!text || text.startsWith('/')) return;

    // Cek apakah text match dengan trigger words
    const triggerWords = ['code', 'kode', 'buat kode', 'buat code'];
    if (!triggerWords.includes(text)) return;

    // Cek apakah user adalah admin
    if (!isAdmin(userId)) {
      await bot.sendMessage(chatId, '❌ <b>Akses ditolak!</b>\n\nPerintah ini khusus untuk admin.', {
        parse_mode: 'HTML'
      });
      return;
    }

    const teksMenu = `🎫 <b>SISTEM CODE REDEEM</b>\n\n` +
      `Pilih opsi di bawah ini:`;

    await bot.sendMessage(chatId, teksMenu, {
      parse_mode: 'HTML',
      ...mainCodeKeyboard
    });

    // Hapus message trigger untuk UI yang bersih
    try {
      await bot.deleteMessage(chatId, msg.message_id);
    } catch (e) {
      // Ignore delete error
    }
  });
};
