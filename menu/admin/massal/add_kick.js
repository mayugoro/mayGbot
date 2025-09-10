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
        // console.log('🔧 API URL:', url);
        // console.log('📋 Request data:', {
        //   ...data,
        //   token: data.token ? data.token.substring(0, 10) + '...' : 'None',
        //   member_id: data.member_id ? data.member_id.substring(0, 20) + '...' : data.member_id
        // });
        
        const formData = new URLSearchParams(data);
        const response = await axios.post(url, formData, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: this.config.timeout
        });

        this.stats.total++;
        
        // CORRECTED: Check for both string and boolean status formats
        if (response.data?.status === 'success' || 
            response.data?.success === true || 
            response.data?.status === true) {  // ADD: Handle boolean true status
          this.stats.success++;
          // console.log(`✅ ${endpoint.toUpperCase()} API SUCCESS`);
          // console.log(`📋 Response:`, JSON.stringify(response.data, null, 2));
          return { success: true, data: response.data };
        } else {
          this.stats.failed++;
          // console.log(`❌ ${endpoint.toUpperCase()} API FAILED`);
          // console.log(`📋 Response:`, JSON.stringify(response.data, null, 2));
          return { success: false, error: response.data?.message || 'API response failed' };
        }
        
      } catch (error) {
        if (attempt === retries + 1) {
          this.stats.total++;
          this.stats.failed++;
          // console.log(`💥 ${endpoint.toUpperCase()} API EXCEPTION:`);
          // console.log(`📛 Error: ${error.message}`);
          if (error.response) {
            // console.log(`📋 Response Data:`, error.response.data);
          }
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
      member_id: familyMemberId,
      msisdn: normalizePhone(memberPhone),
      slot_id: slotId,
      alias: memberName,  // Use alias instead of parent_name/child_name
      parent_name: 'XL',
      child_name: 'XL'    // Match test_smart_add.js format exactly
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
    // console.log('\n🔍 FILTERING VALID SLOTS...');
    // console.log(`📊 Total slots received: ${slots.length}`);
    
    const validSlots = slots.filter(slot => {
      const slotId = slot.slot_id;
      const alias = (slot.alias || '').trim();
      const msisdn = (slot.msisdn || '').trim();
      const addChances = parseInt(slot.add_chances) || 0;
      
      // CORRECTED LOGIC: Match test_smart_add.js filtering logic exactly
      // Only check alias, msisdn, and add_chances - don't check family_member_id
      const isEmptyAlias = !alias || alias === '-';
      const isEmptyMsisdn = !msisdn || msisdn === '-';
      const hasValidAddChances = addChances > 0; // Allow any add_chances > 0
      
      // Valid slot criteria
      const isValidSlot = slotId && slotId !== '0' && slotId !== 0;
      
      // Final validation: slot must have empty alias/msisdn and valid add_chances
      const isAvailableSlot = isEmptyAlias && isEmptyMsisdn && hasValidAddChances;
      
      // Debug logging for all slots
      if (isAvailableSlot && isValidSlot) {
        // console.log(`✅ VALID SLOT - Slot ${slotId}: alias='${alias}', msisdn='${msisdn}', add_chances=${addChances}`);
      } else {
        // console.log(`🔍 SLOT FILTERED OUT - Slot ${slotId}: alias='${alias}', msisdn='${msisdn}', add_chances=${addChances}, valid_slot=${isValidSlot}, available=${isAvailableSlot}`);
      }
      
      return isValidSlot && isAvailableSlot;
    });
    
    // console.log(`📈 SLOT FILTERING RESULT:`);
    // console.log(`  🟢 Valid Slots: ${validSlots.length}`);
    // console.log(`  🔴 Filtered Out: ${slots.length - validSlots.length}`);
    // console.log(`  📊 Total Slots: ${slots.length}`);
    // console.log('-'.repeat(50));
    
    return validSlots;
  }

  static async getAvailableSlots(phone, maxRetries = 3) {
    // console.log(`🔄 CEKSLOT API with retry system (max ${maxRetries} attempts)`);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // console.log(`🚀 CEKSLOT Attempt ${attempt}/${maxRetries}...`);
        const startTime = Date.now();
        
        const result = await getSlotInfoAPI1Only(phone);
        const responseTime = Date.now() - startTime;
        
        if (result.success) {
          // console.log(`✅ CEKSLOT SUCCESS on attempt ${attempt} (${responseTime}ms)`);
          const validSlots = this.filterValidSlots(result.slots || []);
          return {
            success: true,
            slots: validSlots,
            totalSlots: (result.slots || []).length,
            validSlots: validSlots.length,
            attempts: attempt,
            responseTime
          };
        } else {
          // console.log(`❌ CEKSLOT FAILED on attempt ${attempt}: ${result.error}`);
          
          // If this is not the last attempt, wait before retry
          if (attempt < maxRetries) {
            const retryDelay = attempt * 2000; // Progressive delay: 2s, 4s, 6s
            // console.log(`⏳ Waiting ${retryDelay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
      } catch (error) {
        // console.log(`💥 CEKSLOT ERROR on attempt ${attempt}: ${error.message}`);
        
        // If this is not the last attempt, wait before retry
        if (attempt < maxRetries) {
          const retryDelay = attempt * 2000; // Progressive delay: 2s, 4s, 6s
          // console.log(`⏳ Waiting ${retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    // All attempts failed
    // console.log(`❌ CEKSLOT FAILED after ${maxRetries} attempts`);
    return { 
      success: false, 
      error: `CEKSLOT API failed after ${maxRetries} attempts`,
      attempts: maxRetries
    };
  }
}

// ===== MODERN COMBO PROCESSOR =====
class ModernComboProcessor {
  constructor(apiClient) {
    this.api = apiClient;
    this.timings = {
      addWait: 300000,     // 5 minutes wait after ADD (increased from 1 minute)
      slotInterval: 60000  // 1 minute interval between slots (increased from 15s)
    };
  }

  async executeCombo(parentPhone, slot, tumbalPhone, slotIndex = 0) {
    // console.log('\n🎯 EXECUTING MODERN COMBO (SMART ADD + KICK)...');
    // console.log(`📱 Parent: ${parentPhone}`);
    // console.log(`📱 Tumbal: ${tumbalPhone}`);
    // console.log(`🎰 Slot Index: ${slotIndex} (target slot for this iteration)`);
    // console.log(`⏰ Start Time: ${formatIndonesianTime()}`);
    // console.log('='.repeat(60));
    
    const startTime = Date.now();
    
    try {
      // SMART AUTO-GENERATION: Use Smart ADD logic with specific slot index
      // Step 1: Use Smart ADD to auto-generate parameters and add member to specific slot
      // console.log(`🚀 Step 1: SMART ADD - Auto-generating parameters for slot index ${slotIndex}...`);
      const smartAddResult = await smartAdd(parentPhone, tumbalPhone, 'TUMBAL', slotIndex);
      
      if (!smartAddResult.success) {
        // console.log('❌ SMART ADD FAILED - Cannot proceed with combo');
        // console.log(`💬 Error: ${smartAddResult.error}`);
        return {
          success: false,
          step: 'SMART_ADD',
          error: smartAddResult.error,
          duration: Date.now() - startTime,
          smartAddResult,
          slotIndex
        };
      }

      // console.log('✅ SMART ADD SUCCESS - Proceeding to wait phase...');
      // console.log(`🎯 Slot Used: ${smartAddResult.slotUsed} (index ${slotIndex})`);

      // Step 2: Wait 60 seconds after successful ADD (as requested)
      // console.log(`⏳ Step 2: WAITING ${this.timings.addWait/1000}s (1 minute) after ADD...`);
      const waitStart = Date.now();
      await new Promise(resolve => setTimeout(resolve, this.timings.addWait));
      const waitDuration = Date.now() - waitStart;
      // console.log(`✅ Wait completed in ${waitDuration}ms`);

      // Step 3: Get member ID for kick (get fresh slot data after ADD with retry)
      // console.log('🔍 Step 3: Getting fresh slot data for KICK preparation...');
      
      let postAddSlotResult = null;
      const maxRetries = 3;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // console.log(`🚀 Post-ADD CEKSLOT Attempt ${attempt}/${maxRetries}...`);
          postAddSlotResult = await getSlotInfoAPI1Only(parentPhone);
          
          if (postAddSlotResult.success) {
            // console.log(`✅ Post-ADD CEKSLOT SUCCESS on attempt ${attempt}`);
            break;
          } else {
            // console.log(`❌ Post-ADD CEKSLOT FAILED on attempt ${attempt}: ${postAddSlotResult.error}`);
            
            // If this is not the last attempt, wait before retry
            if (attempt < maxRetries) {
              const retryDelay = attempt * 1500; // Progressive delay: 1.5s, 3s, 4.5s
              // console.log(`⏳ Waiting ${retryDelay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
          }
        } catch (error) {
          // console.log(`💥 Post-ADD CEKSLOT ERROR on attempt ${attempt}: ${error.message}`);
          
          // If this is not the last attempt, wait before retry
          if (attempt < maxRetries) {
            const retryDelay = attempt * 1500; // Progressive delay: 1.5s, 3s, 4.5s
            // console.log(`⏳ Waiting ${retryDelay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
      }
      
      if (!postAddSlotResult || !postAddSlotResult.success) {
        // console.log(`❌ Post-ADD CEKSLOT failed after ${maxRetries} attempts`);
        // console.log(`💬 Error: ${postAddSlotResult?.error || 'Unknown error'}`);
        return {
          success: false,
          step: 'CEKSLOT_POST_ADD',
          error: `Failed to get fresh slot info for kick after ${maxRetries} attempts: ${postAddSlotResult?.error || 'Unknown error'}`,
          duration: Date.now() - startTime,
          addSuccess: true,
          slotIndex,
          attempts: maxRetries
        };
      }

      // Find the added tumbal member for kicking
      const normalizedTumbal = normalizePhone(tumbalPhone);
      const targetMember = postAddSlotResult.slots.find(slot => 
        slot.msisdn === normalizedTumbal && 
        slot.family_member_id && 
        slot.family_member_id !== '-'
      );

      if (!targetMember || !targetMember.family_member_id) {
        // console.log('❌ Target tumbal member not found for kick');
        // console.log(`🔍 Looking for: ${normalizedTumbal}`);
        const availableMembers = postAddSlotResult.slots.filter(s => s.family_member_id).map(s => ({
          alias: s.alias,
          msisdn: s.msisdn,
          slot: s.slot_id
        }));
        // console.log(`📋 Available members:`, availableMembers);
        return {
          success: false,
          step: 'KICK_PREP',
          error: 'Tumbal member not found for kick after ADD',
          duration: Date.now() - startTime,
          addSuccess: true,
          availableMembers,
          slotIndex
        };
      }

      // console.log('✅ Target tumbal member found for kick:');
      // console.log(`   📱 MSISDN: ${targetMember.msisdn}`);
      // console.log(`   👤 Alias: ${targetMember.alias}`);
      // console.log(`   🆔 Member ID: ${targetMember.family_member_id.substring(0, 30)}...`);
      // console.log(`   🎰 Slot: ${targetMember.slot_id}`);

      // Step 4: Execute Smart KICK
      // console.log('\n🚀 Step 4: EXECUTING SMART KICK...');
      const kickResult = await executeKickTumbal(parentPhone, targetMember.family_member_id);

      const totalDuration = Date.now() - startTime;
      
      if (kickResult.success) {
        // console.log('🎉 MODERN COMBO COMPLETED SUCCESSFULLY!');
        // console.log(`⏱️  Total Duration: ${totalDuration}ms`);
        // console.log(`   └── Smart ADD: ${smartAddResult.totalDuration}ms`);
        // console.log(`   └── Wait: ${waitDuration}ms`);
        // console.log(`   └── Kick: ${kickResult.duration}ms`);
        // console.log(`🎰 Slot Index ${slotIndex} processing complete!`);
      } else {
        // console.log('❌ MODERN COMBO FAILED AT KICK STEP');
        // console.log(`💬 Error: ${kickResult.error}`);
      }

      return {
        success: kickResult.success,
        step: kickResult.success ? 'COMPLETE' : 'KICK',
        error: kickResult.success ? null : kickResult.error,
        duration: totalDuration,
        addSuccess: true,
        kickSuccess: kickResult.success,
        slotUsed: smartAddResult.slotUsed,
        memberId: targetMember.family_member_id,
        slotIndex: slotIndex,
        slotData: {
          slot_id: smartAddResult.slotUsed,
          alias: targetMember.alias,
          msisdn: targetMember.msisdn
        }
      };

    } catch (error) {
      // console.log('💥 MODERN COMBO EXCEPTION:');
      // console.log(`📛 Error: ${error.message}`);
      return {
        success: false,
        step: 'EXCEPTION',
        error: error.message,
        duration: Date.now() - startTime,
        slotIndex
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
    
    text += `🚀 <b>Modern Strategy:</b> Sequential CEKSLOT→ADD→WAIT 5min→KICK\n`;
    text += `⚡ <b>Timing:</b> CEKSLOT + ADD + 5min wait + KICK + 1min interval`;
    
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
    // console.log('\n🚀 STARTING PARALLEL BATCH PROCESSING...');
    // console.log(`👥 Managers: ${managerPhones.length}`);
    // console.log(`📱 Tumbals: ${tumbalPhones.length}`);
    // console.log(`⏰ Start Time: ${formatIndonesianTime()}`);
    // console.log('='.repeat(60));
    
    const tracker = new ModernProgressTracker(managerPhones.length, this.bot, this.chatId);
    await tracker.createStatusMessage();

    // Validate tumbal count matches manager count
    if (tumbalPhones.length !== managerPhones.length) {
      // console.log('❌ VALIDATION FAILED: Tumbal count mismatch');
      // console.log(`Expected: ${managerPhones.length} tumbals`);
      // console.log(`Received: ${tumbalPhones.length} tumbals`);
      await this.bot.sendMessage(this.chatId, 
        `❌ <b>Error:</b> Jumlah tumbal (${tumbalPhones.length}) harus sama dengan jumlah pengelola (${managerPhones.length})`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // console.log('✅ VALIDATION PASSED: Tumbal count matches manager count');

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

        // SMART AUTO-GENERATION: Process available slots using Smart ADD logic
        const availableSlotCount = slotResult.validSlots;
        let managerSuccess = 0;
        
        // Process each available slot using Smart ADD (auto-parameter generation)
        for (let j = 0; j < availableSlotCount; j++) {
          
          // Update progress for current slot
          tracker.updateManagerStatus(phone, 'processing', {
            currentSlot: j + 1,
            totalSlots: availableSlotCount,
            successSlots: managerSuccess,
            tumbal: tumbalPhone
          });
          await tracker.updateStatusMessage();

          // Execute Smart Combo: Smart ADD → WAIT 5min → Smart KICK with specific slot index
          const comboResult = await this.combo.executeCombo(phone, null, tumbalPhone, j);
          
          // Record result
          tracker.recordSlotResult(comboResult.success);
          if (comboResult.success) managerSuccess++;

          // Update progress with step details
          const stepDetail = comboResult.step === 'COMPLETE' ? 'Complete' : 
                           comboResult.step === 'KICK' ? 'Kick Failed' :
                           comboResult.step === 'SMART_ADD' ? 'Smart ADD Failed' :
                           comboResult.step === 'CEKSLOT_POST_ADD' ? 'Post-ADD CekSlot Failed' : 
                           comboResult.step === 'KICK_PREP' ? 'Kick Prep Failed' :
                           'Processing';
          
          tracker.updateManagerStatus(phone, 'processing', {
            currentSlot: j + 1,
            totalSlots: availableSlotCount,
            successSlots: managerSuccess,
            lastStep: stepDetail,
            slotUsed: comboResult.slotUsed || 'Unknown',
            tumbal: tumbalPhone
          });
          await tracker.updateStatusMessage();

          // If Smart ADD failed, break the loop as no more slots might be available
          if (!comboResult.success && comboResult.step === 'SMART_ADD') {
            // console.log(`⚠️ Smart ADD failed for ${phone}, stopping slot processing`);
            break;
          }

          // Interval between slots (except last slot for this manager)
          if (j < availableSlotCount - 1) {
            await new Promise(resolve => setTimeout(resolve, this.combo.timings.slotInterval));
          }
        }

        // Mark manager as completed
        tracker.updateManagerStatus(phone, 'completed', {
          totalSlots: availableSlotCount,
          successSlots: managerSuccess,
          tumbal: tumbalPhone
        });
        tracker.recordManagerResult(true);
        await tracker.updateStatusMessage();

        return { phone, success: true, slotsProcessed: availableSlotCount, successSlots: managerSuccess };

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
    // console.log('\n🚀 STARTING SEQUENTIAL BATCH PROCESSING...');
    // console.log(`👥 Managers: ${managerPhones.length}`);
    // console.log(`📱 Tumbal: ${tumbalPhone}`);
    // console.log(`⏰ Start Time: ${formatIndonesianTime()}`);
    // console.log('='.repeat(60));
    
    const tracker = new ModernProgressTracker(managerPhones.length, this.bot, this.chatId);
    await tracker.createStatusMessage();

    for (let i = 0; i < managerPhones.length; i++) {
      const phone = managerPhones[i];
      // console.log(`\n📍 [${i + 1}/${managerPhones.length}] SEQUENTIAL PROCESSING: ${phone}`);
      
      tracker.startProcessingManager();
      tracker.updateManagerStatus(phone, 'processing');
      await tracker.updateStatusMessage();

      try {
        // SMART AUTO-GENERATION: Check if slots are available, but use Smart ADD logic
        // console.log(`🔍 Getting available slots for ${phone}...`);
        const slotResult = await ModernSlotManager.getAvailableSlots(phone);
        
        if (!slotResult.success || slotResult.validSlots === 0) {
          // console.log(`❌ No valid slots for ${phone}: ${slotResult.error || 'No slots available'}`);
          tracker.updateManagerStatus(phone, 'failed', { reason: 'no_valid_slots' });
          tracker.recordManagerResult(false);
          await tracker.updateStatusMessage();
          continue;
        }

        // console.log(`✅ Found ${slotResult.validSlots} valid slots for ${phone}`);

        // SMART PROCESSING: Process available slots using Smart ADD logic
        const availableSlotCount = slotResult.validSlots;
        let managerSuccess = 0;
        
        // console.log(`🎯 Processing ${availableSlotCount} slots for ${phone}...`);
        
        // Process each available slot using Smart ADD (auto-parameter generation)
        for (let j = 0; j < availableSlotCount; j++) {
          // console.log(`\n📍 [${phone}] Processing slot ${j + 1}/${availableSlotCount}...`);
          
          // Update progress for current slot
          tracker.updateManagerStatus(phone, 'processing', {
            currentSlot: j + 1,
            totalSlots: availableSlotCount,
            successSlots: managerSuccess
          });
          await tracker.updateStatusMessage();

          // Execute Smart Combo: Smart ADD → WAIT 5min → Smart KICK with specific slot index
          const comboResult = await this.combo.executeCombo(phone, null, tumbalPhone, j);
          
          // console.log(`📊 [${phone}] Slot ${j + 1} result: ${comboResult.success ? '✅ Success' : '❌ Failed'}`);
          if (!comboResult.success) {
            // console.log(`💬 Error: ${comboResult.error}`);
          }
          
          // Record result
          tracker.recordSlotResult(comboResult.success);
          if (comboResult.success) managerSuccess++;

          // Update progress with step details
          const stepDetail = comboResult.step === 'COMPLETE' ? 'Complete' : 
                           comboResult.step === 'KICK' ? 'Kick Failed' :
                           comboResult.step === 'SMART_ADD' ? 'Smart ADD Failed' :
                           comboResult.step === 'CEKSLOT_POST_ADD' ? 'Post-ADD CekSlot Failed' : 
                           comboResult.step === 'KICK_PREP' ? 'Kick Prep Failed' :
                           'Processing';
          
          tracker.updateManagerStatus(phone, 'processing', {
            currentSlot: j + 1,
            totalSlots: availableSlotCount,
            successSlots: managerSuccess,
            lastStep: stepDetail,
            slotUsed: comboResult.slotUsed || 'Unknown'
          });
          await tracker.updateStatusMessage();

          // If Smart ADD failed, break the loop as no more slots might be available
          if (!comboResult.success && comboResult.step === 'SMART_ADD') {
            // console.log(`⚠️ Smart ADD failed for ${phone}, stopping slot processing`);
            break;
          }

          // Interval between slots (except last slot for this manager)
          if (j < availableSlotCount - 1) {
            // console.log(`⏳ Waiting ${this.combo.timings.slotInterval}ms before next slot...`);
            await new Promise(resolve => setTimeout(resolve, this.combo.timings.slotInterval));
          }
        }

        // console.log(`🏁 [${phone}] Manager completed: ${managerSuccess}/${availableSlotCount} slots successful`);

        // Mark manager as completed
        tracker.updateManagerStatus(phone, 'completed', {
          totalSlots: availableSlotCount,
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

    // console.log('\n🎉 ALL SEQUENTIAL PROCESSING COMPLETED!');

    // Send final summary
    await this.sendFinalSummary(tracker, tumbalPhone);
    return tracker.stats;
  }

  async sendParallelFinalSummary(tracker, managerPhones, tumbalPhones, results) {
    let summary = `🎯 <b>COMBO RESULTS:</b>\n`;
    summary += `✅ Success: ${tracker.stats.slots.success}\n`;
    summary += `❌ Failed: ${tracker.stats.slots.failed}\n`;
    summary += `📋 Total Slots: ${tracker.stats.slots.total}\n\n`;
    
    // Add failed section if there are any failures
    const failedResults = [];
    managerPhones.forEach((manager, index) => {
      const result = results.find(r => r.phone === manager);
      if (!result?.success) {
        failedResults.push({ manager, tumbal: tumbalPhones[index] });
      }
    });
    
    if (failedResults.length > 0) {
      summary += `❌ <b>FAILED</b>\n`;
      failedResults.forEach(failed => {
        summary += `❌ ${failed.manager} → ${failed.tumbal}\n`;
      });
      summary += `\n`;
    }
    
    summary += `👤 <b>Tumbal Mapping:</b>\n`;
    managerPhones.forEach((manager, index) => {
      const result = results.find(r => r.phone === manager);
      if (result?.success) {
        summary += `✅ ${manager} → ${tumbalPhones[index]}\n`;
      }
    });

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
    summary += `🚀 <b>Strategy:</b> Sequential Modern (CEKSLOT→ADD→WAIT 5min→KICK)\n`;
    summary += `⚡ <b>Improvements:</b> Fresh validation + 60s wait + sequential reliability`;

    await this.bot.sendMessage(this.chatId, summary, { parse_mode: 'HTML' });
  }
}

// ===== SMART ADD/KICK FUNCTIONS (AUTO-GENERATE PARAMETERS) =====

// Smart ADD function - Auto generate parameters from CEKSLOT with strict slot filtering
async function smartAdd(parentPhone, tumbalPhone, tumbalName = 'TUMBAL', slotIndex = 0) {
  // console.log('\n🧠 SMART ADD - Auto generating parameters...');
  // console.log(`📱 Parent: ${parentPhone}`);
  // console.log(`📱 Tumbal: ${tumbalPhone}`);
  // console.log(`👤 Alias: ${tumbalName}`);
  // console.log(`🎰 Slot Index: ${slotIndex} (which slot to use)`);
  // console.log(`⏰ Time: ${formatIndonesianTime()}`);
  // console.log('-'.repeat(50));
  
  const startTime = Date.now();
  
  try {
    // Step 1: Hit CEKSLOT API untuk mendapatkan slot info
    // console.log('🔍 Step 1: Getting slot info from CEKSLOT API...');
    const slotResult = await ModernSlotManager.getAvailableSlots(normalizePhone(parentPhone));
    const cekslotDuration = Date.now() - startTime;
    
    // console.log(`⏱️  CEKSLOT Response Time: ${cekslotDuration}ms`);
    
    if (!slotResult.success) {
      // console.log('❌ CEKSLOT failed, cannot proceed with ADD');
      // console.log(`💬 Error: ${slotResult.error}`);
      return {
        success: false,
        error: slotResult.error,
        step: 'CEKSLOT',
        cekslotDuration
      };
    }
    
    // console.log(`📊 Found ${slotResult.totalSlots} total slots, ${slotResult.validSlots} valid empty slots`);
    
    if (!slotResult.slots || slotResult.slots.length === 0) {
      // console.log('❌ No empty slots available, cannot proceed with ADD');
      return {
        success: false,
        error: 'No available slots found (strict filtering: add_chances=2, empty slots only)',
        step: 'NO_SLOTS',
        cekslotDuration,
        totalSlots: slotResult.totalSlots,
        validSlots: 0
      };
    }
    
    // FIXED: Check if the requested slot index is available
    if (slotIndex >= slotResult.slots.length) {
      // console.log(`❌ Slot index ${slotIndex} not available (only ${slotResult.slots.length} slots found)`);
      return {
        success: false,
        error: `Slot index ${slotIndex} not available, only ${slotResult.slots.length} valid slots found`,
        step: 'SLOT_INDEX_OUT_OF_RANGE',
        cekslotDuration,
        totalSlots: slotResult.totalSlots,
        validSlots: slotResult.slots.length,
        requestedIndex: slotIndex
      };
    }
    
    // Step 2: Auto select slot berdasarkan index yang diminta
    const selectedSlot = slotResult.slots[slotIndex];
    const autoSlotId = selectedSlot.slot_id;
    const autoMemberId = selectedSlot.family_member_id || '';
    const autoAlias = tumbalName;
    
    // console.log('✅ Auto-generated parameters:');
    // console.log(`   🎯 Slot ID: ${autoSlotId}`);
    // console.log(`   🎯 Slot Index: ${slotIndex}/${slotResult.slots.length - 1}`);
    // console.log(`   🆔 Member ID: ${autoMemberId ? autoMemberId.substring(0, 30) + '...' : 'Empty'}`);
    // console.log(`   👤 Alias: ${autoAlias}`);
    // console.log(`   🎲 Add Chances: ${selectedSlot.add_chances}`);
    
    // Step 3: Execute ADD API dengan parameter yang auto-generated
    // console.log('\n🚀 Step 2: Executing ADD API with auto-generated parameters...');
    const apiClient = new ModernAPIClient(API_CONFIG);
    const addResult = await apiClient.addMember(
      normalizePhone(parentPhone),
      normalizePhone(tumbalPhone),
      selectedSlot.slot_id,
      tumbalName,
      selectedSlot.family_member_id || ''
    );
    
    const addDuration = Date.now() - startTime - cekslotDuration;
    // console.log(`⏱️  ADD Response Time: ${addDuration}ms`);
    
    if (addResult.success) {
      // console.log('✅ SMART ADD SUCCESS:');
      // console.log(`📋 Response:`, JSON.stringify(addResult.data, null, 2));
    } else {
      // console.log('❌ SMART ADD FAILED:');
      // console.log(`📋 Response:`, JSON.stringify(addResult.data, null, 2));
      // console.log(`💬 Error: ${addResult.error}`);
    }
    
    return {
      success: addResult.success,
      data: addResult.data,
      error: addResult.error,
      step: addResult.success ? 'COMPLETED' : 'ADD',
      cekslotDuration,
      addDuration,
      totalDuration: Date.now() - startTime,
      slotUsed: selectedSlot.slot_id,
      slotData: selectedSlot,
      availableSlots: slotResult.slots.length,
      totalSlots: slotResult.totalSlots,
      slotIndex: slotIndex,
      autoGenerated: {
        slotId: autoSlotId,
        memberId: autoMemberId,
        alias: autoAlias,
        addChances: selectedSlot.add_chances
      }
    };
    
  } catch (error) {
    // console.log('💥 SMART ADD EXCEPTION:');
    // console.log(`📛 Error: ${error.message}`);
    return {
      success: false,
      error: error.message,
      step: 'EXCEPTION',
      totalDuration: Date.now() - startTime
    };
  }
}

// Smart KICK function - Show tumbal members only and let user choose
async function smartKickTumbal(parentPhone) {
  // console.log('\n🧠 SMART KICK TUMBAL - Finding tumbal members...');
  // console.log(`📱 Parent: ${parentPhone}`);
  // console.log(`⏰ Time: ${formatIndonesianTime()}`);
  // console.log('-'.repeat(50));
  
  const startTime = Date.now();
  
  try {
    // Step 1: Get slot info to find tumbal members (with retry system)
    // console.log('🔍 Step 1: Getting member list from CEKSLOT API...');
    
    let slotResult = null;
    let cekslotDuration = 0;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // console.log(`🚀 CEKSLOT Attempt ${attempt}/${maxRetries} for KICK operation...`);
        const attemptStartTime = Date.now();
        
        slotResult = await getSlotInfoAPI1Only(normalizePhone(parentPhone));
        cekslotDuration = Date.now() - attemptStartTime;
        
        if (slotResult.success) {
          // console.log(`✅ CEKSLOT SUCCESS on attempt ${attempt} (${cekslotDuration}ms)`);
          break;
        } else {
          // console.log(`❌ CEKSLOT FAILED on attempt ${attempt}: ${slotResult.error}`);
          
          // If this is not the last attempt, wait before retry
          if (attempt < maxRetries) {
            const retryDelay = attempt * 2000; // Progressive delay: 2s, 4s, 6s
            // console.log(`⏳ Waiting ${retryDelay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
      } catch (error) {
        // console.log(`💥 CEKSLOT ERROR on attempt ${attempt}: ${error.message}`);
        
        // If this is not the last attempt, wait before retry
        if (attempt < maxRetries) {
          const retryDelay = attempt * 2000; // Progressive delay: 2s, 4s, 6s
          // console.log(`⏳ Waiting ${retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    // console.log(`⏱️  CEKSLOT Response Time: ${cekslotDuration}ms`);
    
    if (!slotResult || !slotResult.success) {
      // console.log(`❌ CEKSLOT failed after ${maxRetries} attempts, cannot show members`);
      // console.log(`💬 Error: ${slotResult?.error || 'Unknown error'}`);
      return {
        success: false,
        error: slotResult?.error || `CEKSLOT failed after ${maxRetries} attempts`,
        step: 'CEKSLOT',
        cekslotDuration,
        attempts: maxRetries
      };
    }
    
    // Step 2: Filter only tumbal members (alias contains 'TUMBAL' or similar patterns)
    const tumbalMembers = slotResult.slots.filter(slot => {
      const alias = (slot.alias || '').toLowerCase();
      const msisdn = slot.msisdn || '';
      const hasFamilyMemberId = slot.family_member_id && slot.family_member_id !== '-';
      
      // Check if it's a tumbal by alias or if it's a registered member with proper MSISDN
      const isTumbal = alias.includes('tumbal') || 
                       alias.includes('xl') || 
                       (hasFamilyMemberId && msisdn && msisdn !== '-');
      
      return isTumbal && hasFamilyMemberId;
    });
    
    // console.log(`📊 Found ${slotResult.slots.length} total slots, ${tumbalMembers.length} tumbal members`);
    
    if (tumbalMembers.length === 0) {
      // console.log('❌ No tumbal members found to kick');
      const totalMembers = slotResult.slots.filter(s => s.family_member_id && s.family_member_id !== '-').length;
      // console.log(`📋 Total registered members: ${totalMembers}`);
      return {
        success: false,
        error: 'No tumbal members found to kick',
        step: 'NO_TUMBAL',
        cekslotDuration,
        totalMembers
      };
    }
    
    // console.log('\n👥 TUMBAL MEMBERS FOUND:');
    // console.log('='.repeat(60));
    tumbalMembers.forEach((slot, index) => {
      // console.log(`${index + 1}. Slot ${slot.slot_id}`);
      // console.log(`   📱 MSISDN: ${slot.msisdn || '-'}`);
      // console.log(`   👤 Alias: ${slot.alias || '-'}`);
      // console.log(`   🆔 Member ID: ${slot.family_member_id ? slot.family_member_id.substring(0, 30) + '...' : '-'}`);
      // console.log('');
    });
    // console.log('='.repeat(60));
    
    return {
      success: true,
      tumbalMembers,
      cekslotDuration,
      step: 'TUMBAL_LIST_READY'
    };
    
  } catch (error) {
    // console.log('💥 SMART KICK TUMBAL EXCEPTION:');
    // console.log(`📛 Error: ${error.message}`);
    return {
      success: false,
      error: error.message,
      step: 'EXCEPTION',
      totalDuration: Date.now() - startTime
    };
  }
}

// Execute KICK for specific tumbal member
async function executeKickTumbal(parentPhone, memberId) {
  // console.log('\n🚀 EXECUTING KICK TUMBAL...');
  // console.log(`📱 Parent: ${parentPhone}`);
  // console.log(`🆔 Member ID: ${memberId ? memberId.substring(0, 30) + '...' : 'None'}`);
  // console.log(`⏰ Time: ${formatIndonesianTime()}`);
  // console.log('-'.repeat(50));
  
  const startTime = Date.now();
  
  try {
    // console.log('📤 Sending KICK request...');
    const apiClient = new ModernAPIClient(API_CONFIG);
    const kickResult = await apiClient.kickMember(normalizePhone(parentPhone), memberId);
    
    const duration = Date.now() - startTime;
    // console.log(`⏱️  KICK Response Time: ${duration}ms`);
    
    if (kickResult.success) {
      // console.log('✅ KICK TUMBAL SUCCESS:');
      // console.log(`📋 Response:`, JSON.stringify(kickResult.data, null, 2));
    } else {
      // console.log('❌ KICK TUMBAL FAILED:');
      // console.log(`📋 Response:`, JSON.stringify(kickResult.data, null, 2));
      // console.log(`💬 Error: ${kickResult.error}`);
    }
    
    return {
      success: kickResult.success,
      data: kickResult.data,
      error: kickResult.error,
      duration
    };
    
  } catch (error) {
    // console.log('💥 KICK TUMBAL EXCEPTION:');
    // console.log(`📛 Error: ${error.message}`);
    return {
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    };
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
      if (data === 'modern_addkick_start') {
        
        try {
          const keyboard = [
            [{ text: '🚀 START MODERN ADD-KICK', callback_data: 'modern_addkick_begin' }],
            [{ text: '⚡ START PARALLEL ADD-KICK', callback_data: 'modern_addkick_parallel' }],
            [{ text: '🔙 BACK TO MASSAL', callback_data: 'menu_massal' }]
          ];
          
          const content = 
            `🚀 <b>ADD-KICK MODERN V2.0 - SMART AUTO-GENERATION</b>\n\n` +
            `✨ <b>PILIHAN MODE:</b>\n` +
            `🔸 <b>Sequential:</b> 1 tumbal untuk semua pengelola (antri)\n` +
            `🔸 <b>Parallel:</b> 1 tumbal per pengelola (serentak)\n\n` +
            `🧠 <b>SMART AUTO-GENERATION:</b>\n` +
            `• Hanya input parent + tumbal phone\n` +
            `• Auto-generate slot_id dari CEKSLOT\n` +
            `• Auto-generate member_id\n` +
            `• Strict slot filtering tetap dipertahankan\n` +
            `• Tidak perlu input manual parameter\n\n` +
            `⚡ <b>ADVANTAGES:</b>\n` +
            `• Real-time progress tracking\n` +
            `• Smart slot filtering (add_chances=2)\n` +
            `• Auto parameter generation\n` +
            `• 60s optimized timing\n\n` +
            `🚀 <b>Ready to choose your mode?</b>`;

          
          // Check if message has caption (photo message) or text
          if (message.caption) {
            // Photo message - edit caption
            await bot.editMessageCaption(content, {
              chat_id: chatId,
              message_id: message.message_id,
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard: keyboard }
            });
          } else {
            // Text message - edit text
            await bot.editMessageText(content, {
              chat_id: chatId,
              message_id: message.message_id,
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard: keyboard }
            });
          }

          await bot.answerCallbackQuery(id);
          return;
          
        } catch (innerError) {
          console.error('❌ Error in modern_addkick_start handler:', innerError);
          console.error('Inner error stack:', innerError.stack);
          throw innerError; // Re-throw để ditangkap oleh catch luar
        }

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
      console.error('❌ Error in callback handler:', error);
      console.error('Error stack:', error.stack);
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
            `• Sequential CEKSLOT→ADD→WAIT 5min→KICK timing\n` +
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
          `• Sequential timing per manager: CEKSLOT→ADD→WAIT 5min→KICK\n` +
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
          `• Sequential CEKSLOT→ADD→WAIT 5min→KICK timing\n` +
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
          `• Sequential timing: CEKSLOT→ADD→WAIT 5min→KICK\n` +
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
          `• ~6.5 minutes per slot (CEKSLOT+ADD+5min+KICK)\n` +
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
