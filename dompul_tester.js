const axios = require('axios');
const readline = require('readline');

// Function untuk clear screen cross-platform
const clearScreen = () => {
  // Clear screen untuk Windows dan Unix/Linux dengan delay
  console.clear();
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

      // Filter out Volte status lines and format umur kartu
      const filteredHasil = cleanedHasil
        .split('\n')
        .filter(line => {
          const trimmedLine = line.trim();
          return !trimmedLine.startsWith('Status Volte Device:') &&
                 !trimmedLine.startsWith('Status Volte Area:') &&
                 !trimmedLine.startsWith('Status Volte Simcard:');
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
          return line;
        })
        .join('\n');

      console.log(filteredHasil);

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

module.exports = { checkDompulRaw, normalizePhoneNumber, isXLAxisNumber, clearScreen };