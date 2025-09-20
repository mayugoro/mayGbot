const axios = require('axios');
const readline = require('readline');
const { calculateDaysDiff, formatToDDMMYYYY, formatPackageExpiry, parseToJakartaDate } = require('./utils/date');

// Function untuk clear screen cross-platform
const clearScreen = () => {
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

// Function untuk post-process data yang sudah merged - SIMPLIFIED
const postProcessAkrabBenefits = (resultText) => {
  // No more processing needed, mergePackagesByName sudah handle semuanya
  return resultText;
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
            return `Masa Tenggang: ${formattedDate}`;
          }
          
          return line;
        })
        .join('\n');

      // Merge packages with similar names and process benefits
      let mergedResult = mergePackagesByName(filteredHasil);
      
      // Post-process (simplified, no more complex processing needed)
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
  formatExpiryDaysOnly,
  mergePackagesByName, 
  postProcessAkrabBenefits 
};