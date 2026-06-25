// Netlify Function: Proxy to Deriv Legacy WebSocket API
// Endpoint: wss://ws.binaryws.com/websockets/v3?app_id=1089

const WebSocket = require('ws');

const DERIV_WS_URL = 'wss://ws.binaryws.com/websockets/v3?app_id=1089';
const TIMEOUT_MS = 15000;

exports.handler = async (event, context) => {
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

  // เชื่อมต่อ Deriv WebSocket แบบรักษา connection ไว้หลาย request
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(DERIV_WS_URL);
    let responseReceived = false;
    let timeoutId;
    let messages = [];
    let isAuthorized = false;

    const cleanup = () => {
      clearTimeout(timeoutId);
      try { ws.close(); } catch (e) {}
    };

    // Timeout
    timeoutId = setTimeout(() => {
      if (!responseReceived) {
        cleanup();
        resolve({
          statusCode: 504,
          headers,
          body: JSON.stringify({ 
            error: { message: 'Gateway timeout — Deriv API did not respond within ' + TIMEOUT_MS + 'ms' },
            echo_req: requestBody 
          })
        });
      }
    }, TIMEOUT_MS);

    ws.on('open', () => {
      ws.send(JSON.stringify(requestBody));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // ถ้าเป็น authorize response ให้เก็บไว้แล้วปิด
        if (msg.msg_type === 'authorize') {
          responseReceived = true;
          cleanup();
          resolve({
            statusCode: 200,
            headers,
            body: JSON.stringify(msg)
          });
          return;
        }

        // ถ้าเป็น balance response
        if (msg.msg_type === 'balance') {
          responseReceived = true;
          cleanup();
          resolve({
            statusCode: 200,
            headers,
            body: JSON.stringify(msg)
          });
          return;
        }

        // ถ้าเป็น proposal response
        if (msg.msg_type === 'proposal') {
          responseReceived = true;
          cleanup();
          resolve({
            statusCode: 200,
            headers,
            body: JSON.stringify(msg)
          });
          return;
        }

        // ถ้าเป็น buy response
        if (msg.msg_type === 'buy') {
          responseReceived = true;
          cleanup();
          resolve({
            statusCode: 200,
            headers,
            body: JSON.stringify(msg)
          });
          return;
        }

        // ถ้าเป็น proposal_open_contract
        if (msg.msg_type === 'proposal_open_contract') {
          responseReceived = true;
          cleanup();
          resolve({
            statusCode: 200,
            headers,
            body: JSON.stringify(msg)
          });
          return;
        }

        // ถ้าเป็น error
        if (msg.error) {
          responseReceived = true;
          cleanup();
          resolve({
            statusCode: 200,
            headers,
            body: JSON.stringify(msg)
          });
          return;
        }

        // ถ้าเป็น ping หรือข้อความอื่น ๆ ให้รอต่อ
        messages.push(msg);

      } catch (e) {
        responseReceived = true;
        cleanup();
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
