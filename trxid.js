const { db } = require('./db');
const fs = require('fs');
const path = require('path');

const adminState = new Map();

module.exports = (bot) => {
  // === /trx ===
  bot.onText(/\/trx\s+(.+)/, async (msg, match) => {
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
    
    const userId = match[1].trim();
    adminState.set(msg.chat.id, { mode: 'view_trx', userId: userId });
    
    try {
      // Ambil username dari database pengguna
      const userInfo = await getUserInfo(userId);
      if (!userInfo) {
        const errorMsg = await bot.sendMessage(msg.chat.id, '❌ <b>User tidak ditemukan!</b>\n\nPastikan ID user benar dan user pernah menggunakan bot.', {
          parse_mode: 'HTML'
        });
        
        // Auto-delete command message
        setTimeout(async () => {
          try {
            await bot.deleteMessage(msg.chat.id, msg.message_id);
          } catch (e) {}
        }, 1000);
        
        setTimeout(async () => {
          try {
            await bot.deleteMessage(msg.chat.id, errorMsg.message_id);
          } catch (e) {}
        }, 3000);
        
        adminState.delete(msg.chat.id);
        return;
      }
      
      // Ambil semua transaksi sukses dari user
      const transaksiList = await getTransaksiByUser(userId);
      
      if (transaksiList.length === 0) {
        const emptyMsg = await bot.sendMessage(msg.chat.id, `❌ <b>Tidak ada transaksi sukses</b>\n\nUser <code>${userId}</code> : ${userInfo.username}\nbelum memiliki transaksi yang berhasil.`, {
          parse_mode: 'HTML'
        });
        
        // Auto-delete command message
        setTimeout(async () => {
          try {
            await bot.deleteMessage(msg.chat.id, msg.message_id);
          } catch (e) {}
        }, 1000);
        
        setTimeout(async () => {
          try {
            await bot.deleteMessage(msg.chat.id, emptyMsg.message_id);
          } catch (e) {}
        }, 3000);
        
        adminState.delete(msg.chat.id);
        return;
      }
      
      // Format output transaksi
      let output = `<b>ALL TRX FROM ${userId} : @${userInfo.username}</b>\n`;
      output += `<b>✨Total : ${transaksiList.length} Transaksi.</b>\n\n`;
      output += `<b>Nomor pengelola | Nomor yg diisi | Tipe paket</b>\n`;
      output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      
      transaksiList.forEach(trx => {
        output += `<code>${trx.nomor}</code> | <code>${trx.anggota}</code> | ${trx.kategori}\n`;
      });
      
      output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      output += `💡 Ketik <b>"exit"</b> untuk keluar dari tampilan ini`;
      
      // Cek apakah output terlalu panjang untuk Telegram (limit 4096 karakter)
      if (output.length > 4000) {
        // Buat file txt jika terlalu panjang
        await createAndSendTxtFile(msg.chat.id, userId, userInfo.username, transaksiList, bot);
        
        // Auto-delete command message
        setTimeout(async () => {
          try {
            await bot.deleteMessage(msg.chat.id, msg.message_id);
          } catch (e) {}
        }, 1000);
        
        adminState.delete(msg.chat.id);
      } else {
        // Kirim sebagai pesan teks biasa
        const resultMsg = await bot.sendMessage(msg.chat.id, output, {
          parse_mode: 'HTML'
        });
        
        // Auto-delete command message
        setTimeout(async () => {
          try {
            await bot.deleteMessage(msg.chat.id, msg.message_id);
          } catch (e) {}
        }, 1000);
        
        // Simpan message ID untuk tracking
        const currentState = adminState.get(msg.chat.id);
        currentState.resultMessageId = resultMsg.message_id;
        currentState.userInfo = userInfo;
        adminState.set(msg.chat.id, currentState);
      }
      
    } catch (error) {
      console.error('Error in /trx:', error);
      await bot.sendMessage(msg.chat.id, `❌ Gagal mengambil data transaksi: ${error.message}`);
      
      // Auto-delete command message
      setTimeout(async () => {
        try {
          await bot.deleteMessage(msg.chat.id, msg.message_id);
        } catch (e) {}
      }, 1000);
      
      adminState.delete(msg.chat.id);
    }
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (!msg.text) return;
    if (msg.from.id.toString() !== process.env.ADMIN_ID) return;

    const state = adminState.get(chatId);
    if (!state || state.mode !== 'view_trx') return;

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
      
      // Kirim notifikasi exit yang akan hilang 2 detik
      const exitMsg = await bot.sendMessage(chatId, '✅ Keluar dari tampilan transaksi.');
      setTimeout(async () => {
        try {
          await bot.deleteMessage(chatId, exitMsg.message_id);
        } catch (e) {
          // Ignore delete error
        }
      }, 2000);
      
      adminState.delete(chatId);
      return;
    }

    // Untuk input lainnya, hapus message user (biarkan result tetap tampil)
    try {
      await bot.deleteMessage(chatId, msg.message_id);
    } catch (e) {
      // Ignore delete error
    }
  });
};

// Function untuk mendapatkan info user dari database
const getUserInfo = (userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT user_id, username FROM pengguna WHERE user_id = ?', [userId], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

// Function untuk mendapatkan semua transaksi sukses dari user
const getTransaksiByUser = (userId) => {
  return new Promise((resolve, reject) => {
    // Query untuk mengambil SEMUA transaksi sukses dari user
    // Tidak ada filter expired_at karena kita ingin melihat histori lengkap
    db.all(`
      SELECT nomor, anggota, kategori, slot_ke, kuota, expired_at,
             datetime(expired_at, 'localtime') as expired_formatted,
             datetime(substr(expired_at, 1, 19)) as expired_utc
      FROM stok 
      WHERE user_id = ? AND status = 'freeze'
      ORDER BY id DESC
    `, [userId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

// Function untuk membuat dan mengirim file txt
const createAndSendTxtFile = async (chatId, userId, username, transaksiList, bot) => {
  const fileName = `TRXID ${userId} - ${username}.txt`;
  const filePath = path.join(__dirname, fileName);
  
  try {
    // Buat konten file
    let fileContent = `ALL TRX FROM ${userId} : ${username}\n\n`;
    fileContent += `Total Transaksi: ${transaksiList.length}\n\n`;
    fileContent += `Nomor pengelola | Nomor yg diisi | Tipe paket | Slot | Kuota | Expired | Status\n`;
    fileContent += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    const now = new Date();
    
    transaksiList.forEach((trx, index) => {
      const expiredDate = trx.expired_at ? new Date(trx.expired_at) : null;
      const expiredText = expiredDate ? expiredDate.toLocaleDateString('id-ID') : 'N/A';
      const kuotaText = trx.kuota === '0' ? 'Unlimited' : trx.kuota + ' GB';
      
      // Tentukan status berdasarkan expired date
      let status = 'Aktif';
      if (expiredDate && expiredDate <= now) {
        status = 'Expired';
      }
      
      fileContent += `${index + 1}. ${trx.nomor} | ${trx.anggota} | ${trx.kategori} | Slot ${trx.slot_ke} | ${kuotaText} | ${expiredText} | ${status}\n`;
    });
    
    fileContent += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    fileContent += `\nRingkasan:\n`;
    fileContent += `Total Transaksi: ${transaksiList.length}\n`;
    
    // Hitung transaksi yang masih aktif vs expired
    const activeCount = transaksiList.filter(trx => {
      const expiredDate = trx.expired_at ? new Date(trx.expired_at) : null;
      return !expiredDate || expiredDate > now;
    }).length;
    const expiredCount = transaksiList.length - activeCount;
    
    fileContent += `Transaksi Aktif: ${activeCount}\n`;
    fileContent += `Transaksi Expired: ${expiredCount}\n\n`;
    
    // Breakdown per kategori
    const kategoriCount = {};
    transaksiList.forEach(trx => {
      kategoriCount[trx.kategori] = (kategoriCount[trx.kategori] || 0) + 1;
    });
    fileContent += `\nTransaksi per Kategori:\n`;
    Object.entries(kategoriCount).forEach(([kategori, count]) => {
      fileContent += `- ${kategori}: ${count}\n`;
    });

    // Tulis file
    fs.writeFileSync(filePath, fileContent, 'utf8');

    // Kirim file ke admin
    await bot.sendDocument(chatId, filePath, {}, {
      filename: fileName,
      contentType: 'text/plain'
    });

    // Hapus file setelah dikirim
    fs.unlinkSync(filePath);
  } catch (error) {
    console.error('Error creating txt file:', error);
    await bot.sendMessage(chatId, `❌ Gagal membuat file transaksi: ${error.message}`);

    // Cleanup file jika ada error
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      console.error('Error cleaning up file:', e);
    }
  }
};
