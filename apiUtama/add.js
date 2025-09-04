const axios = require('axios');
const path = require('path');

// Load .env from parent directory (akrab folder)
require('dotenv').config({ 
  path: path.join(__dirname, '..', '.env'),
  quiet: true
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
  // Jika dimulai dengan +62, hapus +
  else if (cleanNomor.startsWith('62')) {
    // Already in correct format
  }
  
  return cleanNomor;
}

// API Add Member menggunakan API Utama (Primary) dengan fallback ke API Lama (Secondary)
async function addMemberAkrab(parentNomor, childNomor, alias = '', memberId = '', slotId = '') {
  const formattedParent = formatNomorToInternational(parentNomor);
  const formattedChild = formatNomorToInternational(childNomor);
  
  try {
    // === API UTAMA (PRIMARY) ===
    console.log(`Trying Primary API - Add ${formattedChild} to ${formattedParent}`);
    
    // Buat form data sesuai dokumentasi API (application/x-www-form-urlencoded)
    const formData = new URLSearchParams();
    formData.append('token', process.env.token);
    formData.append('id_parent', formattedParent);
    formData.append('msisdn', formattedChild);
    
    // Parameter opsional - jika tidak ada, sistem akan auto assign
    if (memberId) {
      formData.append('member_id', memberId);
    }
    if (slotId) {
      formData.append('slot_id', slotId);
    }
    if (alias) {
      formData.append('child_name', alias);
    }
    // Parent name - bisa default atau custom
    formData.append('parent_name', 'BEKASAN'); // Default parent name
    
    const primaryResponse = await axios.post('https://panel.khfy-store.com/api/khfy_v2/member/change_member_akrab_v2', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 45000
    });

    // Cek apakah response berhasil
    if (primaryResponse.data && primaryResponse.status === 200) {
      console.log(`Primary API Response - Add ${formattedChild} to ${formattedParent}:`, primaryResponse.data);
      return {
        success: primaryResponse.data.status || false,
        source: 'primary',
        data: primaryResponse.data,
        parent_nomor: parentNomor,
        child_nomor: childNomor,
        formatted_parent: formattedParent,
        formatted_child: formattedChild,
        alias: alias,
        member_id: memberId,
        slot_id: slotId
      };
    } else {
      throw new Error('Primary API returned invalid response');
    }

  } catch (primaryError) {
    console.log(`Primary API Failed - Add ${formattedChild} to ${formattedParent}:`, primaryError.message);
    
    try {
      // === API SECONDARY (FALLBACK) ===
      console.log(`Trying Secondary API - Add ${childNomor} to ${parentNomor}`);
      
      const secondaryResponse = await axios.post("https://api.hidepulsa.com/api/akrab", {
        action: "add",
        id_telegram: process.env.ADMIN_ID,
        password: process.env.PASSWORD,
        parent: parentNomor,
        child: childNomor,
        alias: alias || ''
      }, {
        headers: {
          "Content-Type": "application/json",
          Authorization: process.env.API_KEY
        },
        timeout: 45000
      });

      if (secondaryResponse.data) {
        console.log(`Secondary API Success - Added ${childNomor} to ${parentNomor}`);
        return {
          success: true,
          source: 'secondary',
          data: secondaryResponse.data,
          parent_nomor: parentNomor,
          child_nomor: childNomor,
          formatted_parent: formattedParent,
          formatted_child: formattedChild,
          alias: alias
        };
      } else {
        throw new Error('Secondary API returned invalid response');
      }

    } catch (secondaryError) {
      console.log(`Secondary API Failed - Add ${childNomor} to ${parentNomor}:`, secondaryError.message);
      
      return {
        success: false,
        source: 'both_failed',
        error: {
          primary: primaryError.message,
          secondary: secondaryError.message
        },
        parent_nomor: parentNomor,
        child_nomor: childNomor,
        formatted_parent: formattedParent,
        formatted_child: formattedChild,
        alias: alias
      };
    }
  }
}

// Export fungsi untuk digunakan di module lain
module.exports = {
  addMemberAkrab,
  formatNomorToInternational
};

// Test jika file dijalankan langsung
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('❌ Parameter tidak lengkap!');
    console.log('📋 Format: node add.js [parent_nomor] [child_nomor] [alias_optional] [member_id_optional] [slot_id_optional]');
    console.log('📋 Contoh: node add.js 08777111222 08777333444');
    console.log('📋 Contoh: node add.js 08777111222 08777333444 "Child1"');
    console.log('📋 Contoh: node add.js 628777111222 6283821447021 "BEKASAN" "RlBNQ19f..." "14853931"');
    process.exit(1);
  }
  
  const parentNomor = args[0];
  const childNomor = args[1];
  const alias = args[2] || '';
  const memberId = args[3] || '';
  const slotId = args[4] || '';
  
  console.log(`🔄 Testing API Add Member untuk:`);
  console.log(`👤 Parent: ${parentNomor}`);
  console.log(`👶 Child: ${childNomor}`);
  if (alias) console.log(`🏷️ Alias: ${alias}`);
  if (memberId) console.log(`🆔 Member ID: ${memberId}`);
  if (slotId) console.log(`🎯 Slot ID: ${slotId}`);
  console.log(`📱 Formatted Parent: ${formatNomorToInternational(parentNomor)}`);
  console.log(`📱 Formatted Child: ${formatNomorToInternational(childNomor)}`);
  
  addMemberAkrab(parentNomor, childNomor, alias, memberId, slotId).then(result => {
    console.log('\n📊 HASIL:');
    console.log(`Success: ${result.success}`);
    console.log(`Source: ${result.source}`);
    console.log(`Parent: ${result.parent_nomor}`);
    console.log(`Child: ${result.child_nomor}`);
    if (result.alias) console.log(`Alias: ${result.alias}`);
    console.log(`Data:`, JSON.stringify(result.data, null, 2));
  }).catch(error => {
    console.error('❌ Error:', error.message);
  });
}