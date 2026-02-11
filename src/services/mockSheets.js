
// Initial Mock Data
let mockData = [
    ['', '項目', '2025/01'],
    ['', '現金與帳戶'],
    ['', '銀行帳戶', '100000'],
    ['', '錢包', '5000'],
    ['', '投資'],
    ['', '股票', '50000'],
    ['', '基金', '20000'],
    ['', '信用卡'],
    ['', '主要信用卡', '0'],
];

// Helper to simulate delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const initializeGapi = async () => {
    await delay(500);
    return true;
};

export const initializeGis = async () => {
    await delay(500);
    return true;
};

export const handleAuthClick = (callback) => {
    setTimeout(() => {
        callback({ access_token: 'mock-token', expires_in: 3600 });
    }, 500);
};

export const trySilentAuth = (callback) => {
    // In mock mode, we can auto-login
    setTimeout(() => {
        callback({ access_token: 'mock-token', expires_in: 3600 });
    }, 500);
};

export const handleSignoutClick = () => {
    console.log("Mock Signout");
};

export const getUserEmail = async () => {
    return 'mockuser@example.com';
};

export const getSheetIdByName = async (sheetName) => {
    // Return a dummy ID
    return 0;
}

export const createSheet = async (title) => {
    return 1;
}


// --- Data Operations ---

const parseRange = (range) => {
    // Simple parser for 'Sheet1!A1:C10' or 'Sheet1!A1'
    // This mock implementation assumes we are always working with the main 'mockData' array
    // and ignores the sheet name for simplicity in this context.

    // We only need to support full reads or specific cell updates for the app's current logic
    return range;
};

export const getValues = async (range) => {
    await delay(300);
    console.log(`[Mock] getValues(${range})`);
    return mockData;
};

export const updateValues = async (range, values) => {
    await delay(300);
    console.log(`[Mock] updateValues(${range})`, values);

    // Logic to update mockData based on A1 notation
    // Supported formats in App.jsx: 
    // 1. 'Sheet'!B{row} -> Update name
    // 2. 'Sheet'!{col}{row} -> Update balance
    // 3. 'Sheet'!A{row} -> Update full row (init)

    // Extract Row and Col
    const match = range.match(/!([A-Z]+)(\d+)/);
    if (!match) return; // Complex ranges not fully supported in this simple mock

    const colStr = match[1];
    const row = parseInt(match[2]) - 1; // 0-indexed

    const col = colStr.charCodeAt(0) - 65; // A -> 0, B -> 1

    // Ensure row exists
    while (mockData.length <= row) {
        mockData.push([]);
    }

    // Update
    const newVals = values[0]; // Assuming single row update
    for (let i = 0; i < newVals.length; i++) {
        mockData[row][col + i] = newVals[i];
    }

    return { result: { updatedCells: values.length } };
};

export const appendValues = async (range, values) => {
    await delay(300);
    console.log(`[Mock] appendValues`, values);
    mockData.push(...values);
    return { result: { updates: { updatedRows: values.length } } };
};

export const insertRow = async (sheetId, rowIndex) => {
    await delay(300);
    console.log(`[Mock] insertRow at ${rowIndex}`);
    // Insert empty array at rowIndex
    mockData.splice(rowIndex, 0, []);
    return {};
};

export const deleteRow = async (sheetId, rowIndex) => {
    await delay(300);
    console.log(`[Mock] deleteRow at ${rowIndex}`);
    mockData.splice(rowIndex, 1);
    return {};
};

export const insertColumn = async (sheetId, colIndex) => {
    await delay(300);
    console.log(`[Mock] insertColumn at ${colIndex}`);
    mockData.forEach(row => {
        row.splice(colIndex, 0, '');
    });
    return {};
};
