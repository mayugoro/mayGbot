// State untuk menyimpan input redeem
const redeemState = new Map();

// === PRELOAD INLINE KEYBOARDS ===
const BACK_TO_MENU_KEYBOARD = [
  [{ text: 'BACK TO MENU', callback_data: 'back_to_menu' }]
];

const REDEEM_INPUT_KEYBOARD = [
  [{ text: '🔙 KEMBALI', callback_data: 'back_to_menu' }]
];

// Utility function untuk membersihkan state redeem
const clearRedeemState = (chatId, reason = 'completed') => {
  if (redeemState.has(chatId)) {
    redeemState.delete(chatId);
  }
};

// Helper function untuk auto restore menu (menghindari duplikasi kode)
const autoRestoreMenu = async (bot, chatId, userId, state) => {
  // Auto restore menu setelah gagal/sukses
  setTimeout(async () => {
    // Hapus pesan menu redeem utama (originalMessageId) setelah 1 detik
    if (state && state.originalMessageId) {
      try {
        await bot.deleteMessage(chatId, state.originalMessageId);
      } catch (e) {
        // Silent ignore - message mungkin sudah tidak ada
      }
    }
  }, 1000); // 1 detik untuk hapus menu redeem

  setTimeout(async () => {
    try {
      const { getUserSaldo } = require('../db');
      const saldo = await getUserSaldo(userId);
      
      // Generate uptime (simplified version)
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

      // Function to generate keyboard based on user ID
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

      const BOT_START_TIME = Date.now() - (process.uptime() * 1000);
      const uptime = formatUptime(Date.now() - BOT_START_TIME);
      
      const generateUserDetail = (userId, username, saldo, uptime) => {
        return '💌 <b>ID</b>           : <code>' + userId + '</code>\n' +
               '💌 <b>User</b>       : <code>' + (username || '-') + '</code>\n' +
               '📧 <b>Saldo</b>     : <code>Rp. ' + saldo.toLocaleString('id-ID') + '</code>\n' +
               '⌚ <b>Uptime</b>  : <code>' + uptime + '</code>';
      };

      // Ambil info user dari database atau fallback ke data yang ada
      let username;
      try {
        // Fallback untuk username jika tidak ada akses ke message object
        username = state?.username || '-';
      } catch (e) {
        username = '-';
      }

      const detail = generateUserDetail(userId, username, saldo, uptime);

      await bot.sendPhoto(chatId, './welcome.jpg', {
        caption: detail,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: generateMainKeyboard(userId) }
      }, {
        filename: 'welcome.jpg',
        contentType: 'image/jpeg'
      });
    } catch (err) {
      console.error('Error restoring main menu after redeem:', err.message);
    }
  }, 2000); // 2 detik delay untuk memberi waktu user membaca hasil
};

// Function untuk redeem code
const redeemCode = async (bot, chatId, userId, code, state) => {
  try {
    const { getCodeInfo, useCode, tambahSaldo } = require('../db');
    
    // Cek apakah code valid dan belum digunakan
    const codeInfo = await getCodeInfo(code);
    
    if (!codeInfo) {
      await bot.sendMessage(chatId, '❌ <b>Kode tidak valid!</b>\n\nKode yang Anda masukkan tidak ditemukan atau sudah tidak berlaku.', {
        parse_mode: 'HTML'
      });
      
      // Log kode tidak valid ke grup/channel (NYANGKUT)
      try {
        const { logRedeemTransaction } = require('../transaction_logger');
        await logRedeemTransaction(bot, {
          userId,
          username: (await bot.getChat(chatId)).username || 'Tidak diketahui',
          code,
          amount: null,
          status: 'validation_failed',
          error: 'Kode tidak ditemukan atau sudah tidak berlaku'
        });
      } catch (logError) {
        console.error('Warning: Failed to log invalid code:', logError.message);
      }
      
      // Auto restore menu setelah kode tidak valid
      await autoRestoreMenu(bot, chatId, userId, state);
      return;
    }

    if (codeInfo.used) {
      await bot.sendMessage(chatId, '❌ <b>Kode sudah digunakan!</b>\n\nKode ini telah digunakan sebelumnya dan tidak dapat digunakan lagi.', {
        parse_mode: 'HTML'
      });
      
      // Log kode sudah digunakan ke grup/channel (NYANGKUT)
      try {
        const { logRedeemTransaction } = require('../transaction_logger');
        await logRedeemTransaction(bot, {
          userId,
          username: (await bot.getChat(chatId)).username || 'Tidak diketahui',
          code,
          amount: codeInfo.nominal,
          status: 'validation_failed',
          error: 'Kode sudah digunakan sebelumnya'
        });
      } catch (logError) {
        console.error('Warning: Failed to log used code:', logError.message);
      }
      
      // Auto restore menu setelah kode sudah digunakan
      await autoRestoreMenu(bot, chatId, userId, state);
      return;
    }

    // Mark code as used dan tambah saldo
    await useCode(code, userId);
    await tambahSaldo(userId, codeInfo.nominal);
    
    const teksSuccess = `✅ <b>REDEEM BERHASIL!</b>\n\n` +
      `<code>Kode: ${code}\n` +
      `Nominal: Rp.${codeInfo.nominal.toLocaleString('id-ID')}</code>\n\n` +
      `💰 Saldo Anda telah bertambah!`;
    
    await bot.sendMessage(chatId, teksSuccess, {
      parse_mode: 'HTML'
    });

    // Log redeem berhasil ke grup/channel
    try {
      const { logRedeemTransaction } = require('../transaction_logger');
      await logRedeemTransaction(bot, {
        userId,
        username: (await bot.getChat(chatId)).username || 'Tidak diketahui',
        code,
        amount: codeInfo.nominal,
        status: 'completed'
      });
    } catch (logError) {
      console.error('Warning: Failed to log redeem transaction:', logError.message);
    }

    // Auto restore menu setelah redeem berhasil
    await autoRestoreMenu(bot, chatId, userId, state);
    
  } catch (err) {
    console.error('Error redeeming code:', err);
    
    // Log redeem gagal ke grup/channel
    try {
      const { logRedeemTransaction } = require('../transaction_logger');
      await logRedeemTransaction(bot, {
        userId,
        username: (await bot.getChat(chatId)).username || 'Tidak diketahui',
        code,
        amount: null,
        status: 'failed',
        error: err.message
      });
    } catch (logError) {
      console.error('Warning: Failed to log failed redeem:', logError.message);
    }
    
    await bot.sendMessage(chatId, '❌ <b>Gagal melakukan redeem</b>\n\nTerjadi kesalahan sistem. Silakan coba lagi.', {
      parse_mode: 'HTML'
    });
    
    // Auto restore menu setelah error sistem
    await autoRestoreMenu(bot, chatId, userId, state);
  }
};

// Function untuk start redeem process dari callback button
const startRedeemProcess = async (bot, chatId, userId, currentMessageId = null, username = null) => {
  try {
    // Edit message saat ini menjadi input form
    const inputText = `🗒️ <b>REDEEM KODE</b>\n\n<i><b>Masukan kode redeem!</b></i>`;
    
    if (currentMessageId) {
      try {
        await bot.editMessageCaption(inputText, {
          chat_id: chatId,
          message_id: currentMessageId,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: REDEEM_INPUT_KEYBOARD }
        });
      } catch (e) {
        // Silent fallback: hapus dan kirim baru tanpa log error
        try {
          await bot.deleteMessage(chatId, currentMessageId);
        } catch (deleteError) {
          // Silent ignore delete error
        }
        const newMsg = await bot.sendMessage(chatId, inputText, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: REDEEM_INPUT_KEYBOARD }
        });
        currentMessageId = newMsg.message_id;
      }
    } else {
      const newMsg = await bot.sendMessage(chatId, inputText, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: REDEEM_INPUT_KEYBOARD }
      });
      currentMessageId = newMsg.message_id;
    }

    redeemState.set(chatId, {
      step: 'waiting_code_input',
      userId: userId,
      username: username, // Simpan username untuk auto restore menu
      redeemMessageId: currentMessageId,
      originalMessageId: currentMessageId  // Simpan originalMessageId untuk dihapus nanti
    });
    
  } catch (err) {
    console.error('Error starting redeem process:', err);
  }
};

module.exports = (bot) => {
  // Handler untuk callback redeem_menu dan pembatalan
  bot.on('callback_query', async (query) => {
    const { data, message, id, from } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    if (data === 'redeem_menu') {
      // PENGECEKAN KETAT - Cegah multiple click untuk redeem menu
      const currentState = redeemState.get(chatId);
      if (currentState && currentState.step === 'waiting_code_input') {
        // Sudah dalam proses redeem, ignore request baru
        return bot.answerCallbackQuery(id, {
          text: 'Proses redeem sedang berlangsung...',
          show_alert: false
        });
      }

      // Cek apakah message sudah dalam bentuk input form redeem
      const expectedInputText = '🗒️ REDEEM KODE\n\nMasukan kode redeem!';
      if (message.caption && message.caption.includes('🗒️ REDEEM KODE') && 
          message.caption.includes('Masukan kode redeem!')) {
        // Sudah dalam form input, tidak perlu edit lagi
        return bot.answerCallbackQuery(id, {
          text: 'Masukkan kode redeem Anda...',
          show_alert: false
        });
      }

      await startRedeemProcess(bot, chatId, from.id, msgId, from.username);
      await bot.answerCallbackQuery(id);
      return;
    }

    // Handler untuk membatalkan proses redeem ketika tombol KEMBALI ditekan
    if (data === 'back_to_menu') {
      const state = redeemState.get(chatId);
      if (state && state.step === 'waiting_code_input') {
        // Hapus state redeem yang sedang berjalan
        clearRedeemState(chatId, 'cancelled by user');
      }
      // Biarkan handler back_to_menu dari main.js menangani redirect ke menu utama
    }
  });

  // Handler untuk input code redeem
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim().toUpperCase();
    
    if (!text || text.startsWith('/')) return;

    const state = redeemState.get(chatId);
    if (!state || state.step !== 'waiting_code_input') return;

    // Validasi format code (20 karakter alphanumeric)
    const codeRegex = /^[A-Z0-9]{20}$/;
    
    if (!codeRegex.test(text)) {
      await bot.sendMessage(chatId, '❌ Kode redeem tidak valid!', {
        parse_mode: 'HTML'
      });
      
      // Hapus message user
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {}
      return;
    }

    // Hapus state dan message user terlebih dahulu
    const currentState = { ...state }; // Simpan copy dari state sebelum dihapus
    clearRedeemState(chatId, 'code processed');
    try {
      await bot.deleteMessage(chatId, msg.message_id);
    } catch (e) {}

    // Hapus message input form
    if (state.redeemMessageId) {
      try {
        await bot.deleteMessage(chatId, state.redeemMessageId);
      } catch (e) {}
    }

    // Process redeem dengan state
    await redeemCode(bot, chatId, state.userId, text, currentState);
  });
};

// Export functions
module.exports.redeemCode = redeemCode;
module.exports.startRedeemProcess = startRedeemProcess;
