const axios = require('axios');

// Format nomor ke international format
function formatNomorToInternational(nomor) {
  let cleanNomor = nomor.replace(/\D/g, '');
  if (cleanNomor.startsWith('0')) {
    cleanNomor = '62' + cleanNomor.substring(1);
  } else if (!cleanNomor.startsWith('62')) {
    cleanNomor = '62' + cleanNomor;
  }
  return cleanNomor;
}

// API untuk kick/remove member akrab dengan dual system
async function removeMemberAkrab(parentNomor, memberId) {
  const formattedParent = formatNomorToInternational(parentNomor);
  
  // Primary API (khfy-store)
  try {
    console.log('🎯 Trying PRIMARY API - Remove Member...');
    
    const formData = new FormData();
    formData.append('token', process.env.token);
    formData.append('member_id', memberId);
    formData.append('id_parent', formattedParent);
    
    const primaryResponse = await axios.post(
      'https://panel.khfy-store.com/api/khfy_v2/member/remove_member_akrab',
      formData,
      {
        timeout: 60000,
        headers: {
          'Content-Type': 'multipart/form-data',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    console.log('✅ PRIMARY API Success:', primaryResponse.data);
    
    // Check if API response indicates success
    const isSuccess = primaryResponse.data?.status === true;
    
    return {
      success: isSuccess,
      source: 'primary',
      parent_nomor: formattedParent,
      member_id: memberId,
      data: primaryResponse.data,
      error: isSuccess ? null : (primaryResponse.data?.message || 'Unknown error'),
      removed_user: primaryResponse.data?.data?.member_info?.last_removed_user || null
    };
    
  } catch (primaryError) {
    console.log('❌ PRIMARY API Error:', primaryError.message);
    
    // Fallback ke Secondary API (hidepulsa)
    try {
      console.log('🔄 Trying SECONDARY API - Remove Member...');
      
      const secondaryData = {
        username: process.env.API_KEY,
        password: process.env.PASSWORD,
        aksi: 'delete-akrab',
        nomor: formattedParent,
        slot: '', // Akan diisi jika tersedia
        id_slot: memberId
      };
      
      const secondaryResponse = await axios.post(
        'https://api.hidepulsa.com/api/',
        secondaryData,
        {
          timeout: 45000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ SECONDARY API Success:', secondaryResponse.data);
      
      // Check if secondary API response indicates success
      const isSecondarySuccess = secondaryResponse.data?.success === true || 
                                secondaryResponse.data?.status === 'success';
      
      return {
        success: isSecondarySuccess,
        source: 'secondary',
        parent_nomor: formattedParent,
        member_id: memberId,
        data: secondaryResponse.data,
        error: isSecondarySuccess ? null : (secondaryResponse.data?.message || 'Unknown error')
      };
      
    } catch (secondaryError) {
      console.log('❌ SECONDARY API Error:', secondaryError.message);
      
      return {
        success: false,
        source: 'both_failed',
        parent_nomor: formattedParent,
        member_id: memberId,
        data: null,
        error: {
          primary: primaryError.message,
          secondary: secondaryError.message
        }
      };
    }
  }
}

module.exports = {
  removeMemberAkrab,
  formatNomorToInternational
};

// Test jika file dijalankan langsung
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('❌ Parameter tidak lengkap!');
    console.log('📋 Format: node kick.js [parent_nomor] [member_id]');
    console.log('📋 Contoh: node kick.js 628777111222 "RlBNQ19f..."');
    process.exit(1);
  }
  
  const parentNomor = args[0];
  const memberId = args[1];
  
  console.log(`🔄 Testing API Remove Member untuk:`);
  console.log(`👤 Parent: ${parentNomor}`);
  console.log(`🆔 Member ID: ${memberId}`);
  console.log(`📱 Formatted Parent: ${formatNomorToInternational(parentNomor)}`);
  
  removeMemberAkrab(parentNomor, memberId).then(result => {
    console.log('\n📊 HASIL:');
    console.log(`Success: ${result.success}`);
    console.log(`Source: ${result.source}`);
    console.log(`Parent: ${result.parent_nomor}`);
    console.log(`Member ID: ${result.member_id}`);
    
    if (result.removed_user) {
      console.log(`Removed User: ${result.removed_user.alias || 'No alias'} (${result.removed_user.msisdn})`);
      console.log(`Quota Used: ${result.removed_user.quota_used} bytes`);
      console.log(`Removed At: ${new Date(result.removed_user.removed_at * 1000).toLocaleString()}`);
    }
    
    console.log(`Data:`, JSON.stringify(result.data, null, 2));
    if (result.error) {
      console.log(`Error:`, result.error);
    }
  }).catch(error => {
    console.error('❌ Error:', error.message);
  });
}