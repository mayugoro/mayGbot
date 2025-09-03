const axios = require('axios');
const path = require('path');

// Load .env from parent directory (akrab folder)
require('dotenv').config({ 
  path: path.join(__dirname, '..', '.env')
});

// Fungsi untuk format nomor telepon ke format internasional
function formatNomorToInternational(nomor) {
  // Hapus semua karakter non-digit
  let cleanNomor = nomor.replace(/\D/g, '');
  
  // Jika dimulai dengan 08, ganti dengan 628
  if (cleanNomor.startsWith('08')) {
    cleanNomor = '628' + cleanNomor.substring(2);
  }
  // Jika dimulai dengan 8 (tanpa 0), tambah 62
  else if (cleanNomor.startsWith('8') && !cleanNomor.startsWith('62')) {
    cleanNomor = '62' + cleanNomor;
  }
  // Jika sudah 62, biarkan
  else if (cleanNomor.startsWith('62')) {
    // Already in correct format
  }
  // Jika dimulai dengan +62, hapus +
  else if (cleanNomor.startsWith('62')) {
    // Already handled above
  }
  
  return cleanNomor;
}

// API Info menggunakan API Utama (Primary) dengan fallback ke API Lama (Secondary)
async function getInfoAkrab(nomorTelepon) {
  const formattedNomor = formatNomorToInternational(nomorTelepon);
  
  try {
    // === API UTAMA (PRIMARY) ===
    console.log(`Trying Primary API for: ${formattedNomor}`);
    
    // id_parent seharusnya adalah nomor yang sedang dicek, bukan hardcode
    const idParent = formattedNomor;
    
    // Buat form data sesuai dokumentasi API (application/x-www-form-urlencoded)
    const formData = new URLSearchParams();
    formData.append('token', process.env.token);
    formData.append('nomor_hp', formattedNomor);
    formData.append('id_parent', idParent);
    
    const primaryResponse = await axios.post('https://panel.khfy-store.com/api/khfy_v2/member/member_info_akrab', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000 // Kurangi timeout menjadi 10 detik untuk faster failover
    });

    // Cek apakah response berhasil dan bukan error message
    if (primaryResponse.data && primaryResponse.status === 200) {
      // Cek apakah ada error message dalam response (FAST FAIL)
      const responseData = primaryResponse.data;
      const message = responseData.message || '';
      
      // Jika ada pesan error, langsung anggap sebagai kegagalan - NO DELAY
      if (message.includes('Tidak mendapatkan respon yang di inginkan') || 
          message.includes('tidak ditemukan') ||
          message.includes('tidak di temukan') ||
          message.includes('gagal') ||
          responseData.status === false ||
          !responseData.data) {
        console.log(`⚡ Primary API FAST FAIL: ${message}`);
        throw new Error(`Primary API error: ${message}`);
      }
      
      console.log(`✅ Primary API Success for: ${formattedNomor}`);
      return {
        success: true,
        source: 'primary',
        data: primaryResponse.data,
        nomor: nomorTelepon,
        formatted_nomor: formattedNomor
      };
    } else {
      throw new Error('Primary API returned invalid response');
    }

  } catch (primaryError) {
    console.log(`Primary API Failed for ${formattedNomor}:`, primaryError.message);
    
    try {
      // === API SECONDARY (FALLBACK) ===
      console.log(`Trying Secondary API for: ${nomorTelepon}`);
      
      const secondaryResponse = await axios.post("https://api.hidepulsa.com/api/akrab", {
        action: "info",
        id_telegram: process.env.ADMIN_ID,
        password: process.env.PASSWORD,
        nomor_hp: nomorTelepon
      }, {
        headers: {
          "Content-Type": "application/json",
          Authorization: process.env.API_KEY
        },
        timeout: 15000 // Kurangi timeout secondary API untuk faster response
      });

      if (secondaryResponse.data) {
        console.log(`Secondary API Success for: ${nomorTelepon}`);
        return {
          success: true,
          source: 'secondary',
          data: secondaryResponse.data,
          nomor: nomorTelepon,
          formatted_nomor: formattedNomor
        };
      } else {
        throw new Error('Secondary API returned invalid response');
      }

    } catch (secondaryError) {
      console.log(`Secondary API Failed for ${nomorTelepon}:`, secondaryError.message);
      
      return {
        success: false,
        source: 'both_failed',
        error: {
          primary: primaryError.message,
          secondary: secondaryError.message
        },
        nomor: nomorTelepon,
        formatted_nomor: formattedNomor
      };
    }
  }
}

// Export fungsi untuk digunakan di module lain
module.exports = {
  getInfoAkrab,
  formatNomorToInternational
};

// Test jika file dijalankan langsung
if (require.main === module) {
  // Ambil nomor dari command line argument
  const testNomor = process.argv[2];
  
  if (!testNomor) {
    console.log('❌ Error: Nomor telepon harus disediakan!');
    console.log('\n📝 Cara penggunaan:');
    console.log('node info.js [nomor_telepon]');
    console.log('\n📋 Contoh:');
    console.log('node info.js 08777111222');
    console.log('node info.js 628777111222');
    console.log('node info.js 8777111222');
    process.exit(1);
  }
  
  console.log(`\n🔍 Testing API Info untuk nomor: ${testNomor}`);
  console.log(`📱 Formatted nomor: ${formatNomorToInternational(testNomor)}`);
  
  getInfoAkrab(testNomor)
    .then(result => {
      console.log('\n📊 HASIL:');
      console.log('Success:', result.success);
      console.log('Source:', result.source);
      console.log('Nomor:', result.nomor);
      console.log('Formatted:', result.formatted_nomor);
      
      if (result.success) {
        console.log('Data:', JSON.stringify(result.data, null, 2));
      } else {
        console.log('Error:', result.error);
      }
    })
    .catch(error => {
      console.error('❌ Test Error:', error);
    });
}