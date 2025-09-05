const fs = require('fs');
const path = require('path');
const https = require('https');

const adminState = new Map();

module.exports = (bot) => {
  // Text trigger keywords for setbanner
  const setbannerKeywords = [
    'set banner', 'setbanner', 'atur banner', 'ubah banner', 'ganti banner',
    'banner baru', 'setting banner', 'update banner', 'change banner',
    'banner setting', 'edit banner', 'modify banner', 'banner', 'replace banner',
    'banner change', 'new banner'
  ];

  // === Text Triggers for setbanner ===
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    if (msg.from.id.toString() !== process.env.ADMIN_ID) return;
    
    // === PROTEKSI BROADCAST SESI ===
    // Jika admin sedang dalam sesi broadcast, jangan proses trigger menu lain
    if (bot.isAdminInBroadcastSession && bot.isAdminInBroadcastSession(msg)) {
      return; // Skip processing, biarkan broadcast handler yang menangani
    }
    
    // Check if message contains any setbanner keywords
    const messageText = msg.text.toLowerCase();
    const hasKeyword = setbannerKeywords.some(keyword => messageText.includes(keyword.toLowerCase()));
    
    if (!hasKeyword) return;
    
    // Check if this is already being handled by state machine
    const state = adminState.get(msg.chat.id);
    if (state && state.mode === 'set_banner') return;
    
    // Execute setbanner functionality
    await executeSetBanner(bot, msg);
  });

  // === /setbanner (backward compatibility) ===
  bot.onText(/\/setbanner/, async (msg) => {
    await executeSetBanner(bot, msg);
  });

  // Main setbanner execution function
  const executeSetBanner = async (bot, msg) => {
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
    
    adminState.set(msg.chat.id, { mode: 'set_banner' });
    
    const inputMsg = await bot.sendMessage(msg.chat.id, '🖼️ <b>SET BANNER</b>\n\n📸 Kirim foto yang akan dijadikan banner baru untuk bot:\n\n📝 <b>Spesifikasi:</b>\n• Format: JPG/PNG\n• Ukuran: Max 10MB\n• Resolusi: Rekomendasi 1280x720\n• Orientasi: Landscape lebih baik\n\n💡 Ketik "exit" untuk membatalkan\n💡 Ketik "restore" untuk kembalikan banner default', {
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
    currentState.inputMessageId = inputMsg.message_id;
    adminState.set(msg.chat.id, currentState);
  };

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (msg.from.id.toString() !== process.env.ADMIN_ID) return;

    const state = adminState.get(chatId);
    if (!state || state.mode !== 'set_banner') return;

    // === CEK CANCEL/EXIT ===
    if (msg.text && ['exit', 'EXIT', 'Exit'].includes(msg.text.trim())) {
      // Hapus pesan input bot dan user
      if (state.inputMessageId) {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {}
      }
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {}
      
      adminState.delete(chatId);
      return;
    }

    // === RESTORE BANNER DEFAULT ===
    if (msg.text && ['restore', 'RESTORE', 'Restore'].includes(msg.text.trim())) {
      // Hapus pesan input sebelumnya
      if (state.inputMessageId) {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {}
      }
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {}

      try {
        // Cek apakah ada backup banner default
        const defaultBackupPath = path.join(__dirname, 'welcome_default.jpg');
        const currentBannerPath = path.join(__dirname, 'welcome.jpg');

        if (fs.existsSync(defaultBackupPath)) {
          // Copy backup ke banner aktif
          fs.copyFileSync(defaultBackupPath, currentBannerPath);
          
          const successMsg = await bot.sendMessage(chatId, '✅ <b>Banner berhasil dikembalikan ke default!</b>\n\n🖼️ Banner welcome.jpg telah dikembalikan ke gambar default asli.', {
            parse_mode: 'HTML'
          });
          
          // Auto delete setelah 3 detik
          setTimeout(async () => {
            try {
              await bot.deleteMessage(chatId, successMsg.message_id);
            } catch (e) {}
          }, 3000);
        } else {
          const errorMsg = await bot.sendMessage(chatId, '❌ <b>Backup banner default tidak ditemukan!</b>\n\n💡 Silakan upload banner baru atau pastikan file welcome_default.jpg tersedia.', {
            parse_mode: 'HTML'
          });
          
          // Auto delete setelah 3 detik
          setTimeout(async () => {
            try {
              await bot.deleteMessage(chatId, errorMsg.message_id);
            } catch (e) {}
          }, 3000);
        }
      } catch (error) {
        const errorMsg = await bot.sendMessage(chatId, `❌ <b>Gagal restore banner:</b>\n<code>${error.message}</code>`, {
          parse_mode: 'HTML'
        });
        
        setTimeout(async () => {
          try {
            await bot.deleteMessage(chatId, errorMsg.message_id);
          } catch (e) {}
        }, 3000);
      }

      adminState.delete(chatId);
      return;
    }

    // === CEK APAKAH PESAN BERISI FOTO ===
    if (!msg.photo) {
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {}
      return;
    }

    // === PROSES FOTO BANNER ===
    try {
      // Hapus pesan input sebelumnya
      if (state.inputMessageId) {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {}
      }
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {}

      // Kirim status processing
      const processMsg = await bot.sendMessage(chatId, '⏳ <b>Memproses banner baru...</b>\n\n📥 Mengunduh foto...', {
        parse_mode: 'HTML'
      });

      // Ambil foto dengan resolusi tertinggi
      const photo = msg.photo[msg.photo.length - 1];
      const fileInfo = await bot.getFile(photo.file_id);
      
      // Tentukan content-type berdasarkan file extension
      const fileExtension = path.extname(fileInfo.file_path).toLowerCase();
      const contentType = getContentTypeFromExtension(fileExtension);
      
      const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;

      // Backup banner lama jika ada
      const currentBannerPath = path.join(__dirname, 'welcome.jpg');
      const backupPath = path.join(__dirname, 'welcome_backup.jpg');

      if (fs.existsSync(currentBannerPath)) {
        fs.copyFileSync(currentBannerPath, backupPath);
      }

      // Update status
      await bot.editMessageText('⏳ <b>Memproses banner baru...</b>\n\n💾 Menyimpan file...', {
        chat_id: chatId,
        message_id: processMsg.message_id,
        parse_mode: 'HTML'
      });

      // Download dan simpan foto baru
      await downloadFile(fileUrl, currentBannerPath);

      // Update status final
      await bot.editMessageText('✅ <b>Banner berhasil diperbarui!</b>\n\n🖼️ Banner baru telah disimpan sebagai welcome.jpg\n📋 Banner lama disimpan sebagai backup\n\n💡 Perubahan akan terlihat pada perintah /menu selanjutnya', {
        chat_id: chatId,
        message_id: processMsg.message_id,
        parse_mode: 'HTML'
      });

      // Auto delete setelah 5 detik
      setTimeout(async () => {
        try {
          await bot.deleteMessage(chatId, processMsg.message_id);
        } catch (e) {}
      }, 5000);

    } catch (error) {
      console.error('Error setting banner:', error);
      
      const errorMsg = await bot.sendMessage(chatId, `❌ <b>Gagal mengatur banner!</b>\n\n🔍 Detail Error:\n<code>${error.message}</code>\n\n💡 Kemungkinan penyebab:\n• File terlalu besar\n• Format tidak didukung\n• Masalah koneksi\n• Permission file system`, {
        parse_mode: 'HTML'
      });
      
      setTimeout(async () => {
        try {
          await bot.deleteMessage(chatId, errorMsg.message_id);
        } catch (e) {}
      }, 5000);
    }

    adminState.delete(chatId);
    return;
  });
};

// Helper function untuk mendapatkan content-type berdasarkan extension
const getContentTypeFromExtension = (extension) => {
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff'
  };
  
  return contentTypes[extension] || 'image/jpeg'; // Default ke JPEG
};

// Helper function untuk download file dengan content-type yang benar
const downloadFile = (url, destination) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    
    // Tentukan content-type dari URL atau gunakan default
    const extension = path.extname(destination).toLowerCase();
    const expectedContentType = getContentTypeFromExtension(extension);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      // Log content-type untuk debugging
      const actualContentType = response.headers['content-type'] || expectedContentType;
      console.log(`📥 Downloading banner: ${actualContentType} -> ${expectedContentType}`);
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`✅ Banner saved as ${expectedContentType}`);
        resolve();
      });
      
      file.on('error', (error) => {
        fs.unlink(destination, () => {}); // Hapus file yang gagal
        reject(error);
      });
      
    }).on('error', (error) => {
      reject(error);
    });
  });
};
