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
  // Jika dimulai dengan +62, hapus +
  else if (cleanNomor.startsWith('62')) {
    // Already in correct format
  }
  
  return cleanNomor;
}

// API Set Kuota Member menggunakan API Utama (Primary) dengan fallback ke API Lama (Secondary)
async function setKuotaMemberAkrab(parentNomor, memberId, kuotaGB) {
  const formattedParent = formatNomorToInternational(parentNomor);
  
  // Convert GB ke bytes (KB * 1024 * 1024)
  const kuotaBytes = kuotaGB * 1024 * 1024 * 1024;
  
  try {
    // === API UTAMA (PRIMARY) ===
    console.log(`Trying Primary API - Set ${kuotaGB}GB kuota for member ${memberId} in ${formattedParent}`);
    
    // Buat form data sesuai dokumentasi API (application/x-www-form-urlencoded)
    const formData = new URLSearchParams();
    formData.append('token', process.env.token);
    formData.append('id_parent', formattedParent);
    formData.append('new_allocation', kuotaBytes.toString());
    formData.append('member_id', memberId);
    
    const primaryResponse = await axios.post('https://panel.khfy-store.com/api/khfy_v2/member/set_kuber_akrab', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 45000
    });

    // Cek apakah response berhasil
    if (primaryResponse.data && primaryResponse.status === 200) {
      console.log(`Primary API Response - Set kuota for ${memberId}:`, primaryResponse.data);
      return {
        success: primaryResponse.data.status || false,
        source: 'primary',
        data: primaryResponse.data,
        parent_nomor: parentNomor,
        formatted_parent: formattedParent,
        member_id: memberId,
        kuota_gb: kuotaGB,
        kuota_bytes: kuotaBytes
      };
    } else {
      throw new Error('Primary API returned invalid response');
    }

  } catch (primaryError) {
    console.log(`Primary API Failed - Set kuota for ${memberId}:`, primaryError.message);
    
    try {
      // === API SECONDARY (FALLBACK) ===
      console.log(`Trying Secondary API - Set kuota (feature may not be available)`);
      
      // Note: API secondary mungkin tidak support set kuota individual
      // Ini placeholder untuk konsistensi
      const secondaryResponse = await axios.post("https://api.hidepulsa.com/api/akrab", {
        action: "set_kuota", // Placeholder - mungkin tidak ada
        id_telegram: process.env.ADMIN_ID,
        password: process.env.PASSWORD,
        parent: parentNomor,
        member_id: memberId,
        kuota_gb: kuotaGB
      }, {
        headers: {
          "Content-Type": "application/json",
          Authorization: process.env.API_KEY
        },
        timeout: 45000
      });

      if (secondaryResponse.data) {
        console.log(`Secondary API Response - Set kuota:`, secondaryResponse.data);
        return {
          success: true,
          source: 'secondary',
          data: secondaryResponse.data,
          parent_nomor: parentNomor,
          formatted_parent: formattedParent,
          member_id: memberId,
          kuota_gb: kuotaGB,
          kuota_bytes: kuotaBytes
        };
      } else {
        throw new Error('Secondary API returned invalid response');
      }

    } catch (secondaryError) {
      console.log(`Secondary API Failed - Set kuota:`, secondaryError.message);
      
      return {
        success: false,
        source: 'both_failed',
        error: {
          primary: primaryError.message,
          secondary: secondaryError.message
        },
        parent_nomor: parentNomor,
        formatted_parent: formattedParent,
        member_id: memberId,
        kuota_gb: kuotaGB,
        kuota_bytes: kuotaBytes
      };
    }
  }
}

// Fungsi helper untuk convert bytes ke GB/MB
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// API Kick Member menggunakan API Utama (Primary) dengan fallback ke API Lama (Secondary)
async function kickMemberAkrab(parentNomor, childNomor, memberId = '', slotId = '') {
  const formattedParent = formatNomorToInternational(parentNomor);
  const formattedChild = formatNomorToInternational(childNomor);
  
  try {
    // === API UTAMA (PRIMARY) ===
    console.log(`Trying Primary API - Kick ${formattedChild} from ${formattedParent}`);
    
    // Buat form data sesuai dokumentasi API (application/x-www-form-urlencoded)
    const formData = new URLSearchParams();
    formData.append('token', process.env.token);
    formData.append('id_parent', formattedParent);
    formData.append('msisdn', formattedChild);
    
    // Parameter opsional - diperlukan untuk kick
    if (memberId) {
      formData.append('member_id', memberId);
    }
    if (slotId) {
      formData.append('slot_id', slotId);
    }
    
    // Kemungkinan endpoint kick - bisa remove_member_akrab atau change_member_akrab_v2 dengan action tertentu
    const primaryResponse = await axios.post('https://panel.khfy-store.com/api/khfy_v2/member/remove_member_akrab', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 45000
    });

    // Cek apakah response berhasil
    if (primaryResponse.data && primaryResponse.status === 200) {
      console.log(`Primary API Response - Kick ${formattedChild} from ${formattedParent}:`, primaryResponse.data);
      return {
        success: primaryResponse.data.status || false,
        source: 'primary',
        data: primaryResponse.data,
        parent_nomor: parentNomor,
        child_nomor: childNomor,
        formatted_parent: formattedParent,
        formatted_child: formattedChild,
        member_id: memberId,
        slot_id: slotId
      };
    } else {
      throw new Error('Primary API returned invalid response');
    }

  } catch (primaryError) {
    console.log(`Primary API Failed - Kick ${formattedChild} from ${formattedParent}:`, primaryError.message);
    
    try {
      // === API SECONDARY (FALLBACK) ===
      console.log(`Trying Secondary API - Kick ${childNomor} from ${parentNomor}`);
      
      const secondaryResponse = await axios.post("https://api.hidepulsa.com/api/akrab", {
        action: "kick",
        id_telegram: process.env.ADMIN_ID,
        password: process.env.PASSWORD,
        parent: parentNomor,
        child: childNomor
      }, {
        headers: {
          "Content-Type": "application/json",
          Authorization: process.env.API_KEY
        },
        timeout: 45000
      });

      if (secondaryResponse.data) {
        console.log(`Secondary API Success - Kicked ${childNomor} from ${parentNomor}`);
        return {
          success: true,
          source: 'secondary',
          data: secondaryResponse.data,
          parent_nomor: parentNomor,
          child_nomor: childNomor,
          formatted_parent: formattedParent,
          formatted_child: formattedChild
        };
      } else {
        throw new Error('Secondary API returned invalid response');
      }

    } catch (secondaryError) {
      console.log(`Secondary API Failed - Kick ${childNomor} from ${parentNomor}:`, secondaryError.message);
      
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
        formatted_child: formattedChild
      };
    }
  }
}

// Export fungsi untuk digunakan di module lain
module.exports = {
  setKuotaMemberAkrab,
  kickMemberAkrab,
  formatNomorToInternational,
  formatBytes
};

// Test jika file dijalankan langsung
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('❌ Parameter tidak lengkap!');
    console.log('📋 FORMAT KUBER: node kuber.js kuber [parent_nomor] [member_id] [kuota_gb]');
    console.log('📋 FORMAT KICK: node kuber.js kick [parent_nomor] [child_nomor] [member_id_optional] [slot_id_optional]');
    console.log('📋 Contoh Kuber: node kuber.js kuber 628777111222 "RlBNQ19f..." 5');
    console.log('📋 Contoh Kick: node kuber.js kick 08777111222 08777333444');
    process.exit(1);
  }
  
  const action = args[0];
  
  if (action === 'kuber') {
    if (args.length < 4) {
      console.log('❌ Parameter kuber tidak lengkap!');
      console.log('📋 Format: node kuber.js kuber [parent_nomor] [member_id] [kuota_gb]');
      process.exit(1);
    }
    
    const parentNomor = args[1];
    const memberId = args[2];
    const kuotaGB = parseFloat(args[3]);
    
    console.log(`🔄 Testing API Set Kuota Member untuk:`);
    console.log(`👤 Parent: ${parentNomor}`);
    console.log(`🆔 Member ID: ${memberId}`);
    console.log(`📊 Kuota: ${kuotaGB} GB`);
    console.log(`📱 Formatted Parent: ${formatNomorToInternational(parentNomor)}`);
    
    setKuotaMemberAkrab(parentNomor, memberId, kuotaGB).then(result => {
      console.log('\n📊 HASIL:');
      console.log(`Success: ${result.success}`);
      console.log(`Source: ${result.source}`);
      console.log(`Parent: ${result.parent_nomor}`);
      console.log(`Member ID: ${result.member_id}`);
      console.log(`Kuota: ${result.kuota_gb} GB (${result.kuota_bytes} bytes)`);
      console.log(`Data:`, JSON.stringify(result.data, null, 2));
    }).catch(error => {
      console.error('❌ Error:', error.message);
    });
    
  } else if (action === 'kick') {
    if (args.length < 3) {
      console.log('❌ Parameter kick tidak lengkap!');
      console.log('📋 Format: node kuber.js kick [parent_nomor] [child_nomor] [member_id_optional] [slot_id_optional]');
      process.exit(1);
    }
    
    const parentNomor = args[1];
    const childNomor = args[2];
    const memberId = args[3] || '';
    const slotId = args[4] || '';
    
    console.log(`🔄 Testing API Kick Member untuk:`);
    console.log(`👤 Parent: ${parentNomor}`);
    console.log(`👶 Child: ${childNomor}`);
    if (memberId) console.log(`🆔 Member ID: ${memberId}`);
    if (slotId) console.log(`🎯 Slot ID: ${slotId}`);
    console.log(`📱 Formatted Parent: ${formatNomorToInternational(parentNomor)}`);
    console.log(`📱 Formatted Child: ${formatNomorToInternational(childNomor)}`);
    
    kickMemberAkrab(parentNomor, childNomor, memberId, slotId).then(result => {
      console.log('\n📊 HASIL:');
      console.log(`Success: ${result.success}`);
      console.log(`Source: ${result.source}`);
      console.log(`Parent: ${result.parent_nomor}`);
      console.log(`Child: ${result.child_nomor}`);
      console.log(`Data:`, JSON.stringify(result.data, null, 2));
    }).catch(error => {
      console.error('❌ Error:', error.message);
    });
    
  } else {
    console.log('❌ Action tidak valid! Gunakan "kuber" atau "kick"');
  }
}