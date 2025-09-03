const { db, getUserSaldo } = require('./db');

// Storage untuk delete states
const deleteStates = new Map(); // key: chatId, value: { step, inputMessageId }

function isAuthorized(id) {
  return id.toString() === process.env.ADMIN_ID;
}

// Function untuk hapus user dari database (Hard Delete - Total Reset)
const deleteUserFromDB = (userId) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Hapus TOTAL dari tabel pengguna (termasuk saldo)
      db.run('DELETE FROM pengguna WHERE user_id = ?', [userId], function(err) {
        if (err) {
          console.error('Error deleting from pengguna:', err);
          return reject(err);
        }
        
        const penggunaDeleted = this.changes;
          
          // Hapus dari tabel stok (data yang terkait dengan user)
          db.run('DELETE FROM stok WHERE user_id = ?', [userId], function(err) {
            if (err) {
              console.error('Error deleting from stok:', err);
              return reject(err);
            }
            
            const stokDeleted = this.changes;
            
            // Hapus dari tabel transaction_history
            db.run('DELETE FROM transaction_history WHERE user_id = ?', [userId], function(err) {
              if (err) {
                console.error('Error deleting from transaction_history:', err);
                return reject(err);
              }
              
              const historyDeleted = this.changes;
              
              // Reset redeem_codes (jika user pernah redeem)
              db.run('UPDATE redeem_codes SET used_by = NULL WHERE used_by = ?', [userId], function(err) {
                if (err) {
                  console.error('Error updating redeem_codes:', err);
                  return reject(err);
                }
                
                const redeemUpdated = this.changes;
                
              // Hapus dari tabel kick_schedule
              db.run('DELETE FROM kick_schedule WHERE chat_id = ?', [userId.toString()], function(err) {
                if (err) {
                  console.error('Error deleting from kick_schedule:', err);
                  return reject(err);
                }
                
                const kickDeleted = this.changes;
                
                resolve({
                  pengguna: penggunaDeleted,
                  stok: stokDeleted,
                  history: historyDeleted,
                  redeem: redeemUpdated,
                  kick: kickDeleted,
                  total: penggunaDeleted + stokDeleted + historyDeleted + redeemUpdated + kickDeleted
                });
              });
            });
          });
        });
      });
    });
  });
};

module.exports = (bot) => {
  // === Delete dengan teks biasa ===
  bot.on('message', async (msg) => {
    // Cek apakah user adalah admin
    if (!msg || !msg.from || msg.from.id.toString() !== process.env.ADMIN_ID) return;
    
    // Cek apakah ini bukan command slash dan ada text
    if (!msg.text || msg.text.startsWith('/')) return;
    
    const chatId = msg.chat.id;
    const state = deleteStates.get(chatId);
    
    // Jika sedang dalam state delete, jangan proses sebagai trigger
    if (state && state.step === 'input_id') return;
    
    // Keywords untuk trigger delete - exact match atau di awal kalimat
    const deleteKeywords = [
      'del', 'delete', 'hapus', 'reset', 'hapus pengguna', 'hapuspengguna', 'delete user',
      'hapus user', 'remove user', 'delete id', 'hapus id', 'remove id',
      'hapus data', 'delete data', 'remove data', 'bersihkan data'
    ];
    
    const messageText = msg.text.toLowerCase().trim();
    
    // Cek apakah message adalah exact match dengan keyword atau dimulai dengan keyword + spasi
    const isDeleteRequest = deleteKeywords.some(keyword => {
      return messageText === keyword || messageText.startsWith(keyword + ' ');
    });
    
    if (!isDeleteRequest) return;
    
    // Trigger delete process
    // Set state untuk input ID
    deleteStates.set(chatId, { step: 'input_id' });
    
    const inputMsg = await bot.sendMessage(chatId,
      '<i>Masukan ID yg akan dihapus dari database.\n' +
      'Bisa massal, pisahkan dengan Enter.\n\n' +
      '💡 Ketik "exit" untuk membatalkan</i>',
      { parse_mode: 'HTML' }
    );
    
    // Auto-delete trigger message
    setTimeout(async () => {
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {}
    }, 1000);
    
    // Simpan message ID input untuk bisa diedit nanti
    const currentState = deleteStates.get(chatId);
    currentState.inputMessageId = inputMsg.message_id;
    deleteStates.set(chatId, currentState);
  });

  // Handle /del command (Admin only) - Backward compatibility
  bot.onText(/\/del$/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Cek authorization
    if (!isAuthorized(userId)) {
      return bot.sendMessage(chatId, "❌ Anda tidak memiliki akses untuk menggunakan command ini.");
    }

    // Set state untuk input ID
    deleteStates.set(chatId, { step: 'input_id' });
    
    const inputMsg = await bot.sendMessage(chatId,
      '<i>Masukan ID yg akan dihapus dari database.\n' +
      'Bisa massal, pisahkan dengan Enter.\n\n' +
      '💡 Ketik "exit" untuk membatalkan</i>',
      { parse_mode: 'HTML' }
    );
    
    // Simpan message ID input untuk bisa diedit nanti
    const currentState = deleteStates.get(chatId);
    currentState.inputMessageId = inputMsg.message_id;
    deleteStates.set(chatId, currentState);
  });

  // Handle text input untuk delete
  bot.on('message', async (msg) => {
    if (!msg || !msg.chat || !msg.from || !msg.text) return;
    
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text.trim();

    const state = deleteStates.get(chatId);
    if (!state || state.step !== 'input_id') return;
    
    if (text.startsWith("/")) return;
    if (!isAuthorized(userId)) {
      try {
        await bot.sendMessage(chatId, "❌ Anda tidak memiliki akses untuk menggunakan command ini.");
      } catch (e) {
        console.error('Error sending unauthorized message:', e);
      }
      return;
    }

    try {
      // === CEK APAKAH INPUT ADALAH DELETE TRIGGER ===
      // Jangan proses delete trigger sebagai input ID
      const deleteKeywords = [
        'del', 'delete', 'hapus', 'reset', 'hapus pengguna', 'hapuspengguna', 'delete user',
        'hapus user', 'remove user', 'delete id', 'hapus id', 'remove id',
        'hapus data', 'delete data', 'remove data', 'bersihkan data'
      ];
      
      const lowerText = text.toLowerCase();
      const isDeleteKeyword = deleteKeywords.some(keyword => {
        return lowerText === keyword || lowerText.startsWith(keyword + ' ');
      });
      
      if (isDeleteKeyword) {
        // Ini adalah delete trigger, bukan input ID - abaikan
        await bot.deleteMessage(chatId, msg.message_id);
        return;
      }
      
      // === CEK CANCEL/EXIT ===
      if (['exit', 'EXIT', 'Exit'].includes(text)) {
        // Hapus input form
        if (state.inputMessageId) {
          try {
            await bot.deleteMessage(chatId, state.inputMessageId);
          } catch (e) {
            // Ignore delete error
          }
        }
        
        deleteStates.delete(chatId);
        await bot.deleteMessage(chatId, msg.message_id);
        return;
      }

      // Parse ID (multiple lines)
      const lines = text.split(/\n|\r/).map(line => line.trim()).filter(line => line);
      const validIds = [];
      
      for (const line of lines) {
        const cleanId = line.replace(/\D/g, '');
        if (cleanId.length >= 8 && cleanId.length <= 12) { // ID Telegram biasanya 8-12 digit
          validIds.push(cleanId);
        }
      }
      
      // Hilangkan duplikasi ID
      const uniqueIds = [...new Set(validIds)];
      
      if (uniqueIds.length === 0) {
        await bot.sendMessage(chatId, 
          '❌ <b>Tidak ada ID yang valid!</b>\n\n' +
          'Format: 8-12 digit angka per baris.\n' +
          'Coba lagi atau ketik "exit" untuk batal.',
          { parse_mode: 'HTML' }
        );
        await bot.deleteMessage(chatId, msg.message_id);
        return;
      }

      // Hapus pesan input user dan form input
      if (state.inputMessageId) {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {}
      }
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {}

      // Kirim pesan "Diproses..."
      const processMsg = await bot.sendMessage(chatId, '<i>Diproses...</i>', { parse_mode: 'HTML' });

      // Mulai proses delete massal
      let totalSuccess = 0;
      let totalFailed = 0;
      let deletedUsers = []; // Array untuk menyimpan data user yang dihapus

      // Process setiap ID
      for (let i = 0; i < uniqueIds.length; i++) {
        const targetId = uniqueIds[i];
        
        try {
          // Cek apakah user ada di database terlebih dahulu
          const userSaldo = await getUserSaldo(parseInt(targetId));
          
          if (userSaldo !== null) {
            // Ambil data lengkap user sebelum dihapus
            const userData = await new Promise((resolve, reject) => {
              db.get('SELECT user_id, username, saldo FROM pengguna WHERE user_id = ?', [parseInt(targetId)], (err, row) => {
                if (err) return reject(err);
                resolve(row);
              });
            });
            
            // User ada, lanjut hapus
            const result = await deleteUserFromDB(parseInt(targetId));
            
            if (result.total > 0) {
              totalSuccess++;
              
              // Simpan data user yang berhasil dihapus
              if (userData) {
                const username = userData.username || 'N/A';
                let displayUsername;
                
                if (username === 'N/A' || username === null) {
                  displayUsername = 'N/A';
                } else if (username.startsWith('@')) {
                  displayUsername = username;
                } else {
                  displayUsername = `@${username}`;
                }
                
                deletedUsers.push({
                  id: userData.user_id,
                  username: displayUsername,
                  saldo: userData.saldo || 0
                });
              }
            } else {
              totalFailed++;
            }
          } else {
            // User tidak ada di database
            totalFailed++;
          }
          
        } catch (error) {
          console.error(`Error deleting user ${targetId}:`, error);
          totalFailed++;
        }
        
        // Delay singkat antar proses
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Hapus pesan "Diproses..."
      try {
        await bot.deleteMessage(chatId, processMsg.message_id);
      } catch (e) {}

      // Kirim hasil dengan detail powerful
      let resultText = `💥 <b>PENGHAPUSAN TOTAL SELESAI!</b>\n\n`;
      resultText += `📊 <b>Statistik Penghapusan:</b>\n`;
      resultText += `• ID diproses: ${uniqueIds.length}\n`;
      resultText += `• Berhasil: ${totalSuccess}\n`;
      resultText += `• Gagal: ${totalFailed}\n\n`;
      
      if (totalSuccess > 0 && deletedUsers.length > 0) {
        resultText += `🗃️ <b>Detail Data TERHAPUS TOTAL:</b>\n`;
        
        deletedUsers.forEach(user => {
          resultText += `<code>${user.id}</code> : ${user.username} : Rp. ${user.saldo.toLocaleString('id-ID')}\n`;
        });
        
        resultText += `\n⚠️ <b>SALDO IKUT TERHAPUS TOTAL!</b>\n`;
        resultText += `📝 <i>User harus daftar ulang dari NOL saat akses bot lagi.</i>`;
      }

      await bot.sendMessage(chatId, resultText, { parse_mode: 'HTML' });

      // Clean up state
      deleteStates.delete(chatId);

    } catch (error) {
      console.error('Error handling delete input:', error.message);
      await bot.sendMessage(chatId, '❌ <b>Terjadi error, silakan coba lagi!</b>', { parse_mode: 'HTML' });
      deleteStates.delete(chatId);
    }
  });
};
