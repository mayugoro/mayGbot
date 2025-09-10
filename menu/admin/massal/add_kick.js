const axios = require('axios');
require('dotenv').config({ quiet: true });

// ===== MODERN ADD-KICK V2.0 - OPTIMIZED & FAST =====
// Enhanced version with improved performance, concurrency, and error handling

// Import utilities
const { getSlotInfoAPI1Only } = require('../../admin/manage_akrab/cekslot1.js');
const { extractAndNormalizePhones } = require('../../../utils/normalize.js');

// Environment Configuration
const API_CONFIG = {
  base: process.env.API1,
  endpoints: {
    add: process.env.ADD1,
    kick: process.env.KICK1,
    check: process.env.CEKSLOT1
  },
  token: process.env.APIKEY1,
  timeout: 25000 // Reduced timeout for faster processing
};

const ADMIN_ID = process.env.ADMIN_ID;

// State management for modern UI
const modernAddKickStates = new Map();

// ===== TIMEZONE UTILITIES (UTC+7 INDONESIA) =====
const getIndonesianTime = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const indonesianTime = new Date(utc + (7 * 3600000));
  return indonesianTime;
};

const formatIndonesianTime = (date = null) => {
  const targetDate = date || getIndonesianTime();
  return targetDate.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// ===== MODERN PHONE NUMBER UTILITIES =====
const normalizePhone = (phone) => {
  if (!phone) return '';
  let clean = phone.replace(/\D/g, '');
  
  if (clean.startsWith('08')) {
    clean = '628' + clean.substring(2);
  } else if (clean.startsWith('8') && !clean.startsWith('62')) {
    clean = '62' + clean;
  }
  
  return clean;
};

// ===== MODERN API CLIENT =====
class ModernAPIClient {
  constructor(config) {
    this.config = config;
    this.stats = {
      success: 0,
      failed: 0,
      total: 0
    };
  }

  async makeRequest(endpoint, data, retries = 2) {
    const url = this.config.base + this.config.endpoints[endpoint];
    
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        // console.log(`🚀 API ${endpoint.toUpperCase()} - Attempt ${attempt}/${retries + 1}`);
        
        const formData = new URLSearchParams(data);
        const response = await axios.post(url, formData, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: this.config.timeout
        });

        this.stats.total++;
        
        if (response.data?.status === 'success' || response.data?.success === true) {
          this.stats.success++;
          return { success: true, data: response.data };
        } else {
          this.stats.failed++;
          return { success: false, error: response.data?.message || 'API response failed' };
        }
        
      } catch (error) {
        if (attempt === retries + 1) {
          this.stats.total++;
          this.stats.failed++;
          return { success: false, error: error.message };
        }
        // console.log(`⚠️ Retry attempt ${attempt} for ${endpoint}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Progressive delay
      }
    }
  }

  async addMember(parentPhone, memberPhone, slotId, memberName = 'TUMBAL', familyMemberId = '') {
    const data = {
      token: this.config.token,
      id_parent: normalizePhone(parentPhone),
      msisdn: normalizePhone(memberPhone),
      member_id: familyMemberId,
      slot_id: slotId,
      parent_name: 'XL',
      child_name: memberName
    };

    return await this.makeRequest('add', data);
  }

  async kickMember(parentPhone, memberId) {
    const data = {
      token: this.config.token,
      member_id: memberId,
      id_parent: normalizePhone(parentPhone)
    };

    return await this.makeRequest('kick', data);
  }

  getStats() {
    return { ...this.stats };
  }

  resetStats() {
    this.stats = { success: 0, failed: 0, total: 0 };
  }
}

// ===== MODERN SLOT MANAGER =====
class ModernSlotManager {
  static filterValidSlots(slots) {
    return slots.filter(slot => {
      const slotId = slot.slot_id;
      const alias = (slot.alias || '').trim();
      const msisdn = (slot.msisdn || '').trim();
      const addChances = parseInt(slot.add_chances) || 0;
      
      // More strict empty checks - must be truly empty
      const isEmptyAlias = alias === '' || alias === '-' || alias === null || alias === undefined;
      const isEmptyMsisdn = msisdn === '' || msisdn === '-' || msisdn === null || msisdn === undefined;
      
      // Additional check: ensure no registered member exists
      const hasNoRegisteredMember = !slot.family_member_id || slot.family_member_id === '' || slot.family_member_id === '-';
      
      // Valid slot criteria
      const isValidSlot = slotId && slotId !== '0' && slotId !== 0;
      const hasCorrectAddChances = addChances === 2; // Only add_chances = 2
      
      // Skip if add_chances is 0, 1, or 3
      const skipInvalidAddChances = addChances !== 0 && addChances !== 1 && addChances !== 3;
      
      // Final validation: slot must be completely empty
      const isCompletelyEmpty = isEmptyAlias && isEmptyMsisdn && hasNoRegisteredMember;
      
      // Debug logging for rejected slots
      if (!isCompletelyEmpty || !hasCorrectAddChances || !isValidSlot) {
        // console.log(`🔍 SLOT FILTERED OUT - Slot ${slotId}: alias='${alias}', msisdn='${msisdn}', add_chances=${addChances}, member_id='${slot.family_member_id}'`);
      }
      
      return isValidSlot && isCompletelyEmpty && hasCorrectAddChances && skipInvalidAddChances;
    });
  }

  static async getAvailableSlots(phone) {
    try {
      const result = await getSlotInfoAPI1Only(phone);
      if (!result.success) {
        return { success: false, error: result.error || 'Failed to get slot info' };
      }

      const validSlots = this.filterValidSlots(result.slots || []);
      return {
        success: true,
        slots: validSlots,
        totalSlots: (result.slots || []).length,
        validSlots: validSlots.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// ===== MODERN COMBO PROCESSOR =====
class ModernComboProcessor {
  constructor(apiClient) {
    this.api = apiClient;
    this.timings = {
      addWait: 60000,      // 1 minute wait after ADD (as requested)
      slotInterval: 15000  // 15s interval between slots (reduced for efficiency)
    };
  }

  async executeCombo(parentPhone, slot, tumbalPhone) {
    const startTime = Date.now();
    
    try {
      // Step 1: Get fresh slot info (CEKSLOT first)
      // console.log(`🎯 COMBO START - Slot ${slot.slot_id}: CEKSLOT → ADD → WAIT 60s → KICK`);
      
      const freshSlotResult = await getSlotInfoAPI1Only(parentPhone);
      if (!freshSlotResult.success) {
        return {
          success: false,
          step: 'CEKSLOT',
          error: `Failed to get fresh slot info: ${freshSlotResult.error}`,
          duration: Date.now() - startTime
        };
      }

      // Verify slot is still available and get updated family_member_id
      const currentSlot = freshSlotResult.slots.find(s => s.slot_id === slot.slot_id);
      if (!currentSlot) {
        return {
          success: false,
          step: 'CEKSLOT',
          error: `Slot ${slot.slot_id} not found in fresh data`,
          duration: Date.now() - startTime
        };
      }

      // Check if slot is still empty
      const isSlotEmpty = (!currentSlot.alias || currentSlot.alias === '-') && 
                         (!currentSlot.msisdn || currentSlot.msisdn === '-');
      
      if (!isSlotEmpty) {
        return {
          success: false,
          step: 'CEKSLOT',
          error: `Slot ${slot.slot_id} is no longer empty`,
          duration: Date.now() - startTime,
          slotStatus: {
            alias: currentSlot.alias,
            msisdn: currentSlot.msisdn
          }
        };
      }

      // Step 2: Add member with fresh slot data
      const addResult = await this.api.addMember(
        parentPhone,
        tumbalPhone,
        currentSlot.slot_id,
        'TUMBAL',
        currentSlot.family_member_id || ''
      );

      if (!addResult.success) {
        return {
          success: false,
          step: 'ADD',
          error: addResult.error,
          duration: Date.now() - startTime,
          slotData: currentSlot
        };
      }

      // Step 3: Wait 1 minute as requested
      // console.log(`⏳ WAIT ${this.timings.addWait/1000}s (1 minute) after ADD...`);
      await new Promise(resolve => setTimeout(resolve, this.timings.addWait));

      // Step 4: Get member ID for kick (fresh lookup after wait)
      let memberIdToKick = addResult.data?.member_id || addResult.data?.data?.member_id;
      
      if (!memberIdToKick) {
        // Get fresh slot info after ADD to find the added member
        const postAddSlotResult = await getSlotInfoAPI1Only(parentPhone);
        if (postAddSlotResult.success && postAddSlotResult.slots) {
          const targetSlot = postAddSlotResult.slots.find(s => 
            s.slot_id === currentSlot.slot_id && 
            s.msisdn === normalizePhone(tumbalPhone)
          );
          memberIdToKick = targetSlot?.family_member_id;
        }
      }

      if (!memberIdToKick) {
        return {
          success: false,
          step: 'KICK_PREP',
          error: 'Member ID not found for kick after ADD',
          duration: Date.now() - startTime,
          addSuccess: true,
          slotData: currentSlot
        };
      }

      // Step 5: Kick member
      const kickResult = await this.api.kickMember(parentPhone, memberIdToKick);

      return {
        success: kickResult.success,
        step: kickResult.success ? 'COMPLETE' : 'KICK',
        error: kickResult.success ? null : kickResult.error,
        duration: Date.now() - startTime,
        addSuccess: true,
        kickSuccess: kickResult.success,
        memberId: memberIdToKick,
        slotData: currentSlot
      };

    } catch (error) {
      return {
        success: false,
        step: 'EXCEPTION',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }
}

// ===== MODERN PROGRESS TRACKER =====
class ModernProgressTracker {
  constructor(totalManagers, bot, chatId) {
    this.totalManagers = totalManagers;
    this.bot = bot;
    this.chatId = chatId;
    this.startTime = getIndonesianTime();
    
    this.stats = {
      managers: {
        completed: 0,
        failed: 0,
        processing: 0
      },
      slots: {
        total: 0,
        success: 0,
        failed: 0
      },
      api: {
        success: 0,
        failed: 0
      }
    };
    
    this.managerStatus = new Map();
    this.statusMessageId = null;
  }

  updateManagerStatus(phone, status, slotData = {}) {
    this.managerStatus.set(phone, {
      status,
      ...slotData,
      lastUpdate: getIndonesianTime()
    });
  }

  async createStatusMessage() {
    const message = this.generateStatusText();
    const msg = await this.bot.sendMessage(this.chatId, message, { parse_mode: 'HTML' });
    this.statusMessageId = msg.message_id;
    return msg;
  }

  async updateStatusMessage() {
    if (!this.statusMessageId) return;
    
    try {
      const message = this.generateStatusText();
      await this.bot.editMessageText(message, {
        chat_id: this.chatId,
        message_id: this.statusMessageId,
        parse_mode: 'HTML'
      });
    } catch (error) {
      // Silent error handling for message editing
    }
  }

  generateStatusText() {
    const elapsed = Math.floor((getIndonesianTime() - this.startTime) / 1000);
    const progress = Math.floor((this.stats.managers.completed + this.stats.managers.failed) / this.totalManagers * 100);
    
    let text = `🚀 <b>ADD-KICK MODERN V2.0 - LIVE STATUS</b>\n`;
    text += `⏰ <i>${formatIndonesianTime()}</i>\n\n`;
    
    // Progress bar
    const progressBar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
    text += `📊 <b>Progress:</b> ${progress}% [${progressBar}]\n\n`;
    
    // Manager stats
    text += `👥 <b>MANAGERS:</b>\n`;
    text += `✅ Completed: ${this.stats.managers.completed}/${this.totalManagers}\n`;
    text += `❌ Failed: ${this.stats.managers.failed}/${this.totalManagers}\n`;
    text += `♻️ Processing: ${this.stats.managers.processing}\n\n`;
    
    // Slot stats
    text += `🎯 <b>SLOTS:</b>\n`;
    text += `✅ Success: ${this.stats.slots.success}\n`;
    text += `❌ Failed: ${this.stats.slots.failed}\n`;
    text += `📋 Total: ${this.stats.slots.total}\n\n`;
    
    // Performance metrics
    if (this.stats.slots.total > 0) {
      const efficiency = Math.floor((this.stats.slots.success / this.stats.slots.total) * 100);
      const avgTime = elapsed > 0 ? Math.floor(this.stats.slots.total / elapsed * 60) : 0;
      text += `⚡ <b>PERFORMANCE:</b>\n`;
      text += `📈 Efficiency: ${efficiency}%\n`;
      text += `🕐 Avg: ${avgTime} slots/min\n`;
      text += `⏱️ Elapsed: ${Math.floor(elapsed/60)}m ${elapsed%60}s\n\n`;
    }
    
    text += `🚀 <b>Modern Strategy:</b> Sequential CEKSLOT→ADD→WAIT 60s→KICK\n`;
    text += `⚡ <b>Timing:</b> CEKSLOT + ADD + 60s wait + KICK + 15s interval`;
    
    return text;
  }

  recordSlotResult(success) {
    this.stats.slots.total++;
    if (success) {
      this.stats.slots.success++;
      this.stats.api.success++;
    } else {
      this.stats.slots.failed++;
      this.stats.api.failed++;
    }
  }

  recordManagerResult(success) {
    this.stats.managers.processing--;
    if (success) {
      this.stats.managers.completed++;
    } else {
      this.stats.managers.failed++;
    }
  }

  startProcessingManager() {
    this.stats.managers.processing++;
  }
}

// ===== MODERN BATCH PROCESSOR =====
class ModernBatchProcessor {
  constructor(bot, chatId) {
    this.bot = bot;
    this.chatId = chatId;
    this.api = new ModernAPIClient(API_CONFIG);
    this.combo = new ModernComboProcessor(this.api);
  }

  // NEW: Parallel processing with one tumbal per manager
  async processParallelBatch(managerPhones, tumbalPhones) {
    const tracker = new ModernProgressTracker(managerPhones.length, this.bot, this.chatId);
    await tracker.createStatusMessage();

    // console.log(`🚀 PARALLEL BATCH START - ${managerPhones.length} managers, ${tumbalPhones.length} tumbals`);

    // Validate tumbal count matches manager count
    if (tumbalPhones.length !== managerPhones.length) {
      await this.bot.sendMessage(this.chatId, 
        `❌ <b>Error:</b> Jumlah tumbal (${tumbalPhones.length}) harus sama dengan jumlah pengelola (${managerPhones.length})`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Process all managers in parallel (serentak)
    const managerPromises = managerPhones.map(async (phone, index) => {
      const tumbalPhone = tumbalPhones[index];
      
      try {
        tracker.startProcessingManager();
        tracker.updateManagerStatus(phone, 'processing', { tumbal: tumbalPhone });
        await tracker.updateStatusMessage();

        // Get available slots for this manager
        const slotResult = await ModernSlotManager.getAvailableSlots(phone);
        
        if (!slotResult.success || slotResult.validSlots === 0) {
          tracker.updateManagerStatus(phone, 'failed', { 
            reason: 'no_valid_slots',
            tumbal: tumbalPhone 
          });
          tracker.recordManagerResult(false);
          await tracker.updateStatusMessage();
          return { phone, success: false, reason: 'no_valid_slots' };
        }

        // Process each valid slot sequentially for this manager
        const slots = slotResult.slots;
        let managerSuccess = 0;
        
        for (let j = 0; j < slots.length; j++) {
          const slot = slots[j];
          
          // Update progress for current slot
          tracker.updateManagerStatus(phone, 'processing', {
            currentSlot: j + 1,
            totalSlots: slots.length,
            successSlots: managerSuccess,
            tumbal: tumbalPhone
          });
          await tracker.updateStatusMessage();

          // Execute sequential combo: CEKSLOT → ADD → WAIT 60s → KICK
          const comboResult = await this.combo.executeCombo(phone, slot, tumbalPhone);
          
          // Record result
          tracker.recordSlotResult(comboResult.success);
          if (comboResult.success) managerSuccess++;

          // Update progress with step details
          const stepDetail = comboResult.step === 'COMPLETE' ? 'Complete' : 
                           comboResult.step === 'KICK' ? 'Kick Failed' :
                           comboResult.step === 'ADD' ? 'Add Failed' :
                           comboResult.step === 'CEKSLOT' ? 'CekSlot Failed' : 
                           'Processing';
          
          tracker.updateManagerStatus(phone, 'processing', {
            currentSlot: j + 1,
            totalSlots: slots.length,
            successSlots: managerSuccess,
            lastStep: stepDetail,
            tumbal: tumbalPhone
          });
          await tracker.updateStatusMessage();

          // Interval between slots (except last slot for this manager)
          if (j < slots.length - 1) {
            await new Promise(resolve => setTimeout(resolve, this.combo.timings.slotInterval));
          }
        }

        // Mark manager as completed
        tracker.updateManagerStatus(phone, 'completed', {
          totalSlots: slots.length,
          successSlots: managerSuccess,
          tumbal: tumbalPhone
        });
        tracker.recordManagerResult(true);
        await tracker.updateStatusMessage();

        return { phone, success: true, slotsProcessed: slots.length, successSlots: managerSuccess };

      } catch (error) {
        console.error(`❌ Manager ${phone} error:`, error);
        tracker.updateManagerStatus(phone, 'failed', { 
          reason: 'processing_error',
          tumbal: tumbalPhone,
          error: error.message 
        });
        tracker.recordManagerResult(false);
        await tracker.updateStatusMessage();
        return { phone, success: false, reason: 'processing_error', error: error.message };
      }
    });

    // Wait for all managers to complete (parallel execution)
    const results = await Promise.all(managerPromises);

    // Send final summary
    await this.sendParallelFinalSummary(tracker, managerPhones, tumbalPhones, results);
    return tracker.stats;
  }

  // ORIGINAL: Sequential processing (legacy method)
  async processBatch(managerPhones, tumbalPhone) {
    const tracker = new ModernProgressTracker(managerPhones.length, this.bot, this.chatId);
    await tracker.createStatusMessage();

    // console.log(`🚀 MODERN BATCH START - ${managerPhones.length} managers, tumbal: ${tumbalPhone}`);

    for (let i = 0; i < managerPhones.length; i++) {
      const phone = managerPhones[i];
      tracker.startProcessingManager();
      tracker.updateManagerStatus(phone, 'processing');
      await tracker.updateStatusMessage();

      try {
        // Step 1: Get available slots for this manager
        const slotResult = await ModernSlotManager.getAvailableSlots(phone);
        
        if (!slotResult.success || slotResult.validSlots === 0) {
          tracker.updateManagerStatus(phone, 'failed', { reason: 'no_valid_slots' });
          tracker.recordManagerResult(false);
          await tracker.updateStatusMessage();
          continue;
        }

        // Process each valid slot sequentially (CEKSLOT → ADD → WAIT 1min → KICK)
        const slots = slotResult.slots;
        let managerSuccess = 0;
        
        for (let j = 0; j < slots.length; j++) {
          const slot = slots[j];
          
          // Update progress for current slot
          tracker.updateManagerStatus(phone, 'processing', {
            currentSlot: j + 1,
            totalSlots: slots.length,
            successSlots: managerSuccess
          });
          await tracker.updateStatusMessage();

          // Execute sequential combo: CEKSLOT → ADD → WAIT 60s → KICK
          const comboResult = await this.combo.executeCombo(phone, slot, tumbalPhone);
          
          // Record result
          tracker.recordSlotResult(comboResult.success);
          if (comboResult.success) managerSuccess++;

          // Update progress with step details
          const stepDetail = comboResult.step === 'COMPLETE' ? 'Complete' : 
                           comboResult.step === 'KICK' ? 'Kick Failed' :
                           comboResult.step === 'ADD' ? 'Add Failed' :
                           comboResult.step === 'CEKSLOT' ? 'CekSlot Failed' : 
                           'Processing';
          
          tracker.updateManagerStatus(phone, 'processing', {
            currentSlot: j + 1,
            totalSlots: slots.length,
            successSlots: managerSuccess,
            lastStep: stepDetail
          });
          await tracker.updateStatusMessage();

          // Interval between slots (except last slot for this manager)
          if (j < slots.length - 1) {
            await new Promise(resolve => setTimeout(resolve, this.combo.timings.slotInterval));
          }
        }

        // Mark manager as completed
        tracker.updateManagerStatus(phone, 'completed', {
          totalSlots: slots.length,
          successSlots: managerSuccess
        });
        tracker.recordManagerResult(true);

      } catch (error) {
        console.error(`❌ Manager ${phone} error:`, error);
        tracker.updateManagerStatus(phone, 'failed', { reason: 'processing_error' });
        tracker.recordManagerResult(false);
      }

      await tracker.updateStatusMessage();
    }

    // Send final summary
    await this.sendFinalSummary(tracker, tumbalPhone);
    return tracker.stats;
  }

  async sendParallelFinalSummary(tracker, managerPhones, tumbalPhones, results) {
    const endTime = getIndonesianTime();
    const totalTime = Math.floor((endTime - tracker.startTime) / 1000);
    const apiStats = this.api.getStats();

    let summary = `📊 <b>PARALLEL ADD-KICK V2.0 - FINAL SUMMARY</b>\n\n`;
    summary += `⏰ <b>Completed:</b> ${formatIndonesianTime(endTime)}\n`;
    summary += `🕐 <b>Duration:</b> ${Math.floor(totalTime/60)}m ${totalTime%60}s\n\n`;
    
    summary += `👥 <b>MANAGERS PROCESSED:</b>\n`;
    summary += `✅ Success: ${tracker.stats.managers.completed}/${tracker.totalManagers}\n`;
    summary += `❌ Failed: ${tracker.stats.managers.failed}/${tracker.totalManagers}\n\n`;
    
    summary += `🎯 <b>COMBO RESULTS:</b>\n`;
    summary += `✅ Success: ${tracker.stats.slots.success}\n`;
    summary += `❌ Failed: ${tracker.stats.slots.failed}\n`;
    summary += `📋 Total Slots: ${tracker.stats.slots.total}\n\n`;
    
    if (tracker.stats.slots.total > 0) {
      const efficiency = Math.floor((tracker.stats.slots.success / tracker.stats.slots.total) * 100);
      const slotsPerMin = totalTime > 0 ? Math.floor(tracker.stats.slots.total / totalTime * 60) : 0;
      summary += `📈 <b>PERFORMANCE:</b>\n`;
      summary += `⚡ Efficiency: ${efficiency}%\n`;
      summary += `🚀 Speed: ${slotsPerMin} slots/min\n`;
      summary += `⏱️ Avg per slot: ${Math.floor(totalTime / tracker.stats.slots.total)}s\n\n`;
    }
    
    summary += `📡 <b>API STATISTICS:</b>\n`;
    summary += `✅ API Success: ${apiStats.success}\n`;
    summary += `❌ API Failed: ${apiStats.failed}\n`;
    summary += `📊 API Total: ${apiStats.total}\n\n`;
    
    summary += `👤 <b>Tumbal Mapping:</b>\n`;
    managerPhones.forEach((manager, index) => {
      const result = results.find(r => r.phone === manager);
      const status = result?.success ? '✅' : '❌';
      summary += `${status} ${manager} → ${tumbalPhones[index]}\n`;
    });
    
    summary += `\n🚀 <b>Strategy:</b> Parallel Modern (1 tumbal per manager)\n`;
    summary += `⚡ <b>Advantages:</b> Concurrent processing + dedicated tumbals + faster completion`;

    await this.bot.sendMessage(this.chatId, summary, { parse_mode: 'HTML' });
  }

  async sendFinalSummary(tracker, tumbalPhone) {
    const endTime = getIndonesianTime();
    const totalTime = Math.floor((endTime - tracker.startTime) / 1000);
    const apiStats = this.api.getStats();

    let summary = `📊 <b>MODERN ADD-KICK V2.0 - FINAL SUMMARY</b>\n\n`;
    summary += `⏰ <b>Completed:</b> ${formatIndonesianTime(endTime)}\n`;
    summary += `🕐 <b>Duration:</b> ${Math.floor(totalTime/60)}m ${totalTime%60}s\n\n`;
    
    summary += `👥 <b>MANAGERS PROCESSED:</b>\n`;
    summary += `✅ Success: ${tracker.stats.managers.completed}/${tracker.totalManagers}\n`;
    summary += `❌ Failed: ${tracker.stats.managers.failed}/${tracker.totalManagers}\n\n`;
    
    summary += `🎯 <b>COMBO RESULTS:</b>\n`;
    summary += `✅ Success: ${tracker.stats.slots.success}\n`;
    summary += `❌ Failed: ${tracker.stats.slots.failed}\n`;
    summary += `📋 Total Slots: ${tracker.stats.slots.total}\n\n`;
    
    if (tracker.stats.slots.total > 0) {
      const efficiency = Math.floor((tracker.stats.slots.success / tracker.stats.slots.total) * 100);
      const slotsPerMin = totalTime > 0 ? Math.floor(tracker.stats.slots.total / totalTime * 60) : 0;
      summary += `📈 <b>PERFORMANCE:</b>\n`;
      summary += `⚡ Efficiency: ${efficiency}%\n`;
      summary += `🚀 Speed: ${slotsPerMin} slots/min\n`;
      summary += `⏱️ Avg per slot: ${Math.floor(totalTime / tracker.stats.slots.total)}s\n\n`;
    }
    
    summary += `📡 <b>API STATISTICS:</b>\n`;
    summary += `✅ API Success: ${apiStats.success}\n`;
    summary += `❌ API Failed: ${apiStats.failed}\n`;
    summary += `📊 API Total: ${apiStats.total}\n\n`;
    
    summary += `👤 <b>Tumbal Used:</b> ${tumbalPhone}\n`;
    summary += `🚀 <b>Strategy:</b> Sequential Modern (CEKSLOT→ADD→WAIT 60s→KICK)\n`;
    summary += `⚡ <b>Improvements:</b> Fresh validation + 60s wait + sequential reliability`;

    await this.bot.sendMessage(this.chatId, summary, { parse_mode: 'HTML' });
  }
}

// ===== MODERN UI HANDLER =====
const initModernAddKick = (bot) => {
  // Handle modern add-kick callbacks
  bot.on('callback_query', async (query) => {
    const { data, message, id, from } = query;
    const chatId = message?.chat?.id;
    
    if (!chatId) return;
    
    try {
      console.log(`🐛 DEBUG: Callback received: ${data}`);
      
      if (data === 'modern_addkick_start') {
        console.log('🚀 Processing modern_addkick_start callback');
        
        const keyboard = [
          [{ text: '🚀 START MODERN ADD-KICK', callback_data: 'modern_addkick_begin' }],
          [{ text: '⚡ START PARALLEL ADD-KICK', callback_data: 'modern_addkick_parallel' }],
          [{ text: '🔙 BACK TO MASSAL', callback_data: 'menu_massal' }]
        ];
        
        const content = 
          `🚀 <b>ADD-KICK MODERN V2.0 - NEXT GENERATION</b>\n\n` +
          `✨ <b>PILIHAN MODE:</b>\n` +
          `🔸 <b>Sequential:</b> 1 tumbal untuk semua pengelola (antri)\n` +
          `🔸 <b>Parallel:</b> 1 tumbal per pengelola (serentak)\n\n` +
          `✨ <b>NEW FEATURES:</b>\n` +
          `• Optimized API timing (60s wait)\n` +
          `• Real-time progress tracking\n` +
          `• Advanced retry logic\n` +
          `• Performance metrics\n` +
          `• Better error handling\n` +
          `• Smart slot filtering\n\n` +
          `⚡ <b>PARALLEL MODE ADVANTAGES:</b>\n` +
          `• Each manager gets dedicated tumbal\n` +
          `• All managers process simultaneously\n` +
          `• Same tumbal used for all slots per manager\n` +
          `• Faster completion time\n` +
          `• No waiting in queue\n\n` +
          `🎯 <b>SMART FILTERING (ENHANCED):</b>\n` +
          `• Only slots with add_chances = 2\n` +
          `• Empty alias and MSISDN required\n` +
          `• Valid slot_id (non-zero)\n` +
          `• No registered members (family_member_id empty)\n` +
          `• Skip slots with add_chances 0, 1, atau 3\n` +
          `• Strict empty slot validation\n` +
          `• Fresh data validation\n\n` +
          `📊 <b>LIVE MONITORING:</b>\n` +
          `• Real-time progress bar\n` +
          `• Success/failure rates\n` +
          `• Processing speed metrics\n` +
          `• Time estimation\n\n` +
          `🚀 <b>Ready to choose your processing mode?</b>`;

        await bot.editMessageText(content, {
          chat_id: chatId,
          message_id: message.message_id,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });

        await bot.answerCallbackQuery(id);
        return;

      } else if (data === 'modern_addkick_parallel') {
        modernAddKickStates.set(chatId, { 
          step: 'input_managers_parallel', 
          menuMessageId: message.message_id,
          mode: 'parallel'
        });
        
        const inputMsg = await bot.sendMessage(chatId,
          `⚡ <b>PARALLEL ADD-KICK V2.0 - INPUT MANAGERS</b>\n\n` +
          `📞 <b>ENTER MANAGER PHONE NUMBERS</b>\n\n` +
          `💡 <b>Format Options:</b>\n` +
          `• Single: 081234567890\n` +
          `• Multiple (one per line):\n` +
          `  081234567890\n` +
          `  081234567891\n` +
          `  081234567892\n\n` +
          `⚡ <b>Parallel Processing Features:</b>\n` +
          `• Each manager gets dedicated tumbal\n` +
          `• All managers process simultaneously\n` +
          `• Real-time concurrent progress tracking\n` +
          `• Faster completion time\n\n` +
          `⚠️ <b>Requirements:</b>\n` +
          `• All numbers must be logged in\n` +
          `• Valid Indonesian phone format\n` +
          `• Minimum 10 digits\n\n` +
          `💡 Type "exit" to cancel`,
          { parse_mode: 'HTML' }
        );
        
        const currentState = modernAddKickStates.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        modernAddKickStates.set(chatId, currentState);
        
        await bot.answerCallbackQuery(id);
        return;

      } else if (data === 'modern_addkick_begin') {
        modernAddKickStates.set(chatId, { 
          step: 'input_managers', 
          menuMessageId: message.message_id 
        });
        
        const inputMsg = await bot.sendMessage(chatId,
          `🚀 <b>MODERN ADD-KICK V2.0 - INPUT MANAGERS</b>\n\n` +
          `📞 <b>ENTER MANAGER PHONE NUMBERS</b>\n\n` +
          `💡 <b>Format Options:</b>\n` +
          `• Single: 081234567890\n` +
          `• Multiple (one per line):\n` +
          `  081234567890\n` +
          `  081234567891\n` +
          `  081234567892\n\n` +
          `🚀 <b>Modern Processing:</b>\n` +
          `• Smart slot detection (add_chances = 2)\n` +
          `• Optimized API timing (25s wait)\n` +
          `• Real-time progress tracking\n` +
          `• Advanced error recovery\n\n` +
          `⚠️ <b>Requirements:</b>\n` +
          `• All numbers must be logged in\n` +
          `• Valid Indonesian phone format\n` +
          `• Minimum 10 digits\n\n` +
          `💡 Type "exit" to cancel`,
          { parse_mode: 'HTML' }
        );
        
        const currentState = modernAddKickStates.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        modernAddKickStates.set(chatId, currentState);
        
        await bot.answerCallbackQuery(id);
        return;

      } else if (data === 'modern_addkick_cancel') {
        modernAddKickStates.delete(chatId);
        await bot.editMessageText(
          `❌ <b>Modern Add-Kick Cancelled</b>\n\nUse /addkick to start again.`,
          {
            chat_id: chatId,
            message_id: message.message_id,
            parse_mode: 'HTML'
          }
        );
        await bot.answerCallbackQuery(id);
        return;
      }

      // Handle modern confirmation callbacks
      else if (data === 'modern_addkick_confirm_parallel' && chatId) {
        const state = modernAddKickStates.get(chatId);
        
        if (!state) return;
        
        try {
          // Delete confirmation message
          try {
            await bot.deleteMessage(chatId, message.message_id);
          } catch (e) {}
          
          // Start parallel batch processing
          const processor = new ModernBatchProcessor(bot, chatId);
          await processor.processParallelBatch(state.managerPhones, state.tumbalPhones);
          
          // Clean up state
          modernAddKickStates.delete(chatId);
          
        } catch (error) {
          await bot.sendMessage(chatId, '❌ <b>Parallel processing error!</b>', { parse_mode: 'HTML' });
          modernAddKickStates.delete(chatId);
        }
        
        await bot.answerCallbackQuery(id);
        return;
      } else if (data === 'modern_addkick_confirm' && chatId) {
        const state = modernAddKickStates.get(chatId);
        
        if (!state) return;
        
        try {
          // Delete confirmation message
          try {
            await bot.deleteMessage(chatId, message.message_id);
          } catch (e) {}
          
          // Start sequential batch processing
          const processor = new ModernBatchProcessor(bot, chatId);
          await processor.processBatch(state.managerPhones, state.tumbalPhone);
          
          // Clean up state
          modernAddKickStates.delete(chatId);
          
        } catch (error) {
          await bot.sendMessage(chatId, '❌ <b>Modern processing error!</b>', { parse_mode: 'HTML' });
          modernAddKickStates.delete(chatId);
        }
        
        await bot.answerCallbackQuery(id);
        return;
      }
      
    } catch (error) {
      await bot.answerCallbackQuery(id, { text: '❌ Error occurred, please try again!', show_alert: true });
    }
  });

  // Handle modern add-kick text input
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    
    if (!text || text.startsWith('/')) return;
    
    const state = modernAddKickStates.get(chatId);
    if (!state) return;
    
    try {
      // Check for exit/cancel
      if (['exit', 'EXIT', 'Exit'].includes(text)) {
        if (state.inputMessageId) {
          try {
            await bot.deleteMessage(chatId, state.inputMessageId);
          } catch (e) {}
        }
        modernAddKickStates.delete(chatId);
        await bot.deleteMessage(chatId, msg.message_id);
        return;
      }

      if (state.step === 'input_managers' || state.step === 'input_managers_parallel') {
        // Parse and validate manager phones
        const phones = extractAndNormalizePhones(text);
        
        if (phones.length === 0) {
          await bot.sendMessage(chatId, 
            `❌ <b>No valid phone numbers found!</b>\n\n` +
            `Requirements: 10-15 digits per line.\n` +
            `Try again or type "exit" to cancel.`,
            { parse_mode: 'HTML' }
          );
          await bot.deleteMessage(chatId, msg.message_id);
          return;
        }
        
        // Remove duplicates
        const uniquePhones = [...new Set(phones)];
        
        // Clean up input messages
        if (state.inputMessageId) {
          try {
            await bot.deleteMessage(chatId, state.inputMessageId);
          } catch (e) {}
        }
        try {
          await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {}
        
        // Determine next step based on mode
        if (state.mode === 'parallel') {
          // Move to multiple tumbal input for parallel mode
          state.step = 'input_tumbals_parallel';
          state.managerPhones = uniquePhones;
          modernAddKickStates.set(chatId, state);
          
          const inputMsg = await bot.sendMessage(chatId,
            `👥 <b>ENTER TUMBAL PHONE NUMBERS (PARALLEL MODE)</b>\n\n` +
            `📝 <b>Managers Found:</b> ${uniquePhones.length} unique numbers\n\n` +
            `⚡ <b>PARALLEL REQUIREMENT:</b> Enter ${uniquePhones.length} tumbal numbers\n` +
            `(One tumbal per manager for simultaneous processing)\n\n` +
            `💡 <b>Format (one per line):</b>\n` +
            `083821447274\n` +
            `083821447275\n` +
            `083821447276\n\n` +
            `⚠️ <b>Important:</b>\n` +
            `• Number of tumbals must match managers (${uniquePhones.length})\n` +
            `• Each line = one tumbal number\n` +
            `• All will be processed simultaneously\n\n` +
            `💡 Type "exit" to cancel`,
            { parse_mode: 'HTML' }
          );
          
          state.inputMessageId = inputMsg.message_id;
          modernAddKickStates.set(chatId, state);
        } else {
          // Move to single tumbal input for sequential mode
          state.step = 'input_tumbal';
          state.managerPhones = uniquePhones;
          modernAddKickStates.set(chatId, state);
          
          const inputMsg = await bot.sendMessage(chatId,
            `👤 <b>ENTER TUMBAL PHONE NUMBER</b>\n\n` +
            `📝 <b>Managers Found:</b> ${uniquePhones.length} unique numbers\n\n` +
            `💡 <b>Tumbal Example:</b> <code>083821447274</code>\n` +
            `⚠️ <b>This number will be added and kicked repeatedly</b>\n\n` +
            `🚀 <b>Modern Processing Ready:</b>\n` +
            `• Sequential CEKSLOT→ADD→WAIT 60s→KICK timing\n` +
            `• Fresh slot validation mechanisms\n` +
            `• Live progress tracking\n\n` +
            `💡 Type "exit" to cancel`,
            { parse_mode: 'HTML' }
          );
          
          state.inputMessageId = inputMsg.message_id;
          modernAddKickStates.set(chatId, state);
        }

      } else if (state.step === 'input_tumbals_parallel') {
        // Parse and validate tumbal phones for parallel mode
        const tumbalPhones = extractAndNormalizePhones(text);
        
        if (tumbalPhones.length !== state.managerPhones.length) {
          await bot.sendMessage(chatId,
            `❌ <b>Mismatch in tumbal count!</b>\n\n` +
            `Expected: ${state.managerPhones.length} tumbals\n` +
            `Received: ${tumbalPhones.length} tumbals\n\n` +
            `Please provide exactly ${state.managerPhones.length} tumbal numbers.`,
            { parse_mode: 'HTML' }
          );
          await bot.deleteMessage(chatId, msg.message_id);
          return;
        }
        
        // Clean up input messages
        if (state.inputMessageId) {
          try {
            await bot.deleteMessage(chatId, state.inputMessageId);
          } catch (e) {}
        }
        try {
          await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {}
        
        // Show parallel confirmation
        const confirmText = 
          `⚡ <b>PARALLEL ADD-KICK V2.0 - CONFIRMATION</b>\n\n` +
          `👥 <b>Manager Phones:</b> ${state.managerPhones.length} numbers\n` +
          `👤 <b>Tumbal Phones:</b> ${tumbalPhones.length} numbers\n\n` +
          `📋 <b>Manager → Tumbal Mapping:</b>\n` +
          state.managerPhones.map((manager, i) => `${i+1}. ${manager} → ${tumbalPhones[i]}`).join('\n') + '\n\n' +
          `⚡ <b>PARALLEL STRATEGY V2.0:</b>\n` +
          `• Each manager gets dedicated tumbal\n` +
          `• All managers process simultaneously\n` +
          `• Sequential timing per manager: CEKSLOT→ADD→WAIT 60s→KICK\n` +
          `• Real-time concurrent progress tracking\n` +
          `• Smart error recovery per manager\n` +
          `• Performance metrics monitoring\n\n` +
          `🚀 <b>PARALLEL ADVANTAGES:</b>\n` +
          `• No waiting in queue\n` +
          `• Faster completion time\n` +
          `• Dedicated tumbal per manager\n` +
          `• Same tumbal for all slots per manager\n` +
          `• Independent processing\n\n` +
          `🎯 <b>FILTERING CRITERIA (ENHANCED):</b>\n` +
          `• Valid slot_id (non-zero)\n` +
          `• Empty alias and MSISDN\n` +
          `• add_chances = 2 only (skip 0,1,3)\n` +
          `• No registered members (empty family_member_id)\n` +
          `• Strict slot validation\n` +
          `• Fresh data validation\n\n` +
          `📊 <b>ESTIMATED TIME:</b>\n` +
          `• ~75 seconds per slot (concurrent)\n` +
          `• Real-time progress updates\n` +
          `• Live efficiency monitoring\n\n` +
          `❓ <b>Proceed with parallel processing?</b>`;
        
        const keyboard = [
          [
            { text: '❌ CANCEL', callback_data: 'modern_addkick_cancel' },
            { text: '⚡ START PARALLEL', callback_data: 'modern_addkick_confirm_parallel' }
          ]
        ];
        
        state.tumbalPhones = tumbalPhones;
        modernAddKickStates.set(chatId, state);
        
        await bot.sendMessage(chatId, confirmText, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });

      } else if (state.step === 'input_managers') {
        // Parse and validate manager phones
        const phones = extractAndNormalizePhones(text);
        
        if (phones.length === 0) {
          await bot.sendMessage(chatId, 
            `❌ <b>No valid phone numbers found!</b>\n\n` +
            `Requirements: 10-15 digits per line.\n` +
            `Try again or type "exit" to cancel.`,
            { parse_mode: 'HTML' }
          );
          await bot.deleteMessage(chatId, msg.message_id);
          return;
        }
        
        // Remove duplicates
        const uniquePhones = [...new Set(phones)];
        
        // Clean up input messages
        if (state.inputMessageId) {
          try {
            await bot.deleteMessage(chatId, state.inputMessageId);
          } catch (e) {}
        }
        try {
          await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {}
        
        // Move to tumbal input
        state.step = 'input_tumbal';
        state.managerPhones = uniquePhones;
        modernAddKickStates.set(chatId, state);
        
        const inputMsg = await bot.sendMessage(chatId,
          `👤 <b>ENTER TUMBAL PHONE NUMBER</b>\n\n` +
          `📝 <b>Managers Found:</b> ${uniquePhones.length} unique numbers\n\n` +
          `💡 <b>Tumbal Example:</b> <code>083821447274</code>\n` +
          `⚠️ <b>This number will be added and kicked repeatedly</b>\n\n` +
          `🚀 <b>Modern Processing Ready:</b>\n` +
          `• Sequential CEKSLOT→ADD→WAIT 60s→KICK timing\n` +
          `• Fresh slot validation mechanisms\n` +
          `• Live progress tracking\n\n` +
          `💡 Type "exit" to cancel`,
          { parse_mode: 'HTML' }
        );
        
        state.inputMessageId = inputMsg.message_id;
        modernAddKickStates.set(chatId, state);

      } else if (state.step === 'input_tumbal') {
        // Validate tumbal phone
        const tumbalPhones = extractAndNormalizePhones(text);
        
        if (tumbalPhones.length !== 1) {
          await bot.sendMessage(chatId,
            `❌ <b>Please provide exactly one tumbal number!</b>\n\n` +
            `Format: 10-15 digits.\n` +
            `Try again or type "exit" to cancel.`,
            { parse_mode: 'HTML' }
          );
          await bot.deleteMessage(chatId, msg.message_id);
          return;
        }
        
        const tumbalPhone = tumbalPhones[0];
        
        // Clean up input messages
        if (state.inputMessageId) {
          try {
            await bot.deleteMessage(chatId, state.inputMessageId);
          } catch (e) {}
        }
        try {
          await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {}
        
        // Show modern confirmation
        const confirmText = 
          `🚀 <b>MODERN ADD-KICK V2.0 - CONFIRMATION</b>\n\n` +
          `👥 <b>Manager Phones:</b> ${state.managerPhones.length} numbers\n` +
          `📝 <b>List:</b>\n${state.managerPhones.map((p, i) => `${i+1}. ${p}`).join('\n')}\n\n` +
          `👤 <b>Tumbal Phone:</b> ${tumbalPhone}\n\n` +
          `🚀 <b>MODERN STRATEGY V2.0:</b>\n` +
          `• API1 Only (KHFY-Store)\n` +
          `• Sequential timing: CEKSLOT→ADD→WAIT 60s→KICK\n` +
          `• Fresh slot validation before each ADD\n` +
          `• Real-time progress tracking\n` +
          `• Smart error recovery\n` +
          `• Performance metrics monitoring\n\n` +
          `⚡ <b>PERFORMANCE IMPROVEMENTS:</b>\n` +
          `• Sequential reliability vs parallel chaos\n` +
          `• 1 minute wait ensures ADD completion\n` +
          `• Fresh CEKSLOT prevents slot conflicts\n` +
          `• Better member_id tracking\n\n` +
          `🎯 <b>FILTERING CRITERIA (ENHANCED):</b>\n` +
          `• Valid slot_id (non-zero)\n` +
          `• Empty alias and MSISDN\n` +
          `• add_chances = 2 only (skip 0,1,3)\n` +
          `• No registered members (empty family_member_id)\n` +
          `• Strict slot validation\n` +
          `• Fresh data validation\n\n` +
          `📊 <b>ESTIMATED TIME:</b>\n` +
          `• ~75 seconds per slot (CEKSLOT+ADD+60s+KICK)\n` +
          `• Real-time progress updates\n` +
          `• Live efficiency monitoring\n\n` +
          `❓ <b>Proceed with sequential modern processing?</b>`;
        
        const keyboard = [
          [
            { text: '❌ CANCEL', callback_data: 'modern_addkick_cancel' },
            { text: '🚀 START MODERN', callback_data: 'modern_addkick_confirm' }
          ]
        ];
        
        state.tumbalPhone = tumbalPhone;
        modernAddKickStates.set(chatId, state);
        
        await bot.sendMessage(chatId, confirmText, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });
      }
      
    } catch (error) {
      await bot.sendMessage(chatId, '❌ <b>Error occurred, please try again!</b>', { parse_mode: 'HTML' });
      modernAddKickStates.delete(chatId);
    }
  });
};

// ===== MODULE EXPORTS =====
module.exports = initModernAddKick;

// Export modern classes for external use
module.exports.ModernAPIClient = ModernAPIClient;
module.exports.ModernSlotManager = ModernSlotManager;
module.exports.ModernComboProcessor = ModernComboProcessor;
module.exports.ModernBatchProcessor = ModernBatchProcessor;
module.exports.ModernProgressTracker = ModernProgressTracker;
