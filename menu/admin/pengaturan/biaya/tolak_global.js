// 🌍 PESAN TOLAK GLOBAL
// Handler khusus untuk mengatur pesan penolakan akses menu global
// File ini dimuat secara dinamis oleh biaya_operasi.js

const { getKonfigurasi, setKonfigurasi } = require('../../../../db');
// Import Input Exiter utilities untuk modern pattern
const { sendStyledInputMessage, autoDeleteMessage, EXIT_KEYWORDS } = require('../../../../utils/exiter');

const adminState = new Map();

// Function untuk generate input form menggunakan modern Input Exiter pattern
const generatePesanGlobalInputMessage = (currentPesan) => {
  const mainText = `🌍 SET PESAN TOLAK GLOBAL\n\nPesan saat ini:\n${currentPesan}`;
  const subtitle = `Masukkan pesan baru yang akan muncul saat user tidak punya saldo cukup untuk akses global:\n💡 Gunakan \\n untuk baris baru\n💡 Maksimal 200 karakter`;
  
  return { mainText, subtitle };
};

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    if (data === 'set_pesan_global') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      try {
        const currentValue = await getKonfigurasi('pesan_tolak_global');
        const currentPesan = currentValue || 'Saldo tidak cukup untuk akses menu global\\n\\n⏤͟͟ᴍᴀʏᴜɢᴏʀᴏ';
        
        // Set state untuk input exiter (gunakan from.id yang konsisten)
        adminState.set(from.id, { type: 'pesan_tolak_global' });
        
        // Kirim styled input message menggunakan modern utility
        const inputMessage = generatePesanGlobalInputMessage(currentPesan);
        const inputMsg = await sendStyledInputMessage(bot, chatId, inputMessage.mainText, inputMessage.subtitle);
        
        // Track input message untuk cleanup saat exit
        const currentState = adminState.get(from.id);
        currentState.inputMessageId = inputMsg.message_id;
        adminState.set(from.id, currentState);
        
      } catch (e) {
        console.error('Error getting pesan global:', e);
        await bot.answerCallbackQuery(id, { 
          text: '❌ Gagal memuat data pesan global.', 
          show_alert: true 
        });
        return;
      }
      
      await bot.answerCallbackQuery(id);
      return;
    }
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (!msg.text) return;
    if (msg.from.id.toString() !== process.env.ADMIN_ID) return;

    const state = adminState.get(msg.from.id);
    if (!state || state.type !== 'pesan_tolak_global') return;

    const userInput = msg.text.trim();
    
    // Check modern exit keywords
    if (EXIT_KEYWORDS.COMBINED.includes(userInput)) {
      // Cleanup input message jika ada
      if (state.inputMessageId) {
        await autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
      }
      adminState.delete(msg.from.id);
      // Auto delete user message
      await autoDeleteMessage(bot, chatId, msg.message_id, 100);
      return;
    }

    // Validasi panjang pesan
    if (userInput.length > 200) {
      const errorMsg = await bot.sendMessage(chatId, '❌ Pesan terlalu panjang! Maksimal 200 karakter.');
      await autoDeleteMessage(bot, chatId, errorMsg.message_id, 2000);
      await autoDeleteMessage(bot, chatId, msg.message_id, 100);
      return;
    }

    try {
      // Hapus input message terlebih dahulu
      if (state.inputMessageId) {
        await autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
      }
      
      // Update konfigurasi
      await setKonfigurasi('pesan_tolak_global', userInput);

      // Konfirmasi berhasil
      const successMsg = await bot.sendMessage(chatId, `✅ Pesan tolak global berhasil diatur:\n${userInput}`);
      await autoDeleteMessage(bot, chatId, successMsg.message_id, 3000);
      
    } catch (e) {
      const errorMsg = await bot.sendMessage(chatId, `❌ Gagal mengubah pesan: ${e.message}`);
      await autoDeleteMessage(bot, chatId, errorMsg.message_id, 2000);
    }
    
    // Cleanup
    adminState.delete(msg.from.id);
    await autoDeleteMessage(bot, chatId, msg.message_id, 100);
    return;
  });
};
