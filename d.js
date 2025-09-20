const axios = require('axios');
const readline = require('readline');
const { calculateDaysDiff, formatToDDMMYYYY, formatPackageExpiry, parseToJakartaDate } = require('./utils/date');

// Function untuk clear screen cross-platform
const clearScreen = () => {
  // Clear screen untuk Windows dan Unix/Linux dengan delay
  console.clear();
};

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

// Function untuk menggabungkan package dengan nama yang mirip
const mergePackagesByName = (resultText) => {
  const lines = resultText.split('\n');
  const mergedLines = [];
  const packageGroups = new Map();
  
  let currentPackage = null;
  let currentBenefits = [];
  let isInPackageSection = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect package start
    if (line.includes('🎁 Quota:')) {
      // Save previous package if exists
      if (currentPackage) {
        const key = getPackageKey(currentPackage.name);
        if (!packageGroups.has(key)) {
          packageGroups.set(key, {
            names: [],
            expiry: currentPackage.expiry,
            benefits: [],
            isAkrab: key === 'akrab'
          });
        }
        packageGroups.get(key).names.push(currentPackage.name);
        
        // Process benefits untuk akrab package
        packageGroups.get(key).benefits.push(...currentBenefits);
      }
      
      // Start new package
      const packageName = line.replace('🎁 Quota:', '').trim();
      currentPackage = { name: packageName, expiry: null };
      currentBenefits = [];
      isInPackageSection = true;
      continue;
    }
    
    // Detect expiry date
    if (line.includes('🍂 Aktif Hingga:') && currentPackage) {
      currentPackage.expiry = line.replace('🍂 Aktif Hingga:', '').trim();
      continue;
    }
    
    // Detect separator (end of package)
    if (line.includes('===========================') && isInPackageSection) {
      isInPackageSection = false;
      continue;
    }
    
    // Collect benefits
    if (isInPackageSection && (line.includes('🎁 Benefit:') || line.includes('🎁 Tipe Kuota:') || line.includes('🎁 Kuota:') || line.includes('🌲 Sisa Kuota:'))) {
      currentBenefits.push(line);
      continue;
    }
    
    // Non-package lines
    if (!isInPackageSection) {
      mergedLines.push(line);
    }
  }
  
  // Handle last package
  if (currentPackage) {
    const key = getPackageKey(currentPackage.name);
    if (!packageGroups.has(key)) {
      packageGroups.set(key, {
        names: [],
        expiry: currentPackage.expiry,
        benefits: [],
        isAkrab: key === 'akrab'
      });
    }
    packageGroups.get(key).names.push(currentPackage.name);
    
    // Process benefits untuk akrab package
    packageGroups.get(key).benefits.push(...currentBenefits);
  }
  
  // Reconstruct with merged packages
  const separatorIndex = mergedLines.findIndex(line => line.includes('==========================='));
  if (separatorIndex !== -1) {
    const beforePackages = mergedLines.slice(0, separatorIndex + 1);
    const afterPackages = mergedLines.slice(separatorIndex + 1);
    
    const reconstructed = [...beforePackages];
    
    // Add merged packages
    packageGroups.forEach((group, key) => {
      const mergedName = group.names.join(' + ');
      reconstructed.push(`✨ ${mergedName} :`);
      reconstructed.push(`� Aktif Hingga : ${group.expiry}`);
      reconstructed.push('');
      reconstructed.push(...group.benefits);
      reconstructed.push('');
    });
    
    reconstructed.push(...afterPackages);
    return reconstructed.join('\n');
  }
  
  return resultText;
};

// Function untuk mengurutkan benefits akrab sesuai prioritas (compatible dengan struktur object)
const sortAkrabBenefits = (benefits) => {
  const priorityOrder = [
    'Kuota Bersama',
    'Kuota Nasional', 
    'Kuota Lokal 2',
    'Kuota Lokal 3',
    'Kuota Lokal 4',
    'My Reward'
  ];
  
  const sorted = [];
  const others = [];
  
  // Sort based on priority
  priorityOrder.forEach(priority => {
    const found = benefits.find(benefit => {
      // Handle both object and string formats
      const benefitName = typeof benefit === 'object' ? benefit.name : benefit.split(':')[0];
      return benefitName === priority;
    });
    if (found) {
      sorted.push(found);
    }
  });
  
  // Add any other benefits not in priority list
  benefits.forEach(benefit => {
    const benefitName = typeof benefit === 'object' ? benefit.name : benefit.split(':')[0];
    if (!priorityOrder.includes(benefitName)) {
      others.push(benefit);
    }
  });
  
  return [...sorted, ...others];
};

// Function untuk post-process akrab benefits setelah merge dengan logic dompul.js
const postProcessAkrabBenefits = (resultText) => {
  const lines = resultText.split('\n');
  const processedLines = [];
  let isInAkrabPackage = false;
  let isInOtherPackage = false;
  let currentPackageName = '';
  let foundKuotaBersama = false;
  let skipNextBenefitBlock = false;
  let skipSmsVoiceBenefit = false;
  let currentBenefitName = '';
  let akrabBenefits = []; // Store akrab benefits for sorting
  let otherBenefits = []; // Store other package benefits
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect package headers
    if (line.startsWith('✨ ') && line.includes(' :')) {
      // Process previous package benefits if any
      if (isInAkrabPackage && akrabBenefits.length > 0) {
        // Sort and add akrab benefits dengan alignment
        const sortedBenefits = sortAkrabBenefits(akrabBenefits);
        const alignedBenefits = formatBenefitsWithAlignment(sortedBenefits);
        processedLines.push(...alignedBenefits);
        akrabBenefits = [];
      } else if (isInOtherPackage && otherBenefits.length > 0) {
        // Add other package benefits dengan alignment
        const alignedBenefits = formatBenefitsWithAlignment(otherBenefits);
        processedLines.push(...alignedBenefits);
        otherBenefits = [];
      }
      
      // Reset flags
      currentPackageName = line.replace('✨ ', '').replace(' :', '').trim();
      isInAkrabPackage = currentPackageName.toLowerCase().includes('akrab');
      isInOtherPackage = !isInAkrabPackage;
      foundKuotaBersama = false;
      skipNextBenefitBlock = false;
      skipSmsVoiceBenefit = false;
      
      processedLines.push(line);
      continue;
    }
    
    // Detect expiry line
    if (line.startsWith('🌙 Aktif Hingga :')) {
      processedLines.push(line);
      continue;
    }
    
    // Process benefits in akrab package
    if (isInAkrabPackage && line.includes('🎁 Benefit:')) {
      // Skip SMS and Voice benefits
      if (line.includes('SMS (ke XL)') || line.includes('Nelp (ke XL)')) {
        skipSmsVoiceBenefit = true;
        continue;
      }
      // Handle "24jam di semua jaringan" replacement and duplicate removal
      else if (line.includes('24jam di semua jaringan')) {
        // Always skip the first occurrence, take the second (last) one
        if (!foundKuotaBersama) {
          // Mark that we found the first one, skip it
          foundKuotaBersama = true;
          skipNextBenefitBlock = true;
          skipSmsVoiceBenefit = false;
          continue;
        } else {
          // This is the second occurrence, use this as "Kuota Bersama"
          currentBenefitName = 'Kuota Bersama';
          skipNextBenefitBlock = false;
          skipSmsVoiceBenefit = false;
        }
      } else {
        // Normal benefit
        skipNextBenefitBlock = false;
        skipSmsVoiceBenefit = false;
        // Apply benefit name mapping for Akrab
        let benefitName = line.replace('🎁 Benefit:', '').trim();
        if (benefitName.includes('Nasional')) {
          benefitName = 'Kuota Nasional';
        } else if (benefitName.includes('myRewards')) {
          benefitName = 'My Reward';
        }
        currentBenefitName = benefitName;
      }
    } else if (isInOtherPackage && line.includes('🎁 Benefit:')) {
      // Other package benefit
      skipSmsVoiceBenefit = false;
      skipNextBenefitBlock = false;
      let benefitName = line.replace('� Benefit:', '').trim();
      
      // Custom naming rules for non-Akrab benefits (sesuai dompul.js)
      if (benefitName.includes('24 Jam Semua Jaringan')) {
        // Check if it's an application-specific quota first
        if (benefitName.match(/YouTube|Instagram|Facebook|Netflix|Iflix|VIU|Joox/i)) {
          // For application-specific quotas, show only the app name
          const appMatch = benefitName.match(/(YouTube|Instagram|Facebook|Netflix|Iflix|VIU|Joox)/i);
          if (appMatch) {
            benefitName = appMatch[1];
          }
        }
        // For non-application quotas, replace "24 Jam Semua Jaringan" with "Kuota reguler"
        else {
          benefitName = benefitName.replace('24 Jam Semua Jaringan', 'Kuota reguler').replace(/\s+/g, ' ').trim();
        }
      } else if (benefitName.includes('24jam di semua jaringan')) {
        benefitName = 'Kuota Utama';
      }
      
      currentBenefitName = benefitName;
    } else if (line.includes('🌲 Sisa Kuota:') && currentBenefitName && !skipSmsVoiceBenefit && !skipNextBenefitBlock) {
      // Combine benefit name with sisa kuota
      const sisaKuota = line.replace('🌲 Sisa Kuota:', '').trim();
      
      if (isInAkrabPackage) {
        akrabBenefits.push({ name: currentBenefitName, sisa: sisaKuota });
      } else if (isInOtherPackage) {
        otherBenefits.push({ name: currentBenefitName, sisa: sisaKuota });
      }
      
      currentBenefitName = '';
    } else if (skipSmsVoiceBenefit) {
      // Skip lines that are part of SMS/Voice benefit blocks
      if (line.includes('🌲 Sisa Kuota:')) {
        continue;
      } else if (line.trim() === '') {
        // End of benefit block, stop skipping
        skipSmsVoiceBenefit = false;
        continue;
      } else if (line.includes('🎁 Benefit:')) {
        // New benefit started, stop skipping and process this line
        skipSmsVoiceBenefit = false;
        // Check again if this new benefit should be skipped
        if (line.includes('SMS (ke XL)') || line.includes('Nelp (ke XL)')) {
          skipSmsVoiceBenefit = true;
          continue;
        } else {
          currentBenefitName = line.replace('🎁 Benefit:', '').trim();
        }
      } else {
        continue;
      }
    } else if (skipNextBenefitBlock) {
      // Skip lines that are part of the duplicate benefit block
      if (line.includes('🌲 Sisa Kuota:')) {
        continue;
      } else if (line.trim() === '') {
        // End of benefit block, stop skipping
        skipNextBenefitBlock = false;
        continue;
      } else if (line.includes('🎁 Benefit:')) {
        // New benefit started, stop skipping
        skipNextBenefitBlock = false;
        // Check if this new benefit should be skipped for SMS/Voice
        if (line.includes('SMS (ke XL)') || line.includes('Nelp (ke XL)')) {
          skipSmsVoiceBenefit = true;
          continue;
        } else {
          currentBenefitName = line.replace('🎁 Benefit:', '').trim();
        }
      } else {
        continue;
      }
    } else {
      // Skip individual benefit/sisa kuota lines if they're not combined yet
      if (!line.includes('🎁 Benefit:') && !line.includes('🌲 Sisa Kuota:')) {
        processedLines.push(line);
      }
    }
  }
  
  // Process remaining benefits at the end
  if (isInAkrabPackage && akrabBenefits.length > 0) {
    const sortedBenefits = sortAkrabBenefits(akrabBenefits);
    const alignedBenefits = formatBenefitsWithAlignment(sortedBenefits);
    processedLines.push(...alignedBenefits);
  } else if (isInOtherPackage && otherBenefits.length > 0) {
    const alignedBenefits = formatBenefitsWithAlignment(otherBenefits);
    processedLines.push(...alignedBenefits);
  }
  
  return processedLines.join('\n');
};

// Function untuk format benefits dengan alignment yang rapi (sesuai dompul.js)
const formatBenefitsWithAlignment = (benefits) => {
  if (benefits.length === 0) return [];
  
  let maxNameLength = 0;
  let maxValueLength = 0;
  
  // Find max lengths for name and value alignment
  for (const benefit of benefits) {
    if (benefit.name.length > maxNameLength) {
      maxNameLength = benefit.name.length;
    }
    
    // Extract number part for alignment (remove unit like GB, MB, KB)
    let valueOnly = benefit.sisa === '0' ? '0' : benefit.sisa.replace(/\s*(GB|MB|KB)$/i, '');
    if (valueOnly.length > maxValueLength) {
      maxValueLength = valueOnly.length;
    }
  }
  
  const alignedBenefits = [];
  for (const benefit of benefits) {
    const paddedName = benefit.name.padEnd(maxNameLength);
    
    // Format sisa with aligned units
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
        sisaFormatted = benefit.sisa.padStart(maxValueLength + 3); // fallback
      }
    }
    
    alignedBenefits.push(`<code>🔖 ${paddedName} : ${sisaFormatted}</code>`);
  }
  
  return alignedBenefits;
};

// Function untuk mendapatkan key package berdasarkan kata kunci
const getPackageKey = (packageName) => {
  const name = packageName.toLowerCase();
  
  if (name.includes('akrab')) {
    return 'akrab';
  }
  if (name.includes('bundling')) {
    return 'bundling';
  }
  if (name.includes('pelanggan baru')) {
    return 'pelanggan_baru';
  }
  if (name.includes('unlimited')) {
    return 'unlimited';
  }
  
  // Default: use first word as key
  return packageName.split(' ')[0].toLowerCase();
};

// Function untuk cek dompul single nomor menggunakan KMSP Store API
const checkDompulRaw = async (nomor_hp) => {
  try {
    // Clear screen sebelum mulai checking
    clearScreen();
    
    console.log('🚀 DOMPUL KMSP RESPONSE TESTER');
    console.log('='.repeat(50));
    console.log(`🔍 Checking dompul for: ${nomor_hp}`);
    console.log('⏳ Please wait...\n');

    const params = {
      msisdn: nomor_hp,
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

    console.log('\n' + '='.repeat(80));

    // Extract dan tampilkan field "hasil" jika ada
    if (response.data && response.data.data && response.data.data.hasil) {
      // Tampilkan versi cleaned up (remove HTML tags)
      const cleanedHasil = response.data.data.hasil
        .replace(/<br>/g, '\n')
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ') // Replace HTML space
        .trim();

      // Filter out Volte status lines, Tipe Kuota, and Kuota lines, then format other fields
      const filteredHasil = cleanedHasil
        .split('\n')
        .filter(line => {
          const trimmedLine = line.trim();
          return !trimmedLine.startsWith('Status Volte Device:') &&
                 !trimmedLine.startsWith('Status Volte Area:') &&
                 !trimmedLine.startsWith('Status Volte Simcard:') &&
                 !line.includes('🎁 Tipe Kuota:') &&
                 !line.includes('🎁 Kuota:');
        })
        .map(line => {
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
            return `Masa Berakhir Tenggang: ${formattedDate}`;
          }
          
          return line;
        })
        .join('\n');

      // Merge packages with similar names and process akrab benefits
      let mergedResult = mergePackagesByName(filteredHasil);
      
      // Post-process to fix "24jam di semua jaringan" in akrab packages
      mergedResult = postProcessAkrabBenefits(mergedResult);

      console.log(mergedResult);

    } else {
      console.log('\n❌ No hasil data available in response');
    }

    console.log('\n' + '='.repeat(80));

    return {
      status: 'success',
      data: response.data,
      hasil: response.data?.data?.hasil || null,
      packages: response.data?.data?.packages || null
    };

  } catch (error) {
    console.error('\n❌ DOMPUL CHECK FAILED');
    console.error('━'.repeat(40));
    console.error(`   Error: ${error.message}`);
    
    if (error.response?.status) {
      console.error(`   HTTP Status: ${error.response.status}`);
    }
    
    if (error.response?.data?.message) {
      console.error(`   API Message: ${error.response.data.message}`);
    }
    
    console.error('━'.repeat(40));

    return {
      status: 'error',
      message: error.response?.data?.message || error.message
    };
  }
};

// Function untuk normalize nomor HP ke format 08xxxxxxxx
const normalizePhoneNumber = (phone) => {
  // Remove all non-digits
  let cleaned = phone.replace(/\D/g, '');
  
  // Convert 62 prefix to 08
  if (cleaned.startsWith('62')) {
    cleaned = '0' + cleaned.substring(2);
  }
  
  // Ensure starts with 08
  if (!cleaned.startsWith('08')) {
    if (cleaned.startsWith('8')) {
      cleaned = '0' + cleaned;
    } else {
      return null; // Invalid format
    }
  }
  
  // Check length (should be 10-13 digits after 08)
  if (cleaned.length < 10 || cleaned.length > 15) {
    return null;
  }
  
  return cleaned;
};

// Function untuk validate XL/Axis number
const isXLAxisNumber = (nomor) => {
  const xlAxisSeries = [
    '0817', '0818', '0819', // XL
    '0859', '0877', '0878', // XL
    '0831', '0832', '0833', '0838' // Axis
  ];
  
  const prefix = nomor.substring(0, 4);
  return xlAxisSeries.includes(prefix);
};

// Main function
const main = async () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Clear screen saat pertama kali start
  clearScreen();

  console.log('🚀 DOMPUL KMSP RESPONSE TESTER');
  console.log('='.repeat(50));
  console.log('📱 Masukkan nomor HP untuk testing...');
  console.log('   Format: 08xxxxxxxx atau 62xxxxxxxx');
  console.log('   🎯 Output: Field "hasil" & "packages"');
  console.log('   Ketik "exit" untuk keluar\n');

  const askForNumber = () => {
    rl.question('🔢 Nomor HP: ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        clearScreen();
        console.log('\n👋 Terima kasih telah menggunakan DOMPUL TESTER!');
        console.log('🚀 Happy coding! 🚀\n');
        rl.close();
        return;
      }

      const normalizedNumber = normalizePhoneNumber(input);
      
      if (!normalizedNumber) {
        console.log('\n❌ Format nomor tidak valid! Gunakan format 08xxxxxxxx atau 62xxxxxxxx');
        console.log('⏳ Menunggu input yang benar...\n');
        askForNumber();
        return;
      }

      if (!isXLAxisNumber(normalizedNumber)) {
        console.log('⚠️  Warning: Nomor bukan XL/Axis, tetapi tetap akan dicoba...');
      }

      console.log(`✅ Normalized number: ${normalizedNumber}\n`);
      
      try {
        await checkDompulRaw(normalizedNumber);
      } catch (error) {
        console.error('💥 Unexpected error:', error.message);
      }

      // Setelah selesai, tampilkan prompt untuk input berikutnya
      askForNumber();
    });
  };

  askForNumber();
};

// Run the tester
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { 
  checkDompulRaw, 
  normalizePhoneNumber, 
  isXLAxisNumber, 
  clearScreen, 
  formatDateToReadable, 
  mergePackagesByName, 
  postProcessAkrabBenefits 
};