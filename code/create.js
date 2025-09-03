// === PRELOAD INLINE KEYBOARDS ===
const createCodeKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [{ text: 'Rp. 10.000', callback_data: 'create_10000' }],
      [{ text: 'Rp. 50.000', callback_data: 'create_50000' }],
      [{ text: 'Rp. 100.000', callback_data: 'create_100000' }],
      [{ text: 'MANUAL', callback_data: 'create_manual' }],
      [{ text: 'KEMBALI', callback_data: 'back_to_code_menu' }]
    ]
  }
};

const CODE_MENU_KEYBOARD = [
  [{ text: 'BUAT CODE REDEEM', callback_data: 'create_code' }],
  [{ text: 'BACK TO MENU', callback_data: 'back_to_menu' }]
];

// State untuk menyimpan input manual
const createState = new Map();

// Function untuk generate random code
const generateCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Function untuk show create menu
const showCreateMenu = async (bot, chatId, messageId = null) => {
  const teksMenu = `💰 <b>BUAT CODE REDEEM</b>\n\n` +
    `Pilih nominal yang ingin dibuat:`;

  if (messageId) {
    try {
      // Coba edit dulu, asumsi ini text message
      await bot.editMessageText(teksMenu, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        ...createCodeKeyboard
      });
    } catch (e) {
      // Jika edit gagal, hapus dan kirim baru
      try {
        await bot.deleteMessage(chatId, messageId);
      } catch (deleteErr) {}
      
      await bot.sendMessage(chatId, teksMenu, {
        parse_mode: 'HTML',
        ...createCodeKeyboard
      });
    }
  } else {
    await bot.sendMessage(chatId, teksMenu, {
      parse_mode: 'HTML',
      ...createCodeKeyboard
    });
  }
};

// Function untuk create code dengan nominal tertentu
const createRedeemCode = async (bot, chatId, nominal, inputMessageId = null, isDefaultNominal = false) => {
  try {
    const { createCode } = require('../db');
    const code = generateCode();
    
    // Pastikan nominal adalah number dan valid
    if (!nominal || isNaN(nominal) || nominal <= 0) {
      throw new Error('Invalid nominal value: ' + nominal);
    }
    
    // Simpan code ke database
    await createCode(code, nominal);
    
    // Hapus pesan INPUT MANUAL jika ada inputMessageId
    if (inputMessageId) {
      try {
        await bot.deleteMessage(chatId, inputMessageId);
      } catch (e) {
        // Ignore delete error
      }
    }
    
    const teksSuccess = `✅ <b>CODE REDEEM BERHASIL DIBUAT</b>\n\n` +
      `Kode: <code>${code}</code>\n` +
      `Nominal: <code>Rp.${nominal.toLocaleString('id-ID')}</code>`;

    await bot.sendMessage(chatId, teksSuccess, {
      parse_mode: 'HTML'
    });

    // Tampilkan menu create lagi setelah 1 detik (untuk semua jenis input)
    setTimeout(() => {
      showCreateMenu(bot, chatId);
    }, 1000);
    
  } catch (err) {
    console.error('Error creating redeem code:', err);
    await bot.sendMessage(chatId, '❌ <b>Gagal membuat code redeem</b>\n\nTerjadi kesalahan sistem.', {
      parse_mode: 'HTML'
    });
  }
};

module.exports = (bot) => {
  // Handler untuk callback query create
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;

    // Skip jika bukan callback untuk create system
    if (!data.startsWith('create_') && 
        data !== 'back_to_create_menu' && 
        data !== 'back_to_code_menu') {
      return;
    }

    // Handler untuk callback create_code (buka menu create)
    if (data === 'create_code') {
      // Cek apakah user adalah admin
      if (query.from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(query.id, {
          text: 'ente mau ngapain wak🗿',
          show_alert: true
        });
      }
      
      await showCreateMenu(bot, chatId, query.message.message_id);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    // Handler untuk nominal preset
    if (data.startsWith('create_') && data !== 'create_manual') {
      const nominal = parseInt(data.replace('create_', ''));
      
      if (isNaN(nominal) || nominal <= 0) {
        await bot.answerCallbackQuery(query.id, '❌ Invalid nominal value', true);
        return;
      }
      
      // Hapus menu sebelumnya untuk nominal default
      try {
        await bot.deleteMessage(chatId, query.message.message_id);
      } catch (e) {
        // Ignore delete error
      }
      
      await createRedeemCode(bot, chatId, nominal, null, true); // true = isDefaultNominal
      await bot.answerCallbackQuery(query.id);
      return;
    }

    // Handler untuk manual input
    if (data === 'create_manual') {
      const teksManual = `💰 <b>INPUT MANUAL</b>\n\n` +
        `Masukkan nominal yang ingin dibuat (hanya angka):\n\n` +
        `💡 Contoh: 25000\n` +
        `❌ Ketik <code>EXIT</code> untuk membatalkan`;

      try {
        await bot.editMessageText(teksManual, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML'
        });
        
        // Simpan message_id untuk bisa dihapus saat cancel
        createState.set(chatId, {
          step: 'waiting_manual_input',
          userId: userId,
          inputMessageId: query.message.message_id
        });
        
      } catch (e) {
        const newMsg = await bot.sendMessage(chatId, teksManual, {
          parse_mode: 'HTML'
        });
        
        // Simpan message_id dari message baru
        createState.set(chatId, {
          step: 'waiting_manual_input',
          userId: userId,
          inputMessageId: newMsg.message_id
        });
      }
      
      await bot.answerCallbackQuery(query.id);
      return;
    }

    // Handler untuk kembali ke create menu
    if (data === 'back_to_create_menu') {
      createState.delete(chatId);
      await showCreateMenu(bot, chatId, query.message.message_id);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    // Handler untuk kembali ke code menu utama
    if (data === 'back_to_code_menu') {
      createState.delete(chatId);
      
      const teksMenu = `🎫 <b>SISTEM CODE REDEEM</b>\n\n` +
        `Pilih opsi di bawah ini:`;

      try {
        // Cek apakah message memiliki caption atau text
        if (query.message.caption !== undefined) {
          // Message punya caption (photo message)
          await bot.editMessageCaption(teksMenu, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: CODE_MENU_KEYBOARD }
          });
        } else {
          // Message punya text (text message)
          await bot.editMessageText(teksMenu, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: CODE_MENU_KEYBOARD }
          });
        }
      } catch (e) {
        // Jika edit gagal, hapus dan kirim baru
        try {
          await bot.deleteMessage(chatId, query.message.message_id);
        } catch (deleteErr) {}
        
        await bot.sendMessage(chatId, teksMenu, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: CODE_MENU_KEYBOARD }
        });
      }
      
      await bot.answerCallbackQuery(query.id);
      return;
    }
  });

  // Handler untuk manual input message
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    
    if (!text || text.startsWith('/')) return;

    const state = createState.get(chatId);
    if (!state || state.step !== 'waiting_manual_input') return;

    // Check untuk exit command
    if (text.toLowerCase() === 'exit') {
      const inputMessageId = state.inputMessageId;
      createState.delete(chatId);
      
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {}
      
      const cancelMsg = await bot.sendMessage(chatId, '❌ <b>Input manual dibatalkan</b>', {
        parse_mode: 'HTML'
      });
      
      // Hapus kedua pesan dan tampilkan menu baru setelah 1 detik
      setTimeout(async () => {
        try {
          // Hapus pesan cancel
          await bot.deleteMessage(chatId, cancelMsg.message_id);
          
          // Hapus pesan INPUT MANUAL jika ada message_id
          if (inputMessageId) {
            await bot.deleteMessage(chatId, inputMessageId);
          }
        } catch (e) {
          // Ignore delete errors
        }
        
        // Tampilkan menu baru
        await showCreateMenu(bot, chatId);
      }, 1000);
      return;
    }

    // Validasi input adalah angka
    const nominal = parseInt(text.replace(/\D/g, ''));
    
    if (!nominal || nominal < 1) {
      await bot.sendMessage(chatId, '❌ <b>Input tidak valid!</b>\nKetik <code>EXIT</code> untuk membatalkan', {
        parse_mode: 'HTML'
      });
      
      // Hapus message user
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {}
      return;
    }

    // Hapus state dan message user
    createState.delete(chatId);
    try {
      await bot.deleteMessage(chatId, msg.message_id);
    } catch (e) {}

    // Create code dengan nominal manual dan pass inputMessageId untuk dihapus
    await createRedeemCode(bot, chatId, nominal, state.inputMessageId, false); // false = manual input
  });
};

// Export function untuk dipanggil dari code.js
module.exports.showCreateMenu = showCreateMenu;
