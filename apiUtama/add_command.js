const { addMemberAkrab } = require('./add');
const { getInfoAkrab } = require('./info');

// State management untuk add member flow
const addStates = new Map();

// Function untuk reset session timeout
function resetSessionTimeout(chatId) {
  const state = addStates.get(chatId);
  if (state) {
    state.lastActivity = Date.now();
    addStates.set(chatId, state);
  }
}

// Function untuk cek apakah session masih valid (30 detik timeout)
function isSessionValid(chatId) {
  const state = addStates.get(chatId);
  if (!state) return false;
  
  const now = Date.now();
  const timeSinceLastActivity = now - state.lastActivity;
  
  // Session expired setelah 30 detik tidak ada aktivitas
  if (timeSinceLastActivity > 30 * 1000) {
    addStates.delete(chatId);
    return false;
  }
  
  return true;
}

// Handler untuk command /add
module.exports = (bot) => {
  
  // === STEP 1: /add command - Input nomor parent ===
  bot.onText(/^\/add$/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Cek otorisasi admin
    if (userId.toString() !== process.env.ADMIN_ID) {
      return bot.sendMessage(chatId, "❌ Anda tidak memiliki akses untuk command ini.");
    }
    
    // Set state ke step 1
    addStates.set(chatId, { 
      step: 'input_parent',
      userId: userId,
      startTime: Date.now(),
      lastActivity: Date.now()
    });
    
    const helpText = `➕ <b>ADD MEMBER AKRAB</b>\n\n` +
      `<b>STEP 1/5:</b> Masukan nomor pengelola (parent)\n\n` +
      `� <b>Format:</b> 08xxx atau 628xxx\n` +
      `📋 <b>Contoh:</b> 08777111222`;
    
    await bot.sendMessage(chatId, helpText, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '❌ BATAL', callback_data: 'add_cancel' }
        ]]
      }
    });
  });

  // === STEP 2: Setelah input parent, ambil info dan pilih slot ===
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;
    
    if (!addStates.has(chatId)) return;
    
    // Cek session validity (30 detik timeout)
    if (!isSessionValid(chatId)) {
      return;
    }
    
    // Reset timeout karena ada aktivitas baru
    resetSessionTimeout(chatId);
    
    const state = addStates.get(chatId);
    if (state.userId !== userId) return;
    
    // STEP 1: Input parent nomor
    if (state.step === 'input_parent') {
      if (!text || text.startsWith('/')) return;
      
      const parentNomor = text.trim();
      if (parentNomor.length < 10) {
        return bot.sendMessage(chatId, "❌ Nomor tidak valid! Minimal 10 digit.");
      }
      
      // Loading message
      const loadingMsg = await bot.sendMessage(chatId, "⏳ Mengambil info akrab...");
      
      try {
        // Get info akrab untuk melihat slot yang tersedia
        const infoResult = await getInfoAkrab(parentNomor);
        
        await bot.deleteMessage(chatId, loadingMsg.message_id);
        
        if (!infoResult.success) {
          addStates.delete(chatId);
          return bot.sendMessage(chatId, `❌ <b>Gagal ambil info!</b>\n\n📱 ${parentNomor}\n🚫 ${infoResult.error?.primary || 'Unknown error'}`, {
            parse_mode: 'HTML'
          });
        }
        
        // Parse slots dari response
        let availableSlots = [];
        
        if (infoResult.source === 'primary' && infoResult.data?.status) {
          const memberInfo = infoResult.data.data?.member_info;
          if (memberInfo) {
            const allMembers = [...(memberInfo.members || []), ...(memberInfo.additional_members || [])];
            
            let slotCounter = 1;
            for (const member of allMembers) {
              if (member.member_type === 'PARENT') continue;
              
              const msisdn = member.msisdn || '';
              const addChances = member.add_chances || 0;
              
              if (!msisdn || msisdn === '') {
                availableSlots.push({
                  slot: slotCounter,
                  addChances: addChances,
                  memberId: member.family_member_id,
                  slotId: member.slot_id
                });
              }
              slotCounter++;
            }
          }
        }
        
        if (availableSlots.length === 0) {
          addStates.delete(chatId);
          return bot.sendMessage(chatId, `❌ <b>TIDAK ADA SLOT KOSONG!</b>\n\n📱 ${parentNomor}\n\nSemua slot sudah terisi.`, {
            parse_mode: 'HTML'
          });
        }
        
        // Update state dengan info parent dan available slots
        addStates.set(chatId, {
          ...state,
          step: 'select_slot',
          parentNomor: parentNomor,
          availableSlots: availableSlots,
          infoResult: infoResult
        });
        
        // Generate slot selection keyboard
        const slotKeyboard = [];
        for (const slot of availableSlots) {
          let status;
          if (slot.addChances === 0) {
            status = '❗ Kosong';
          } else if (slot.addChances === 1) {
            status = '⚠️ Kosong';
          } else {
            status = '✅ Kosong';
          }
          
          slotKeyboard.push([{
            text: `SLOT ${slot.slot}: (${slot.addChances}) ${status}`,
            callback_data: `add_slot_${slot.slot}`
          }]);
        }
        
        slotKeyboard.push([{ text: '❌ BATAL', callback_data: 'add_cancel' }]);
        
        const slotText = `➕ <b>ADD MEMBER AKRAB</b>\n\n` +
          `<b>STEP 2/5:</b> Pilih slot yang tersedia\n\n` +
          `👤 <b>Parent:</b> <code>${parentNomor}</code>\n\n` +
          `📋 <b>Slot Kosong:</b>`;
        
        await bot.sendMessage(chatId, slotText, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: slotKeyboard }
        });
        
      } catch (error) {
        await bot.deleteMessage(chatId, loadingMsg.message_id);
        addStates.delete(chatId);
        
        await bot.sendMessage(chatId, `❌ <b>ERROR SISTEM</b>\n\n🚫 ${error.message}`, {
          parse_mode: 'HTML'
        });
      }
    }
    
    // STEP 3: Input child nomor
    else if (state.step === 'input_child') {
      if (!text || text.startsWith('/')) return;
      
      const childNomor = text.trim();
      if (childNomor.length < 10) {
        return bot.sendMessage(chatId, "❌ Nomor tidak valid! Minimal 10 digit.");
      }
      
      // Update state
      addStates.set(chatId, {
        ...state,
        step: 'input_parent_name',
        childNomor: childNomor
      });
      
      const parentNameText = `➕ <b>ADD MEMBER AKRAB</b>\n\n` +
        `<b>STEP 4/5:</b> Masukan nama pengelola\n\n` +
        `👤 <b>Parent:</b> <code>${state.parentNomor}</code>\n` +
        `👶 <b>Child:</b> <code>${childNomor}</code>\n` +
        `🎯 <b>Slot:</b> ${state.selectedSlot}\n\n` +
        `📝 <b>Contoh:</b> BEKASAN, BULANAN, XL, dll`;
      
      await bot.sendMessage(chatId, parentNameText, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '❌ BATAL', callback_data: 'add_cancel' }
          ]]
        }
      });
    }
    
    // STEP 4: Input parent name
    else if (state.step === 'input_parent_name') {
      if (!text || text.startsWith('/')) return;
      
      const parentName = text.trim();
      
      // Update state
      addStates.set(chatId, {
        ...state,
        step: 'input_child_name',
        parentName: parentName
      });
      
      const childNameText = `➕ <b>ADD MEMBER AKRAB</b>\n\n` +
        `<b>STEP 5/5:</b> Masukan nama anggota\n\n` +
        `👤 <b>Parent:</b> <code>${state.parentNomor}</code> (${parentName})\n` +
        `👶 <b>Child:</b> <code>${state.childNomor}</code>\n` +
        `🎯 <b>Slot:</b> ${state.selectedSlot}\n\n` +
        `📝 <b>Contoh:</b> Child1, Anak, Adik, dll`;
      
      await bot.sendMessage(chatId, childNameText, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '❌ BATAL', callback_data: 'add_cancel' }
          ]]
        }
      });
    }
    
    // STEP 5: Input child name dan execute
    else if (state.step === 'input_child_name') {
      if (!text || text.startsWith('/')) return;
      
      const childName = text.trim();
      
      // Loading message
      const loadingMsg = await bot.sendMessage(chatId, "⏳ Menambahkan member ke akrab...");
      
      try {
        const result = await addMemberAkrab(
          state.parentNomor,
          state.childNomor,
          childName,
          state.selectedSlotData.memberId,
          state.selectedSlotData.slotId.toString()
        );
        
        await bot.deleteMessage(chatId, loadingMsg.message_id);
        addStates.delete(chatId);
        
        if (result.success) {
          let responseText = `✅ <b>ADD MEMBER BERHASIL</b>\n\n`;
          responseText += `👤 <b>Parent:</b> <code>${state.parentNomor}</code> (${state.parentName})\n`;
          responseText += `👶 <b>Child:</b> <code>${state.childNomor}</code> (${childName})\n`;
          responseText += `� <b>Slot:</b> ${state.selectedSlot}\n`;
          responseText += `🔗 <b>Source:</b> ${result.source === 'primary' ? '🎯 API Utama' : '🔄 API Secondary'}\n\n`;
          responseText += `📋 <b>Message:</b> ${result.data?.message || 'Member berhasil ditambahkan'}`;
          
          await bot.sendMessage(chatId, responseText, {
            parse_mode: 'HTML'
          });
          
        } else {
          let errorText = `❌ <b>GAGAL ADD MEMBER</b>\n\n`;
          errorText += `👤 <b>Parent:</b> <code>${state.parentNomor}</code>\n`;
          errorText += `👶 <b>Child:</b> <code>${state.childNomor}</code>\n`;
          errorText += `� <b>Slot:</b> ${state.selectedSlot}\n\n`;
          errorText += `🚫 <b>Error:</b>\n`;
          errorText += `• API Utama: ${result.error.primary}\n`;
          errorText += `• API Secondary: ${result.error.secondary}`;
          
          await bot.sendMessage(chatId, errorText, {
            parse_mode: 'HTML'
          });
        }
        
      } catch (error) {
        await bot.deleteMessage(chatId, loadingMsg.message_id);
        addStates.delete(chatId);
        
        await bot.sendMessage(chatId, `❌ <b>ERROR SISTEM</b>\n\n🚫 ${error.message}`, {
          parse_mode: 'HTML'
        });
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
    
    const state = addStates.get(chatId);
    if (state.userId !== userId) return;
    
    // Handle slot selection
    if (data.startsWith('add_slot_')) {
      const slotNumber = parseInt(data.replace('add_slot_', ''));
      const selectedSlotData = state.availableSlots.find(s => s.slot === slotNumber);
      
      if (!selectedSlotData) {
        return bot.answerCallbackQuery(id, {
          text: "❌ Slot tidak valid!",
          show_alert: true
        });
      }
      
      // Update state
      addStates.set(chatId, {
        ...state,
        step: 'input_child',
        selectedSlot: slotNumber,
        selectedSlotData: selectedSlotData
      });
      
      const childText = `➕ <b>ADD MEMBER AKRAB</b>\n\n` +
        `<b>STEP 3/5:</b> Masukan nomor anggota\n\n` +
        `� <b>Parent:</b> <code>${state.parentNomor}</code>\n` +
        `🎯 <b>Slot:</b> ${slotNumber} (${selectedSlotData.addChances} chances)\n\n` +
        `📝 <b>Format:</b> 08xxx atau 628xxx\n` +
        `📋 <b>Contoh:</b> 08777333444`;
      
      await bot.editMessageText(childText, {
        chat_id: chatId,
        message_id: message.message_id,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '❌ BATAL', callback_data: 'add_cancel' }
          ]]
        }
      });
      
      await bot.answerCallbackQuery(id, {
        text: `✅ Slot ${slotNumber} dipilih`,
        show_alert: false
      });
    }
    
    // Handle cancel
    else if (data === 'add_cancel') {
      addStates.delete(chatId); // Reset session tanpa pemberitahuan
      
      await bot.editMessageText(`❌ <b>ADD MEMBER DIBATALKAN</b>\n\nProses penambahan member telah dibatalkan.`, {
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
    for (const [chatId, state] of addStates) {
      if (state.lastActivity && now - state.lastActivity > 30 * 1000) { // 30 detik tidak aktif
        addStates.delete(chatId);
      }
    }
  }, 60 * 1000); // Check setiap 1 menit
};
