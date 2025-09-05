const { getStok } = require('./db');

const adminState = new Map();

module.exports = (bot) => {
  // === Allstok dengan teks biasa ===
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    
    // Cek apakah user adalah admin
    if (msg.from.id.toString() !== process.env.ADMIN_ID) return;
    
    // === PROTEKSI BROADCAST SESI ===
    // Jika admin sedang dalam sesi broadcast, jangan proses trigger menu lain
    if (bot.isAdminInBroadcastSession && bot.isAdminInBroadcastSession(msg)) {
      return; // Skip processing, biarkan broadcast handler yang menangani
    }
    
    // Cek state untuk mode allstok
    const state = adminState.get(chatId);
    
    // Jika sedang dalam mode view_allstok, handle exit
    if (state && state.mode === 'view_allstok') {
      if (!msg.text) return;
      
      const text = msg.text.trim();

      // === CEK EXIT ===
      if (['exit', 'EXIT', 'Exit'].includes(text)) {
        // Hapus result message dan user message
        if (state.resultMessageId) {
          try {
            await bot.deleteMessage(chatId, state.resultMessageId);
          } catch (e) {
            // Ignore delete error
          }
        }
        try {
          await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {
          // Ignore delete error
        }
        
        adminState.delete(chatId);
        return;
      }

      // Untuk input lainnya, hapus message user (biarkan result tetap tampil)
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {
        // Ignore delete error
      }
      return;
    }
    
    // Cek apakah ini bukan command slash dan ada text
    if (!msg.text || msg.text.startsWith('/')) return;
    
    // Keywords untuk trigger allstok
    const allstokKeywords = [
      'all stok', 'allstok', 'semua stok', 'cek semua stok', 'lihat stok',
      'stok lengkap', 'list stok', 'daftar stok', 'inventori', 'stok', 'inventory',
      'cek stok semua', 'tampilkan stok', 'show stock'
    ];
    
    const messageText = msg.text.toLowerCase();
    const isAllstokRequest = allstokKeywords.some(keyword => 
      messageText.includes(keyword)
    );
    
    if (!isAllstokRequest) return;
    
    // Mulai proses allstok
    adminState.set(msg.chat.id, { mode: 'view_allstok' });
    
    try {
      // Definisikan semua kategori
      const kategoriStok = {
        bekasan: ['3H', '4H', '5H', '6H', '7H', '8H', '9H', '10H'],
        bulanan: ['SUPERMINI', 'MINI', 'BIG', 'LITE', 'JUMBO', 'MEGABIG']
      };
      
      let output = '<b>📦 SEMUA PENGELOLA DARI SISA STOK</b>\n\n';
      let hasStok = false;
      
      // Cek stok bekasan
      for (const kategori of kategoriStok.bekasan) {
        try {
          const stokList = await getStok(kategori);
          if (stokList.length > 0) {
            hasStok = true;
            output += `<b>Bekasan ${kategori} : </b><i>${stokList.length}</i>\n`;
            stokList.forEach(nomor => {
              output += `<code>${nomor}</code>\n`;
            });
            output += '\n';
          }
        } catch (e) {
          console.error(`Error getting stok ${kategori}:`, e.message);
        }
      }
      
      // Cek stok bulanan
      for (const paket of kategoriStok.bulanan) {
        try {
          const stokList = await getStok(paket);
          if (stokList.length > 0) {
            hasStok = true;
            output += `<b>Bulanan ${paket} : </b><i>${stokList.length}</i>\n`;
            stokList.forEach(nomor => {
              output += `<code>${nomor}</code>\n`;
            });
            output += '\n';
          }
        } catch (e) {
          console.error(`Error getting stok ${paket}:`, e.message);
        }
      }
      
      // Jika tidak ada stok sama sekali
      if (!hasStok) {
        output += '❌ <b>Tidak ada stok tersedia</b>\n\n';
        output += '📝 Semua kategori kosong:\n';
        output += '• Bekasan: 3H, 4H, 5H, 6H, 7H, 8H, 9H, 10H\n';
        output += '• Bulanan: SUPERMINI, MINI, BIG, LITE, JUMBO, MEGABIG\n\n';
      }
      
      output += '💡 Ketik <b>"exit"</b> untuk keluar dari tampilan ini';
      
      // Kirim output
      const resultMsg = await bot.sendMessage(msg.chat.id, output, {
        parse_mode: 'HTML'
      });
      
      // Auto-delete command message setelah respons dikirim
      setTimeout(async () => {
        try {
          await bot.deleteMessage(msg.chat.id, msg.message_id);
        } catch (e) {}
      }, 1000);
      
      // Simpan message ID untuk tracking
      const currentState = adminState.get(msg.chat.id);
      currentState.resultMessageId = resultMsg.message_id;
      adminState.set(msg.chat.id, currentState);
      
    } catch (error) {
      console.error('Error in allstok:', error);
      await bot.sendMessage(msg.chat.id, `❌ Gagal mengambil data stok: ${error.message}`);
      
      // Auto-delete command message
      setTimeout(async () => {
        try {
          await bot.deleteMessage(msg.chat.id, msg.message_id);
        } catch (e) {}
      }, 1000);
      
      adminState.delete(msg.chat.id);
    }
  });

  // === /allstok command (backward compatibility) ===
  bot.onText(/\/allstok/, async (msg) => {
    if (msg.from.id.toString() !== process.env.ADMIN_ID) {
      await bot.sendMessage(msg.chat.id, 'ente siapa njir🗿');
      // Auto-delete command message
      setTimeout(async () => {
        try {
          await bot.deleteMessage(msg.chat.id, msg.message_id);
        } catch (e) {}
      }, 1000);
      return;
    }
    
    adminState.set(msg.chat.id, { mode: 'view_allstok' });
    
    try {
      // Definisikan semua kategori
      const kategoriStok = {
        bekasan: ['3H', '4H', '5H', '6H', '7H', '8H', '9H', '10H'],
        bulanan: ['SUPERMINI', 'MINI', 'BIG', 'LITE', 'JUMBO', 'MEGABIG']
      };
      
      let output = '<b>📦 SEMUA PENGELOLA DARI SISA STOK</b>\n\n';
      let hasStok = false;
      
      // Cek stok bekasan
      for (const kategori of kategoriStok.bekasan) {
        try {
          const stokList = await getStok(kategori);
          if (stokList.length > 0) {
            hasStok = true;
            output += `<b>Bekasan ${kategori} : </b><i>${stokList.length}</i>\n`;
            stokList.forEach(nomor => {
              output += `<code>${nomor}</code>\n`;
            });
            output += '\n';
          }
        } catch (e) {
          console.error(`Error getting stok ${kategori}:`, e.message);
        }
      }
      
      // Cek stok bulanan
      for (const paket of kategoriStok.bulanan) {
        try {
          const stokList = await getStok(paket);
          if (stokList.length > 0) {
            hasStok = true;
            output += `<b>Bulanan ${paket} : </b><i>${stokList.length}</i>\n`;
            stokList.forEach(nomor => {
              output += `<code>${nomor}</code>\n`;
            });
            output += '\n';
          }
        } catch (e) {
          console.error(`Error getting stok ${paket}:`, e.message);
        }
      }
      
      // Jika tidak ada stok sama sekali
      if (!hasStok) {
        output += '❌ <b>Tidak ada stok tersedia</b>\n\n';
        output += '📝 Semua kategori kosong:\n';
        output += '• Bekasan: 3H, 4H, 5H, 6H, 7H, 8H, 9H, 10H\n';
        output += '• Bulanan: SUPERMINI, MINI, BIG, LITE, JUMBO, MEGABIG\n\n';
      }
      
      output += '💡 Ketik <b>"exit"</b> untuk keluar dari tampilan ini';
      
      // Kirim output
      const resultMsg = await bot.sendMessage(msg.chat.id, output, {
        parse_mode: 'HTML'
      });
      
      // Auto-delete command message setelah respons dikirim
      setTimeout(async () => {
        try {
          await bot.deleteMessage(msg.chat.id, msg.message_id);
        } catch (e) {}
      }, 1000);
      
      // Simpan message ID untuk tracking
      const currentState = adminState.get(msg.chat.id);
      currentState.resultMessageId = resultMsg.message_id;
      adminState.set(msg.chat.id, currentState);
      
    } catch (error) {
      console.error('Error in /allstok:', error);
      await bot.sendMessage(msg.chat.id, `❌ Gagal mengambil data stok: ${error.message}`);
      
      // Auto-delete command message
      setTimeout(async () => {
        try {
          await bot.deleteMessage(msg.chat.id, msg.message_id);
        } catch (e) {}
      }, 1000);
      
      adminState.delete(msg.chat.id);
    }
  });
};
