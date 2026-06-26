exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // ── LOG 1: ดูว่าได้รับอะไรจาก frontend ──
  console.log('=== DERIV PROXY ===');
  console.log('Received body:', event.body);
  
  try {
    const bodyObj = JSON.parse(event.body);
    console.log('Parsed body:', JSON.stringify(bodyObj, null, 2));
    
    // ถ้าเป็น authorize ให้ log token (แค่ 10 ตัวแรก)
    if (bodyObj.authorize) {
      console.log('Token prefix:', bodyObj.authorize.substring(0, 10) + '...');
      console.log('Token length:', bodyObj.authorize.length);
    }
  } catch (e) {
    console.log('Body is not JSON:', event.body);
  }

  try {
    // ── LOG 2: ดูว่าส่งอะไรไป Deriv ──
    console.log('Sending to Deriv API...');
    
    const response = await fetch('https://ws.binaryws.com/websockets/v3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: event.body
    });

    const data = await response.json();
    
    // ── LOG 3: ดูว่า Deriv ตอบอะไรกลับมา ──
    console.log('Deriv response:', JSON.stringify(data, null, 2));
    
    // ถ้า error ให้ log ชัดเจน
    if (data.error) {
      console.log('❌ DERIV ERROR:', data.error.code, '-', data.error.message);
    } else if (data.authorize) {
      console.log('✅ AUTH SUCCESS:', data.authorize.loginid);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('❌ PROXY ERROR:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Proxy failed', 
        message: error.message 
      })
    };
  }
};
