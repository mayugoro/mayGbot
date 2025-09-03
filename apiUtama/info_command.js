const { getInfoAkrab } = require('./info');

// Handler untuk command /info
module.exports = (bot) => {
  bot.onText(/\/info\s+(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const nomorTelepon = match[1].trim();
    
    // Cek otorisasi admin
    if (userId.toString() !== process.env.ADMIN_ID) {
      return bot.sendMessage(chatId, "❌ Anda tidak memiliki akses untuk command ini.");
    }
    
    // Validasi nomor telepon
    if (!nomorTelepon || nomorTelepon.length < 10) {
      return bot.sendMessage(chatId, "❌ Format salah!\n\nContoh: `/info 08777111222`", {
        parse_mode: 'Markdown'
      });
    }
    
    // Kirim status loading
    const loadingMsg = await bot.sendMessage(chatId, "⏳ Mengambil info akrab...");
    
    try {
      const result = await getInfoAkrab(nomorTelepon);
      
      // Hapus loading message
      await bot.deleteMessage(chatId, loadingMsg.message_id);
      
      if (result.success) {
        let responseText = '';
        
        // Format untuk API Utama (khfy-store)
        if (result.source === 'primary' && result.data?.status) {
          const data = result.data.data;
          const memberInfo = data?.member_info;
          
          if (memberInfo) {
            // Header
            responseText += `✅ <b>NOMOR 1/1</b>\n`;
            responseText += `📱 : <code>${memberInfo.parent_msisdn}</code>\n`;
            
            // Format expired date
            const expiredTimestamp = memberInfo.end_date;
            if (expiredTimestamp) {
              const expiredDate = new Date(expiredTimestamp * 1000);
              const formattedDate = expiredDate.toLocaleDateString('id-ID', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              });
              responseText += `📅 Expired : ${formattedDate}\n\n`;
            }
            
            // Detail slot
            responseText += `� <b>DETAIL SLOT:</b>\n`;
            
            // Gabungkan members dan additional_members
            const allMembers = [...(memberInfo.members || []), ...(memberInfo.additional_members || [])];
            
            let slotCounter = 1;
            for (const member of allMembers) {
              if (member.member_type === 'PARENT') continue; // Skip parent
              
              const msisdn = member.msisdn || '';
              const addChances = member.add_chances || 0;
              
              let status;
              if (msisdn && msisdn !== '') {
                status = '❌ Terisi';
              } else {
                if (addChances === 0) {
                  status = '❗ Kosong';
                } else if (addChances === 1) {
                  status = '⚠️ Kosong';
                } else {
                  status = '✅ Kosong';
                }
              }
              
              responseText += `SLOT ${slotCounter}: (${addChances}) ${status}\n`;
              slotCounter++;
            }
          } else {
            responseText += `❌ <b>DATA TIDAK LENGKAP</b>\n\n`;
            responseText += `📱 : <code>${result.formatted_nomor}</code>\n`;
            responseText += `🔗 Source: 🎯 API Utama\n`;
            responseText += `📄 Message: ${result.data.message || 'Tidak ada pesan'}`;
          }
          
        } else if (result.source === 'secondary') {
          // Format untuk API Secondary (hidepulsa) - gunakan format yang sudah ada
          const data = result.data?.data;
          if (data) {
            const slotList = data?.data_slot || [];
            const expiredText = data?.expired || 'Tidak tersedia';
            
            responseText += `✅ <b>NOMOR 1/1</b>\n`;
            responseText += `� : <code>${result.formatted_nomor}</code>\n`;
            responseText += `📅 Expired : ${expiredText}\n\n`;
            
            if (slotList.length > 0) {
              responseText += `📋 <b>DETAIL SLOT:</b>\n`;
              for (const slot of slotList) {
                if (slot["slot-ke"] === 0) continue;
                const sisaAdd = slot['sisa-add'] || 0;
                let status;
                if (slot.nomor && slot.nomor !== "") {
                  status = '❌ Terisi';
                } else {
                  if (sisaAdd === 1) {
                    status = '⚠️ Kosong';
                  } else if (sisaAdd === 0) {
                    status = '❗ Kosong';
                  } else {
                    status = '✅ Kosong';
                  }
                }
                responseText += `SLOT ${slot["slot-ke"]}: (${sisaAdd}) ${status}\n`;
              }
            } else {
              responseText += `❌ <b>Tidak ada data slot</b>\n`;
            }
          }
        } else {
          // Fallback format jika data tidak sesuai
          responseText += `❌ <b>FORMAT DATA TIDAK DIKENAL</b>\n\n`;
          responseText += `📱 : <code>${result.formatted_nomor}</code>\n`;
          responseText += `🔗 Source: ${result.source === 'primary' ? '🎯 API Utama' : '🔄 API Secondary'}\n`;
          responseText += `📄 Message: ${result.data?.message || 'Tidak ada pesan'}`;
        }

        await bot.sendMessage(chatId, responseText, {
          parse_mode: 'HTML'
        });
        
      } else {
        let errorText = `❌ <b>GAGAL AMBIL INFO</b>\n\n`;
        errorText += `📱 <b>Nomor:</b> <code>${result.nomor}</code>\n`;
        errorText += `🌍 <b>Format Intl:</b> <code>${result.formatted_nomor}</code>\n\n`;
        errorText += `🚫 <b>Error:</b>\n`;
        errorText += `• API Utama: ${result.error.primary}\n`;
        errorText += `• API Secondary: ${result.error.secondary}`;
        
        await bot.sendMessage(chatId, errorText, {
          parse_mode: 'HTML'
        });
      }
      
    } catch (error) {
      // Hapus loading message jika masih ada
      try {
        await bot.deleteMessage(chatId, loadingMsg.message_id);
      } catch (e) {}
      
      await bot.sendMessage(chatId, `❌ <b>ERROR SISTEM</b>\n\n🚫 ${error.message}`, {
        parse_mode: 'HTML'
      });
    }
  });
  
  // Handler untuk /info tanpa parameter
  bot.onText(/^\/info$/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (userId.toString() !== process.env.ADMIN_ID) {
      return bot.sendMessage(chatId, "❌ Anda tidak memiliki akses untuk command ini.");
    }
    
    const helpText = `ℹ️ <b>CARA PENGGUNAAN COMMAND /info</b>\n\n` +
      `📝 <b>Format:</b> <code>/info [nomor_telepon]</code>\n\n` +
      `📋 <b>Contoh:</b>\n` +
      `• <code>/info 08777111222</code>\n` +
      `• <code>/info 628777111222</code>\n` +
      `• <code>/info 8777111222</code>\n\n` +
      `🔄 <b>Sistem:</b>\n` +
      `• Primary: API Utama (khfy-store)\n` +
      `• Fallback: API Secondary (hidepulsa)\n\n` +
      `📱 <b>Auto Format:</b> Nomor otomatis diformat ke 628xxx`;
    
    await bot.sendMessage(chatId, helpText, {
      parse_mode: 'HTML'
    });
  });
};
