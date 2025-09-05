const { getAllUsers, getTotalUsers, db, getUsersWithHistoryCount } = require('./db');

const adminState = new Map();

module.exports = (bot) => {
  // === Getalluser dengan teks biasa ===
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
    
    const chatId = msg.chat.id;
    const state = adminState.get(chatId);
    
    // === CEK EXIT untuk view_users ===
    if (state && state.mode === 'view_users') {
      const text = msg.text.trim();
      
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
        // Auto-delete command message
        setTimeout(async () => {
          try {
            await bot.deleteMessage(msg.chat.id, msg.message_id);
          } catch (e) {}
        }, 1000);
        return;
      }

      // Ambil semua user dengan detail transaksi dari permanent history table
      const users = await getUsersWithHistoryCount();
      
      if (users.length === 0) {
        await bot.sendMessage(msg.chat.id, '❌ Gagal mengambil data user.');
        // Auto-delete command message
        setTimeout(async () => {
          try {
            await bot.deleteMessage(msg.chat.id, msg.message_id);
          } catch (e) {}
        }, 1000);
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
      output += `\n💡 Ketik <b>"exit"</b> untuk keluar dari tampilan ini`;

      // Kirim pesan
      const sentMessage = await bot.sendMessage(msg.chat.id, output, {
        parse_mode: 'HTML'
      });

      // Auto-delete command message setelah respons dikirim
      setTimeout(async () => {
        try {
          await bot.deleteMessage(msg.chat.id, msg.message_id);
        } catch (e) {}
      }, 1000);

      // Simpan state untuk tracking
      adminState.set(msg.chat.id, {
        mode: 'view_users',
        resultMessageId: sentMessage.message_id
      });

    } catch (error) {
      console.error('Error in getalluser:', error);
      await bot.sendMessage(msg.chat.id, `❌ Gagal mengambil data user: ${error.message}`);
      
      // Auto-delete command message
      setTimeout(async () => {
        try {
          await bot.deleteMessage(msg.chat.id, msg.message_id);
        } catch (e) {}
      }, 1000);
    }
  });

  // === /getalluser command (backward compatibility) ===
  bot.onText(/\/getalluser/, async (msg) => {
    if (msg.from.id.toString() !== process.env.ADMIN_ID) {
      return bot.sendMessage(msg.chat.id, 'ente siapa njir🗿');
    }
    
    try {
      // Ambil total user
      const totalUsers = await getTotalUsers();
      
      if (totalUsers === 0) {
        await bot.sendMessage(msg.chat.id, '❌ Tidak ada user dalam database.');
        // Auto-delete command message
        setTimeout(async () => {
          try {
            await bot.deleteMessage(msg.chat.id, msg.message_id);
          } catch (e) {}
        }, 1000);
        return;
      }

      // Ambil semua user dengan detail transaksi dari permanent history table
      const users = await getUsersWithHistoryCount();
      
      if (users.length === 0) {
        await bot.sendMessage(msg.chat.id, '❌ Gagal mengambil data user.');
        // Auto-delete command message
        setTimeout(async () => {
          try {
            await bot.deleteMessage(msg.chat.id, msg.message_id);
          } catch (e) {}
        }, 1000);
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
      output += `\n💡 Ketik <b>"exit"</b> untuk keluar dari tampilan ini`;

      // Kirim pesan
      const sentMessage = await bot.sendMessage(msg.chat.id, output, {
        parse_mode: 'HTML'
      });

      // Auto-delete command message setelah respons dikirim
      setTimeout(async () => {
        try {
          await bot.deleteMessage(msg.chat.id, msg.message_id);
        } catch (e) {}
      }, 1000);

      // Simpan state untuk tracking
      adminState.set(msg.chat.id, {
        mode: 'view_users',
        resultMessageId: sentMessage.message_id
      });

    } catch (error) {
      console.error('Error in getalluser:', error);
      await bot.sendMessage(msg.chat.id, `❌ Gagal mengambil data user: ${error.message}`);
      
      // Auto-delete command message
      setTimeout(async () => {
        try {
          await bot.deleteMessage(msg.chat.id, msg.message_id);
        } catch (e) {}
      }, 1000);
    }
  });
};
