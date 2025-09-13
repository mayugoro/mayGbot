const { getAllUsers, getTotalUsers, db, getUsersWithHistoryCount } = require('./db');

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
  // === Getalluser dengan teks biasa - MENGGUNAKAN UTILS TEMPLATE ===
  bot.on('message', async (msg) => {
    // Cek apakah user adalah admin
    if (msg.from.id.toString() !== process.env.ADMIN_ID) return;
    
    // Cek apakah ini bukan command slash dan ada text
    if (!msg.text || msg.text.startsWith('/')) return;
    
    // === PROTEKSI BROADCAST SESI ===
    // Jika admin sedang dalam sesi broadcast, jangan proses trigger menu lain
    if (bot.isAdminInBroadcastSession && bot.isAdminInBroadcastSession(msg)) {
      return; // Skip processing, biarkan broadcast handler yang menangani
    }
    
    // ✅ MENGGUNAKAN UTILS TEMPLATE untuk handle flow dengan exit
    const flowControl = await handleFlowWithExit(bot, msg, adminState, 'view_users', EXIT_KEYWORDS.COMBINED);
    
    if (flowControl.isExit) {
      return; // Exit berhasil diproses oleh utils
    }
    
    if (!flowControl.shouldContinue) {
      return; // Flow sedang aktif, stop processing
    }
    
    const chatId = msg.chat.id;
    
    // Keywords untuk trigger getalluser
    const getalluserKeywords = [
      'get all user', 'getalluser', 'semua user', 'data user', 'user', 'semua user', 'list user',
      'daftar user', 'user list', 'all users', 'lihat user', 'tampilkan user',
      'cek user', 'data member', 'member list', 'database user', 'user database'
    ];
    
    const messageText = msg.text.toLowerCase();
    const isGetalluserRequest = getalluserKeywords.some(keyword => 
      messageText.includes(keyword)
    );
    
    if (!isGetalluserRequest) return;
    
    try {
      // Ambil total user
      const totalUsers = await getTotalUsers();
      
      if (totalUsers === 0) {
        await bot.sendMessage(msg.chat.id, '❌ Tidak ada user dalam database.');
        // ✅ MENGGUNAKAN UTILS TEMPLATE untuk auto-delete
        await autoDeleteMessage(bot, msg.chat.id, msg.message_id);
        return;
      }

      // Ambil semua user dengan detail transaksi dari permanent history table
      const users = await getUsersWithHistoryCount();
      
      if (users.length === 0) {
        await bot.sendMessage(msg.chat.id, '❌ Gagal mengambil data user.');
        // ✅ MENGGUNAKAN UTILS TEMPLATE untuk auto-delete
        await autoDeleteMessage(bot, msg.chat.id, msg.message_id);
        return;
      }

      // Format output
      let output = `📊 <b>DATA SEMUA USER</b>\n\n`;
      output += `👥 <b>Total User:</b> ${totalUsers}\n\n`;
      output += `<b>ID | Username | Total TRX | Saldo Akhir</b>\n`;
      output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      
      users.forEach(user => {
        const username = user.username || 'N/A';
        let displayUsername;
        
        // Fixed username display logic - handle null values properly
        if (username === 'N/A' || username === null) {
          displayUsername = 'N/A';
        } else if (username.startsWith('@')) {
          displayUsername = username;
        } else {
          displayUsername = `@${username}`;
        }
        
        const totalTrx = user.total_transactions || 0;
        const saldo = user.saldo || 0;
        
        output += `<code>${user.user_id}</code> : ${displayUsername} : ${totalTrx} : Rp. ${saldo.toLocaleString('id-ID')}\n`;
      });
      
      output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      output += `\n` + generateExitInstruction();

      // ✅ MENGGUNAKAN UTILS TEMPLATE untuk inisialisasi flow state
      initializeFlowState(adminState, chatId, 'view_users');

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
      console.error('Error in getalluser:', error);
      await bot.sendMessage(chatId, `❌ Gagal mengambil data user: ${error.message}`);
      
      // ✅ MENGGUNAKAN UTILS TEMPLATE untuk auto-delete
      await autoDeleteMessage(bot, chatId, msg.message_id);
    }
  });

  // === /getalluser command (backward compatibility) - MENGGUNAKAN UTILS TEMPLATE ===
  bot.onText(/\/getalluser/, async (msg) => {
    if (msg.from.id.toString() !== process.env.ADMIN_ID) {
      await bot.sendMessage(msg.chat.id, 'ente siapa njir🗿');
      // ✅ MENGGUNAKAN UTILS TEMPLATE untuk auto-delete
      await autoDeleteMessage(bot, msg.chat.id, msg.message_id);
      return;
    }
    
    try {
      // Ambil total user
      const totalUsers = await getTotalUsers();
      
      if (totalUsers === 0) {
        await bot.sendMessage(msg.chat.id, '❌ Tidak ada user dalam database.');
        // ✅ MENGGUNAKAN UTILS TEMPLATE untuk auto-delete
        await autoDeleteMessage(bot, msg.chat.id, msg.message_id);
        return;
      }

      // Ambil semua user dengan detail transaksi dari permanent history table
      const users = await getUsersWithHistoryCount();
      
      if (users.length === 0) {
        await bot.sendMessage(msg.chat.id, '❌ Gagal mengambil data user.');
        // ✅ MENGGUNAKAN UTILS TEMPLATE untuk auto-delete
        await autoDeleteMessage(bot, msg.chat.id, msg.message_id);
        return;
      }

      // Format output
      let output = `📊 <b>DATA SEMUA USER</b>\n\n`;
      output += `👥 <b>Total User:</b> ${totalUsers}\n\n`;
      output += `<b>ID | Username | Total TRX | Saldo Akhir</b>\n`;
      output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      
      users.forEach(user => {
        const username = user.username || 'N/A';
        let displayUsername;
        
        // Fixed username display logic - handle null values properly
        if (username === 'N/A' || username === null) {
          displayUsername = 'N/A';
        } else if (username.startsWith('@')) {
          displayUsername = username;
        } else {
          displayUsername = `@${username}`;
        }
        
        const totalTrx = user.total_transactions || 0;
        const saldo = user.saldo || 0;
        
        output += `<code>${user.user_id}</code> : ${displayUsername} : ${totalTrx} : Rp. ${saldo.toLocaleString('id-ID')}\n`;
      });
      
      output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      output += `\n` + generateExitInstruction();

      // ✅ MENGGUNAKAN UTILS TEMPLATE untuk inisialisasi flow state
      initializeFlowState(adminState, msg.chat.id, 'view_users');

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
      console.error('Error in getalluser:', error);
      await bot.sendMessage(msg.chat.id, `❌ Gagal mengambil data user: ${error.message}`);
      
      // ✅ MENGGUNAKAN UTILS TEMPLATE untuk auto-delete
      await autoDeleteMessage(bot, msg.chat.id, msg.message_id);
    }
  });
};