const { getAllUsers, logBroadcast, markUserBlocked } = require('./db');

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
  // === SETUP GLOBAL BROADCAST PROTECTION ===
  // Attach broadcast protection function ke bot object
  bot.isAdminInBroadcastSession = (msg) => {
    if (!msg || !msg.from || msg.from.id.toString() !== process.env.ADMIN_ID) {
      return false;
    }
    return isInBroadcastSession(msg.chat.id);
  };

  // Function untuk cek apakah admin sedang dalam sesi broadcast
  const isInBroadcastSession = (chatId) => {
    const state = adminState.get(chatId);
    return state && state.mode === 'broadcast';
  };

  // Function untuk membersihkan sesi broadcast
  const clearBroadcastSession = (chatId) => {
    adminState.delete(chatId);
  };
  // === Broadcast dengan teks biasa (MENGGUNAKAN UTILS TEMPLATE) ===
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    
    // Cek apakah user adalah admin
    if (msg.from.id.toString() !== process.env.ADMIN_ID) return;
    
    // ✅ MENGGUNAKAN UTILS TEMPLATE untuk handle flow dengan exit  
    // Gunakan EXIT_KEYWORDS.COMBINED untuk mendukung lebih banyak exit keywords
    const flowControl = await handleFlowWithExit(bot, msg, adminState, 'broadcast', EXIT_KEYWORDS.COMBINED);
    
    if (flowControl.isExit) {
      return; // Exit berhasil diproses oleh utils
    }
    
    // Cek apakah sedang dalam broadcast mode dan perlu melanjutkan processing
    const state = adminState.get(chatId);
    const inBroadcastSession = isInBroadcastSession(chatId);
    
    // Jika sedang dalam sesi broadcast dan step input_message, tapi bukan exit
    if (inBroadcastSession && state && state.step === 'input_message' && !flowControl.shouldContinue) {
      
      // Jika dalam sesi broadcast dan bukan exit, lanjut ke proses broadcast
      await processBroadcastMessage(msg, bot, chatId, state);
      return; // STOP di sini, jangan lanjut ke trigger lain
    }
    
    // === TRIGGER BROADCAST BARU (hanya jika TIDAK sedang dalam sesi) ===
    if (!inBroadcastSession) {
      // Cek apakah ini bukan command slash dan ada text
      if (!msg.text || msg.text.startsWith('/')) return;
      
      // Keywords untuk trigger broadcast (lebih spesifik)
      const broadcastKeywords = [
        'broadcast', 'broadcast ke semua', 'kirim ke semua user',
        '/broadcast', 'pengumuman', 'blast message'
      ];
      
      const messageText = msg.text.toLowerCase();
      const isBroadcastRequest = broadcastKeywords.some(keyword => 
        messageText === keyword || messageText.includes(keyword)
      );
      
      if (isBroadcastRequest) {
        // ✅ MENGGUNAKAN UTILS TEMPLATE untuk inisialisasi flow state
        initializeFlowState(adminState, chatId, 'broadcast', { 
          step: 'input_message', 
          startTime: Date.now() 
        });
        
        const broadcastPrompt = '📢 <b>SESI BROADCAST DIMULAI</b>\n\n' +
          '🔒 <b>Mode:</b> Broadcast Aktif\n' +
          '📝 Kirim pesan yang akan di-broadcast:\n\n' +
          '✅ <b>Support:</b>\n• Teks\n• Foto + Caption\n• Video + Caption\n• Audio/Voice\n• Document/File\n• Sticker\n• GIF/Animation\n\n' +
          '❌ <b>Keluar:</b> ' + generateExitInstruction('exit');
        
        // ✅ MENGGUNAKAN UTILS TEMPLATE untuk send message dengan tracking
        await sendMessageWithTracking(
          bot, 
          chatId, 
          broadcastPrompt, 
          { parse_mode: 'HTML' },
          adminState,
          adminState.get(chatId),
          msg
        );
        return;
      }
    }
    
    // Jika sampai sini dan tidak match broadcast trigger, biarkan handler lain memproses
    return;
  });

  // === Function untuk memproses pesan broadcast ===
  async function processBroadcastMessage(msg, bot, chatId, state) {
    try {
      // Ambil semua user
      const users = await getAllUsers();
      
      if (users.length === 0) {
        const teksError = '❌ Tidak ada user dalam database untuk broadcast.';
        
        if (state.inputMessageId) {
          try {
            await bot.editMessageText(teksError, {
              chat_id: chatId,
              message_id: state.inputMessageId
            });
          } catch (e) {
            await bot.sendMessage(chatId, teksError);
          }
        } else {
          await bot.sendMessage(chatId, teksError);
        }
        
        clearBroadcastSession(chatId);
        try {
          await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {
          if (!e.message.includes('message to delete not found')) {
            console.error('Error deleting message:', e.message);
          }
        }
        return;
      }

      // Detect message type dan siapkan data untuk broadcast
      let messageType = 'text';
      let broadcastData = {};
      let broadcastDescription = '';

      if (msg.text) {
        messageType = 'text';
        broadcastData.text = msg.text;
        broadcastDescription = `Teks: ${msg.text.substring(0, 50)}${msg.text.length > 50 ? '...' : ''}`;
      } else if (msg.photo) {
        messageType = 'photo';
        broadcastData.photo = msg.photo[msg.photo.length - 1].file_id;
        broadcastData.caption = msg.caption || '';
        broadcastDescription = `Foto${msg.caption ? ' + Caption: ' + msg.caption.substring(0, 30) + '...' : ''}`;
      } else if (msg.video) {
        messageType = 'video';
        broadcastData.video = msg.video.file_id;
        broadcastData.caption = msg.caption || '';
        broadcastDescription = `Video${msg.caption ? ' + Caption: ' + msg.caption.substring(0, 30) + '...' : ''}`;
      } else if (msg.audio) {
        messageType = 'audio';
        broadcastData.audio = msg.audio.file_id;
        broadcastData.caption = msg.caption || '';
        broadcastDescription = `Audio${msg.caption ? ' + Caption: ' + msg.caption.substring(0, 30) + '...' : ''}`;
      } else if (msg.voice) {
        messageType = 'voice';
        broadcastData.voice = msg.voice.file_id;
        broadcastDescription = 'Voice Message';
      } else if (msg.document) {
        messageType = 'document';
        broadcastData.document = msg.document.file_id;
        broadcastData.caption = msg.caption || '';
        broadcastDescription = `Document: ${msg.document.file_name || 'File'}${msg.caption ? ' + Caption' : ''}`;
      } else if (msg.sticker) {
        messageType = 'sticker';
        broadcastData.sticker = msg.sticker.file_id;
        broadcastDescription = 'Sticker';
      } else if (msg.animation) {
        messageType = 'animation';
        broadcastData.animation = msg.animation.file_id;
        broadcastData.caption = msg.caption || '';
        broadcastDescription = `GIF/Animation${msg.caption ? ' + Caption' : ''}`;
      } else if (msg.video_note) {
        messageType = 'video_note';
        broadcastData.video_note = msg.video_note.file_id;
        broadcastDescription = 'Video Note (Circle Video)';
      } else {
        await bot.sendMessage(chatId, '❌ Tipe pesan tidak didukung untuk broadcast.\n\nTipe yang didukung: teks, foto, video, audio, voice, document, sticker, GIF');
        return;
      }

      // Kirim ke semua user
      let successCount = 0;
      let blockedCount = 0;
      let deactivatedCount = 0; 
      let errorCount = 0;
      const targetCount = users.length;
      
      // Update status ke admin
      const statusMsg = `📡 Broadcasting ${messageType} ke ${targetCount} user...\n\n⏳ Mohon tunggu...`;
      if (state.inputMessageId) {
        try {
          await bot.editMessageText(statusMsg, {
            chat_id: chatId,
            message_id: state.inputMessageId
          });
        } catch (e) {
          await bot.sendMessage(chatId, statusMsg);
        }
      } else {
        await bot.sendMessage(chatId, statusMsg);
      }
      
      // Broadcast ke semua user
      for (const user of users) {
        try {
          let sendOptions = {};
          if (broadcastData.caption) {
            sendOptions.caption = broadcastData.caption;
          }
          if (broadcastData.text) {
            sendOptions.text = broadcastData.text;
          }

          let sentMessage;

          switch (messageType) {
            case 'text':
              sentMessage = await bot.sendMessage(user.user_id, broadcastData.text);
              break;
            case 'photo':
              sentMessage = await bot.sendPhoto(user.user_id, broadcastData.photo, 
                broadcastData.caption ? { caption: broadcastData.caption } : {}, {
                filename: 'broadcast.jpg',
                contentType: 'image/jpeg'
              });
              break;
            case 'video':
              sentMessage = await bot.sendVideo(user.user_id, broadcastData.video, 
                broadcastData.caption ? { 
                  caption: broadcastData.caption,
                  filename: 'video',
                  contentType: 'video/mp4'
                } : {
                  filename: 'video',
                  contentType: 'video/mp4'
                });
              break;
            case 'audio':
              sentMessage = await bot.sendAudio(user.user_id, broadcastData.audio, 
                broadcastData.caption ? { 
                  caption: broadcastData.caption,
                  filename: 'audio',
                  contentType: 'audio/mpeg'
                } : {
                  filename: 'audio',
                  contentType: 'audio/mpeg'
                });
              break;
            case 'voice':
              sentMessage = await bot.sendVoice(user.user_id, broadcastData.voice, {
                filename: 'voice',
                contentType: 'audio/ogg'
              });
              break;
            case 'document':
              sentMessage = await bot.sendDocument(user.user_id, broadcastData.document, 
                broadcastData.caption ? { 
                  caption: broadcastData.caption,
                  filename: 'document',
                  contentType: 'application/octet-stream'
                } : {
                  filename: 'document',
                  contentType: 'application/octet-stream'
                });
              break;
            case 'sticker':
              sentMessage = await bot.sendSticker(user.user_id, broadcastData.sticker, {
                filename: 'sticker',
                contentType: 'image/webp'
              });
              break;
            case 'animation':
              sentMessage = await bot.sendAnimation(user.user_id, broadcastData.animation, 
                broadcastData.caption ? { 
                  caption: broadcastData.caption,
                  filename: 'animation',
                  contentType: 'image/gif'
                } : {
                  filename: 'animation',
                  contentType: 'image/gif'
                });
              break;
            case 'video_note':
              sentMessage = await bot.sendVideoNote(user.user_id, broadcastData.video_note, {
                filename: 'video_note',
                contentType: 'video/mp4'
              });
              break;
          }
          
          // Auto-pin pesan broadcast yang berhasil dikirim
          if (sentMessage && sentMessage.message_id) {
            try {
              await bot.pinChatMessage(user.user_id, sentMessage.message_id, {
                disable_notification: true
              });
            } catch (pinError) {
              console.log(`⚠️ Gagal pin pesan untuk user ${user.user_id}: ${pinError.message}`);
            }
          }
          
          successCount++;
        } catch (error) {
          // === SMART ERROR HANDLING ===
          const errorMsg = error.message || '';
          
          if (errorMsg.includes('403') && errorMsg.includes('bot was blocked by the user')) {
            // User telah memblokir bot - mark di database
            blockedCount++;
            console.log(`🚫 User ${user.user_id} has blocked the bot (marked & skipped)`);
            
            // Optional: Mark user sebagai blocked di database
            try {
              await markUserBlocked(user.user_id);
            } catch (markErr) {
              // Silent ignore mark error
            }
          } else if (errorMsg.includes('403') && errorMsg.includes('user is deactivated')) {
            // Akun user deactivated/deleted
            deactivatedCount++;
            console.log(`👻 User ${user.user_id} account deactivated (skipped)`);
          } else if (errorMsg.includes('403') && errorMsg.includes('chat not found')) {
            // Chat tidak ditemukan
            errorCount++;
            console.log(`🔍 Chat ${user.user_id} not found (skipped)`);
          } else if (errorMsg.includes('429')) {
            // Rate limit - tunggu sebentar
            console.log(`⏳ Rate limit hit for user ${user.user_id}, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Optional: retry sekali lagi
            errorCount++;
          } else {
            // Error lain yang perlu attention
            errorCount++;
            console.log(`❌ Unexpected error for user ${user.user_id}:`, errorMsg);
          }
        }
        
        // Delay kecil untuk menghindari rate limit
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      
      // Log broadcast ke database
      try {
        await logBroadcast(msg.from.id, broadcastDescription, targetCount, successCount);
      } catch (e) {
        console.error('Gagal log broadcast:', e.message);
      }
      
      // Kirim hasil ke admin dengan breakdown detail
      const totalFailed = blockedCount + deactivatedCount + errorCount;
      
      let hasilBroadcast = `✅ <b>BROADCAST SELESAI!</b>\n\n`;
      hasilBroadcast += `📊 <b>STATISTIK:</b>\n`;
      hasilBroadcast += `🎯 Target: ${targetCount} user\n`;
      hasilBroadcast += `✅ Berhasil: ${successCount}\n`;
      hasilBroadcast += `❌ Gagal: ${totalFailed}\n\n`;
      
      if (totalFailed > 0) {
        hasilBroadcast += `📋 <b>DETAIL GAGAL:</b>\n`;
        if (blockedCount > 0) hasilBroadcast += `🚫 Blocked: ${blockedCount}\n`;
        if (deactivatedCount > 0) hasilBroadcast += `👻 Deactivated: ${deactivatedCount}\n`;  
        if (errorCount > 0) hasilBroadcast += `⚠️ Error lain: ${errorCount}\n\n`;
      }
      
      hasilBroadcast += `🔓 Sesi broadcast berakhir.`;
      
      // Success rate
      const successRate = ((successCount / targetCount) * 100).toFixed(1);
      hasilBroadcast += `\n📈 Success Rate: ${successRate}%`;
      
      let resultMessageId;
      if (state.inputMessageId) {
        try {
          await bot.editMessageText(hasilBroadcast, {
            chat_id: chatId,
            message_id: state.inputMessageId,
            parse_mode: 'HTML'
          });
          resultMessageId = state.inputMessageId;
        } catch (e) {
          const sentMsg = await bot.sendMessage(chatId, hasilBroadcast, { parse_mode: 'HTML' });
          resultMessageId = sentMsg.message_id;
        }
      } else {
        const sentMsg = await bot.sendMessage(chatId, hasilBroadcast, { parse_mode: 'HTML' });
        resultMessageId = sentMsg.message_id;
      }
      
      // Auto-delete hasil broadcast setelah 3 detik
      setTimeout(async () => {
        try {
          await bot.deleteMessage(chatId, resultMessageId);
        } catch (e) {}
      }, 3000);
      
    } catch (error) {
      const teksError = `❌ Gagal melakukan broadcast!\n\n🔍 <b>ERROR:</b>\n<code>${error.message}</code>\n\n🔓 Sesi broadcast berakhir.\n⏰ Pesan ini akan hilang dalam 3 detik...`;
      
      let errorMessageId;
      if (state.inputMessageId) {
        try {
          await bot.editMessageText(teksError, {
            chat_id: chatId,
            message_id: state.inputMessageId,
            parse_mode: 'HTML'
          });
          errorMessageId = state.inputMessageId;
        } catch (e) {
          const sentMsg = await bot.sendMessage(chatId, teksError, { parse_mode: 'HTML' });
          errorMessageId = sentMsg.message_id;
        }
      } else {
        const sentMsg = await bot.sendMessage(chatId, teksError, { parse_mode: 'HTML' });
        errorMessageId = sentMsg.message_id;
      }
      
      // Auto-delete error message setelah 3 detik
      setTimeout(async () => {
        try {
          await bot.deleteMessage(chatId, errorMessageId);
        } catch (e) {}
      }, 3000);
    }
    
    // WAJIB: Clear sesi broadcast setelah selesai
    clearBroadcastSession(chatId);
    try {
      await bot.deleteMessage(chatId, msg.message_id);
    } catch (e) {
      if (!e.message.includes('message to delete not found')) {
        console.error('Error deleting message:', e.message);
      }
    }
    return;
  }

  // === /broadcast command (backward compatibility) - MENGGUNAKAN UTILS TEMPLATE ===
  bot.onText(/\/broadcast/, async (msg) => {
    if (msg.from.id.toString() !== process.env.ADMIN_ID) {
      await bot.sendMessage(msg.chat.id, 'ente siapa njir🗿');
      // ✅ MENGGUNAKAN UTILS TEMPLATE untuk auto-delete
      await autoDeleteMessage(bot, msg.chat.id, msg.message_id);
      return;
    }
    
    // Cek jika sedang dalam sesi broadcast lain
    if (isInBroadcastSession(msg.chat.id)) {
      await bot.sendMessage(msg.chat.id, '⚠️ Anda sedang dalam sesi broadcast aktif!\n\n' + generateExitInstruction() + ' untuk keluar atau lanjutkan mengirim pesan broadcast.');
      return;
    }
    
    // ✅ MENGGUNAKAN UTILS TEMPLATE untuk inisialisasi flow state
    initializeFlowState(adminState, msg.chat.id, 'broadcast', { 
      step: 'input_message', 
      startTime: Date.now() 
    });
    
    const broadcastPrompt = '📢 <b>SESI BROADCAST DIMULAI</b>\n\n' +
      '🔒 <b>Mode:</b> Broadcast Aktif (via command)\n' +
      '📝 Kirim pesan yang akan di-broadcast:\n\n' +
      '✅ <b>Support:</b>\n• Teks\n• Foto + Caption\n• Video + Caption\n• Audio/Voice\n• Document/File\n• Sticker\n• GIF/Animation\n\n' +
      '❌ <b>Keluar:</b> ' + generateExitInstruction('exit');
    
    // ✅ MENGGUNAKAN UTILS TEMPLATE untuk send message dengan tracking
    await sendMessageWithTracking(
      bot, 
      msg.chat.id, 
      broadcastPrompt, 
      { parse_mode: 'HTML' },
      adminState,
      adminState.get(msg.chat.id),
      msg
    );
  });

  // Export function untuk cek sesi dari luar (opsional)
  return {
    isInBroadcastSession,
    clearBroadcastSession
  };
};

// Export global untuk akses dari file lain
module.exports.adminState = adminState;
module.exports.isInBroadcastSession = (chatId) => {
  const state = adminState.get(chatId);
  return state && state.mode === 'broadcast';
};
