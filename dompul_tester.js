const axios = require('axios');
const readline = require('readline');

// Function untuk cek dompul single nomor menggunakan KMSP Store API
const checkDompulRaw = async (nomor_hp) => {
  try {
    console.log(`🔍 Checking dompul for: ${nomor_hp}`);

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
    console.log('📱 DOMPUL CHECK RESULT');
    console.log('='.repeat(80));

    // Extract dan tampilkan field "hasil" jika ada
    if (response.data && response.data.data && response.data.data.hasil) {
      // Tampilkan versi cleaned up (remove HTML tags)
      const cleanedHasil = response.data.data.hasil
        .replace(/<br>/g, '\n')
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ') // Replace HTML space
        .trim();

      console.log('\n📋 DOMPUL INFORMATION:');
      console.log('━'.repeat(60));
      console.log(cleanedHasil);
      console.log('━'.repeat(60));

      // Extract dan tampilkan field "packages" jika ada (structured data)
      if (response.data && response.data.data && response.data.data_sp && response.data.data_sp.quotas && response.data.data_sp.quotas.value && response.data.data_sp.quotas.value.length > 0) {
        console.log('\n📦 STRUCTURED PACKAGES DATA:');
        console.log('━'.repeat(60));
        
        const quotaData = response.data.data_sp.quotas.value;
        quotaData.forEach((quotaGroup, groupIndex) => {
          if (quotaGroup && quotaGroup[0] && quotaGroup[0].packages) {
            const pkg = quotaGroup[0].packages;
            console.log(`\n✨ Package ${groupIndex + 1}: ${pkg.name}`);
            console.log(`   📅 Expires: ${pkg.expDate}`);
            
            if (quotaGroup[0].benefits && quotaGroup[0].benefits.length > 0) {
              console.log('   📊 Benefits:');
              quotaGroup[0].benefits.forEach((benefit, benefitIndex) => {
                console.log(`      ${benefitIndex + 1}. ${benefit.bname} (${benefit.type})`);
                console.log(`         Quota: ${benefit.quota} | Remaining: ${benefit.remaining}`);
              });
            }
          }
        });
        
        console.log('━'.repeat(60));
      } else {
        console.log('\n📦 STRUCTURED PACKAGES DATA:');
        console.log('━'.repeat(30));
        console.log('❌ No structured package data available');
        console.log('━'.repeat(30));
      }

      // Analisa error patterns untuk informasi tambahan
      console.log('\n🔍 STATUS ANALYSIS:');
      console.log('━'.repeat(40));

      const equalsSeparatorIndex = cleanedHasil.indexOf('===========================');
      if (equalsSeparatorIndex !== -1) {
        const contentAfterSeparator = cleanedHasil.substring(equalsSeparatorIndex).trim();
        
        // Check error patterns
        const errorPatterns = [
          { pattern: /batas maksimal pengecekan.*?dalam.*?jam/i, name: '⚠️ Rate Limit Reached', status: 'warning' },
          { pattern: /MSISDN.*?tidak memiliki paket/i, name: '📦 No Active Package', status: 'info' },
          { pattern: /nomor.*?tidak.*?terdaftar/i, name: '❌ Invalid Number', status: 'error' },
          { pattern: /layanan.*?tidak.*?tersedia/i, name: '🚫 Service Unavailable', status: 'error' },
          { pattern: /sistem.*?sedang.*?maintenance/i, name: '🔧 System Maintenance', status: 'warning' },
          { pattern: /gagal.*?memproses.*?permintaan/i, name: '❌ Processing Failed', status: 'error' }
        ];

        let statusFound = false;
        for (const errorPattern of errorPatterns) {
          if (errorPattern.pattern.test(contentAfterSeparator)) {
            console.log(`   ${errorPattern.name}`);
            statusFound = true;
            break;
          }
        }
        
        if (!statusFound) {
          console.log('   ✅ All systems normal');
        }
      } else {
        console.log('   ✅ Data retrieved successfully');
      }

    } else {
      console.log('\n❌ DOMPUL INFORMATION:');
      console.log('━'.repeat(30));
      console.log('No hasil data available in response');
      console.log('━'.repeat(30));
      
      // Tetap cek structured data meskipun "hasil" tidak ada
      if (response.data && response.data.data && response.data.data_sp && response.data.data_sp.quotas && response.data.data_sp.quotas.value && response.data.data_sp.quotas.value.length > 0) {
        console.log('\n📦 STRUCTURED PACKAGES DATA:');
        console.log('━'.repeat(60));
        
        const quotaData = response.data.data_sp.quotas.value;
        quotaData.forEach((quotaGroup, groupIndex) => {
          if (quotaGroup && quotaGroup[0] && quotaGroup[0].packages) {
            const pkg = quotaGroup[0].packages;
            console.log(`\n✨ Package ${groupIndex + 1}: ${pkg.name}`);
            console.log(`   📅 Expires: ${pkg.expDate}`);
            
            if (quotaGroup[0].benefits && quotaGroup[0].benefits.length > 0) {
              console.log('   📊 Benefits:');
              quotaGroup[0].benefits.forEach((benefit, benefitIndex) => {
                console.log(`      ${benefitIndex + 1}. ${benefit.bname} (${benefit.type})`);
                console.log(`         Quota: ${benefit.quota} | Remaining: ${benefit.remaining}`);
              });
            }
          }
        });
        
        console.log('━'.repeat(60));
      }
    }

    // Check field "message" untuk informasi tambahan
    if (response.data && response.data.message) {
      console.log('\n💬 API RESPONSE STATUS:');
      console.log('━'.repeat(30));
      console.log(`   ${response.data.message}`);
      console.log('━'.repeat(30));
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

  console.log('🚀 DOMPUL KMSP RESPONSE TESTER');
  console.log('='.repeat(50));
  console.log('📱 Masukkan nomor HP untuk testing...');
  console.log('   Format: 08xxxxxxxx atau 62xxxxxxxx');
  console.log('   🎯 Output: Field "hasil" & "packages"');
  console.log('   Ketik "exit" untuk keluar\n');

  const askForNumber = () => {
    rl.question('🔢 Nomor HP: ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        console.log('\n👋 Terima kasih!');
        rl.close();
        return;
      }

      const normalizedNumber = normalizePhoneNumber(input);
      
      if (!normalizedNumber) {
        console.log('❌ Format nomor tidak valid! Gunakan format 08xxxxxxxx atau 62xxxxxxxx');
        askForNumber();
        return;
      }

      if (!isXLAxisNumber(normalizedNumber)) {
        console.log('⚠️  Warning: Nomor bukan XL/Axis, tetapi tetap akan dicoba...');
      }

      console.log(`✅ Normalized number: ${normalizedNumber}`);
      
      try {
        await checkDompulRaw(normalizedNumber);
      } catch (error) {
        console.error('💥 Unexpected error:', error.message);
      }

      console.log('\n' + '='.repeat(80));
      console.log('✨ Check completed! Try another number?\n');
      askForNumber();
    });
  };

  askForNumber();
};

// Run the tester
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { checkDompulRaw, normalizePhoneNumber, isXLAxisNumber };