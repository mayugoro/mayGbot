const { getStok } = require('./db');

// Import utils template untuk flow management
const { 
  handleFlowWithExit, 
  sendMessageWithTracking, 
  initializeFlowState,
  generateExitInstruction,
  autoDeleteMessage,
  EXIT_KEYWORDS
} = require('./utils/flow_sendMessage');

const adminState = new Map();

module.exports = (bot) => {
  // === Allstok dengan teks biasa (MENGGUNAKAN UTILS TEMPLATE) ===
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    
    // Cek apakah user adalah admin
    if (msg.from.id.toString() !== process.env.ADMIN_ID) return;
    
    // === PROTEKSI BROADCAST SESI ===
    // Jika admin sedang dalam sesi broadcast, jangan proses trigger menu lain
    if (bot.isAdminInBroadcastSession && bot.isAdminInBroadcastSession(msg)) {
      return; // Skip processing, biarkan broadcast handler yang menangani
    }
    
    // ✅ MENGGUNAKAN UTILS TEMPLATE untuk handle flow dengan exit
    const flowControl = await handleFlowWithExit(bot, msg, adminState, 'view_allstok', EXIT_KEYWORDS.COMBINED);
    
    if (flowControl.isExit) {
      return; // Exit berhasil diproses oleh utils
    }
    
    if (!flowControl.shouldContinue) {
      return; // Flow sedang aktif, stop processing
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
    
    // ✅ MENGGUNAKAN UTILS TEMPLATE untuk inisialisasi flow state
    initializeFlowState(adminState, chatId, 'view_allstok');
    
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
      
      // ✅ MENGGUNAKAN UTILS TEMPLATE untuk generate exit instruction
      output += generateExitInstruction();
      
      // ✅ MENGGUNAKAN UTILS TEMPLATE untuk send message dengan tracking
      await sendMessageWithTracking(
        bot, 
        chatId, 
        output, 
        { parse_mode: 'HTML' },
        adminState,
        adminState.get(chatId),
        msg
      );
      
    } catch (error) {
      console.error('Error in allstok:', error);
      await bot.sendMessage(chatId, `❌ Gagal mengambil data stok: ${error.message}`);
      
      // ✅ MENGGUNAKAN UTILS TEMPLATE untuk auto-delete
      await autoDeleteMessage(bot, chatId, msg.message_id);
      
      adminState.delete(chatId);
    }
  });

  // === /allstok command (backward compatibility) - MENGGUNAKAN UTILS TEMPLATE ===
  bot.onText(/\/allstok/, async (msg) => {
    if (msg.from.id.toString() !== process.env.ADMIN_ID) {
      await bot.sendMessage(msg.chat.id, 'ente siapa njir🗿');
      // ✅ MENGGUNAKAN UTILS TEMPLATE untuk auto-delete
      await autoDeleteMessage(bot, msg.chat.id, msg.message_id);
      return;
    }
    
    // ✅ MENGGUNAKAN UTILS TEMPLATE untuk inisialisasi flow state
    initializeFlowState(adminState, msg.chat.id, 'view_allstok');
    
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
      
      // ✅ MENGGUNAKAN UTILS TEMPLATE untuk generate exit instruction
      output += generateExitInstruction();
      
      // ✅ MENGGUNAKAN UTILS TEMPLATE untuk send message dengan tracking
      await sendMessageWithTracking(
        bot, 
        msg.chat.id, 
        output, 
        { parse_mode: 'HTML' },
        adminState,
        adminState.get(msg.chat.id),
        msg
      );
      
    } catch (error) {
      console.error('Error in /allstok:', error);
      await bot.sendMessage(msg.chat.id, `❌ Gagal mengambil data stok: ${error.message}`);
      
      // ✅ MENGGUNAKAN UTILS TEMPLATE untuk auto-delete
      await autoDeleteMessage(bot, msg.chat.id, msg.message_id);
      
      adminState.delete(msg.chat.id);
    }
  });
};
