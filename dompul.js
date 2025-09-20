const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { normalizePhoneNumber, isValidIndonesianPhone, extractPhonesFromMultilineText } = require('./utils/normalize');
const { getJakartaTime, createJakartaDate, calculateDaysDiff, formatDaysDiff, formatPackageExpiry, parseToJakartaDate, formatToDDMMYYYY, getDompulTimestamp } = require('./utils/date');
const { sendStyledInputMessage, autoDeleteMessage, EXIT_KEYWORDS } = require('./utils/exiter');

// ===== FORMATTING FUNCTIONS FROM d.js =====

// Function untuk format tanggal dari YYYY-MM-DD ke DD/MM/YYYY dengan hari tersisa
const formatDateToReadable = (dateString) => {
  if (!dateString || dateString === '-') return dateString;
  
  // Parse tanggal menggunakan utility function
  const parsedDate = parseToJakartaDate(dateString);
  if (!parsedDate) {
    return dateString; // Return original if parsing failed
  }
  
  // Format tanggal ke DD/MM/YYYY
  const formattedDate = formatToDDMMYYYY(parsedDate);
  
  // Hitung selisih hari menggunakan utility function
  const daysRemaining = calculateDaysDiff(dateString);
  
  if (isNaN(daysRemaining)) {
    return formattedDate; // Return tanpa info hari jika gagal hitung
  }
  
  // Format dengan emoji menggunakan utility function
  const daysInfo = formatPackageExpiry(daysRemaining);
  
  return `${formattedDate} ${daysInfo}`;
};

// Function khusus untuk format "Aktif Hingga" - hanya tampilkan info hari
const formatExpiryDaysOnly = (dateString) => {
  if (!dateString || dateString === '-') return dateString;
  
  // Hitung selisih hari menggunakan utility function
  const daysRemaining = calculateDaysDiff(dateString);
  
  if (isNaN(daysRemaining)) {
    return dateString; // Return original if parsing failed
  }
  
  // Format khusus tanpa kurung untuk Aktif Hingga
  if (daysRemaining > 0) {
    return `⚡${daysRemaining} HARI`;
  } else if (daysRemaining === 0) {
    return '⚡HARI INI';
  } else {
    return '⚡EXPIRED';
  }
};

// Function untuk menggabungkan package dengan nama yang mirip (hanya untuk Akrab) - FIXED
const mergePackagesByName = (resultText) => {
  const lines = resultText.split('\n');
  const packages = [];
  let currentPackage = null;
  let currentBenefits = [];
  let headerLines = [];
  let isInPackageSection = false;
  let isCollectingBenefits = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Collect header lines before packages
    if (!line.includes('🎁 Quota:') && !isInPackageSection) {
      headerLines.push(line);
      continue;
    }
    
    // Detect package start
    if (line.includes('🎁 Quota:')) {
      // Save previous package
      if (currentPackage) {
        packages.push({
          name: currentPackage.name,
          expiry: currentPackage.expiry,
          benefits: [...currentBenefits],
          isAkrab: currentPackage.name.toLowerCase().includes('akrab')
        });
      }
      
      // Start new package
      const packageName = line.replace('🎁 Quota:', '').trim();
      currentPackage = { name: packageName, expiry: null };
      currentBenefits = [];
      isInPackageSection = true;
      isCollectingBenefits = false;
      continue;
    }
    
    // Detect expiry
    if (line.includes('🍂 Aktif Hingga:') && currentPackage) {
      currentPackage.expiry = line.replace('🍂 Aktif Hingga:', '').trim();
      continue;
    }
    
    // Detect separator (start collecting benefits)
    if (line.includes('===========================') && isInPackageSection) {
      isCollectingBenefits = true;
      continue;
    }
    
    // Collect benefits for current package
    if (isCollectingBenefits && (line.includes('🎁 Benefit:') || line.includes('🌲 Sisa Kuota:'))) {
      currentBenefits.push(line);
    }
    
    // Detect next package or end
    if (line.includes('🎁 Quota:') || i === lines.length - 1) {
      isCollectingBenefits = false;
    }
  }
  
  // Save last package
  if (currentPackage) {
    packages.push({
      name: currentPackage.name,
      expiry: currentPackage.expiry,
      benefits: [...currentBenefits],
      isAkrab: currentPackage.name.toLowerCase().includes('akrab')
    });
  }
  
  // Reconstruct output
  const result = [];
  
  // Add header
  result.push(...headerLines);
  
  // Merge Akrab packages
  const akrabPackages = packages.filter(pkg => pkg.isAkrab);
  const otherPackages = packages.filter(pkg => !pkg.isAkrab);
  
  if (akrabPackages.length > 0) {
    const mergedNames = akrabPackages.map(pkg => pkg.name);
    const mergedBenefits = akrabPackages.flatMap(pkg => pkg.benefits);
    
    result.push(`✨ ${mergedNames.join(' + ')} :`);
    result.push(`🌙 Aktif Hingga : ${formatExpiryDaysOnly(akrabPackages[0].expiry)}`);
    
    // Process Akrab benefits
    const processedBenefits = processBenefitsForPackage(mergedBenefits, true);
    result.push(...processedBenefits);
    result.push('');
  }
  
  // Add other packages separately
  for (const pkg of otherPackages) {
    result.push(`✨ ${pkg.name} :`);
    result.push(`🌙 Aktif Hingga : ${formatExpiryDaysOnly(pkg.expiry)}`);
    
    // Process other package benefits
    const processedBenefits = processBenefitsForPackage(pkg.benefits, false);
    result.push(...processedBenefits);
    result.push('');
  }
  
  // Remove last empty line
  if (result[result.length - 1] === '') {
    result.pop();
  }
  
  return result.join('\n');
};

// Function untuk process benefits per package - NEW
const processBenefitsForPackage = (benefitLines, isAkrab) => {
  const benefits = [];
  let currentBenefit = '';
  let foundKuotaBersama = false;
  let skipNext = false;
  
  for (let i = 0; i < benefitLines.length; i++) {
    const line = benefitLines[i];
    
    if (line.includes('🎁 Benefit:')) {
      let benefitName = line.replace('🎁 Benefit:', '').trim();
      
      if (isAkrab) {
        // Skip SMS and Voice
        if (benefitName.includes('SMS (ke XL)') || benefitName.includes('Nelp (ke XL)')) {
          skipNext = true;
          continue;
        }
        
        // Handle Kuota Bersama
        if (benefitName.includes('24jam di semua jaringan')) {
          if (!foundKuotaBersama) {
            foundKuotaBersama = true;
            skipNext = true;
            continue;
          } else {
            benefitName = 'Kuota Bersama';
          }
        }
        
        // Map other names
        if (benefitName.includes('Nasional')) benefitName = 'Kuota Nasional';
        if (benefitName.includes('myRewards')) benefitName = 'My Reward';
      } else {
        // Non-Akrab naming - Remove "24Jam" text from all benefits
        // Remove "24Jam" or "24 Jam" (case insensitive) but keep other "jam" words
        benefitName = benefitName.replace(/24\s*[Jj]am(?=\s|$)/g, '').trim();
        
        // Then apply specific mappings
        if (benefitName.includes('Semua Jaringan')) {
          // Check for app-specific first
          if (benefitName.match(/YouTube|Instagram|Facebook|Netflix|Iflix|VIU|Joox/i)) {
            const appMatch = benefitName.match(/(YouTube|Instagram|Facebook|Netflix|Iflix|VIU|Joox)/i);
            if (appMatch) {
              benefitName = appMatch[1];
            }
          } else {
            benefitName = benefitName.replace('Semua Jaringan', 'Kuota reguler').replace(/\s+/g, ' ').trim();
          }
        } else if (benefitName.includes('di semua jaringan')) {
          benefitName = benefitName.replace('di semua jaringan', 'Kuota Utama').replace(/\s+/g, ' ').trim();
        }
        
        // Clean up extra spaces
        benefitName = benefitName.replace(/\s+/g, ' ').trim();
      }
      
      currentBenefit = benefitName;
      skipNext = false;
    } else if (line.includes('🌲 Sisa Kuota:') && currentBenefit && !skipNext) {
      const sisaKuota = line.replace('🌲 Sisa Kuota:', '').trim();
      benefits.push({ name: currentBenefit, sisa: sisaKuota });
      currentBenefit = '';
    } else if (skipNext && line.includes('🌲 Sisa Kuota:')) {
      skipNext = false;
    }
  }
  
  // Sort Akrab benefits
  if (isAkrab) {
    benefits.sort((a, b) => {
      const order = ['Kuota Bersama', 'Kuota Nasional', 'Kuota Lokal 2', 'Kuota Lokal 3', 'Kuota Lokal 4', 'My Reward'];
      const aIndex = order.indexOf(a.name);
      const bIndex = order.indexOf(b.name);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }
  
  // Format with alignment
  return formatBenefitsWithAlignment(benefits);
};

// Function untuk format benefits dengan alignment yang rapi
const formatBenefitsWithAlignment = (benefits) => {
  if (benefits.length === 0) return [];
  
  let maxNameLength = Math.max(...benefits.map(b => b.name.length));
  let maxValueLength = Math.max(...benefits.map(b => {
    const valueOnly = b.sisa === '0' ? '0' : b.sisa.replace(/\s*(GB|MB|KB)$/i, '');
    return valueOnly.length;
  }));
  
  return benefits.map(benefit => {
    const paddedName = benefit.name.padEnd(maxNameLength);
    
    let sisaFormatted;
    if (benefit.sisa === '0') {
      sisaFormatted = '0'.padStart(maxValueLength) + ' GB';
    } else {
      const valueMatch = benefit.sisa.match(/^(.*?)\s*(GB|MB|KB)?$/i);
      if (valueMatch) {
        const value = valueMatch[1];
        const unit = valueMatch[2] || 'GB';
        sisaFormatted = value.padStart(maxValueLength) + ' ' + unit;
      } else {
        sisaFormatted = benefit.sisa.padStart(maxValueLength + 3);
      }
    }
    
    return `<code>🔖 ${paddedName} : ${sisaFormatted}</code>`;
  });
};

// ===== END FORMATTING FUNCTIONS =====

// Storage untuk dompul states
const dompulStates = new Map(); // key: chatId, value: { step, inputMessageId, timeoutId }

// Database setup
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

// Initialize settings table if not exists
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);
  
  // Set default dompul enabled jika belum ada
  db.get("SELECT value FROM settings WHERE key = 'dompul_enabled'", (err, row) => {
    if (!row) {
      db.run("INSERT INTO settings (key, value) VALUES ('dompul_enabled', 'true')");
    }
  });
});

// Function untuk get setting dari database
const getSetting = (key) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT value FROM settings WHERE key = ?", [key], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.value : null);
    });
  });
};

// Function untuk set setting ke database
const setSetting = (key, value) => {
  return new Promise((resolve, reject) => {
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

// Function untuk cek apakah dompul enabled
const isDompulEnabled = async () => {
  try {
    const value = await getSetting('dompul_enabled');
    return value === 'true';
  } catch (error) {
    console.error('Error checking dompul status:', error);
    return true; // Default true jika error
  }
};

function isAuthorized(id) {
  return id.toString() === process.env.ADMIN_ID;
}

// Mapping seri nomor XL dan Axis
const xlAxisSeries = [
  '0817', '0818', '0819', // XL
  '0859', '0877', '0878', // XL
  '0831', '0832', '0833', '0838' // Axis
];

// Function untuk cek apakah nomor adalah XL/Axis
const isXLAxisNumber = (nomor) => {
  // Nomor sudah dalam format 08xxxxxxx, langsung cek prefix
  const prefix = nomor.substring(0, 4);
  return xlAxisSeries.includes(prefix);
};

// Function untuk cek dompul single nomor menggunakan KMSP Store API
const checkDompul = async (nomor_hp) => {
  try {
    // Nomor sudah dinormalisasi ke format 08xxxxxxx, langsung gunakan
    const formattedMsisdn = nomor_hp;

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

    // Cek apakah response mengandung pesan error setelah separator ===========================
    // Atau cek field "message" untuk informasi tambahan
    let messageInfo = null;
    
    // Cek field message untuk informasi tambahan
    if (response.data && response.data.message) {
      messageInfo = response.data.message;
    }
    
    if (response.data && response.data.data && response.data.data.hasil) {
      const hasil = response.data.data.hasil;
      const equalsSeparatorIndex = hasil.indexOf('===========================');
      
      if (equalsSeparatorIndex !== -1) {
        // Ambil content setelah tanda === pertama
        const contentAfterSeparator = hasil.substring(equalsSeparatorIndex);
        
        // Deteksi pesan error dalam content setelah separator
        const criticalErrorPatterns = [
          /nomor.*?tidak.*?terdaftar/i,
          /layanan.*?tidak.*?tersedia/i,
          /sistem.*?sedang.*?maintenance/i,
          /gagal.*?memproses.*?permintaan/i
        ];

        // Hanya return error untuk critical errors yang tidak memiliki data basic
        const hasCriticalError = criticalErrorPatterns.some(pattern => pattern.test(contentAfterSeparator));
        
        if (hasCriticalError) {
          // Extract pesan error spesifik
          let errorMessage = 'Error tidak diketahui';
          for (const pattern of criticalErrorPatterns) {
            const match = contentAfterSeparator.match(pattern);
            if (match) {
              errorMessage = match[0];
              break;
            }
          }
          
          // Untuk critical error, kembalikan sebagai error
          return {
            status: 'error',
            message: errorMessage,
            messageInfo: messageInfo // Sertakan info dari field message
          };
        }
        
        // Untuk rate limit dan no package, tetap return success 
        // biar data basic bisa diparsing dan error ditampilkan di tengah
      }
    }

    return {
      status: 'success',
      data: response.data,
      messageInfo: messageInfo // Sertakan info dari field message
    };
  } catch (error) {
    console.error(`❌ Error checking dompul untuk ${nomor_hp}:`, error.message);
    
    // Ekstrak informasi dari field message jika ada dalam error response
    let messageInfo = null;
    if (error.response && error.response.data && error.response.data.message) {
      messageInfo = error.response.data.message;
    }
    
    return {
      status: 'error',
      message: error.response?.data?.message || error.message,
      messageInfo: messageInfo
    };
  }
};

module.exports = (bot) => {
  // Handle /dompulon command (Admin only)
  bot.onText(/\/dompulon$/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Cek authorization
    if (!isAuthorized(userId)) {
      return bot.sendMessage(chatId, "❌ Anda tidak memiliki akses untuk menggunakan command ini.");
    }

    try {
      await setSetting('dompul_enabled', 'true');
      await bot.sendMessage(chatId, "✅ <b>Fitur Dompul telah diaktifkan!</b>", { parse_mode: 'HTML' });
    } catch (error) {
      console.error('Error enabling dompul:', error);
      await bot.sendMessage(chatId, "❌ <b>Gagal mengaktifkan fitur dompul!</b>", { parse_mode: 'HTML' });
    }
  });

  // Handle /dompuloff command (Admin only)
  bot.onText(/\/dompuloff$/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Cek authorization
    if (!isAuthorized(userId)) {
      return bot.sendMessage(chatId, "❌ Anda tidak memiliki akses untuk menggunakan command ini.");
    }

    try {
      await setSetting('dompul_enabled', 'false');
      await bot.sendMessage(chatId, "🔒 <b>Fitur Dompul telah dinonaktifkan!</b>", { parse_mode: 'HTML' });
    } catch (error) {
      console.error('Error disabling dompul:', error);
      await bot.sendMessage(chatId, "❌ <b>Gagal menonaktifkan fitur dompul!</b>", { parse_mode: 'HTML' });
    }
  });

  // Handle /dompul command
  bot.onText(/\/dompul$/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Hapus command message segera
    autoDeleteMessage(bot, chatId, msg.message_id, 0);

    // === SAFEGUARD: Clear existing state jika ada ===
    if (dompulStates.has(chatId)) {
      const existingState = dompulStates.get(chatId);
      if (existingState.inputMessageId) {
        autoDeleteMessage(bot, chatId, existingState.inputMessageId, 0);
      }
      // Clear existing timeout jika ada
      if (existingState.timeoutId) {
        clearTimeout(existingState.timeoutId);
      }
      dompulStates.delete(chatId);
    }

    // Cek apakah fitur dompul aktif (admin bypass)
    const enabled = await isDompulEnabled();
    const isAdmin = isAuthorized(userId);
    
    if (!enabled && !isAdmin) {
      const closedMsg = await bot.sendMessage(chatId, "<b><i>Fitur ditutup!</i></b>", { parse_mode: 'HTML' });
      autoDeleteMessage(bot, chatId, closedMsg.message_id, 3000);
      return;
    }

    // Set state untuk input nomor
    dompulStates.set(chatId, { step: 'input_nomor' });
    
    const inputMsg = await sendStyledInputMessage(bot, chatId,
      'Masukan nomor . . .\n' +
      'Bisa massal, pisahkan dengan Enter.'
    );
    
    // Setup timeout 30 detik untuk auto-delete pesan input
    const timeoutId = setTimeout(async () => {
      const currentState = dompulStates.get(chatId);
      if (currentState && currentState.step === 'input_nomor') {
        // Auto-delete pesan input karena timeout
        if (currentState.inputMessageId) {
          autoDeleteMessage(bot, chatId, currentState.inputMessageId, 0);
        }
        
        // Send timeout message dengan auto-delete
        const timeoutMsg = await bot.sendMessage(chatId, 
          '<i>⏰ Waktu input habis (30 detik)\nSilakan ketik /dompul untuk mengulang</i>', 
          { parse_mode: 'HTML' }
        );
        autoDeleteMessage(bot, chatId, timeoutMsg.message_id, 5000);
        
        // Clear state
        dompulStates.delete(chatId);
      }
    }, 30000); // 30 detik timeout
    
    // Simpan message ID input dan timeout ID untuk bisa diedit/clear nanti
    const currentState = dompulStates.get(chatId);
    currentState.inputMessageId = inputMsg.message_id;
    currentState.timeoutId = timeoutId;
    dompulStates.set(chatId, currentState);
  });

  // Handle text input untuk dompul
  bot.on('message', async (msg) => {
    if (!msg || !msg.chat || !msg.from || !msg.text) return;
    
    // === PROTEKSI BROADCAST SESI ===
    // Jika admin sedang dalam sesi broadcast, jangan proses trigger menu lain
    if (bot.isAdminInBroadcastSession && bot.isAdminInBroadcastSession(msg)) {
      return; // Skip processing, biarkan broadcast handler yang menangani
    }
    
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text.trim();

    const state = dompulStates.get(chatId);
    if (!state || state.step !== 'input_nomor') return;
    
    // === SAFEGUARD: Prevent duplicate processing ===
    if (state.processing) return; // Skip jika sedang diproses
    
    if (text.startsWith("/")) return;
    
    try {
      // === SET PROCESSING FLAG ===
      state.processing = true;
      dompulStates.set(chatId, state);
      
      // === CEK CANCEL/EXIT ===
      if (EXIT_KEYWORDS.COMBINED.includes(text)) {
        // Clear timeout jika ada
        if (state.timeoutId) {
          clearTimeout(state.timeoutId);
        }
        
        // Hapus input form dengan auto-delete
        if (state.inputMessageId) {
          autoDeleteMessage(bot, chatId, state.inputMessageId, 0);
        }
        
        // Hapus user message
        autoDeleteMessage(bot, chatId, msg.message_id, 0);
        
        // Clear state
        dompulStates.delete(chatId);
        return;
      }

      // Parse nomor HP menggunakan utility - deteksi absolut dengan normalisasi
      const validNumbers = extractPhonesFromMultilineText(text);
      const uniqueNumbers = validNumbers; // Already deduplicated by utility
      
      if (uniqueNumbers.length === 0) {
        const errorMsg = await bot.sendMessage(chatId, 
          '❌ <b>Tidak ada nomor Indonesia yang valid!</b>\n\n' +
          'Format: Nomor Indonesia 08xxxxxxxx\n' +
          'Coba lagi atau ketik "exit" untuk batal.',
          { parse_mode: 'HTML' }
        );
        
        // Auto-delete error message dan user input
        autoDeleteMessage(bot, chatId, errorMsg.message_id, 3000);
        autoDeleteMessage(bot, chatId, msg.message_id, 0);
        
        // Reset processing flag
        state.processing = false;
        dompulStates.set(chatId, state);
        return;
      }

      // Clear timeout karena user sudah input valid
      if (state.timeoutId) {
        clearTimeout(state.timeoutId);
      }

      // Hapus pesan input user dan form input dengan auto-delete
      if (state.inputMessageId) {
        autoDeleteMessage(bot, chatId, state.inputMessageId, 0);
      }
      autoDeleteMessage(bot, chatId, msg.message_id, 0);

      // Tampilkan pesan "Sedang diproses"
      const processingMsg = await bot.sendMessage(chatId, 
        '<i>Sedang diproses, mohon tunggu</i>', 
        { parse_mode: 'HTML' }
      );

      // Mulai proses cek dompul massal secara concurrent
      let totalSuccess = 0;
      let totalFailed = 0;
      let completedCount = 0;

      // Function untuk process single nomor
      const processSingleNomor = async (nomor_hp, index) => {
        try {
          // Nomor sudah dinormalisasi ke format 08xxxxxxx, langsung gunakan untuk display
          const displayNumber = nomor_hp;
          
          // Cek apakah nomor adalah XL/Axis
          if (!isXLAxisNumber(nomor_hp)) {
            return {
              success: false,
              nomor: displayNumber,
              index: index,
              error: 'Bukan nomor XL & Axis 🗿',
              isValidProvider: false
            };
          }

          // Hit API cek dompul
          const result = await checkDompul(nomor_hp);

          return {
            success: result.status === 'success',
            nomor: displayNumber,
            index: index,
            data: result.data,
            error: result.message,
            messageInfo: result.messageInfo, // Tambahan informasi dari field message
            isValidProvider: true
          };

        } catch (error) {
          // Nomor sudah dinormalisasi, langsung gunakan
          const displayNumber = nomor_hp;

          return {
            success: false,
            nomor: displayNumber,
            index: index,
            error: error.message,
            messageInfo: null, // Tidak ada messageInfo untuk exception
            isValidProvider: true
          };
        }
      };

      // Function untuk send hasil segera setelah API call selesai
      const processAndSendResult = async (result) => {
        completedCount++;
        
        // Hapus pesan "Sedang diproses" pada output pertama
        if (completedCount === 1 && processingMsg) {
          autoDeleteMessage(bot, chatId, processingMsg.message_id, 0);
        }
        
        try {
          if (result.success && result.data && result.data.data && result.data.data.hasil) {
            // Parse dan format hasil sesuai format yang diinginkan
            let rawData = result.data.data.hasil
              .replace(/<br>/g, '\n')
              .replace(/<[^>]*>/g, '') // Remove HTML tags
              .replace(/&nbsp;/g, ' ') // Replace HTML space
              .trim();

            // ===== DETEKSI ERROR MESSAGES DARI FIELD "HASIL" =====
            // Cek apakah ada pesan error setelah tanda ===========================
            const equalsSeparatorIndex = rawData.indexOf('===========================');
            let hasErrorAfterSeparator = false;
            let errorMessage = '';
            
            if (equalsSeparatorIndex !== -1) {
              // Ambil content setelah tanda === pertama
              const contentAfterSeparator = rawData.substring(equalsSeparatorIndex).trim();
              
              // Deteksi pattern error dalam content setelah separator
              const errorPatterns = [
                { pattern: /batas maksimal pengecekan.*?dalam.*?jam/i, message: '❗️Telah melakukan pengecekan 5x\n~  Coba lagi nanti 🗿' },
                { pattern: /MSISDN.*?tidak memiliki paket/i, message: '📦 Nomor tidak memiliki paket aktif\n~  Langsung isi kuota saja😁' },
                { pattern: /nomor.*?tidak.*?terdaftar/i, message: '📱 Invalid: Nomor tidak terdaftar' },
                { pattern: /layanan.*?tidak.*?tersedia/i, message: '🚫 Service: Layanan tidak tersedia' },
                { pattern: /sistem.*?sedang.*?maintenance/i, message: '🔧 Maintenance: Sistem sedang maintenance' },
                { pattern: /gagal.*?memproses.*?permintaan/i, message: '❌ Failed: Gagal memproses permintaan' }
              ];

              for (const errorPattern of errorPatterns) {
                if (errorPattern.pattern.test(contentAfterSeparator)) {
                  hasErrorAfterSeparator = true;
                  errorMessage = errorPattern.message;
                  break;
                }
              }
            }

            // Jika bukan error message, atau ada error tapi tetap ada data basic, lanjutkan parsing normal
            
            // ===== GUNAKAN FORMATTING DARI d.js =====
            
            // Filter out Volte status lines, Tipe Kuota, and Kuota lines, then format other fields
            const filteredHasil = rawData
              .split('\n')
              .filter(line => {
                const trimmedLine = line.trim();
                return !trimmedLine.startsWith('Status Volte Device:') &&
                       !trimmedLine.startsWith('Status Volte Area:') &&
                       !trimmedLine.startsWith('Status Volte Simcard:') &&
                       !line.includes('🎁 Tipe Kuota:') &&
                       !line.includes('🎁 Kuota:') &&
                       !line.includes('📃 RESULT:');
              })
              .map(line => {
                // Format MSISDN menjadi Nomor
                if (line.trim().startsWith('MSISDN:')) {
                  let nomorText = line.replace('MSISDN:', '').trim();
                  return `Nomor: ${nomorText}`;
                }
                
                // Format umur kartu untuk menghilangkan "0 Tahun" dan tampilan yang lebih bersih
                if (line.trim().startsWith('Umur Kartu:')) {
                  let umurText = line.replace('Umur Kartu:', '').trim();
                  
                  // Parse tahun dan bulan
                  const tahunMatch = umurText.match(/(\d+)\s*Tahun/);
                  const bulanMatch = umurText.match(/(\d+)\s*Bulan/);
                  
                  let tahun = tahunMatch ? parseInt(tahunMatch[1]) : 0;
                  let bulan = bulanMatch ? parseInt(bulanMatch[1]) : 0;
                  
                  // Format berdasarkan nilai
                  let formattedUmur = '';
                  if (tahun > 0 && bulan > 0) {
                    formattedUmur = `${tahun} Tahun ${bulan} Bulan`;
                  } else if (tahun > 0 && bulan === 0) {
                    formattedUmur = `${tahun} Tahun`;
                  } else if (tahun === 0 && bulan > 0) {
                    formattedUmur = `${bulan} Bulan`;
                  } else {
                    // Jika tidak ada match atau keduanya 0, gunakan original text
                    formattedUmur = umurText || '-';
                  }
                  
                  return `Umur Kartu: ${formattedUmur}`;
                }
                
                // Format Status Dukcapil dengan simbol
                if (line.trim().startsWith('Status Dukcapil:')) {
                  let dukcapilText = line.replace('Status Dukcapil:', '').trim();
                  
                  if (dukcapilText === 'Sudah') {
                    return `Status Dukcapil: ${dukcapilText} ✅`;
                  } else if (dukcapilText === 'Belum') {
                    return `Status Dukcapil: ${dukcapilText} ❌`;
                  } else {
                    return line; // Jika status lain, biarkan seperti semula
                  }
                }
                
                // Format Masa Aktif dengan format tanggal yang readable
                if (line.trim().startsWith('Masa Aktif:')) {
                  let masaAktifText = line.replace('Masa Aktif:', '').trim();
                  let formattedDate = formatDateToReadable(masaAktifText);
                  return `Masa Aktif: ${formattedDate}`;
                }
                
                // Format Masa Berakhir Tenggang dengan format tanggal yang readable
                if (line.trim().startsWith('Masa Berakhir Tenggang:')) {
                  let tengganganText = line.replace('Masa Berakhir Tenggang:', '').trim();
                  let formattedDate = formatDateToReadable(tengganganText);
                  return `Masa Tenggang: ${formattedDate}`;
                }
                
                return line;
              })
              .join('\n');

            // Merge packages with similar names and process benefits menggunakan fungsi dari d.js
            let mergedResult = mergePackagesByName(filteredHasil);
            
            // Final formatting untuk Telegram dengan header SUKSES
            formattedResult = `├──────────SUKSES──────────┤\n${mergedResult}\n├─────────────────────────┤`;
            
            // Jika ada error setelah separator, tambahkan di tengah
            if (hasErrorAfterSeparator) {
              formattedResult += `\n${errorMessage}\n├─────────────────────────┤`;
              
              await bot.sendMessage(chatId, formattedResult, { parse_mode: 'HTML' });
              totalFailed++; // Count as failed karena ada error message
            } else {
              await bot.sendMessage(chatId, formattedResult, { parse_mode: 'HTML' });
              totalSuccess++; // Count as success karena tidak ada error
            }
            
          } else {
            // Handle error hasil - termasuk API error atau response tanpa data hasil
            let errorText = '';
            
            if (!result.isValidProvider) {
              errorText = `❌ <b>NOMOR ${result.index + 1}/${uniqueNumbers.length}</b> <code>[${completedCount}/${uniqueNumbers.length}]</code>\n\n<i>Nomer ${result.nomor} ${result.error}</i>`;
            } else {
              // Jika ada messageInfo, prioritaskan menampilkan itu saja dengan format sederhana
              if (result.messageInfo) {
                errorText = `<i>❗Maintenance\n~ ${result.messageInfo}</i>`;
              } else {
                // Fallback ke format error biasa jika tidak ada messageInfo
                let errorMessage = result.error || 'Error tidak diketahui';
                
                // Pertahankan pesan error asli tanpa modifikasi berlebihan
                // Hanya clean up HTML tags jika ada
                if (typeof errorMessage === 'string') {
                  errorMessage = errorMessage.replace(/<[^>]*>/g, '').trim();
                }
                
                errorText = `❌ <b>NOMOR ${result.index + 1}/${uniqueNumbers.length}</b> <code>[${completedCount}/${uniqueNumbers.length}]</code>\n\n<i>Nomor ${result.nomor} - ${errorMessage}</i>`;
              }
            }
            
            await bot.sendMessage(chatId, errorText, { parse_mode: 'HTML' });
            totalFailed++;
          }

        } catch (sendError) {
          console.error('Error sending result:', sendError.message);
          totalFailed++;
        }
      };

      // Jalankan semua API call secara concurrent
      const allPromises = uniqueNumbers.map((nomor_hp, index) => 
        processSingleNomor(nomor_hp, index).then(result => {
          // Process dan kirim hasil segera setelah API call selesai
          return processAndSendResult(result);
        }).catch(error => {
          // Handle error dan kirim juga
          const errorResult = {
            success: false,
            error: error.message,
            nomor: nomor_hp,
            index: index,
            isValidProvider: true
          };
          return processAndSendResult(errorResult);
        })
      );

      // Tunggu SEMUA hasil dikirim (tapi pengiriman sudah real-time)
      await Promise.allSettled(allPromises);

      // Clean up state
      dompulStates.delete(chatId);

    } catch (error) {
      console.error('Error handling dompul input:', error.message);
      
      // Clear timeout jika ada error
      if (state && state.timeoutId) {
        clearTimeout(state.timeoutId);
      }
      
      const errorMsg = await bot.sendMessage(chatId, '❌ <b>Terjadi error, silakan coba lagi!</b>', { parse_mode: 'HTML' });
      autoDeleteMessage(bot, chatId, errorMsg.message_id, 3000);
      dompulStates.delete(chatId);
    }
  });
};

// Export fungsi-fungsi yang dibutuhkan untuk callback handler
module.exports.isDompulEnabled = isDompulEnabled;
module.exports.isAuthorized = isAuthorized;
module.exports.dompulStates = dompulStates;
module.exports.formatDateToReadable = formatDateToReadable;
module.exports.formatExpiryDaysOnly = formatExpiryDaysOnly;
module.exports.mergePackagesByName = mergePackagesByName;
module.exports.processBenefitsForPackage = processBenefitsForPackage;
module.exports.formatBenefitsWithAlignment = formatBenefitsWithAlignment;