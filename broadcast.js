const { getAllUsers, logBroadcast } = require('./db');

const adminState = new Map();

module.exports = (bot) => {
  // === Broadcast dengan teks biasa ===
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    
    // Cek apakah user adalah admin
    if (msg.from.id.toString() !== process.env.ADMIN_ID) return;
    
    // Cek apakah ini bukan command slash dan ada text
    if (!msg.text || msg.text.startsWith('/')) return;
    
    // Keywords untuk trigger broadcast
    const broadcastKeywords = [
      'broadcast', 'pengumuman', 'announcement', 'kirim pesan', 'kirim ke semua',
      'broadcast ke semua', 'pengumuman ke semua', 'announce', 'blast', 'mass message'
    ];
    
    const messageText = msg.text.toLowerCase();
    const isBroadcastRequest = broadcastKeywords.some(keyword => 
      messageText.includes(keyword)
    );
    
    if (!isBroadcastRequest) {
      // Cek juga apakah sedang dalam mode broadcast
      const state = adminState.get(chatId);
      if (!state || state.mode !== 'broadcast' || state.step !== 'input_message') return;
    } else {
      // Jika trigger broadcast keyword, mulai proses broadcast
      adminState.set(msg.chat.id, { mode: 'broadcast', step: 'input_message' });
      
      const inputMsg = await bot.sendMessage(msg.chat.id, '📢 <b>BROADCAST</b>\n\nKirim pesan yang akan di-broadcast:\n\n✅ <b>Support:</b>\n• Teks\n• Foto + Caption\n• Video + Caption\n• Audio/Voice\n• Document/File\n• Sticker\n• GIF/Animation\n\n💡 Ketik "exit" untuk membatalkan', {
        parse_mode: 'HTML'
      });
      
      // Auto-delete command message setelah respons dikirim
      setTimeout(async () => {
        try {
          await bot.deleteMessage(msg.chat.id, msg.message_id);
        } catch (e) {}
      }, 1000);
      
      // Simpan message ID untuk bisa diedit nanti
      const currentState = adminState.get(msg.chat.id);
      currentState.inputMessageId = inputMsg.message_id;
      adminState.set(msg.chat.id, currentState);
      return;
    }

    const state = adminState.get(chatId);
    if (!state || state.mode !== 'broadcast' || state.step !== 'input_message') return;

    // === CEK CANCEL/EXIT ===
    if (msg.text && ['exit', 'EXIT', 'Exit'].includes(msg.text.trim())) {
      if (state.inputMessageId) {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {}
      }
      
      adminState.delete(chatId);
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {
        // Jangan log error jika message sudah tidak ada
        if (!e.message.includes('message to delete not found')) {
          console.error('Error deleting message:', e.message);
        }
      }
      return;
    }

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
        
        adminState.delete(chatId);
        try {
          await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {
          // Jangan log error jika message sudah tidak ada
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
        broadcastData.text = msg.text; // Langsung kirim teks asli tanpa wrapper
        broadcastDescription = `Teks: ${msg.text.substring(0, 50)}${msg.text.length > 50 ? '...' : ''}`;
      } else if (msg.photo) {
        messageType = 'photo';
        broadcastData.photo = msg.photo[msg.photo.length - 1].file_id;
        broadcastData.caption = msg.caption || ''; // Caption asli atau kosong
        broadcastDescription = `Foto${msg.caption ? ' + Caption: ' + msg.caption.substring(0, 30) + '...' : ''}`;
      } else if (msg.video) {
        messageType = 'video';
        broadcastData.video = msg.video.file_id;
        broadcastData.caption = msg.caption || ''; // Caption asli atau kosong
        broadcastDescription = `Video${msg.caption ? ' + Caption: ' + msg.caption.substring(0, 30) + '...' : ''}`;
      } else if (msg.audio) {
        messageType = 'audio';
        broadcastData.audio = msg.audio.file_id;
        broadcastData.caption = msg.caption || ''; // Caption asli atau kosong
        broadcastDescription = `Audio${msg.caption ? ' + Caption: ' + msg.caption.substring(0, 30) + '...' : ''}`;
      } else if (msg.voice) {
        messageType = 'voice';
        broadcastData.voice = msg.voice.file_id;
        broadcastDescription = 'Voice Message';
      } else if (msg.document) {
        messageType = 'document';
        broadcastData.document = msg.document.file_id;
        broadcastData.caption = msg.caption || ''; // Caption asli atau kosong
        broadcastDescription = `Document: ${msg.document.file_name || 'File'}${msg.caption ? ' + Caption' : ''}`;
      } else if (msg.sticker) {
        messageType = 'sticker';
        broadcastData.sticker = msg.sticker.file_id;
        broadcastDescription = 'Sticker';
      } else if (msg.animation) {
        messageType = 'animation';
        broadcastData.animation = msg.animation.file_id;
        broadcastData.caption = msg.caption || ''; // Caption asli atau kosong
        broadcastDescription = `GIF/Animation${msg.caption ? ' + Caption' : ''}`;
      } else if (msg.video_note) {
        messageType = 'video_note';
        broadcastData.video_note = msg.video_note.file_id;
        broadcastDescription = 'Video Note (Circle Video)';
      } else {
        // Unsupported message type
        await bot.sendMessage(chatId, '❌ Tipe pesan tidak didukung untuk broadcast.\n\nTipe yang didukung: teks, foto, video, audio, voice, document, sticker, GIF');
        return;
      }

      // Kirim ke semua user
      let successCount = 0;
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
                disable_notification: true // Pin tanpa notifikasi
              });
            } catch (pinError) {
              // Ignore pin errors (user mungkin tidak mengizinkan pin atau chat bukan private)
              console.log(`⚠️ Gagal pin pesan untuk user ${user.user_id}: ${pinError.message}`);
            }
          }
          
          successCount++;
        } catch (error) {
          console.log(`❌ Gagal kirim ${messageType} ke user ${user.user_id}:`, error.message);
        }
        
        // Delay kecil untuk menghindari rate limit
        await new Promise(resolve => setTimeout(resolve, 150)); // Tambah delay sedikit karena ada operasi pin
      }
      
      // Log broadcast ke database
      try {
        await logBroadcast(msg.from.id, broadcastDescription, targetCount, successCount);
      } catch (e) {
        console.error('Gagal log broadcast:', e.message);
      }
      
      // Kirim hasil ke admin (simple success message) dan auto-delete
      const hasilBroadcast = `✅ Broadcast ${messageType} terkirim!.`;
      
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
      
      // Auto-delete hasil broadcast setelah 2 detik
      setTimeout(async () => {
        try {
          await bot.deleteMessage(chatId, resultMessageId);
        } catch (e) {
          // Ignore delete error jika message sudah tidak ada
        }
      }, 2000);
      
    } catch (error) {
      const teksError = `❌ Gagal melakukan broadcast!\n\n🔍 <b>ERROR:</b>\n<code>${error.message}</code>\n\n⏰ Pesan ini akan hilang dalam 2 detik...`;
      
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
      
      // Auto-delete error message setelah 2 detik
      setTimeout(async () => {
        try {
          await bot.deleteMessage(chatId, errorMessageId);
        } catch (e) {
          // Ignore delete error jika message sudah tidak ada
        }
      }, 2000);
    }
    
    adminState.delete(chatId);
    try {
      await bot.deleteMessage(chatId, msg.message_id);
    } catch (e) {
      // Jangan log error jika message sudah tidak ada
      if (!e.message.includes('message to delete not found')) {
        console.error('Error deleting message:', e.message);
      }
    }
    return;
  });

  // === /broadcast command (backward compatibility) ===
  bot.onText(/\/broadcast/, async (msg) => {
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
    
    adminState.set(msg.chat.id, { mode: 'broadcast', step: 'input_message' });
    
    const inputMsg = await bot.sendMessage(msg.chat.id, '📢 <b>BROADCAST</b>\n\nKirim pesan yang akan di-broadcast:\n\n✅ <b>Support:</b>\n• Teks\n• Foto + Caption\n• Video + Caption\n• Audio/Voice\n• Document/File\n• Sticker\n• GIF/Animation\n\n💡 Ketik "exit" untuk membatalkan', {
      parse_mode: 'HTML'
    });
    
    // Auto-delete command message setelah respons dikirim
    setTimeout(async () => {
      try {
        await bot.deleteMessage(msg.chat.id, msg.message_id);
      } catch (e) {}
    }, 1000);
    
    // Simpan message ID untuk bisa diedit nanti
    const currentState = adminState.get(msg.chat.id);
    currentState.inputMessageId = inputMsg.message_id;
    adminState.set(msg.chat.id, currentState);
  });
};
