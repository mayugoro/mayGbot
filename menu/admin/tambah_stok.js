const { addStok } = require('../../db');

// Import utils EXITER untuk input yang konsisten
const { 
  sendStyledInputMessage,
  autoDeleteMessage: exiterAutoDelete,
  EXIT_KEYWORDS
} = require('../../utils/exiter');

const adminState = new Map();

// === PRELOAD INLINE KEYBOARDS ===
const TAMBAH_STOK_MAIN_KEYBOARD = [
  [
    { text: '🌙 TAMBAH BULANAN', callback_data: 'tambah_stok_bulanan' },
    { text: '⚡ TAMBAH BEKASAN', callback_data: 'tambah_stok_bekasan' }
  ],
  [{ text: '🔙 KEMBALI', callback_data: 'menu_admin' }]
];

const TAMBAH_STOK_BEKASAN_KEYBOARD = [
  [{ text: 'BEKASAN 3H', callback_data: 'add_stok_3h' }],
  [{ text: 'BEKASAN 4H', callback_data: 'add_stok_4h' }],
  [{ text: 'BEKASAN 5H', callback_data: 'add_stok_5h' }],
  [{ text: 'BEKASAN 6H', callback_data: 'add_stok_6h' }],
  [{ text: 'BEKASAN 7H', callback_data: 'add_stok_7h' }],
  [{ text: 'BEKASAN 8H', callback_data: 'add_stok_8h' }],
  [{ text: 'BEKASAN 9H', callback_data: 'add_stok_9h' }],
  [{ text: 'BEKASAN 10H', callback_data: 'add_stok_10h' }],
  [{ text: '✨ SMART ADD STOK ✨', callback_data: 'smart_add_stok' }],
  [{ text: '🔙 KEMBALI', callback_data: 'tambah_stok' }]
];

const TAMBAH_STOK_BULANAN_KEYBOARD = [
  [{ text: 'SUPERMINI', callback_data: 'add_stok_supermini' }],
  [{ text: 'SUPERBIG', callback_data: 'add_stok_superbig' }],
  [{ text: 'MINI', callback_data: 'add_stok_mini' }],
  [{ text: 'BIG', callback_data: 'add_stok_big' }],
  [{ text: 'LITE', callback_data: 'add_stok_lite' }],
  [{ text: 'JUMBO', callback_data: 'add_stok_jumbo' }],
  [{ text: 'MEGABIG', callback_data: 'add_stok_megabig' }],
  [{ text: 'SUPER JUMBO', callback_data: 'add_stok_superjumbo' }],
  [{ text: '🔙 KEMBALI', callback_data: 'tambah_stok' }]
];

// Preload template pesan
const TAMBAH_STOK_MAIN_CONTENT = '📦 <b>TAMBAH STOK</b>\n\nPilih kategori stok yang akan ditambahkan:';
const TAMBAH_STOK_BEKASAN_CONTENT = '⚡ <b>TAMBAH STOK BEKASAN</b>\n\nPilih kategori bekasan yang akan ditambah:';
const TAMBAH_STOK_BULANAN_CONTENT = '🌙 <b>TAMBAH STOK BULANAN</b>\n\nPilih paket bulanan yang akan ditambah:';

// Template input form dengan pattern exiter yang konsisten
const generateInputForm = (jenis, kategori) => {
  const jenisText = jenis === 'bekasan' ? 'BEKASAN' : 'BULANAN';
  const mainText = `📝 TAMBAH STOK ${jenisText} ${kategori}`;
  const subtitle = `Masukkan nomor-nomor untuk ${jenis === 'bekasan' ? 'kategori' : 'paket'} ${jenisText} ${kategori}:\n\nFormat: Satu nomor per baris\nContoh:\n087777111111\n087777222222\n087777333333`;
  
  return { mainText, subtitle };
};

// Function untuk smart parsing text input menjadi kategori bekasan + nomor
const parseSmartAddInput = (inputText) => {
  const lines = inputText.split(/\n|\r/).map(line => line.trim()).filter(line => line);
  const result = {};
  let currentCategory = null;
  
  // Pattern untuk mendeteksi kategori bekasan
  const categoryPatterns = [
    { pattern: /bekasan\s*3\s*hari/i, category: '3H' },
    { pattern: /bekasan\s*4\s*hari/i, category: '4H' },
    { pattern: /bekasan\s*5\s*hari/i, category: '5H' },
    { pattern: /bekasan\s*6\s*hari/i, category: '6H' },
    { pattern: /bekasan\s*7\s*hari/i, category: '7H' },
    { pattern: /bekasan\s*8\s*hari/i, category: '8H' },
    { pattern: /bekasan\s*9\s*hari/i, category: '9H' },
    { pattern: /bekasan\s*10\s*hari/i, category: '10H' }
  ];
  
  // Pattern untuk nomor HP Indonesia (08xxxxxxxx atau 62xxxxxxxx, 9-16 digit)
  const phonePattern = /^(08|62)\d{7,14}$/;
  
  for (const line of lines) {
    // Cek apakah line adalah kategori
    let foundCategory = false;
    for (const { pattern, category } of categoryPatterns) {
      if (pattern.test(line)) {
        currentCategory = category;
        if (!result[currentCategory]) {
          result[currentCategory] = [];
        }
        foundCategory = true;
        break;
      }
    }
    
    // Jika bukan kategori dan ada kategori aktif, cek apakah nomor HP
    if (!foundCategory && currentCategory && phonePattern.test(line)) {
      // Normalisasi nomor ke format 08xxxxxxxx
      let normalizedNumber = line;
      if (line.startsWith('62')) {
        normalizedNumber = '0' + line.substring(2);
      }
      
      result[currentCategory].push(normalizedNumber);
    }
  }
  
  return result;
};

// Template untuk smart add input form
const generateSmartAddInputForm = () => {
  const mainText = '✨ SMART ADD STOK BEKASAN';
  const subtitle = `Paste text dengan format kategori + nomor:\n\n<b>Contoh:</b>\n⚡️BEKASAN 3 HARI\n085924193416\n085924193401\n\n⚡️BEKASAN 7 HARI\n085926146058\n\n<i>• Akan otomatis mendeteksi kategori\n• Mendukung format: "BEKASAN X HARI"\n• Normalisasi nomor otomatis</i>`;
  
  return { mainText, subtitle };
};

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    if (data === 'tambah_stok') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, {
          text: 'ente mau ngapain wak🗿',
          show_alert: true
        });
      }
      
      const keyboard = TAMBAH_STOK_MAIN_KEYBOARD;
      const content = TAMBAH_STOK_MAIN_CONTENT;
      
      // Cek apakah message memiliki caption (dari photo message)
      if (message.caption) {
        // Cek apakah caption dan keyboard sudah sama
        if (message.caption === content && 
            message.reply_markup?.inline_keyboard && 
            JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu Tambah Stok aktif.',
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
              text: '✅ Menu Tambah Stok aktif.',
              show_alert: false
            });
          }
          console.error('Error editing tambah_stok caption:', error.message);
        }
      } else {
        // Cek apakah text dan keyboard sudah sama
        if (message.text === content && 
            message.reply_markup?.inline_keyboard && 
            JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu Tambah Stok aktif.',
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
              text: '✅ Menu Tambah Stok aktif.',
              show_alert: false
            });
          }
          console.error('Error editing tambah_stok text:', error.message);
        }
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === PILIH BEKASAN ===
    if (data === 'tambah_stok_bekasan') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const keyboard = TAMBAH_STOK_BEKASAN_KEYBOARD;
      const content = TAMBAH_STOK_BEKASAN_CONTENT;

      try {
        if (message.caption) {
          await bot.editMessageCaption(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } else {
          await bot.editMessageText(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        }
      } catch (error) {
        if (error.message.includes('message is not modified')) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu sudah aktif.',
            show_alert: false
          });
        }
        console.error('Error editing tambah_stok_bekasan:', error.message);
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === PILIH BULANAN ===
    if (data === 'tambah_stok_bulanan') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const keyboard = TAMBAH_STOK_BULANAN_KEYBOARD;
      const content = TAMBAH_STOK_BULANAN_CONTENT;

      try {
        if (message.caption) {
          await bot.editMessageCaption(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } else {
          await bot.editMessageText(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        }
      } catch (error) {
        if (error.message.includes('message is not modified')) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu sudah aktif.',
            show_alert: false
          });
        }
        console.error('Error editing tambah_stok_bulanan:', error.message);
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === SMART ADD STOK ===
    if (data === 'smart_add_stok') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      adminState.set(chatId, { mode: 'smart_add_stok', menuMessageId: msgId });
      
      // JANGAN hapus menu, kirim input form di bawah menu dengan pattern exiter
      const { mainText, subtitle } = generateSmartAddInputForm();
      const inputMsg = await sendStyledInputMessage(bot, chatId, mainText, subtitle, 'membatalkan');
      
      // Simpan message ID untuk bisa diedit nanti
      const currentState = adminState.get(chatId);
      currentState.inputMessageId = inputMsg.message_id;
      adminState.set(chatId, currentState);
      
      await bot.answerCallbackQuery(id);
      return;
    }

    // === PILIH KATEGORI STOK BEKASAN ===
    if (/^add_stok_\d+h$/i.test(data)) {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const kategori = data.split('_')[2].toUpperCase();
      adminState.set(chatId, { mode: 'tambah_stok', kategori: kategori, jenis: 'bekasan', menuMessageId: msgId });
      
      // JANGAN hapus menu, kirim input form di bawah menu dengan pattern exiter
      const { mainText, subtitle } = generateInputForm('bekasan', kategori);
      const inputMsg = await sendStyledInputMessage(bot, chatId, mainText, subtitle, 'membatalkan');
      
      // Simpan message ID untuk bisa diedit nanti
      const currentState = adminState.get(chatId);
      currentState.inputMessageId = inputMsg.message_id;
      adminState.set(chatId, currentState);
      
      await bot.answerCallbackQuery(id);
      return;
    }

    // === PILIH KATEGORI STOK BULANAN ===
    if (/^add_stok_(supermini|superbig|mini|big|lite|jumbo|megabig|superjumbo)$/i.test(data)) {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const paket = data.split('_')[2].toLowerCase();
      adminState.set(chatId, { mode: 'tambah_stok', kategori: paket.toUpperCase(), jenis: 'bulanan', menuMessageId: msgId });
      
      // JANGAN hapus menu, kirim input form di bawah menu dengan pattern exiter
      const { mainText, subtitle } = generateInputForm('bulanan', paket.toUpperCase());
      const inputMsg = await sendStyledInputMessage(bot, chatId, mainText, subtitle, 'membatalkan');
      
      // Simpan message ID untuk bisa diedit nanti
      const currentState = adminState.get(chatId);
      currentState.inputMessageId = inputMsg.message_id;
      adminState.set(chatId, currentState);
      
      await bot.answerCallbackQuery(id);
      return;
    }
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (!msg.text) return;
    if (msg.from.id.toString() !== process.env.ADMIN_ID) return;

    const state = adminState.get(chatId);
    if (!state || (!state.mode || (state.mode !== 'tambah_stok' && state.mode !== 'smart_add_stok'))) return;

    // === CEK CANCEL/EXIT menggunakan EXIT_KEYWORDS dari exiter ===
    if (EXIT_KEYWORDS.COMBINED.includes(msg.text.trim())) {
      // Hapus input form jika ada (sama seperti cekpulsa.js)
      if (state.inputMessageId) {
        exiterAutoDelete(bot, chatId, state.inputMessageId, 100);
      }
      
      // Hapus user message dengan delay kecil agar terlihat bersamaan
      exiterAutoDelete(bot, chatId, msg.message_id, 100);
      
      adminState.delete(chatId);
      return;
    }

    // === SMART ADD STOK HANDLER ===
    if (state.mode === 'smart_add_stok') {
      const parsedData = parseSmartAddInput(msg.text);
      
      if (Object.keys(parsedData).length === 0) {
        await bot.sendMessage(chatId, '❌ <b>Tidak ditemukan kategori bekasan atau nomor yang valid</b>\n\n<i>Pastikan format sesuai contoh:\n⚡️BEKASAN 3 HARI\n085924193416\n085924193401</i>', { parse_mode: 'HTML' });
        
        // Hapus user message
        try {
          await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {}
        
        return;
      }

      // Process setiap kategori yang ditemukan
      const results = [];
      let totalBerhasil = 0;
      let totalGagal = 0;

      for (const [kategori, nomorList] of Object.entries(parsedData)) {
        const hasil = [];
        const gagal = [];

        for (const nomor of nomorList) {
          try {
            const inserted = await addStok(kategori, nomor, nomor);
            if (inserted) {
              hasil.push(nomor);
              totalBerhasil++;
            } else {
              gagal.push(nomor);
              totalGagal++;
            }
          } catch (e) {
            gagal.push(nomor);
            totalGagal++;
          }
        }

        results.push({
          kategori,
          berhasil: hasil.length,
          gagal: gagal.length,
          total: nomorList.length
        });
      }

      // Generate hasil message
      let teksHasil = '✨ <b>SMART ADD STOK COMPLETED</b>\n\n';
      
      for (const result of results) {
        const statusIcon = result.gagal === 0 ? '✅' : result.berhasil > 0 ? '⚠️' : '❌';
        teksHasil += `${statusIcon} <b>BEKASAN ${result.kategori}:</b> ${result.berhasil}/${result.total}\n`;
      }
      
      teksHasil += `\n📊 <b>SUMMARY:</b>\n`;
      teksHasil += `• Berhasil: <b>${totalBerhasil}</b> nomor\n`;
      if (totalGagal > 0) {
        teksHasil += `• Gagal: <b>${totalGagal}</b> nomor\n`;
      }
      teksHasil += `• Kategori: <b>${Object.keys(parsedData).length}</b> jenis bekasan`;

      // Store message ID untuk auto-delete
      let resultMessageId = null;

      // Edit input form menjadi notifikasi hasil
      if (state.inputMessageId) {
        try {
          await bot.editMessageText(teksHasil, {
            chat_id: chatId,
            message_id: state.inputMessageId,
            parse_mode: 'HTML'
          });
          resultMessageId = state.inputMessageId;
        } catch (e) {
          console.log('Edit message error:', e.message);
          const sentMsg = await bot.sendMessage(chatId, teksHasil, { parse_mode: 'HTML' });
          resultMessageId = sentMsg.message_id;
        }
      } else {
        const sentMsg = await bot.sendMessage(chatId, teksHasil, { parse_mode: 'HTML' });
        resultMessageId = sentMsg.message_id;
      }
      
      // Hapus input user terlebih dahulu
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {
        console.log('Delete user message error:', e.message);
      }
      
      // Clean up state
      adminState.delete(chatId);
      
      // Auto delete notifikasi hasil menggunakan exiter function
      if (resultMessageId) {
        // Non-blocking auto-delete dengan exiter helper
        exiterAutoDelete(bot, chatId, resultMessageId, 4000);
      }
      
      return;
    }

    // === REGULAR ADD STOK HANDLER ===
    if (state.mode === 'tambah_stok' && state.kategori) {
      const kategori = state.kategori.toUpperCase();
      const jenis = state.jenis;
      
      // Validasi kategori berdasarkan jenis
      if (jenis === 'bekasan' && !['3H', '4H', '5H', '6H', '7H', '8H', '9H', '10H'].includes(kategori)) {
        await bot.sendMessage(chatId, `❌ Kategori bekasan ${kategori} tidak valid.`);
        adminState.delete(chatId);
        return;
      }
      
      if (jenis === 'bulanan' && !['SUPERMINI', 'SUPERBIG', 'MINI', 'BIG', 'LITE', 'JUMBO', 'MEGABIG', 'SUPERJUMBO'].includes(kategori)) {
        await bot.sendMessage(chatId, `❌ Paket bulanan ${kategori} tidak valid.`);
        adminState.delete(chatId);
        return;
      }

      const list = msg.text.split(/\n|\r/).map(s => s.trim()).filter(s => s);
      const hasil = [];
      const gagal = [];

      for (const nomor of list) {
        try {
          const inserted = await addStok(kategori, nomor, nomor);
          if (inserted) {
            hasil.push(nomor);
          } else {
            gagal.push(nomor);
          }
        } catch (e) {
          gagal.push(nomor);
        }
      }

      const jenisText = jenis === 'bekasan' ? 'BEKASAN' : 'BULANAN';
      
      // Generate result message dengan logic yang lebih baik
      let teksHasil = '';
      
      if (hasil.length > 0) {
        teksHasil = `✅ <b>Stok ${jenisText} ${kategori}</b>\nBerhasil ditambah: <b>${hasil.length}</b> nomor`;
      }
      
      if (gagal.length > 0) {
        if (hasil.length > 0) {
          teksHasil += `\n\n❌ Gagal menambahkan: <b>${gagal.length}</b> nomor`;
        } else {
          teksHasil = `❌ <b>Gagal menambahkan stok ${jenisText} ${kategori}</b>\nSemua <b>${gagal.length}</b> nomor gagal diproses`;
        }
      }
      
      // Jika tidak ada input yang valid
      if (hasil.length === 0 && gagal.length === 0) {
        teksHasil = `⚠️ <b>Tidak ada nomor yang valid untuk diproses</b>`;
      }

      // Store message ID untuk auto-delete
      let resultMessageId = null;

      // Edit input form menjadi notifikasi hasil
      if (state.inputMessageId) {
        try {
          await bot.editMessageText(teksHasil, {
            chat_id: chatId,
            message_id: state.inputMessageId,
            parse_mode: 'HTML'
          });
          resultMessageId = state.inputMessageId;
        } catch (e) {
          console.log('Edit message error:', e.message);
          const sentMsg = await bot.sendMessage(chatId, teksHasil, { parse_mode: 'HTML' });
          resultMessageId = sentMsg.message_id;
        }
      } else {
        const sentMsg = await bot.sendMessage(chatId, teksHasil, { parse_mode: 'HTML' });
        resultMessageId = sentMsg.message_id;
      }
      
      // Hapus input user terlebih dahulu
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {
        console.log('Delete user message error:', e.message);
      }
      
      // Clean up state
      adminState.delete(chatId);
      
      // Auto delete notifikasi hasil menggunakan exiter function
      if (resultMessageId) {
        // Non-blocking auto-delete dengan exiter helper
        exiterAutoDelete(bot, chatId, resultMessageId, 3000);
      }
      
      return;
    }
  });
};
