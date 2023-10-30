const axios = require('axios');

const TOTAL_REQUESTS = 10000;
const TARGET_URL = 'http://localhost:3001/balance';
const PAYLOAD = {
    userId: 1,
    amount: 2,
};

const MAX_RETRIES = 3; // adjust as needed

async function sendRequest(retryCount = 0) {
    try {
        const response = await axios.patch(TARGET_URL, PAYLOAD);
        return { success: true, data: response.data };
    } catch (error) {
        // Check for ECONNRESET or other specific conditions to retry
        if (error.code === 'ECONNRESET' || error.message === 'Network Error') {
            if (retryCount < MAX_RETRIES) {
                const delay = 500 * (retryCount + 1); // Introduce a delay before retrying
                await new Promise(res => setTimeout(res, delay));
                return sendRequest(retryCount + 1);
            }
        }

        return {
            success: false,
            error: error.response ? error.response.data.error : error.message,
        };
    }
}

async function main() {
    const promises = [];
    for (let i = 0; i < TOTAL_REQUESTS; i++) {
        promises.push(sendRequest());
    }

    const results = await Promise.all(promises);

    // Analyze the results and classify errors
    let successCount = 0;
    const errorCounts = {
        'User not found': 0,
        'Insufficient funds': 0,
        'Internal server error': 0,
        other: 0,
    };

    results.forEach((result) => {
        if (result.success) {
            successCount++;
        } else if (errorCounts.hasOwnProperty(result.error)) {
            errorCounts[result.error]++;
        } else {
            console.log('===', result);
            errorCounts.other++;
        }
    });

    console.log(`Successes: ${successCount}`);
    Object.entries(errorCounts).forEach(([errorType, count]) => {
        console.log(`${errorType}: ${count}`);
    });
}

main().catch(console.error);
