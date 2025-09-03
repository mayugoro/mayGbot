const { removeMemberAkrab } = require('./kick');
const { getInfoAkrab } = require('./info');

// State management untuk kick member flow
const kickStates = new Map();

// Function untuk reset session timeout
function resetSessionTimeout(chatId) {
  const state = kickStates.get(chatId);
  if (state) {
    state.lastActivity = Date.now();
    kickStates.set(chatId, state);
  }
}

// Function untuk cek apakah session masih valid (30 detik timeout)
function isSessionValid(chatId) {
  const state = kickStates.get(chatId);
  if (!state) return false;
  
  const now = Date.now();
  const timeSinceLastActivity = now - state.lastActivity;
  
  // Session expired setelah 30 detik tidak ada aktivitas
  if (timeSinceLastActivity > 30 * 1000) {
    kickStates.delete(chatId);
    return false;
  }
  
  return true;
}

// Handler untuk command /kick
module.exports = (bot) => {
  
  // === STEP 1: /kick command - Input nomor parent ===
  bot.onText(/^\/kick$/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Cek otorisasi admin
    if (userId.toString() !== process.env.ADMIN_ID) {
      return bot.sendMessage(chatId, "❌ Anda tidak memiliki akses untuk command ini.");
    }
    
    // Set state ke step 1
    kickStates.set(chatId, { 
      step: 'input_parent',
      userId: userId,
      startTime: Date.now(),
      lastActivity: Date.now()
    });
    
    const helpText = `🔥 <b>KICK MEMBER AKRAB</b>\n\n` +
      `<b>STEP 1/2:</b> Masukan nomor pengelola (parent)\n\n` +
      `📝 <b>Format:</b> 08xxx atau 628xxx\n` +
      `📋 <b>Contoh:</b> 08777111222`;
    
    await bot.sendMessage(chatId, helpText, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '❌ BATAL', callback_data: 'kick_cancel' }
        ]]
      }
    });
  });

  // === STEP 2: Setelah input parent, tampilkan member untuk di-kick ===
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;
    
    if (!kickStates.has(chatId)) return;
    
    // Cek session validity (30 detik timeout)
    if (!isSessionValid(chatId)) {
      return;
    }
    
    // Reset timeout karena ada aktivitas baru
    resetSessionTimeout(chatId);
    
    const state = kickStates.get(chatId);
    if (state.userId !== userId) return;
    
    // STEP 1: Input parent nomor
    if (state.step === 'input_parent') {
      if (!text || text.startsWith('/')) return;
      
      const parentNomor = text.trim();
      if (parentNomor.length < 10) {
        return bot.sendMessage(chatId, "❌ Nomor tidak valid! Minimal 10 digit.");
      }
      
      // Loading message
      const loadingMsg = await bot.sendMessage(chatId, 
        `🔍 <b>MENGAMBIL DATA MEMBER...</b>\n\n` +
        `📞 Parent: ${parentNomor}\n` +
        `⏳ Mohon tunggu sebentar...`, 
        { parse_mode: 'HTML' }
      );
      
      try {
        // Get info untuk ambil member list
        const infoResult = await getInfoAkrab(parentNomor);
        
        if (!infoResult.success) {
          return bot.editMessageText(
            `❌ <b>GAGAL MENGAMBIL DATA</b>\n\n` +
            `📞 Parent: ${parentNomor}\n` +
            `💥 Error: ${infoResult.error}\n\n` +
            `🌐 Source: ${infoResult.source}`,
            { chat_id: chatId, message_id: loadingMsg.message_id, parse_mode: 'HTML' }
          );
        }
        
        // Parse active members dari response
        let activeMembers = [];
        
        // Cek struktur data dari API info
        if (infoResult.data && infoResult.data.data && infoResult.data.data.member_info) {
          const memberInfo = infoResult.data.data.member_info;
          
          // Ambil regular members (skip parent)
          if (memberInfo.members && memberInfo.members.length > 0) {
            memberInfo.members.forEach(member => {
              // Skip parent member, hanya ambil child
              if (member.member_type === 'CHILD' && member.msisdn) {
                activeMembers.push({
                  nomor: member.msisdn,
                  member_id: member.family_member_id,
                  slot: member.slot || 0,
                  alias: member.alias || '',
                  status: 'aktif'
                });
              }
            });
          }
          
          // Ambil additional members
          if (memberInfo.additional_members && memberInfo.additional_members.length > 0) {
            memberInfo.additional_members.forEach(member => {
              if (member.member_type === 'CHILD' && member.msisdn) {
                activeMembers.push({
                  nomor: member.msisdn,
                  member_id: member.family_member_id,
                  slot: member.slot || 0,
                  alias: member.alias || '',
                  status: 'aktif'
                });
              }
            });
          }
        }
        
        if (activeMembers.length === 0) {
          return bot.editMessageText(
            `📊 <b>TIDAK ADA MEMBER AKTIF</b>\n\n` +
            `📞 Parent: ${parentNomor}\n` +
            `👥 Belum ada member yang dapat di-kick.`,
            { chat_id: chatId, message_id: loadingMsg.message_id, parse_mode: 'HTML' }
          );
        }
        
        // Update state dengan info parent dan active members
        kickStates.set(chatId, {
          ...state,
          step: 'select_member',
          parentNomor: parentNomor,
          activeMembers: activeMembers,
          infoResult: infoResult
        });
        
        // Generate member selection keyboard
        const memberKeyboard = [];
        activeMembers.forEach((member) => {
          const displayText = member.alias ? 
            `${member.nomor} (${member.alias}) - Slot ${member.slot}` :
            `${member.nomor} - Slot ${member.slot}`;
          
          memberKeyboard.push([{
            text: displayText,
            callback_data: `kick_member_${member.slot}`
          }]);
        });
        
        memberKeyboard.push([{ text: '❌ BATAL', callback_data: 'kick_cancel' }]);
        
        bot.editMessageText(
          `👥 <b>PILIH MEMBER UNTUK DI-KICK</b>\n\n` +
          `📞 Parent: ${parentNomor}\n` +
          `📊 Total Member: ${activeMembers.length}\n\n` +
          `🎯 Pilih member yang akan di-kick:`,
          {
            chat_id: chatId,
            message_id: loadingMsg.message_id,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: memberKeyboard }
          }
        );
        
      } catch (error) {
        console.error('Error in kick command:', error);
        bot.editMessageText(
          `❌ <b>SYSTEM ERROR</b>\n\n` +
          `💥 Error: ${error.message}`,
          { chat_id: chatId, message_id: loadingMsg.message_id, parse_mode: 'HTML' }
        );
        kickStates.delete(chatId);
      }
    }
  });

  // === CALLBACK HANDLERS ===
  bot.on('callback_query', async (query) => {
    const { data, message, id, from } = query;
    const chatId = message?.chat?.id;
    const userId = from?.id;
    
    // Cek session validity (30 detik timeout)
    if (!isSessionValid(chatId)) {
      return;
    }
    
    // Reset timeout karena ada aktivitas baru
    resetSessionTimeout(chatId);
    
    const state = kickStates.get(chatId);
    if (state.userId !== userId) return;
    
    // Handle member selection untuk kick
    if (data.startsWith('kick_member_')) {
      const slotNumber = parseInt(data.replace('kick_member_', ''));
      const selectedMember = state.activeMembers.find(m => m.slot === slotNumber);
      
      if (!selectedMember) {
        return bot.answerCallbackQuery(id, {
          text: "❌ Member tidak ditemukan!",
          show_alert: true
        });
      }
      
      // Konfirmasi kick member
      await bot.editMessageText(
        `⚠️ <b>KONFIRMASI KICK MEMBER</b>\n\n` +
        `📞 Parent: ${state.parentNomor}\n` +
        `👤 Member: ${selectedMember.nomor}\n` +
        `🆔 Member ID: ${selectedMember.member_id}\n` +
        `📱 Slot: ${selectedMember.slot}\n` +
        `🏷️ Alias: ${selectedMember.alias || 'Tidak ada'}\n\n` +
        `⚠️ <b>PERINGATAN:</b>\n` +
        `• Member akan langsung di-kick\n` +
        `• Proses tidak dapat dibatalkan\n\n` +
        `🎯 Lanjutkan kick member?`,
        {
          chat_id: chatId,
          message_id: message.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔥 Ya, Kick Member', callback_data: `kick_confirm_${selectedMember.slot}` },
                { text: '❌ BATAL', callback_data: 'kick_cancel' }
              ]
            ]
          }
        }
      );
      
      // Update state dengan selected member
      kickStates.set(chatId, {
        ...state,
        step: 'confirm_kick',
        selectedMember: selectedMember
      });
      
      await bot.answerCallbackQuery(id, {
        text: `Member ${selectedMember.nomor} dipilih untuk di-kick`,
        show_alert: false
      });
    }
    
    // Handle konfirmasi kick
    else if (data.startsWith('kick_confirm_')) {
      const slotNumber = parseInt(data.replace('kick_confirm_', ''));
      const selectedMember = state.selectedMember;
      
      if (!selectedMember || selectedMember.slot !== slotNumber) {
        return bot.answerCallbackQuery(id, {
          text: "❌ Data member tidak valid!",
          show_alert: true
        });
      }
      
      // Process kick member
      const processingMsg = await bot.editMessageText(
        `⏳ <b>MEMPROSES KICK MEMBER...</b>\n\n` +
        `📞 Parent: ${state.parentNomor}\n` +
        `👤 Member: ${selectedMember.nomor}\n` +
        `📱 Slot: ${selectedMember.slot}\n\n` +
        `🔄 Sedang mengeluarkan member...`,
        { chat_id: chatId, message_id: message.message_id, parse_mode: 'HTML' }
      );
      
      try {
        // Call API untuk kick member
        const result = await removeMemberAkrab(state.parentNomor, selectedMember.member_id);
        
        if (result.success) {
          bot.editMessageText(
            `✅ <b>MEMBER BERHASIL DI-KICK</b>\n\n` +
            `📞 Parent: ${state.parentNomor}\n` +
            `👤 Member: ${selectedMember.nomor}\n` +
            `🆔 Member ID: ${selectedMember.member_id}\n` +
            `📱 Slot: ${selectedMember.slot}\n` +
            `🌐 Source: ${result.source}\n\n` +
            `✨ Member telah berhasil dikeluarkan!`,
            { chat_id: chatId, message_id: message.message_id, parse_mode: 'HTML' }
          );
        } else {
          bot.editMessageText(
            `❌ <b>GAGAL KICK MEMBER</b>\n\n` +
            `📞 Parent: ${state.parentNomor}\n` +
            `👤 Member: ${selectedMember.nomor}\n` +
            `📱 Slot: ${selectedMember.slot}\n\n` +
            `💥 Error: ${result.error}\n` +
            `🌐 Source: ${result.source}`,
            { chat_id: chatId, message_id: message.message_id, parse_mode: 'HTML' }
          );
        }
      } catch (error) {
        console.error('Error in kick process:', error);
        bot.editMessageText(
          `❌ <b>SYSTEM ERROR</b>\n\n` +
          `💥 Error: ${error.message}`,
          { chat_id: chatId, message_id: message.message_id, parse_mode: 'HTML' }
        );
      }
      
      kickStates.delete(chatId); // Reset session tanpa pemberitahuan
      
      await bot.answerCallbackQuery(id);
    }
    
    // Handle cancel
    else if (data === 'kick_cancel') {
      kickStates.delete(chatId); // Reset session tanpa pemberitahuan
      
      await bot.editMessageText(`❌ <b>KICK MEMBER DIBATALKAN</b>\n\nProses kick member telah dibatalkan.`, {
        chat_id: chatId,
        message_id: message.message_id,
        parse_mode: 'HTML'
      });
      
      await bot.answerCallbackQuery(id, {
        text: "✅ Dibatalkan",
        show_alert: false
      });
    }
  });
  
  // Cleanup otomatis setiap 1 menit untuk session yang expired (30+ detik tidak aktif)
  setInterval(() => {
    const now = Date.now();
    for (const [chatId, state] of kickStates) {
      if (state.lastActivity && now - state.lastActivity > 30 * 1000) { // 30 detik tidak aktif
        kickStates.delete(chatId);
      }
    }
  }, 60 * 1000); // Check setiap 1 menit
};
