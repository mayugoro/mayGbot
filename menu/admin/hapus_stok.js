const { getStok, deleteStok, deleteSingleStok, clearStokKategori } = require('../../db');

const adminState = new Map();

// === PRELOAD INLINE KEYBOARDS ===
const HAPUS_STOK_MAIN_KEYBOARD = [
  [
    { text: '🌙 HAPUS BULANAN', callback_data: 'hapus_stok_bulanan' },
    { text: '⚡ HAPUS BEKASAN', callback_data: 'hapus_stok_bekasan' }
  ],
  [
    { text: '🗑️ HAPUS SEMUA', callback_data: 'del_all_stok' }
  ],
  [{ text: '🔙 KEMBALI', callback_data: 'menu_admin' }]
];

const HAPUS_STOK_BEKASAN_KEYBOARD = [
  [{ text: 'BEKASAN 3H', callback_data: 'del_stok_3h' }],
  [{ text: 'BEKASAN 4H', callback_data: 'del_stok_4h' }],
  [{ text: 'BEKASAN 5H', callback_data: 'del_stok_5h' }],
  [{ text: 'BEKASAN 6H', callback_data: 'del_stok_6h' }],
  [{ text: 'BEKASAN 7H', callback_data: 'del_stok_7h' }],
  [{ text: 'BEKASAN 8H', callback_data: 'del_stok_8h' }],
  [{ text: 'BEKASAN 9H', callback_data: 'del_stok_9h' }],
  [{ text: 'BEKASAN 10H', callback_data: 'del_stok_10h' }],
  [{ text: '🔙 KEMBALI', callback_data: 'hapus_stok' }]
];

const HAPUS_STOK_BULANAN_KEYBOARD = [
  [{ text: 'SUPERMINI', callback_data: 'del_stok_supermini' }],
  [{ text: 'SUPERBIG', callback_data: 'del_stok_superbig' }],
  [{ text: 'MINI', callback_data: 'del_stok_mini' }],
  [{ text: 'BIG', callback_data: 'del_stok_big' }],
  [{ text: 'LITE', callback_data: 'del_stok_lite' }],
  [{ text: 'JUMBO', callback_data: 'del_stok_jumbo' }],
  [{ text: 'MEGABIG', callback_data: 'del_stok_megabig' }],
  [{ text: 'SUPER JUMBO', callback_data: 'del_stok_superjumbo' }],
  [{ text: '🔙 KEMBALI', callback_data: 'hapus_stok' }]
];

const HAPUS_SEMUA_KEYBOARD = [
  [{ text: '✅ YA, HAPUS SEMUA', callback_data: 'confirm_del_all' }],
  [{ text: '❌ BATAL', callback_data: 'hapus_stok' }]
];

// Preload template pesan
const HAPUS_STOK_MAIN_CONTENT = '🗑️ <b>HAPUS STOK</b>\n\nPilih kategori stok yang akan dihapus:';
const HAPUS_STOK_BEKASAN_CONTENT = '⚡ <b>HAPUS STOK BEKASAN</b>\n\nPilih kategori bekasan yang akan dihapus:';
const HAPUS_STOK_BULANAN_CONTENT = '🌙 <b>HAPUS STOK BULANAN</b>\n\nPilih paket bulanan yang akan dihapus:';
const HAPUS_SEMUA_CONTENT = '⚠️ <b>PERINGATAN!</b>\n\nAnda akan menghapus <b>SEMUA STOK</b> dari semua kategori (BEKASAN & BULANAN).\n\n<b>Tindakan ini tidak dapat dibatalkan!</b>\n\nApakah Anda yakin?';

// Template input form untuk hapus stok
const generateHapusStokForm = (jenis, kategori, daftarNomor) => {
  const jenisText = jenis === 'bekasan' ? 'BEKASAN' : 'BULANAN';
  let daftarText = '';
  
  if (daftarNomor.length > 0) {
    daftarText = `DAFTAR PENGELOLA UNTUK ${jenisText} ${kategori}:\n\n<code>`;
    daftarNomor.forEach(nomor => {
      daftarText += `${nomor}\n`;
    });
    daftarText += `</code>\n`;
  } else {
    daftarText = `❌ TIDAK ADA STOK UNTUK ${jenisText} ${kategori}\n\n`;
  }
  
  return `🗑️ <b>HAPUS STOK ${jenisText} ${kategori}</b>\n\n` +
    daftarText +
    `💡 Ketik "ALL" untuk hapus semua\n` +
    `💡 Ketik "exit" untuk membatalkan.`;
};

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    if (data === 'hapus_stok') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, {
          text: 'ente mau ngapain wak🗿',
          show_alert: true
        });
      }
      
      const keyboard = HAPUS_STOK_MAIN_KEYBOARD;
      const content = HAPUS_STOK_MAIN_CONTENT;

      // Cek apakah message memiliki caption (dari photo message)
      if (message.caption) {
        // Cek apakah caption dan keyboard sudah sama
        if (message.caption === content && 
            message.reply_markup?.inline_keyboard && 
            JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu Hapus Stok aktif.',
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
              text: '✅ Menu Hapus Stok aktif.',
              show_alert: false
            });
          }
          console.error('Error editing hapus_stok caption:', error.message);
        }
      } else {
        // Cek apakah text dan keyboard sudah sama
        if (message.text === content && 
            message.reply_markup?.inline_keyboard && 
            JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu Hapus Stok aktif.',
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
              text: '✅ Menu Hapus Stok aktif.',
              show_alert: false
            });
          }
          console.error('Error editing hapus_stok text:', error.message);
        }
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === PILIH BEKASAN ===
    if (data === 'hapus_stok_bekasan') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const keyboard = HAPUS_STOK_BEKASAN_KEYBOARD;
      const content = HAPUS_STOK_BEKASAN_CONTENT;

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
        console.error('Error editing hapus_stok_bekasan:', error.message);
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === PILIH BULANAN ===
    if (data === 'hapus_stok_bulanan') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const keyboard = HAPUS_STOK_BULANAN_KEYBOARD;
      const content = HAPUS_STOK_BULANAN_CONTENT;

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
        console.error('Error editing hapus_stok_bulanan:', error.message);
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === HAPUS SEMUA STOK ===
    if (data === 'del_all_stok') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const keyboard = HAPUS_SEMUA_KEYBOARD;
      const content = HAPUS_SEMUA_CONTENT;

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
        console.error('Error editing del_all_stok:', error.message);
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === KONFIRMASI HAPUS SEMUA ===
    if (data === 'confirm_del_all') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      try {
        let totalHapus = 0;
        const kategoriList = ['3H', '4H', '5H', '6H', '7H', '8H', '9H', '10H', 'SUPERMINI', 'SUPERBIG', 'MINI', 'BIG', 'LITE', 'JUMBO', 'MEGABIG', 'SUPERJUMBO'];
        
        for (const kat of kategoriList) {
          const jumlahHapus = await clearStokKategori(kat);
          totalHapus += jumlahHapus;
        }
        
        // Kirim pesan baru di bawah menu dengan countdown
        const resultMsg = await bot.sendMessage(chatId, `✅ <b>Berhasil menghapus semua stok!</b>\n\n📊 Total stok yang dihapus: <b>${totalHapus}</b> nomor\n\n🗑️ Semua kategori (BEKASAN & BULANAN) telah dikosongkan.\n\n⏰ <i>Pesan akan hilang dalam 2 detik...</i>`, {
          parse_mode: 'HTML'
        });
        
        // Countdown 2 detik
        setTimeout(async () => {
          try {
            await bot.editMessageText(`✅ <b>Berhasil menghapus semua stok!</b>\n\n📊 Total stok yang dihapus: <b>${totalHapus}</b> nomor\n\n🗑️ Semua kategori (BEKASAN & BULANAN) telah dikosongkan.`, {
              chat_id: chatId,
              message_id: resultMsg.message_id,
              parse_mode: 'HTML'
            });
          } catch (e) {
            // Ignore edit error
          }
        }, 1000);
        
        // Auto delete notifikasi hasil setelah 2 detik
        setTimeout(async () => {
          try {
            await bot.deleteMessage(chatId, resultMsg.message_id);
          } catch (e) {
            // Ignore delete error
          }
        }, 2000);
        
      } catch (e) {
        await bot.sendMessage(chatId, `❌ Gagal menghapus semua stok: ${e.message}`);
      }
      
      await bot.answerCallbackQuery(id);
      return;
    }

    // === PILIH KATEGORI HAPUS BEKASAN ===
    if (/^del_stok_\d+h$/i.test(data)) {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const kategori = data.split('_')[2].toUpperCase();
      
      try {
        // Ambil daftar nomor untuk kategori ini
        const daftarNomor = await getStok(kategori);
        
        let daftarText = '';
        if (daftarNomor.length > 0) {
          daftarText = `DAFTAR PENGELOLA UNTUK BEKASAN ${kategori}:\n\n<code>`;
          daftarNomor.forEach(nomor => {
            daftarText += `${nomor}\n`;
          });
          daftarText += `</code>\n`;
        } else {
          daftarText = `❌ TIDAK ADA STOK UNTUK BEKASAN ${kategori}\n\n`;
        }
        
        adminState.set(chatId, { mode: 'hapus_stok', kategori: kategori, jenis: 'bekasan', menuMessageId: msgId });
        
        // JANGAN hapus menu, kirim input form di bawah menu
        const inputMsg = await bot.sendMessage(chatId, generateHapusStokForm('bekasan', kategori, daftarNomor), {
          parse_mode: 'HTML'
        });
        
        // Simpan message ID untuk bisa diedit nanti
        const currentState = adminState.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        adminState.set(chatId, currentState);
        
      } catch (e) {
        console.error('Error getting stok list:', e);
        await bot.answerCallbackQuery(id, { text: '❌ Gagal memuat daftar stok.', show_alert: true });
        return;
      }
      
      await bot.answerCallbackQuery(id);
      return;
    }

    // === PILIH KATEGORI HAPUS BULANAN ===
    if (/^del_stok_(supermini|superbig|mini|big|lite|jumbo|megabig|superjumbo)$/i.test(data)) {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const paket = data.split('_')[2].toLowerCase();
      
      try {
        // Ambil daftar nomor untuk paket ini
        const daftarNomor = await getStok(paket.toUpperCase());
        
        let daftarText = '';
        if (daftarNomor.length > 0) {
          daftarText = `DAFTAR PENGELOLA UNTUK BULANAN ${paket.toUpperCase()}:\n\n<code>`;
          daftarNomor.forEach(nomor => {
            daftarText += `${nomor}\n`;
          });
          daftarText += `</code>\n`;
        } else {
          daftarText = `❌ TIDAK ADA STOK UNTUK BULANAN ${paket.toUpperCase()}\n\n`;
        }
        
        adminState.set(chatId, { mode: 'hapus_stok', kategori: paket.toUpperCase(), jenis: 'bulanan', menuMessageId: msgId });
        
        // JANGAN hapus menu, kirim input form di bawah menu
        const inputMsg = await bot.sendMessage(chatId, generateHapusStokForm('bulanan', paket.toUpperCase(), daftarNomor), {
          parse_mode: 'HTML'
        });
        
        // Simpan message ID untuk bisa diedit nanti
        const currentState = adminState.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        adminState.set(chatId, currentState);
        
      } catch (e) {
        console.error('Error getting stok list:', e);
        await bot.answerCallbackQuery(id, { text: '❌ Gagal memuat daftar stok.', show_alert: true });
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

    const state = adminState.get(chatId);
    if (!state || state.mode !== 'hapus_stok' || !state.kategori) return;

    // === CEK CANCEL/EXIT ===
    if (['exit', 'EXIT', 'Exit'].includes(msg.text.trim())) {
      // Hapus input form
      if (state.inputMessageId) {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {
          // Ignore delete error
        }
      }
      
      adminState.delete(chatId);
      await bot.deleteMessage(chatId, msg.message_id);
      return;
    }

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

    // Cek jika input adalah "ALL" untuk hapus semua dalam kategori
    if (msg.text.trim().toUpperCase() === 'ALL') {
      try {
        const jumlahHapus = await clearStokKategori(kategori);
        
        const jenisText = jenis === 'bekasan' ? 'BEKASAN' : 'BULANAN';
        let teksHasil = `✅ Berhasil menghapus semua stok dari kategori ${jenisText} ${kategori}\n\n📊 Total stok yang dihapus: ${jumlahHapus} nomor\n\n⏰ <i>Pesan akan hilang dalam 2 detik...</i>`;
        
        let resultMessageId;
        if (state.inputMessageId) {
          try {
            await bot.editMessageText(teksHasil, {
              chat_id: chatId,
              message_id: state.inputMessageId
            });
            resultMessageId = state.inputMessageId;
          } catch (e) {
            const msg = await bot.sendMessage(chatId, teksHasil);
            resultMessageId = msg.message_id;
          }
        } else {
          const msg = await bot.sendMessage(chatId, teksHasil);
          resultMessageId = msg.message_id;
        }
        
        // Countdown 1 detik
        setTimeout(async () => {
          try {
            const updatedText = teksHasil.replace('⏰ <i>Pesan akan hilang dalam 2 detik...</i>', '⏰ <i>Pesan akan hilang dalam 1 detik...</i>');
            await bot.editMessageText(updatedText, {
              chat_id: chatId,
              message_id: resultMessageId
            });
          } catch (e) {
            // Ignore edit error
          }
        }, 1000);
        
        // Auto delete setelah 2 detik
        setTimeout(async () => {
          try {
            await bot.deleteMessage(chatId, resultMessageId);
          } catch (e) {
            // Ignore delete error
          }
        }, 2000);
        
        adminState.delete(chatId);
        await bot.deleteMessage(chatId, msg.message_id);
        return;
      } catch (e) {
        await bot.sendMessage(chatId, `❌ Gagal menghapus stok: ${e.message}`);
        adminState.delete(chatId);
        return;
      }
    }

    // Hapus nomor-nomor spesifik
    const list = msg.text.split(/\n|\r/).map(s => s.trim()).filter(s => s);
    const berhasil = [];
    const gagal = [];

    for (const nomor of list) {
      try {
        // GUNAKAN deleteSingleStok untuk hapus hanya 1 record
        const deleted = await deleteSingleStok(kategori, nomor);
        if (deleted > 0) {
          berhasil.push(nomor);
        } else {
          gagal.push(nomor + ' (tidak ditemukan)');
        }
      } catch (e) {
        gagal.push(nomor + ' (error)');
      }
    }

    const jenisText = jenis === 'bekasan' ? 'BEKASAN' : 'BULANAN';
    let teksHasil = `✅ Proses hapus stok kategori ${jenisText} ${kategori} selesai`;
    
    if (berhasil.length > 0) {
      teksHasil += `\n\n🗑️ Berhasil dihapus (${berhasil.length}):\n`;
      berhasil.slice(0, 5).forEach((nomor, index) => {
        teksHasil += `${index + 1}. ${nomor}\n`;
      });
      if (berhasil.length > 5) {
        teksHasil += `... dan ${berhasil.length - 5} nomor lainnya`;
      }
    }
    
    if (gagal.length > 0) {
      teksHasil += `\n\n❌ Gagal dihapus (${gagal.length}):\n`;
      gagal.slice(0, 3).forEach((nomor, index) => {
        teksHasil += `${index + 1}. ${nomor}\n`;
      });
      if (gagal.length > 3) {
        teksHasil += `... dan ${gagal.length - 3} nomor lainnya`;
      }
    }

    // Tambahkan countdown ke pesan hasil
    teksHasil += `\n\n⏰ <i>Pesan akan hilang dalam 2 detik...</i>`;

    let resultMessageId;
    if (state.inputMessageId) {
      try {
        await bot.editMessageText(teksHasil, {
          chat_id: chatId,
          message_id: state.inputMessageId
        });
        resultMessageId = state.inputMessageId;
      } catch (e) {
        const msg = await bot.sendMessage(chatId, teksHasil);
        resultMessageId = msg.message_id;
      }
    } else {
      const msg = await bot.sendMessage(chatId, teksHasil);
      resultMessageId = msg.message_id;
    }
    
    // Countdown 1 detik
    setTimeout(async () => {
      try {
        const updatedText = teksHasil.replace('⏰ <i>Pesan akan hilang dalam 2 detik...</i>', '⏰ <i>Pesan akan hilang dalam 1 detik...</i>');
        await bot.editMessageText(updatedText, {
          chat_id: chatId,
          message_id: resultMessageId
        });
      } catch (e) {
        // Ignore edit error
      }
    }, 1000);
    
    // Auto delete notifikasi hasil setelah 2 detik
    setTimeout(async () => {
      try {
        await bot.deleteMessage(chatId, resultMessageId);
      } catch (e) {
        // Ignore delete error
      }
    }, 2000);
    
    adminState.delete(chatId);
    await bot.deleteMessage(chatId, msg.message_id);
    return;
  });
};

