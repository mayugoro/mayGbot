const axios = require('axios');
require('dotenv').config({ quiet: true });
// ========================= FITUR MAINTENANCE =========================
// Fitur sedang dalam tahap perbaikan dan pemeliharaan
// Silakan gunakan fitur lain sementara waktu
// ====================================================================

module.exports = {
    smartAddKickCombo: () => ({ success: false, message: 'Fitur sedang maintenance' }),
    processSmartAddKick: () => ({ success: false, message: 'Fitur sedang maintenance' }),
    findTumbalInSlots: () => ({ success: false, message: 'Fitur sedang maintenance' }),
    checkSmsVoicePackages: () => ({ success: false, message: 'Fitur sedang maintenance' }),
    kickTumbalFromSlot: () => ({ success: false, message: 'Fitur sedang maintenance' }),
    addTumbalToSlot: () => ({ success: false, message: 'Fitur sedang maintenance' })
};

// API1 Configuration
const API_PRIMARY_BASE = process.env.API1;
const API_PRIMARY_ADD_ENDPOINT = process.env.ADD1;
const API_PRIMARY_KICK_ENDPOINT = process.env.KICK1;
const API_PRIMARY_KUOTA_ENDPOINT = process.env.CEK_KUOTA_MEMBER1;
const API_PRIMARY_TOKEN = process.env.APIKEY1;
const ADMIN_ID = process.env.ADMIN_ID;

// Storage untuk add-kick states
const addKickStates = new Map();

// Helper function untuk format nomor ke internasional
function formatNomorToInternational(nomor) {
  let cleanNomor = nomor.replace(/\D/g, '');
  
  if (cleanNomor.startsWith('08')) {
    cleanNomor = '628' + cleanNomor.substring(2);
  } else if (cleanNomor.startsWith('8') && !cleanNomor.startsWith('62')) {
    cleanNomor = '62' + cleanNomor;
  }
  
  return cleanNomor;
}

// Function untuk cek kuota member
const cekKuotaMemberAPI1 = async (member_id, id_parent) => {
  try {
    const formData = new URLSearchParams();
    formData.append('token', API_PRIMARY_TOKEN);
    formData.append('member_id', member_id);
    formData.append('id_parent', id_parent);

    const response = await axios.post(API_PRIMARY_BASE + API_PRIMARY_KUOTA_ENDPOINT, formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000
    });

    if (response.data?.status === true && response.data?.data) {
      return {
        success: true,
        data: response.data.data.quotas || [],
        source: '🟢 KHFY API1'
      };
    } else {
      return {
        success: false,
        error: response.data?.message || 'Failed to get quota data',
        source: '🟢 KHFY API1'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      source: '🟢 KHFY API1'
    };
  }
};

// Function untuk validasi SMS & Voice packages
const validateTumbalPackages = (quotasData) => {
  if (!quotasData || !Array.isArray(quotasData)) {
    return { ready: false, reason: 'Data kuota tidak valid' };
  }

  const targetBenefits = [
    'SMS ke semua nomor XL & AXIS',
    'Nelpon ke semua nomor XL & AXIS'
  ];

  let foundTargets = [];
  
  quotasData.forEach(quotaPackage => {
    if (quotaPackage.benefits && Array.isArray(quotaPackage.benefits)) {
      quotaPackage.benefits.forEach(benefit => {
        for (const target of targetBenefits) {
          if (benefit.name.includes(target)) {
            foundTargets.push({
              target: target,
              found: benefit.name,
              package: quotaPackage.name
            });
          }
        }
      });
    }
  });

  const smsFound = foundTargets.some(t => t.target.includes('SMS'));
  const voiceFound = foundTargets.some(t => t.target.includes('Nelpon'));
  
  return {
    ready: smsFound && voiceFound,
    reason: smsFound && voiceFound ? 'SMS & Voice packages ready' : `Missing: SMS=${smsFound}, Voice=${voiceFound}`,
    packages: foundTargets
  };
};

// Function untuk ADD tumbal
const addTumbalAPI1 = async (nomor_hp, slot_id, nomor_tumbal, family_member_id = "") => {
  try {
    const formattedNomor = formatNomorToInternational(nomor_hp);
    const formattedTumbal = formatNomorToInternational(nomor_tumbal);
    
    const formData = new URLSearchParams();
    formData.append('token', API_PRIMARY_TOKEN);
    formData.append('id_parent', formattedNomor);
    formData.append('msisdn', formattedTumbal);
    formData.append('member_id', family_member_id);
    formData.append('slot_id', slot_id);
    formData.append('parent_name', 'XL');
    formData.append('child_name', 'TUMBAL');

    const response = await axios.post(API_PRIMARY_BASE + API_PRIMARY_ADD_ENDPOINT, formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000
    });

    return {
      success: response.data?.status === 'success' || response.data?.success === true,
      message: response.data?.message || (response.data?.status === 'success' ? 'ADD berhasil' : 'ADD gagal'),
      member_id: response.data?.data?.member_id || response.data?.member_id || null,
      raw_response: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
      member_id: null
    };
  }
};

// Function untuk KICK tumbal
const kickTumbalAPI1 = async (nomor_hp, member_id) => {
  try {
    const formattedNomor = formatNomorToInternational(nomor_hp);
    
    const formData = new URLSearchParams();
    formData.append('token', API_PRIMARY_TOKEN);
    formData.append('member_id', member_id);
    formData.append('id_parent', formattedNomor);

    const response = await axios.post(API_PRIMARY_BASE + API_PRIMARY_KICK_ENDPOINT, formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000
    });

    return {
      success: response.data?.status === 'success' || response.data?.success === true,
      message: response.data?.message || (response.data?.status === 'success' ? 'KICK berhasil' : 'KICK gagal'),
      raw_response: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

// Function untuk cari tumbal di slot mana pun
const findTumbalInSlots = (slots, nomor_tumbal) => {
  const formattedTumbal = formatNomorToInternational(nomor_tumbal);
  
  for (const slot of slots) {
    if (slot.msisdn === formattedTumbal && slot.family_member_id) {
      return {
        found: true,
        slot_id: slot.slot_id,
        member_id: slot.family_member_id,
        alias: slot.alias || 'TUMBAL'
      };
    }
  }
  
  return { found: false };
};

// MAIN FUNCTION: Smart Add-Kick Combo dengan flow yang benar
const smartAddKickCombo = async (nomor_hp, targetSlot, nomor_tumbal) => {
  const startTime = Date.now();
  
  console.log(`\n🎯 ===== SMART ADD-KICK COMBO START =====`);
  console.log(`📱 Pengelola: ${nomor_hp}`);
  console.log(`🎯 Target Slot: ${targetSlot.slot_id}`);
  console.log(`👤 Tumbal: ${nomor_tumbal}`);
  console.log(`⏰ Start: ${new Date().toLocaleString()}`);
  
  try {
    // STEP 1: Cek fresh slot data
    console.log(`\n🔍 STEP 1: Getting fresh slot data...`);
    const slotResult = await getSlotInfoAPI1Only(nomor_hp);
    
    if (!slotResult.success) {
      return {
        success: false,
        error: `STEP 1 FAILED: ${slotResult.error}`,
        elapsed_time: Math.round((Date.now() - startTime) / 1000)
      };
    }
    
    // STEP 2: Cari apakah tumbal sudah ada di slot mana pun
    console.log(`\n🔍 STEP 2: Checking if tumbal already exists in any slot...`);
    const tumbalLocation = findTumbalInSlots(slotResult.slots, nomor_tumbal);
    
    let kickResult = null;
    let addResult = null;
    
    if (tumbalLocation.found) {
      console.log(`✅ Tumbal found in slot ${tumbalLocation.slot_id} (member_id: ${tumbalLocation.member_id})`);
      
      // STEP 3A: Cek apakah packages sudah ready untuk kick
      console.log(`\n📦 STEP 3A: Checking SMS & Voice packages...`);
      const kuotaResult = await cekKuotaMemberAPI1(tumbalLocation.member_id, nomor_hp);
      
      if (kuotaResult.success) {
        const packageCheck = validateTumbalPackages(kuotaResult.data);
        console.log(`📦 Package status: ${packageCheck.reason}`);
        
        if (packageCheck.ready) {
          console.log(`✅ Packages ready! Proceeding to KICK...`);
        } else {
          console.log(`⏳ Packages not ready yet, but will proceed to KICK anyway...`);
        }
      }
      
      // STEP 4A: KICK tumbal
      console.log(`\n🚀 STEP 4A: KICKING tumbal from slot ${tumbalLocation.slot_id}...`);
      kickResult = await kickTumbalAPI1(nomor_hp, tumbalLocation.member_id);
      console.log(`🔍 KICK result: ${kickResult.success ? 'SUCCESS' : 'FAILED'} - ${kickResult.message}`);
      
      if (!kickResult.success) {
        return {
          success: false,
          error: `KICK FAILED: ${kickResult.message}`,
          elapsed_time: Math.round((Date.now() - startTime) / 1000),
          step: 'KICK'
        };
      }
      
      // Wait 3 seconds after kick
      console.log(`⏳ Waiting 3s after KICK...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // STEP 3B/5B: ADD tumbal to target slot
    console.log(`\n🚀 STEP ${tumbalLocation.found ? '5B' : '3B'}: ADDING tumbal to slot ${targetSlot.slot_id}...`);
    addResult = await addTumbalAPI1(nomor_hp, targetSlot.slot_id, nomor_tumbal, targetSlot.family_member_id);
    console.log(`🔍 ADD result: ${addResult.success ? 'SUCCESS' : 'FAILED'} - ${addResult.message}`);
    
    if (!addResult.success) {
      return {
        success: false,
        error: `ADD FAILED: ${addResult.message}`,
        elapsed_time: Math.round((Date.now() - startTime) / 1000),
        step: 'ADD',
        kickResult: kickResult
      };
    }
    
    const finalElapsed = Math.round((Date.now() - startTime) / 1000);
    
    console.log(`\n🎉 ===== SMART COMBO SUCCESS =====`);
    console.log(`⏰ Total time: ${finalElapsed}s`);
    console.log(`🔄 Flow: ${tumbalLocation.found ? 'FOUND→KICK→ADD' : 'NOT_FOUND→ADD'}`);
    
    return {
      success: true,
      message: `Smart combo success in ${finalElapsed}s`,
      elapsed_time: finalElapsed,
      flow: tumbalLocation.found ? 'KICK_THEN_ADD' : 'DIRECT_ADD',
      kickResult: kickResult,
      addResult: addResult,
      tumbalWasFound: tumbalLocation.found,
      previousSlot: tumbalLocation.found ? tumbalLocation.slot_id : null,
      newSlot: targetSlot.slot_id
    };
    
  } catch (error) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.error(`❌ SMART COMBO EXCEPTION after ${elapsed}s:`, error.message);
    
    return {
      success: false,
      error: `EXCEPTION: ${error.message}`,
      elapsed_time: elapsed,
      step: 'EXCEPTION'
    };
  }
};

// Main processing function
const processSmartAddKick = async (nomor_pengelola_list, nomor_tumbal, chatId, bot) => {
  try {
    console.log(`🚀 ===== SMART ADD-KICK PROCESSING START =====`);
    console.log(`📱 Pengelola: ${nomor_pengelola_list.length} nomor`);
    console.log(`👤 Tumbal: ${nomor_tumbal}`);
    console.log(`⏰ Start: ${new Date().toLocaleString()}`);
    
    // Status tracker
    const statusTracker = {};
    nomor_pengelola_list.forEach(nomor => {
      statusTracker[nomor] = {
        status: 'pending',
        slots: 0,
        totalSlots: 0,
        successSlots: 0
      };
    });

    // Status display function
    const createStatusList = (currentIndex = -1) => {
      let statusText = `🎯 <b>SMART ADD-KICK PROCESSING</b>\n`;
      statusText += `⏰ <i>${new Date().toLocaleString('id-ID')}</i>\n\n`;
      
      nomor_pengelola_list.forEach((nomor, index) => {
        let icon = '⏳';
        let detail = '';
        
        if (statusTracker[nomor].status === 'processing') {
          icon = '🔄';
          detail = ` (${statusTracker[nomor].slots}/${statusTracker[nomor].totalSlots} slot)`;
        } else if (statusTracker[nomor].status === 'completed') {
          icon = '✅';
          detail = ` (${statusTracker[nomor].successSlots}/${statusTracker[nomor].totalSlots} slot)`;
        } else if (statusTracker[nomor].status === 'failed') {
          icon = '❌';
          detail = ' (no slots)';
        }
        
        statusText += `${nomor} ${icon}${detail}\n`;
      });
      
      statusText += `\n🎯 <b>Progress:</b> ${currentIndex + 1}/${nomor_pengelola_list.length} pengelola`;
      statusText += `\n🚀 <b>Strategy:</b> Smart Add-Kick (Check→Kick→Add)`;
      statusText += `\n🔄 <b>Flow:</b> Tumbal cek dulu, kick jika ada, baru add`;
      
      return statusText;
    };

    // Send status message
    const statusMsg = await bot.sendMessage(chatId, createStatusList(), { parse_mode: 'HTML' });

    let totalSuccess = 0;
    let totalFailed = 0;

    // Process each pengelola
    for (let i = 0; i < nomor_pengelola_list.length; i++) {
      const nomor_hp = nomor_pengelola_list[i];
      
      try {
        console.log(`\n🔄 Processing pengelola ${i+1}/${nomor_pengelola_list.length}: ${nomor_hp}`);
        
        // Get available slots
        const slotResult = await getSlotInfoAPI1Only(nomor_hp);
        if (!slotResult.success) {
          statusTracker[nomor_hp] = { status: 'failed', reason: 'cekslot_failed' };
          continue;
        }

        // Filter available slots (kosong dengan add_chances = 2)
        const availableSlots = slotResult.slots.filter(slot => {
          const slotId = slot.slot_id;
          const alias = (slot.alias || '').trim();
          const msisdn = (slot.msisdn || '').trim();
          const addChances = parseInt(slot.add_chances) || 0;
          
          const isEmptyAlias = alias === '' || alias === '-';
          const isEmptyMsisdn = msisdn === '' || msisdn === '-';
          
          return slotId && slotId !== '0' && slotId !== 0 && isEmptyAlias && isEmptyMsisdn && addChances === 2;
        });

        if (availableSlots.length === 0) {
          statusTracker[nomor_hp] = { status: 'failed', reason: 'no_available_slots' };
          continue;
        }

        // Mark as processing
        statusTracker[nomor_hp] = {
          status: 'processing',
          slots: 0,
          totalSlots: availableSlots.length,
          successSlots: 0
        };

        // Update status
        try {
          await bot.editMessageText(createStatusList(i), {
            chat_id: chatId,
            message_id: statusMsg.message_id,
            parse_mode: 'HTML'
          });
        } catch (e) {}

        // Process each slot
        for (let j = 0; j < availableSlots.length; j++) {
          const slot = availableSlots[j];
          
          statusTracker[nomor_hp].slots = j + 1;
          
          // Update status
          try {
            await bot.editMessageText(createStatusList(i), {
              chat_id: chatId,
              message_id: statusMsg.message_id,
              parse_mode: 'HTML'
            });
          } catch (e) {}

          // Execute smart combo
          const comboResult = await smartAddKickCombo(nomor_hp, slot, nomor_tumbal);
          
          if (comboResult.success) {
            totalSuccess++;
            statusTracker[nomor_hp].successSlots++;
            console.log(`✅ Slot ${slot.slot_id} SUCCESS: ${comboResult.flow} in ${comboResult.elapsed_time}s`);
          } else {
            totalFailed++;
            console.log(`❌ Slot ${slot.slot_id} FAILED: ${comboResult.error} in ${comboResult.elapsed_time}s`);
          }

          // Wait between slots
          if (j < availableSlots.length - 1) {
            console.log(`⏳ Waiting 5s before next slot...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }

        statusTracker[nomor_hp].status = 'completed';

      } catch (error) {
        console.error(`❌ Error processing ${nomor_hp}:`, error);
        statusTracker[nomor_hp] = { status: 'failed', reason: 'processing_error' };
      }
    }

    // Final summary
    let completedCount = 0;
    let failedCount = 0;
    
    Object.values(statusTracker).forEach(status => {
      if (status.status === 'completed') completedCount++;
      else if (status.status === 'failed') failedCount++;
    });

    const finalMessage = 
      `📊 <b>SMART ADD-KICK SUMMARY</b>\n\n` +
      `📱 <b>Total Pengelola:</b> ${nomor_pengelola_list.length}\n` +
      `✅ <b>Berhasil:</b> ${completedCount}\n` +
      `❌ <b>Gagal:</b> ${failedCount}\n\n` +
      `🎯 <b>Slot Results:</b>\n` +
      `✅ <b>Success:</b> ${totalSuccess}\n` +
      `❌ <b>Failed:</b> ${totalFailed}\n\n` +
      `👤 <b>Tumbal:</b> ${nomor_tumbal}\n` +
      `🚀 <b>Strategy:</b> Smart flow (Check→Kick→Add)`;

    await bot.editMessageText(createStatusList(nomor_pengelola_list.length - 1) + '\n\n✅ <b>SELESAI!</b>', {
      chat_id: chatId,
      message_id: statusMsg.message_id,
      parse_mode: 'HTML'
    });

    await bot.sendMessage(chatId, finalMessage, { parse_mode: 'HTML' });

  } catch (error) {
    console.error('❌ Processing error:', error);
    await bot.sendMessage(chatId, `❌ <b>Error:</b> ${error.message}`, { parse_mode: 'HTML' });
  }
};

module.exports = (bot) => {
  // Handle callback queries
  bot.on('callback_query', async (query) => {
    const { data, message, id, from } = query;
    const chatId = message?.chat?.id;
    
    if (!chatId) return;
    
    try {
      if (data === 'addkick_start') {
        const keyboard = [
          [{ text: '🎯 MULAI SMART ADD-KICK', callback_data: 'addkick_begin' }],
          [{ text: '🔙 KEMBALI', callback_data: 'menu_massal' }]
        ];
        
        const content = 
          `🧠 <b>SMART ADD-KICK SYSTEM</b>\n\n` +
          `🔄 <b>Smart Flow:</b>\n` +
          `1️⃣ Cek apakah tumbal sudah ada di slot mana pun\n` +
          `2️⃣ Jika ADA → Cek packages → Kick dulu\n` +
          `3️⃣ Jika TIDAK ADA → Langsung add\n` +
          `4️⃣ Add tumbal ke slot target\n\n` +
          `⚡ <b>Keunggulan:</b>\n` +
          `• No conflict "nomor sudah terdaftar"\n` +
          `• Otomatis kick tumbal lama\n` +
          `• Real-time SMS & Voice detection\n` +
          `• Sequential processing per slot\n\n` +
          `🎯 <b>Filter:</b> Slot kosong dengan add_chances = 2\n\n` +
          `🚀 <b>Siap memulai?</b>`;

        try {
          await bot.editMessageText(content, {
            chat_id: chatId,
            message_id: message.message_id,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } catch (error) {
          if (!error.message.includes('message is not modified')) {
            await bot.sendMessage(chatId, content, {
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard: keyboard }
            });
          }
        }

        await bot.answerCallbackQuery(id, { text: '🧠 Smart Add-Kick System', show_alert: false });
        
      } else if (data === 'addkick_begin') {
        addKickStates.set(chatId, { step: 'input_pengelola' });
        
        const inputMsg = await bot.sendMessage(chatId,
          `📱 <b>INPUT NOMOR PENGELOLA</b>\n\n` +
          `Masukkan nomor HP pengelola (bisa multiple):\n\n` +
          `💡 <b>Format:</b>\n` +
          `• Single: 081234567890\n` +
          `• Multiple (satu per baris):\n` +
          `  081234567890\n` +
          `  081234567891\n\n` +
          `🧠 <b>Smart System:</b> Otomatis cek dan kick tumbal lama\n\n` +
          `💡 Ketik "exit" untuk batal`,
          { parse_mode: 'HTML' }
        );
        
        const state = addKickStates.get(chatId);
        state.inputMessageId = inputMsg.message_id;
        addKickStates.set(chatId, state);
        
        await bot.answerCallbackQuery(id, { text: '📱 Input nomor pengelola', show_alert: false });
        
      } else if (data === 'addkick_confirm') {
        const state = addKickStates.get(chatId);
        
        if (!state) {
          await bot.answerCallbackQuery(id, { text: '❌ Session expired', show_alert: true });
          return;
        }
        
        try {
          await bot.deleteMessage(chatId, message.message_id);
        } catch (e) {}
        
        await bot.answerCallbackQuery(id, { text: '🚀 Memulai smart processing...', show_alert: false });
        
        await processSmartAddKick(state.nomor_pengelola_list, state.nomor_tumbal, chatId, bot);
        
        addKickStates.delete(chatId);
      }
      
    } catch (error) {
      console.error('❌ Callback error:', error);
      await bot.answerCallbackQuery(id, { text: '❌ Error occurred', show_alert: true });
    }
  });

  // Handle text input
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    
    if (!text || text.startsWith('/')) return;
    
    const state = addKickStates.get(chatId);
    if (!state) return;
    
    try {
      if (text.toLowerCase() === 'exit') {
        if (state.inputMessageId) {
          try {
            await bot.deleteMessage(chatId, state.inputMessageId);
          } catch (e) {}
        }
        addKickStates.delete(chatId);
        await bot.deleteMessage(chatId, msg.message_id);
        return;
      }

      if (state.step === 'input_pengelola') {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        const validNumbers = [];
        
        for (const line of lines) {
          const cleanNumber = line.replace(/\D/g, '');
          if (cleanNumber.length >= 10 && cleanNumber.length <= 15) {
            validNumbers.push(cleanNumber);
          }
        }
        
        const uniqueNumbers = [...new Set(validNumbers)];
        
        if (uniqueNumbers.length === 0) {
          await bot.sendMessage(chatId, 
            `❌ <b>Tidak ada nomor yang valid!</b>\n\nCoba lagi atau ketik "exit"`,
            { parse_mode: 'HTML' }
          );
          await bot.deleteMessage(chatId, msg.message_id);
          return;
        }
        
        if (state.inputMessageId) {
          try {
            await bot.deleteMessage(chatId, state.inputMessageId);
          } catch (e) {}
        }
        try {
          await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {}
        
        state.step = 'input_tumbal';
        state.nomor_pengelola_list = uniqueNumbers;
        addKickStates.set(chatId, state);
        
        const inputMsg = await bot.sendMessage(chatId,
          `👤 <b>INPUT NOMOR TUMBAL</b>\n\n` +
          `Masukkan nomor HP untuk tumbal:\n\n` +
          `💡 <b>Contoh:</b> 083821447274\n` +
          `🧠 <b>Smart System:</b> Akan otomatis kick jika tumbal sudah ada di slot lain\n\n` +
          `💡 Ketik "exit" untuk batal`,
          { parse_mode: 'HTML' }
        );
        
        const currentState = addKickStates.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        addKickStates.set(chatId, currentState);
        
      } else if (state.step === 'input_tumbal') {
        const cleanNumber = text.replace(/\D/g, '');
        
        if (cleanNumber.length < 10 || cleanNumber.length > 15) {
          await bot.sendMessage(chatId,
            `❌ <b>Format nomor tumbal tidak valid!</b>\n\nCoba lagi atau ketik "exit"`,
            { parse_mode: 'HTML' }
          );
          await bot.deleteMessage(chatId, msg.message_id);
          return;
        }
        
        if (state.inputMessageId) {
          try {
            await bot.deleteMessage(chatId, state.inputMessageId);
          } catch (e) {}
        }
        try {
          await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {}
        
        const confirmText = 
          `🧠 <b>KONFIRMASI SMART ADD-KICK</b>\n\n` +
          `📱 <b>Pengelola:</b> ${state.nomor_pengelola_list.length} nomor\n` +
          `📝 <b>Daftar:</b>\n${state.nomor_pengelola_list.map((n, i) => `${i+1}. ${n}`).join('\n')}\n\n` +
          `👤 <b>Tumbal:</b> ${cleanNumber}\n\n` +
          `🔄 <b>Smart Flow:</b>\n` +
          `• Cek tumbal di semua slot\n` +
          `• Kick otomatis jika sudah ada\n` +
          `• Add ke slot kosong (add_chances=2)\n` +
          `• Sequential processing\n\n` +
          `⚡ <b>Keunggulan:</b>\n` +
          `• No conflict error\n` +
          `• Auto cleanup\n` +
          `• Real-time package detection\n\n` +
          `❓ <b>Lanjutkan?</b>`;
        
        const keyboard = [
          [
            { text: '❌ BATAL', callback_data: 'addkick_cancel' },
            { text: '✅ LANJUTKAN', callback_data: 'addkick_confirm' }
          ]
        ];
        
        state.nomor_tumbal = cleanNumber;
        addKickStates.set(chatId, state);
        
        await bot.sendMessage(chatId, confirmText, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });
      }
      
    } catch (error) {
      console.error('❌ Message handler error:', error);
      await bot.sendMessage(chatId, '❌ <b>Terjadi error!</b>', { parse_mode: 'HTML' });
      addKickStates.delete(chatId);
    }
  });
};

// Export functions
module.exports.processSmartAddKick = processSmartAddKick;
module.exports.smartAddKickCombo = smartAddKickCombo;
