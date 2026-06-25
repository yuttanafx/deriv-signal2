// Netlify Function: Proxy to Deriv API via WebSocket
// เพราะ Deriv API เป็น WebSocket protocol — ไม่รองรับ HTTP REST โดยตรง

const WebSocket = require('ws');

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: { message: 'Method not allowed. Use POST.' } })
    };
  }

  let requestBody;
  try {
    requestBody = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: { message: 'Invalid JSON body: ' + e.message } })
    };
  }

  // เชื่อมต่อ Deriv WebSocket API ผ่าน Netlify Function (server-side)
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
    let responseReceived = false;
    let timeoutId;

    const cleanup = () => {
      clearTimeout(timeoutId);
      try { ws.close(); } catch (e) {}
    };

    // Timeout 15 วินาที
    timeoutId = setTimeout(() => {
      if (!responseReceived) {
        cleanup();
        resolve({
          statusCode: 504,
          headers,
          body: JSON.stringify({ error: { message: 'Gateway timeout — Deriv API did not respond within 15s' } })
        });
      }
    }, 15000);

    ws.on('open', () => {
      // ส่ง request ไปยัง Deriv
      ws.send(JSON.stringify(requestBody));
    });

    ws.on('message', (data) => {
      responseReceived = true;
      cleanup();

      try {
        const responseData = JSON.parse(data.toString());
        resolve({
          statusCode: 200,
          headers,
          body: JSON.stringify(responseData)
        });
      } catch (e) {
        resolve({
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: { message: 'Failed to parse Deriv response: ' + e.message } })
        });
      }
    });

    ws.on('error', (err) => {
      if (!responseReceived) {
        cleanup();
        resolve({
          statusCode: 502,
          headers,
          body: JSON.stringify({ error: { message: 'WebSocket error: ' + err.message } })
        });
      }
    });

    ws.on('close', () => {
      if (!responseReceived) {
        cleanup();
        resolve({
          statusCode: 502,
          headers,
          body: JSON.stringify({ error: { message: 'WebSocket closed unexpectedly' } })
        });
      }
    });
  });
};
