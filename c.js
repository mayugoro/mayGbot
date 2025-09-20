const axios = require('axios');
const readline = require('readline');
require('dotenv').config({ quiet: true });

// Import cekslot1 functions
const { getSlotInfoAPI1Only } = require('./menu/admin/manage_akrab/cekslot1.js');

// ===== SIMPLE CLI ADD-KICK V2.0 (NO EXTERNAL DEPENDENCIES) =====
// Simplified version without chalk, ora, cli-table3 dependencies
// Full functionality with basic console output

console.log('🚀 Loading ADD-KICK CLI V2.0...');

// Environment Configuration
const API_CONFIG = {
  base: process.env.API1,
  endpoints: {
    add: process.env.ADD1,
    kick: process.env.KICK1,
    check: process.env.CEKSLOT1
  },
  token: process.env.APIKEY1,
  timeout: 25000
};

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ===== UTILITY FUNCTIONS =====
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

const extractAndNormalizePhones = (input) => {
  if (!input) return [];
  const phones = input.split(/[,\n\r\s]+/).filter(p => p.trim());
  return phones.map(phone => {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('08')) {
      clean = '628' + clean.substring(2);
    } else if (clean.startsWith('8') && !clean.startsWith('62')) {
      clean = '62' + clean;
    }
    return clean;
  }).filter(p => p.length >= 10 && p.length <= 15);
};

// ===== DOMPUL PACKAGE CHECKER =====
let checkDompul = async (phone) => {
  console.log('📡 [MOCK] DOMPUL API call for:', phone);
  
  // Mock response - replace with real implementation
  return {
    status: 'success',
    data: {
      data: {
        hasil: 'Mock response with no Akrab package'
      }
    }
  };
};

// Try to load real dompul function
try {
  const dompulModule = require('./dompul.js');
  // Since dompul.js exports as a function, we need to check if checkDompul is available
  // Let's check if we can access it
  console.log('⚠️  dompul.js found but checkDompul not exported, using internal implementation');
  
  // We'll create our own checkDompul implementation based on the dompul.js code
  checkDompul = async (nomor_hp) => {
    try {
      // Convert 628xxx back to 08xxx for dompul API
      let formattedMsisdn = nomor_hp;
      if (nomor_hp.startsWith('628')) {
        formattedMsisdn = '08' + nomor_hp.substring(3);
      }

      const params = {
        msisdn: formattedMsisdn,
        isJSON: 'true',
        _: Date.now().toString()
      };

      const response = await axios.get("https://apigw.kmsp-store.com/sidompul/v4/cek_kuota", {
        params,
        headers: {
          "Accept": "application/json, text/javascript, */*; q=0.01",
          "Accept-Encoding": "gzip, deflate, br, zstd",
          "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
          "Authorization": "Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw",
          "Content-Type": "application/x-www-form-urlencoded",
          "Origin": "https://sidompul.kmsp-store.com",
          "Priority": "u=1, i",
          "Referer": "https://sidompul.kmsp-store.com/",
          "Sec-CH-UA": '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
          "Sec-CH-UA-Mobile": "?0",
          "Sec-CH-UA-Platform": '"Windows"',
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-site",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
          "X-API-Key": "60ef29aa-a648-4668-90ae-20951ef90c55",
          "X-App-Version": "4.0.0"
        },
        timeout: 30000
      });

      return {
        status: 'success',
        data: response.data
      };
    } catch (error) {
      console.error(`❌ Error checking dompul untuk ${nomor_hp}:`, error.message);
      return {
        status: 'error',
        message: error.response?.data?.message || error.message
      };
    }
  };
  
  console.log('✅ Using custom checkDompul implementation based on dompul.js');
  
} catch (e) {
  console.log('⚠️  Using MOCK checkDompul (dompul.js not found)');
  console.log('   To use real function, ensure ./dompul.js exists');
}

// Function to check if tumbal has "Akrab" package
const checkAkrabPackage = async (phone) => {
  try {
    console.log(`🔍 Checking for Akrab package on ${phone}...`);
    
    const result = await checkDompul(phone);
    
    if (result.status !== 'success') {
      console.log(`❌ DOMPUL API failed: ${result.message}`);
      return { hasAkrab: false, error: result.message };
    }
    
    const hasil = result.data?.data?.hasil || '';
    console.log(`📄 DOMPUL response length: ${hasil.length} chars`);
    
    // Check if response contains "Akrab" package
    const hasAkrab = hasil.toLowerCase().includes('akrab');
    
    if (hasAkrab) {
      console.log(`✅ AKRAB PACKAGE FOUND on ${phone}!`);
    } else {
      console.log(`❌ No Akrab package found on ${phone}`);
    }
    
    return { hasAkrab, error: null, response: hasil };
    
  } catch (error) {
    console.log(`💥 Error checking Akrab package: ${error.message}`);
    return { hasAkrab: false, error: error.message };
  }
};

// ===== SLOT CHECKING FUNCTIONS =====
// Function to check available slots for a manager
async function checkManagerSlots(managerNumber) {
    try {
        console.log(`🔍 Mengecek slot untuk manager: ${managerNumber}`);
        
        const result = await getSlotInfoAPI1Only(managerNumber);
        
        if (!result.success) {
            console.log(`❌ Gagal cek slot untuk ${managerNumber}: ${result.error}`);
            return { success: false, availableSlots: 0, error: result.error };
        }
        
        // Filter slots yang memenuhi kriteria (add_chances >= 2)
        const validSlots = result.slots.filter(slot => (slot.add_chances || 0) >= 2);
        
        console.log(`✅ Manager ${managerNumber}: ${validSlots.length} slot tersedia (dari ${result.slots.length} total)`);
        
        if (validSlots.length > 0) {
            console.log(`📋 Detail slot yang tersedia:`);
            validSlots.forEach((slot, index) => {
                console.log(`   ${index + 1}. ${slot.alias} (${slot.msisdn}) - Add Chances: ${slot.add_chances}`);
            });
        }
        
        return {
            success: true,
            availableSlots: validSlots.length,
            totalSlots: result.slots.length,
            validSlots: validSlots,
            allSlots: result.slots
        };
        
    } catch (error) {
        console.log(`💥 Error checking slots untuk ${managerNumber}: ${error.message}`);
        return { success: false, availableSlots: 0, error: error.message };
    }
}

// Function to check all managers and calculate total tumbal needed
async function checkAllManagersSlots(managerNumbers) {
    console.log(`\n🔍 MENGECEK SLOT SEMUA MANAGER...`);
    console.log(`📞 Total Manager: ${managerNumbers.length}`);
    
    const results = [];
    let totalTumbalNeeded = 0;
    
    for (const manager of managerNumbers) {
        const slotResult = await checkManagerSlots(manager);
        results.push({
            manager: manager,
            ...slotResult
        });
        
        if (slotResult.success) {
            totalTumbalNeeded += slotResult.availableSlots;
        }
        
        // Small delay between checks
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n📊 SUMMARY SLOT CHECK:`);
    console.log(`🎯 Total Manager: ${managerNumbers.length}`);
    console.log(`🎯 Total Tumbal Dibutuhkan: ${totalTumbalNeeded}`);
    console.log(`\n📋 Detail per Manager:`);
    
    results.forEach((result, index) => {
        if (result.success) {
            console.log(`   ${index + 1}. ${result.manager}: ${result.availableSlots} slot tersedia`);
        } else {
            console.log(`   ${index + 1}. ${result.manager}: ERROR - ${result.error}`);
        }
    });
    
    return {
        success: true,
        results: results,
        totalTumbalNeeded: totalTumbalNeeded,
        totalManagers: managerNumbers.length
    };
}

// ===== AKRAB PACKAGE MONITORING =====
const monitorAkrabPackage = async (tumbalPhone, maxChecks = 5, intervalMs = 60000) => {
  console.log('\n🎯 STARTING AKRAB PACKAGE MONITORING...');
  console.log(`📱 Tumbal: ${tumbalPhone}`);
  console.log(`⏰ Max checks: ${maxChecks} (every ${intervalMs/1000}s)`);
  console.log(`🕐 Total monitoring time: ${(maxChecks * intervalMs) / 1000}s (${(maxChecks * intervalMs) / 60000} minutes)`);
  console.log('='.repeat(60));
  
  const startTime = Date.now();
  
  for (let attempt = 1; attempt <= maxChecks; attempt++) {
    console.log(`\n� [${attempt}/${maxChecks}] Checking Akrab package...`);
    console.log(`⏰ Time: ${formatIndonesianTime()}`);
    
    try {
      const checkResult = await checkAkrabPackage(tumbalPhone);
      
      if (checkResult.error) {
        console.log(`⚠️ Check failed: ${checkResult.error}`);
      } else if (checkResult.hasAkrab) {
        console.log('🎉 AKRAB PACKAGE DETECTED!');
        return {
          success: true,
          foundAt: attempt,
          totalDuration: Date.now() - startTime,
          message: `Akrab package found on attempt ${attempt}/${maxChecks}`
        };
      } else {
        console.log('❌ No Akrab package yet');
      }
      
      // Wait before next check (except on last attempt)
      if (attempt < maxChecks) {
        console.log(`⏳ Waiting ${intervalMs/1000}s before next check...`);
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
      
    } catch (error) {
      console.log(`💥 Monitor error: ${error.message}`);
    }
  }
  
  console.log('\n❌ MONITORING TIMEOUT');
  console.log(`⏰ Checked ${maxChecks} times over ${(maxChecks * intervalMs) / 60000} minutes`);
  
  return {
    success: false,
    foundAt: null,
    totalDuration: Date.now() - startTime,
    message: `Akrab package not found after ${maxChecks} attempts over ${(maxChecks * intervalMs) / 60000} minutes`
  };
};

// ===== API CLIENT =====
class SimpleAPIClient {
  constructor(config) {
    this.config = config;
    this.stats = { success: 0, failed: 0, total: 0 };
  }

  async makeRequest(endpoint, data, retries = 2) {
    const url = this.config.base + this.config.endpoints[endpoint];
    
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        console.log(`🚀 ${endpoint.toUpperCase()} API - Attempt ${attempt}/${retries + 1}`);
        
        const formData = new URLSearchParams(data);
        const response = await axios.post(url, formData, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: this.config.timeout
        });

        this.stats.total++;
        
        // Check for success
        if (response.data?.status === 'success' || 
            response.data?.success === true || 
            response.data?.status === true) {
          this.stats.success++;
          console.log(`✅ ${endpoint.toUpperCase()} SUCCESS`);
          return { success: true, data: response.data };
        } else {
          this.stats.failed++;
          console.log(`❌ ${endpoint.toUpperCase()} FAILED`);
          console.log('Response:', JSON.stringify(response.data, null, 2));
          return { success: false, error: response.data?.message || 'API response failed' };
        }
        
      } catch (error) {
        if (attempt === retries + 1) {
          this.stats.total++;
          this.stats.failed++;
          console.log(`💥 ${endpoint.toUpperCase()} ERROR: ${error.message}`);
          return { success: false, error: error.message };
        }
        console.log(`⚠️ Retry ${attempt} for ${endpoint}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
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
      alias: memberName,
      parent_name: 'XL',
      child_name: 'XL'
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
}

// ===== SLOT MANAGER =====
class SimpleSlotManager {
  static filterValidSlots(slots) {
    console.log('\n🔍 FILTERING VALID SLOTS...');
    console.log(`📊 Total slots: ${slots.length}`);
    
    const validSlots = slots.filter(slot => {
      const slotId = slot.slot_id;
      const alias = (slot.alias || '').trim();
      const msisdn = (slot.msisdn || '').trim();
      const addChances = parseInt(slot.add_chances) || 0;
      
      const isEmptyAlias = !alias || alias === '-';
      const isEmptyMsisdn = !msisdn || msisdn === '-';
      const hasValidAddChances = addChances === 2;
      const isValidSlot = slotId && slotId !== '0' && slotId !== 0;
      const isAvailableSlot = isEmptyAlias && isEmptyMsisdn && hasValidAddChances;
      
      if (isValidSlot && isAvailableSlot) {
        console.log(`✅ VALID - Slot ${slotId}: add_chances=${addChances}`);
      } else {
        console.log(`❌ SKIP - Slot ${slotId}: add_chances=${addChances}, alias='${alias}', msisdn='${msisdn}'`);
      }
      
      return isValidSlot && isAvailableSlot;
    });
    
    console.log(`📈 Result: ${validSlots.length} valid slots`);
    return validSlots;
  }

  static async getAvailableSlots(phone, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 CEKSLOT attempt ${attempt}/${maxRetries} for ${phone}`);
        const result = await getSlotInfoAPI1Only(phone);
        
        if (result.success) {
          const validSlots = this.filterValidSlots(result.slots || []);
          return {
            success: true,
            slots: validSlots,
            totalSlots: (result.slots || []).length,
            validSlots: validSlots.length
          };
        } else {
          console.log(`❌ CEKSLOT failed: ${result.error}`);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          }
        }
      } catch (error) {
        console.log(`💥 CEKSLOT error: ${error.message}`);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
      }
    }
    
    return { success: false, error: `CEKSLOT failed after ${maxRetries} attempts` };
  }
}

// ===== SMART ADD FUNCTION =====
async function smartAdd(parentPhone, tumbalPhone, tumbalName = 'TUMBAL', slotIndex = 0) {
  console.log('\n🧠 SMART ADD - Auto generating parameters...');
  console.log(`📱 Parent: ${parentPhone}`);
  console.log(`📱 Tumbal: ${tumbalPhone}`);
  console.log(`🎰 Slot Index: ${slotIndex}`);
  
  const startTime = Date.now();
  
  try {
    // Get slot info
    const slotResult = await SimpleSlotManager.getAvailableSlots(normalizePhone(parentPhone));
    
    if (!slotResult.success) {
      return {
        success: false,
        error: slotResult.error,
        step: 'CEKSLOT'
      };
    }
    
    if (!slotResult.slots || slotResult.slots.length === 0) {
      return {
        success: false,
        error: 'No available slots found',
        step: 'NO_SLOTS'
      };
    }
    
    if (slotIndex >= slotResult.slots.length) {
      return {
        success: false,
        error: `Slot index ${slotIndex} not available, only ${slotResult.slots.length} slots found`,
        step: 'SLOT_INDEX_OUT_OF_RANGE'
      };
    }
    
    // Auto-generate parameters
    const selectedSlot = slotResult.slots[slotIndex];
    console.log(`✅ Using slot ${selectedSlot.slot_id} (index ${slotIndex})`);
    
    // Execute ADD API
    const apiClient = new SimpleAPIClient(API_CONFIG);
    const addResult = await apiClient.addMember(
      normalizePhone(parentPhone),
      normalizePhone(tumbalPhone),
      selectedSlot.slot_id,
      tumbalName,
      selectedSlot.family_member_id || ''
    );
    
    return {
      success: addResult.success,
      data: addResult.data,
      error: addResult.error,
      step: addResult.success ? 'COMPLETED' : 'ADD',
      totalDuration: Date.now() - startTime,
      slotUsed: selectedSlot.slot_id,
      slotData: selectedSlot
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      step: 'EXCEPTION',
      totalDuration: Date.now() - startTime
    };
  }
}

// ===== KICK FUNCTION =====
async function executeKick(parentPhone, memberId) {
  console.log('\n🚀 EXECUTING KICK...');
  console.log(`📱 Parent: ${parentPhone}`);
  console.log(`🆔 Member ID: ${memberId ? memberId.substring(0, 30) + '...' : 'None'}`);
  
  const startTime = Date.now();
  
  try {
    const apiClient = new SimpleAPIClient(API_CONFIG);
    const kickResult = await apiClient.kickMember(normalizePhone(parentPhone), memberId);
    
    return {
      success: kickResult.success,
      data: kickResult.data,
      error: kickResult.error,
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

// ===== COMBO PROCESSOR =====
async function executeCombo(parentPhone, tumbalPhone, slotIndex = 0) {
  console.log('\n🎯 EXECUTING COMBO (ADD + MONITOR AKRAB + KICK)...');
  console.log(`📱 Parent: ${parentPhone}`);
  console.log(`📱 Tumbal: ${tumbalPhone}`);
  console.log(`🎰 Slot Index: ${slotIndex}`);
  console.log(`⏰ Time: ${formatIndonesianTime()}`);
  console.log('='.repeat(60));
  
  const startTime = Date.now();
  
  try {
    // Step 1: Smart ADD
    console.log('\n🚀 STEP 1: EXECUTING SMART ADD...');
    const smartAddResult = await smartAdd(parentPhone, tumbalPhone, 'TUMBAL', slotIndex);
    
    if (!smartAddResult.success) {
      console.log('❌ SMART ADD FAILED');
      return {
        success: false,
        step: 'SMART_ADD',
        error: smartAddResult.error,
        duration: Date.now() - startTime
      };
    }

    console.log('✅ SMART ADD SUCCESS');
    console.log(`🎰 Used slot: ${smartAddResult.slotUsed}`);

    // Step 2: Monitor Akrab Package (5 minutes max, check every 1 minute)
    console.log('\n🔍 STEP 2: MONITORING AKRAB PACKAGE...');
    console.log('⏰ Will check every 1 minute for max 5 minutes');
    
    const monitorResult = await monitorAkrabPackage(tumbalPhone, 5, 60000);
    
    if (!monitorResult.success) {
      console.log('⚠️ AKRAB PACKAGE NOT FOUND WITHIN 5 MINUTES');
      console.log('   Proceeding with KICK anyway...');
    } else {
      console.log(`🎉 AKRAB PACKAGE FOUND! (${monitorResult.foundAt}/5 attempts)`);
      console.log(`⏰ Detection time: ${Math.floor(monitorResult.totalDuration/1000)}s`);
    }

    // Step 3: Get fresh data for KICK
    console.log('\n🔍 STEP 3: PREPARING FOR KICK...');
    console.log('🔄 Getting fresh slot data...');
    const postAddResult = await getSlotInfoAPI1Only(parentPhone);
    
    if (!postAddResult.success) {
      return {
        success: false,
        step: 'CEKSLOT_POST_ADD',
        error: 'Failed to get fresh slot info',
        duration: Date.now() - startTime,
        addSuccess: true,
        monitorResult: monitorResult
      };
    }

    // Find added member
    const normalizedTumbal = normalizePhone(tumbalPhone);
    const targetMember = postAddResult.slots.find(slot => 
      slot.msisdn === normalizedTumbal && 
      slot.family_member_id && 
      slot.family_member_id !== '-'
    );

    if (!targetMember) {
      return {
        success: false,
        step: 'KICK_PREP',
        error: 'Added member not found for kick',
        duration: Date.now() - startTime,
        addSuccess: true,
        monitorResult: monitorResult
      };
    }

    console.log(`✅ Found member: ${targetMember.alias} (${targetMember.msisdn})`);

    // Step 4: Execute KICK
    console.log('\n🚀 STEP 4: EXECUTING KICK...');
    const kickResult = await executeKick(parentPhone, targetMember.family_member_id);
    
    const success = kickResult.success;
    const finalMessage = success ? '🎉 COMBO COMPLETED SUCCESSFULLY!' : '❌ COMBO FAILED AT KICK';
    console.log(finalMessage);

    return {
      success,
      step: success ? 'COMPLETE' : 'KICK',
      error: success ? null : kickResult.error,
      duration: Date.now() - startTime,
      addSuccess: true,
      kickSuccess: success,
      slotUsed: smartAddResult.slotUsed,
      memberId: targetMember.family_member_id,
      monitorResult: monitorResult,
      akrabFound: monitorResult.success,
      akrabFoundAt: monitorResult.foundAt,
      akrabMessage: monitorResult.message
    };

  } catch (error) {
    console.log('💥 COMBO ERROR:', error.message);
    return {
      success: false,
      step: 'EXCEPTION',
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

// ===== BATCH PROCESSOR =====
async function processSequentialBatch(managerPhones, tumbalPhones, slotCheckResult) {
  console.log('\n🚀 STARTING SEQUENTIAL PROCESSING...');
  console.log(`👥 Managers: ${managerPhones.length}`);
  console.log(`📱 Total Tumbal: ${tumbalPhones.length}`);
  console.log(`🎯 Total Available Slots: ${slotCheckResult.totalTumbalNeeded}`);
  console.log(`⏰ Start: ${formatIndonesianTime()}`);
  console.log('='.repeat(60));
  
  const stats = {
    managers: { completed: 0, failed: 0 },
    slots: { success: 0, failed: 0, total: 0 }
  };

  let tumbalIndex = 0; // Track which tumbal to use next

  for (let i = 0; i < managerPhones.length; i++) {
    const phone = managerPhones[i];
    console.log(`\n📍 [${i + 1}/${managerPhones.length}] PROCESSING: ${phone}`);
    
    try {
      // Get the slot result for this manager from our pre-check
      const managerSlotResult = slotCheckResult.results.find(r => r.manager === phone);
      
      if (!managerSlotResult || !managerSlotResult.success || managerSlotResult.availableSlots === 0) {
        console.log(`❌ No valid slots for ${phone} (from pre-check)`);
        stats.managers.failed++;
        continue;
      }

      console.log(`✅ Found ${managerSlotResult.availableSlots} valid slots (pre-checked)`);

      // Process each available slot with different tumbal
      let managerSuccess = 0;
      for (let j = 0; j < managerSlotResult.availableSlots; j++) {
        if (tumbalIndex >= tumbalPhones.length) {
          console.log(`⚠️ No more tumbal numbers available (used ${tumbalIndex}/${tumbalPhones.length})`);
          break;
        }

        const currentTumbal = tumbalPhones[tumbalIndex];
        console.log(`\n📍 Processing slot ${j + 1}/${managerSlotResult.availableSlots} with tumbal: ${currentTumbal}`);
        
        const comboResult = await executeCombo(phone, currentTumbal, j);
        
        stats.slots.total++;
        if (comboResult.success) {
          stats.slots.success++;
          managerSuccess++;
        } else {
          stats.slots.failed++;
        }

        console.log(`📊 Result: ${comboResult.success ? '✅ Success' : '❌ Failed'}`);
        
        // Show Akrab monitoring result
        if (comboResult.monitorResult) {
          const akrabIcon = comboResult.akrabFound ? '🎉' : '⏰';
          const akrabStatus = comboResult.akrabFound 
            ? `Akrab found (${comboResult.akrabFoundAt}/5 attempts)`
            : 'Akrab not found (5 min timeout)';
          console.log(`${akrabIcon} Akrab Status: ${akrabStatus}`);
        }
        
        // Move to next tumbal for next slot
        tumbalIndex++;
        
        // Break if ADD failed (no more slots available)
        if (!comboResult.success && comboResult.step === 'SMART_ADD') {
          console.log('⚠️ ADD failed, stopping slots for this manager');
          // Don't increment tumbalIndex more since we're breaking
          break;
        }

        // Interval between slots
        if (j < managerSlotResult.availableSlots - 1) {
          console.log('⏳ 20s interval...');
          await new Promise(resolve => setTimeout(resolve, 20000));
        }
      }

      console.log(`🏁 Manager ${phone}: ${managerSuccess}/${slotResult.validSlots} successful`);
      stats.managers.completed++;

    } catch (error) {
      console.log(`❌ Manager ${phone} error:`, error.message);
      stats.managers.failed++;
    }
  }

  // Final summary
  console.log('\n📊 FINAL SUMMARY - SEQUENTIAL MODE');
  console.log('='.repeat(60));
  console.log(`👥 Managers: ${stats.managers.completed} success, ${stats.managers.failed} failed`);
  console.log(`🎯 Slots: ${stats.slots.success} success, ${stats.slots.failed} failed, ${stats.slots.total} total`);
  const efficiency = stats.slots.total > 0 ? Math.floor((stats.slots.success / stats.slots.total) * 100) : 0;
  console.log(`📈 Efficiency: ${efficiency}%`);
  
  return stats;
}

// ===== PARALLEL BATCH PROCESSOR =====
async function processParallelBatch(managerPhones, tumbalPhones, slotCheckResult) {
  console.log('\n⚡ STARTING PARALLEL PROCESSING...');
  console.log(`👥 Managers: ${managerPhones.length}`);
  console.log(`📱 Total Tumbal: ${tumbalPhones.length}`);
  console.log(`🎯 Total Available Slots: ${slotCheckResult.totalTumbalNeeded}`);
  console.log(`⏰ Start: ${formatIndonesianTime()}`);
  console.log('='.repeat(60));

  const stats = {
    managers: { completed: 0, failed: 0 },
    slots: { success: 0, failed: 0, total: 0 }
  };

  // Create tumbal distribution map based on slot availability
  let tumbalIndex = 0;
  const managerTumbalMap = new Map();
  
  for (const phone of managerPhones) {
    const managerSlotResult = slotCheckResult.results.find(r => r.manager === phone);
    if (managerSlotResult && managerSlotResult.success && managerSlotResult.availableSlots > 0) {
      const managerTumbals = [];
      for (let i = 0; i < managerSlotResult.availableSlots; i++) {
        if (tumbalIndex < tumbalPhones.length) {
          managerTumbals.push(tumbalPhones[tumbalIndex]);
          tumbalIndex++;
        }
      }
      managerTumbalMap.set(phone, {
        tumbals: managerTumbals,
        slots: managerSlotResult.availableSlots
      });
      console.log(`📋 ${phone}: ${managerSlotResult.availableSlots} slots, ${managerTumbals.length} tumbals assigned`);
    }
  }

  // Process all managers in parallel
  const managerPromises = managerPhones.map(async (phone, index) => {
    const managerData = managerTumbalMap.get(phone);
    
    if (!managerData || managerData.tumbals.length === 0) {
      console.log(`❌ [${phone}] No slots or tumbals assigned`);
      return { phone, success: false, reason: 'no_slots_or_tumbals' };
    }

    console.log(`🚀 [PARALLEL] Starting ${phone} with ${managerData.slots} slots and ${managerData.tumbals.length} tumbals`);
    
    try {
      // Process each slot for this manager with its assigned tumbals
      let managerSuccess = 0;
      for (let j = 0; j < managerData.slots; j++) {
        if (j >= managerData.tumbals.length) {
          console.log(`⚠️ [${phone}] No more tumbals for slot ${j + 1}`);
          break;
        }

        const currentTumbal = managerData.tumbals[j];
        console.log(`📍 [${phone}] Processing slot ${j + 1}/${managerData.slots} with tumbal: ${currentTumbal}`);
        
        const comboResult = await executeCombo(phone, currentTumbal, j);
        
        if (comboResult.success) {
          managerSuccess++;
        }

        console.log(`📊 [${phone}] Slot ${j + 1}: ${comboResult.success ? '✅ Success' : '❌ Failed'}`);
        
        // Show Akrab monitoring result
        if (comboResult.monitorResult) {
          const akrabIcon = comboResult.akrabFound ? '🎉' : '⏰';
          const akrabStatus = comboResult.akrabFound 
            ? `Akrab found (${comboResult.akrabFoundAt}/5)`
            : 'Akrab timeout';
          console.log(`     ${akrabIcon} ${akrabStatus}`);
        }
        
        // Break if ADD failed
        if (!comboResult.success && comboResult.step === 'SMART_ADD') {
          console.log(`⚠️ [${phone}] ADD failed, stopping slots`);
          break;
        }

        // Interval between slots
        if (j < managerData.slots - 1) {
          await new Promise(resolve => setTimeout(resolve, 20000));
        }
      }

      console.log(`🏁 [${phone}] Completed: ${managerSuccess}/${slotResult.validSlots} successful`);
      return { phone, success: true, slotsProcessed: slotResult.validSlots, successSlots: managerSuccess };

    } catch (error) {
      console.log(`❌ [${phone}] Error: ${error.message}`);
      return { phone, success: false, reason: 'error', error: error.message };
    }
  });

  // Wait for all managers to complete
  const results = await Promise.all(managerPromises);

  // Calculate final stats
  results.forEach(result => {
    if (result.success) {
      stats.managers.completed++;
      stats.slots.success += result.successSlots || 0;
      stats.slots.total += result.slotsProcessed || 0;
      stats.slots.failed += (result.slotsProcessed || 0) - (result.successSlots || 0);
    } else {
      stats.managers.failed++;
    }
  });

  // Final summary
  console.log('\n📊 FINAL SUMMARY - PARALLEL MODE');
  console.log('='.repeat(60));
  console.log(`👥 Managers: ${stats.managers.completed} success, ${stats.managers.failed} failed`);
  console.log(`🎯 Slots: ${stats.slots.success} success, ${stats.slots.failed} failed, ${stats.slots.total} total`);
  
  if (stats.slots.total > 0) {
    const efficiency = Math.floor((stats.slots.success / stats.slots.total) * 100);
    console.log(`📈 Efficiency: ${efficiency}%`);
  }
  
  console.log('\n👤 Manager → Tumbal Results:');
  results.forEach(result => {
    const index = managerPhones.indexOf(result.phone);
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.phone} → ${tumbalPhones[index]} (${result.successSlots || 0} slots)`);
  });
  
  return stats;
}

// ===== CLI HELPER =====
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Function for multi-line input
function askMultiLineInput(prompt, endPrompt = 'Type "done" to finish, or "exit" to cancel:') {
  return new Promise((resolve) => {
    const lines = [];
    console.log(prompt);
    console.log(endPrompt);
    
    const handleInput = (input) => {
      const trimmed = input.trim();
      
      // Check for exit commands
      if (['exit', 'EXIT', 'Exit', 'keluar', 'KELUAR'].includes(trimmed)) {
        rl.removeListener('line', handleInput);
        resolve('exit');
        return;
      }
      
      // Check for done command
      if (['done', 'DONE', 'Done', 'selesai', 'SELESAI'].includes(trimmed)) {
        rl.removeListener('line', handleInput);
        resolve(lines.join('\n'));
        return;
      }
      
      // Add line to collection
      if (trimmed) {
        lines.push(trimmed);
        console.log(`  Added: ${trimmed} (${lines.length} total)`);
      }
    };
    
    rl.on('line', handleInput);
  });
}

// ===== MAIN CLI =====
async function main() {
  try {
    console.clear();
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    ADD-KICK CLI V2.0                          ║');
    console.log('║              Smart Slot-Based Processing                      ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log();
    console.log('🚀 Welcome to ADD-KICK CLI!');
    console.log();
    console.log('✨ FEATURES:');
    console.log('  🧠 Smart Auto-Generation (no manual parameters)');
    console.log('  🎯 Dynamic Slot Checking (add_chances>=2 only)');
    console.log('  � Akrab Package Monitoring (5 min max)');
    console.log('  �📊 Real-time Progress Updates');
    console.log('  � 1 Unique Tumbal per Available Slot');
    console.log();

    // START PROCESS
    console.log('� ADD-KICK PROCESSOR V2.0');
    console.log('  1. Mulai proses ADD-KICK');
    console.log('  2. Exit');
    console.log();
    console.log('🔸 Otomatis mengecek slot dan menghitung tumbal yang dibutuhkan');
    console.log('🔸 1 nomor tumbal per slot yang tersedia');
    console.log();
    
    const startChoice = await askQuestion('Enter your choice (1-2): ');
    
    if (startChoice === '2') {
      console.log('👋 Goodbye! Thank you for using ADD-KICK CLI V2.0');
      rl.close();
      return;
    }
    
    if (startChoice !== '1') {
      console.log('❌ Invalid choice. Please run the program again.');
      rl.close();
      return;
    }

    console.log('\n✅ Starting ADD-KICK Process...');
    console.log('   🔄 Dynamic slot-based processing');
    console.log();

    // Get manager phones
    console.log('\n📱 ENTER MANAGER PHONE NUMBERS:');
    console.log('   Format: One per line or comma-separated in single line');
    console.log('   Example: 081234567890,081234567891 OR multiple lines');
    console.log();
    
    const managerInput = await askMultiLineInput(
      'Enter manager phones (one per line):',
      'Type "done" when finished, or "exit" to cancel:'
    );
    
    // Check for exit command
    if (managerInput === 'exit') {
      console.log('❌ Process cancelled by user. Goodbye!');
      rl.close();
      return;
    }
    
    const managerPhones = extractAndNormalizePhones(managerInput);
    
    if (managerPhones.length === 0) {
      console.log('❌ No valid phones found. Exiting.');
      rl.close();
      return;
    }
    
    const uniqueManagerPhones = [...new Set(managerPhones)];
    console.log(`\n✅ Found ${uniqueManagerPhones.length} unique managers:`);
    uniqueManagerPhones.forEach((phone, i) => {
      console.log(`  ${i + 1}. ${phone}`);
    });

    // Check slots for all managers
    console.log('\n🔍 CHECKING AVAILABLE SLOTS FOR ALL MANAGERS...');
    console.log('   Analyzing slot availability and calculating tumbal requirements');
    console.log('   This may take a moment...');
    console.log();
    
    const slotCheckResult = await checkAllManagersSlots(uniqueManagerPhones);
    
    if (!slotCheckResult.success || slotCheckResult.totalTumbalNeeded === 0) {
      console.log('\n❌ NO AVAILABLE SLOTS FOUND!');
      console.log('   All managers either have no slots or no slots meet the criteria (add_chances >= 2)');
      console.log('   Please check the managers and try again.');
      rl.close();
      return;
    }

    console.log('\n✅ SLOT CHECK COMPLETED!');
    console.log(`🎯 Total slots available: ${slotCheckResult.totalTumbalNeeded}`);
    console.log(`📱 Total tumbal numbers required: ${slotCheckResult.totalTumbalNeeded}`);

    // Get tumbal phone(s) based on slot requirements
    let tumbalPhones = [];
    
    console.log('\n👤 TUMBAL INPUT:');
    console.log(`   You need ${slotCheckResult.totalTumbalNeeded} different tumbal numbers`);
    console.log('   These will be distributed across all available slots');
    console.log('   Each slot will use a unique tumbal number');
    console.log();
    
    const tumbalInput = await askMultiLineInput(
      `Enter ${slotCheckResult.totalTumbalNeeded} tumbal phones (one per line):`,
      'Type "done" when finished, or "exit" to cancel:'
    );
    
    // Check for exit command
    if (tumbalInput === 'exit') {
      console.log('❌ Process cancelled by user. Goodbye!');
      rl.close();
      return;
    }
    
    const tumbalArray = extractAndNormalizePhones(tumbalInput);
    
    if (tumbalArray.length !== slotCheckResult.totalTumbalNeeded) {
      console.log(`❌ Please provide exactly ${slotCheckResult.totalTumbalNeeded} tumbal numbers (one per available slot).`);
      console.log(`   You provided: ${tumbalArray.length} numbers`);
      console.log('   Exiting.');
      rl.close();
      return;
    }
    
    tumbalPhones = tumbalArray;
    console.log(`✅ Got ${tumbalPhones.length} tumbal numbers for ${slotCheckResult.totalTumbalNeeded} available slots`);
    
    console.log('\n📋 Slot distribution per Manager:');
    slotCheckResult.results.forEach((result, i) => {
      if (result.success && result.availableSlots > 0) {
        console.log(`  ${i + 1}. ${result.manager}: ${result.availableSlots} slots available`);
      }
    });
    
    console.log();

    // Confirmation
    console.log('🔍 PROCESSING CONFIGURATION:');
    console.log(`   Managers: ${uniqueManagerPhones.length}`);
    console.log(`   Tumbals: ${tumbalPhones.length}`);
    console.log(`   Available Slots: ${slotCheckResult.totalTumbalNeeded}`);
    console.log(`   Strategy: CEKSLOT → ADD → Monitor Akrab (5min) → KICK`);
    console.log(`   Processing: Sequential, 1 unique tumbal per slot`);
    console.log();
    
    const confirm = await askQuestion('Proceed with processing? (y/n, or "exit" to cancel): ');
    
    // Check for exit command
    if (['exit', 'EXIT', 'Exit', 'keluar', 'KELUAR'].includes(confirm.trim())) {
      console.log('❌ Process cancelled by user. Goodbye!');
      rl.close();
      return;
    }
    
    if (!['y', 'Y', 'yes', 'YES'].includes(confirm)) {
      console.log('❌ Cancelled. Goodbye!');
      rl.close();
      return;
    }

    console.log('\n🚀 STARTING ADD-KICK PROCESSING...');
    console.log('   Press Ctrl+C to stop at any time');

    // Start sequential processing (only mode now)
    await processSequentialBatch(uniqueManagerPhones, tumbalPhones, slotCheckResult);

    console.log('\n🎉 PROCESSING COMPLETED!');
    console.log('Thank you for using ADD-KICK CLI V2.0');
    
    rl.close();

  } catch (error) {
    console.error('\n💥 ERROR:', error.message);
    console.error(error.stack);
    rl.close();
    process.exit(1);
  }
}

// ===== ERROR HANDLING =====
process.on('SIGINT', () => {
  console.log('\n\n👋 Interrupted by user. Goodbye!');
  if (rl) rl.close();
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error.message);
  process.exit(1);
});

// ===== RUN =====
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 FATAL:', error.message);
    if (rl) rl.close();
    process.exit(1);
  });
}

module.exports = {
  SimpleAPIClient,
  SimpleSlotManager,
  smartAdd,
  executeKick,
  executeCombo,
  processSequentialBatch,
  processParallelBatch,
  main
};