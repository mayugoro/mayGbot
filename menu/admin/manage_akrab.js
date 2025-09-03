// === KEYBOARD MENU AKRAB ===
const MANAGE_AKRAB_KEYBOARD = [
  [
    { text: '🔍 CEK SLOT', callback_data: 'cekslot1' },
    { text: '⚡ TAMBAH', callback_data: 'add1' }
  ],
  [
    { text: '🦵 KICK', callback_data: 'kick1' },
    { text: '🛠️ EDIT KUBER', callback_data: 'editkuber1' }
  ],
  [ 
    { text: '🔙 KEMBALI', callback_data: 'menu_admin' }
  ]
];

// Template konten menu
const MANAGE_AKRAB_CONTENT = '👺 <b>KELOLA AKRAB</b>\n\nPilih operasi AKRAB yang ingin dilakukan:';

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    // === PENGECEKAN ADMIN UNTUK SEMUA FITUR AKRAB ===
    const akrabCallbacks = ['manage_akrab', 'cekslot1', 'add1', 'kick1', 'editkuber1'];
    if (akrabCallbacks.includes(data)) {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, {
          text: 'Ente mau ngapain wak 🗿',
          show_alert: true
        });
      }
    }

    // === MENU KELOLA AKRAB ===
    if (data === 'manage_akrab') {
      
      const keyboard = MANAGE_AKRAB_KEYBOARD;
      const content = MANAGE_AKRAB_CONTENT;

      // Cek apakah message memiliki caption (dari photo message)
      if (message.caption) {
        // Cek apakah caption dan keyboard sudah sama
        if (message.caption === content && 
            message.reply_markup?.inline_keyboard && 
            JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu AKRAB sudah aktif.',
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
              text: '✅ Menu AKRAB sudah aktif.',
              show_alert: false
            });
          }
          // Error dihandle secara silent
        }
      } else {
        // Cek apakah text dan keyboard sudah sama
        if (message.text === content && 
            message.reply_markup?.inline_keyboard && 
            JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu AKRAB sudah aktif.',
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
              text: '✅ Menu AKRAB sudah aktif.',
              show_alert: false
            });
          }
          // Error dihandle secara silent
        }
      }

      await bot.answerCallbackQuery(id);
      return;
    }
  });

  // Load semua sub-tools AKRAB
  try {
    require('./manage_akrab/cekslot1')(bot);
    require('./manage_akrab/add1')(bot);
    require('./manage_akrab/kick1')(bot);
    require('./manage_akrab/editkuber1')(bot);
  } catch (error) {
    // Error dihandle secara silent - file akan dibuat
    console.log('📁 Pastikan folder manage_akrab/ dan file-filenya sudah dibuat:');
    console.log('   - ./manage_akrab/cekslot1.js (CEK SLOT)');
    console.log('   - ./manage_akrab/add1.js (TAMBAH ANGGOTA)');
    console.log('   - ./manage_akrab/kick1.js (KICK ANGGOTA)');
    console.log('   - ./manage_akrab/editkuber1.js (EDIT KUBER)');
  }
};
