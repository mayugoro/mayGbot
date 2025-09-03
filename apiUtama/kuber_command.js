const { getInfoAkrab } = require('./info');
const { setKuotaMemberAkrab } = require('./kuber');

// State management untuk interactive command
const kuberStates = new Map();

// Function untuk reset session timeout
function resetSessionTimeout(chatId) {
  const state = kuberStates.get(chatId);
  if (state) {
    state.lastActivity = Date.now();
    kuberStates.set(chatId, state);
  }
}

// Function untuk cek apakah session masih valid (30 detik timeout)
function isSessionValid(chatId) {
  const state = kuberStates.get(chatId);
  if (!state) return false;
  
  const now = Date.now();
  const timeSinceLastActivity = now - state.lastActivity;
  
  // Session expired setelah 30 detik tidak ada aktivitas
  if (timeSinceLastActivity > 30 * 1000) {
    kuberStates.delete(chatId);
    return false;
  }
  
  return true;
}

module.exports = (bot) => {
  // Command /kuber untuk set quota member
  bot.onText(/\/kuber$/, async (msg) => {
    const chatId = msg.chat.id;
    
    // Reset state dan mulai session baru
    kuberStates.delete(chatId);
    
    // Step 1: Minta nomor parent
    const stepMsg = await bot.sendMessage(chatId, 
      '🎯 *SET KUOTA MEMBER*\n\n' +
      '📋 *LANGKAH 1 dari 3*\n\n' +
      '👤 Silakan masukkan nomor parent akrab:\n\n' +
      '📱 Format: 08xxxxxxxxxx atau 628xxxxxxxxxx\n' +
      '💡 Contoh: 08777111222\n\n' +
      '❌ Ketik /cancel untuk membatalkan', 
      { parse_mode: 'Markdown' }
    );
    
    // Set session dengan aktivitas pertama
    kuberStates.set(chatId, {
      step: 'parent_nomor',
      messageId: stepMsg.message_id,
      startTime: Date.now(),
      lastActivity: Date.now()
    });
  });
  
  // Handler untuk cancel command
  bot.onText(/\/cancel/, (msg) => {
    const chatId = msg.chat.id;
    
    if (kuberStates.has(chatId)) {
      kuberStates.delete(chatId); // Reset session tanpa pemberitahuan
      bot.sendMessage(chatId, '❌ *PROSES DIBATALKAN*\n\nCommand /kuber telah dibatalkan.', {
        parse_mode: 'Markdown'
      });
    }
  });
  
  // Handler untuk semua text messages
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (!kuberStates.has(chatId) || !text || text.startsWith('/')) {
      return;
    }
    
    // Cek session validity (30 detik timeout)
    if (!isSessionValid(chatId)) {
      return;
    }
    
    // Reset timeout karena ada aktivitas baru
    resetSessionTimeout(chatId);
    
    const state = kuberStates.get(chatId);
    
    try {
      if (state.step === 'parent_nomor') {
        // Validasi nomor parent
        const nomorRegex = /^(08|628)\d{8,12}$/;
        if (!nomorRegex.test(text.replace(/\s+/g, ''))) {
          bot.sendMessage(chatId, 
            '❌ *Format nomor tidak valid!*\n\n' +
            '📱 Gunakan format: 08xxxxxxxxxx atau 628xxxxxxxxxx\n' +
            '💡 Contoh: 08777111222\n\n' +
            '🔄 Silakan coba lagi:', 
            { parse_mode: 'Markdown' }
          );
          return;
        }
        
        const parentNomor = text.replace(/\s+/g, '');
        
        // Loading message
        const loadingMsg = await bot.sendMessage(chatId, 
          '🔍 *MENGAMBIL DATA MEMBER...*\n\n' +
          `👤 Parent: ${parentNomor}\n` +
          '⏳ Mohon tunggu sebentar...', 
          { parse_mode: 'Markdown' }
        );
        
        // Get info untuk melihat member list
        const infoResult = await getInfoAkrab(parentNomor);
        
        if (!infoResult.success) {
          bot.editMessageText(
            '❌ *GAGAL MENGAMBIL DATA*\n\n' +
            `🔍 Parent: ${parentNomor}\n` +
            `📱 Error: ${infoResult.error}\n\n` +
            '🔄 Silakan coba lagi dengan nomor yang benar.',
            { chat_id: chatId, message_id: loadingMsg.message_id, parse_mode: 'Markdown' }
          );
          return;
        }
        
        // Parse members dari response
        let members = [];
        
        // Cek struktur data dari API info
        if (infoResult.data && infoResult.data.data && infoResult.data.data.member_info) {
          const memberInfo = infoResult.data.data.member_info;
          
          // Ambil regular members (skip parent)
          if (memberInfo.members && memberInfo.members.length > 0) {
            memberInfo.members.forEach(member => {
              // Skip parent member, hanya ambil child
              if (member.member_type === 'CHILD' && member.msisdn) {
                const kuotaGB = member.usage && member.usage.quota_allocated ? 
                  (member.usage.quota_allocated / (1024 * 1024 * 1024)).toFixed(2) + ' GB' : '0 GB';
                
                members.push({
                  nomor: member.msisdn,
                  member_id: member.family_member_id,
                  kuota_terpakai: kuotaGB,
                  status: 'aktif',
                  alias: member.alias || ''
                });
              }
            });
          }
          
          // Ambil additional members
          if (memberInfo.additional_members && memberInfo.additional_members.length > 0) {
            memberInfo.additional_members.forEach(member => {
              if (member.member_type === 'CHILD' && member.msisdn) {
                const kuotaGB = member.usage && member.usage.quota_allocated ? 
                  (member.usage.quota_allocated / (1024 * 1024 * 1024)).toFixed(2) + ' GB' : '0 GB';
                
                members.push({
                  nomor: member.msisdn,
                  member_id: member.family_member_id,
                  kuota_terpakai: kuotaGB,
                  status: 'aktif',
                  alias: member.alias || ''
                });
              }
            });
          }
        }
        
        if (members.length === 0) {
          bot.editMessageText(
            '📊 *TIDAK ADA MEMBER*\n\n' +
            `👤 Parent: ${parentNomor}\n` +
            '👥 Belum ada member yang terdaftar.\n\n' +
            '💡 Tambahkan member terlebih dahulu dengan /add',
            { chat_id: chatId, message_id: loadingMsg.message_id, parse_mode: 'Markdown' }
          );
          kuberStates.delete(chatId);
          return;
        }
        
        // Buat keyboard untuk pilih member
        const keyboard = [];
        members.forEach((member, index) => {
          const displayText = member.alias ? 
            `${index + 1}. ${member.nomor} (${member.alias}) - ${member.kuota_terpakai}` :
            `${index + 1}. ${member.nomor} - ${member.kuota_terpakai}`;
          
          keyboard.push([{
            text: displayText,
            callback_data: `kuber_member_${index}`
          }]);
        });
        
        keyboard.push([{ text: '❌ Batal', callback_data: 'kuber_cancel' }]);
        
        bot.editMessageText(
          '👥 *PILIH MEMBER*\n\n' +
          '📋 *LANGKAH 2 dari 3*\n\n' +
          `👤 Parent: ${parentNomor}\n` +
          `📊 Total Member: ${members.length}\n\n` +
          '🎯 Pilih member yang akan diatur kuotanya:',
          {
            chat_id: chatId,
            message_id: loadingMsg.message_id,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
          }
        );
        
        // Update state
        kuberStates.set(chatId, {
          ...state,
          step: 'select_member',
          parentNomor: parentNomor,
          members: members,
          messageId: loadingMsg.message_id
        });
        
      } else if (state.step === 'kuota_input') {
        // Validasi input kuota
        const kuotaGB = parseFloat(text);
        
        if (isNaN(kuotaGB) || kuotaGB <= 0 || kuotaGB > 100) {
          bot.sendMessage(chatId, 
            '❌ *Kuota tidak valid!*\n\n' +
            '📊 Masukkan angka antara 0.1 - 100 GB\n' +
            '💡 Contoh: 5 atau 2.5\n\n' +
            '🔄 Silakan coba lagi:', 
            { parse_mode: 'Markdown' }
          );
          return;
        }
        
        // Konfirmasi setting kuota
        const selectedMember = state.selectedMember;
        const confirmMsg = await bot.sendMessage(chatId,
          '✅ *KONFIRMASI SET KUOTA*\n\n' +
          '📋 *LANGKAH 3 dari 3*\n\n' +
          `👤 Parent: ${state.parentNomor}\n` +
          `👥 Member: ${selectedMember.nomor}\n` +
          `🆔 Member ID: ${selectedMember.member_id}\n` +
          `📊 Kuota Baru: ${kuotaGB} GB\n` +
          `📈 Kuota Lama: ${selectedMember.kuota_terpakai}\n\n` +
          '⚠️ *PERINGATAN:*\n' +
          '• Kuota akan langsung berubah\n' +
          '• Proses tidak dapat dibatalkan\n\n' +
          '🎯 Lanjutkan set kuota?',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ Ya, Set Kuota', callback_data: 'kuber_confirm' },
                  { text: '❌ Batal', callback_data: 'kuber_cancel' }
                ]
              ]
            }
          }
        );
        
        // Update state
        kuberStates.set(chatId, {
          ...state,
          step: 'confirm',
          kuotaGB: kuotaGB,
          confirmMessageId: confirmMsg.message_id
        });
      }
      
    } catch (error) {
      console.error('Error in kuber command:', error);
      bot.sendMessage(chatId, 
        '❌ *SYSTEM ERROR*\n\n' +
        'Terjadi kesalahan sistem. Silakan coba lagi.\n\n' +
        `📱 Error: ${error.message}`, 
        { parse_mode: 'Markdown' }
      );
      kuberStates.delete(chatId);
    }
  });
  
  // Handler untuk callback query
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    // Cek session validity (30 detik timeout)
    if (!isSessionValid(chatId)) {
      return;
    }
    
    // Reset timeout karena ada aktivitas baru
    resetSessionTimeout(chatId);
    
    const state = kuberStates.get(chatId);
    
    try {
      if (data === 'kuber_cancel') {
        kuberStates.delete(chatId); // Reset session tanpa pemberitahuan
        bot.editMessageText(
          '❌ *PROSES DIBATALKAN*\n\nCommand /kuber telah dibatalkan.',
          { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' }
        );
        bot.answerCallbackQuery(query.id, { text: 'Proses dibatalkan' });
        return;
      }
      
      if (data.startsWith('kuber_member_') && state.step === 'select_member') {
        const memberIndex = parseInt(data.split('_')[2]);
        const selectedMember = state.members[memberIndex];
        
        bot.editMessageText(
          '📊 *MASUKKAN KUOTA*\n\n' +
          '📋 *LANGKAH 3 dari 3*\n\n' +
          `👤 Parent: ${state.parentNomor}\n` +
          `👥 Member: ${selectedMember.nomor}\n` +
          `🆔 Member ID: ${selectedMember.member_id}\n` +
          `📈 Kuota Saat Ini: ${selectedMember.kuota_terpakai}\n\n` +
          '📊 Masukkan kuota baru (dalam GB):\n\n' +
          '💡 Contoh: 5 (untuk 5GB) atau 2.5 (untuk 2.5GB)\n' +
          '⚠️ Range: 0.1 - 100 GB\n\n' +
          '❌ Ketik /cancel untuk membatalkan',
          { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' }
        );
        
        // Update state
        kuberStates.set(chatId, {
          ...state,
          step: 'kuota_input',
          selectedMember: selectedMember
        });
        
        bot.answerCallbackQuery(query.id, { text: `Member ${selectedMember.nomor} dipilih` });
        
      } else if (data === 'kuber_confirm' && state.step === 'confirm') {
        // Process setting kuota
        const processingMsg = await bot.editMessageText(
          '⏳ *MEMPROSES SET KUOTA...*\n\n' +
          `👤 Parent: ${state.parentNomor}\n` +
          `👥 Member: ${state.selectedMember.nomor}\n` +
          `📊 Kuota: ${state.kuotaGB} GB\n\n` +
          '🔄 Step 1: Verifikasi data member...',
          { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' }
        );
        
        // Step 1: Hit API info untuk verifikasi data terbaru
        const infoResult = await getInfoAkrab(state.parentNomor);
        
        if (!infoResult.success) {
          bot.editMessageText(
            '❌ *GAGAL VERIFIKASI DATA*\n\n' +
            `👤 Parent: ${state.parentNomor}\n` +
            `👥 Member: ${state.selectedMember.nomor}\n` +
            `📊 Kuota: ${state.kuotaGB} GB\n\n` +
            `📱 Error: ${infoResult.error}\n` +
            `🌐 Source: ${infoResult.source}\n\n` +
            '🔄 Silakan coba lagi atau hubungi admin.',
            { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' }
          );
          kuberStates.delete(chatId);
          bot.answerCallbackQuery(query.id, { text: 'Gagal verifikasi data' });
          return;
        }
        
        // Update processing message
        await bot.editMessageText(
          '⏳ *MEMPROSES SET KUOTA...*\n\n' +
          `👤 Parent: ${state.parentNomor}\n` +
          `👥 Member: ${state.selectedMember.nomor}\n` +
          `📊 Kuota: ${state.kuotaGB} GB\n\n` +
          '✅ Step 1: Data terverifikasi\n' +
          '🔄 Step 2: Setting kuota member...',
          { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' }
        );
        
        // Step 2: Call API to set kuota
        const result = await setKuotaMemberAkrab(state.parentNomor, state.selectedMember.member_id, state.kuotaGB);
        
        if (result.success) {
          bot.editMessageText(
            '✅ *KUOTA BERHASIL DIATUR*\n\n' +
            `👤 Parent: ${state.parentNomor}\n` +
            `👥 Member: ${state.selectedMember.nomor}\n` +
            `🆔 Member ID: ${state.selectedMember.member_id}\n` +
            `📊 Kuota Baru: ${state.kuotaGB} GB\n` +
            `💾 Total Bytes: ${result.kuota_bytes.toLocaleString()}\n` +
            `🌐 Source: ${result.source}\n\n` +
            '✨ Kuota telah berhasil diperbarui!',
            { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' }
          );
        } else {
          bot.editMessageText(
            '❌ *GAGAL SET KUOTA*\n\n' +
            `👤 Parent: ${state.parentNomor}\n` +
            `👥 Member: ${state.selectedMember.nomor}\n` +
            `📊 Kuota: ${state.kuotaGB} GB\n\n` +
            `📱 Error: ${result.error}\n` +
            `🌐 Source: ${result.source}\n\n` +
            '🔄 Silakan coba lagi atau hubungi admin.',
            { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' }
          );
        }
        
        kuberStates.delete(chatId);
        bot.answerCallbackQuery(query.id, { 
          text: result.success ? 'Kuota berhasil diatur!' : 'Gagal set kuota' 
        });
      }
      
    } catch (error) {
      console.error('Error in kuber callback:', error);
      bot.editMessageText(
        '❌ *SYSTEM ERROR*\n\n' +
        'Terjadi kesalahan sistem saat memproses.\n\n' +
        `📱 Error: ${error.message}`,
        { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' }
      );
      kuberStates.delete(chatId);
      bot.answerCallbackQuery(query.id, { text: 'Terjadi kesalahan sistem' });
    }
  });
  
  // Cleanup otomatis setiap 1 menit untuk session yang expired (30+ detik tidak aktif)
  setInterval(() => {
    const now = Date.now();
    for (const [chatId, state] of kuberStates) {
      if (now - state.lastActivity > 30 * 1000) { // 30 detik tidak aktif
        kuberStates.delete(chatId);
      }
    }
  }, 60 * 1000); // Check setiap 1 menit
};
