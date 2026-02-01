import { SPREADSHEET_ID, CLIENT_ID, API_KEY, DISCOVERY_DOC, SCOPES } from '../lib/config';

let tokenClient;
let gapiInited = false;
let gisInited = false;

/**
 * Initialize GAPI (Google API Client)
 */
export const initializeGapi = async () => {
    return new Promise((resolve, reject) => {
        // Wait for the gapi script to be loaded
        const checkGapi = setInterval(() => {
            if (window.gapi) {
                clearInterval(checkGapi);
                window.gapi.load('client', async () => {
                    try {
                        await window.gapi.client.init({
                            apiKey: API_KEY,
                            discoveryDocs: [DISCOVERY_DOC],
                        });
                        gapiInited = true;
                        resolve(true);
                    } catch (error) {
                        reject(error);
                    }
                });
            }
        }, 100);
    });
};

/**
 * Initialize GIS (Google Identity Services)
 */
export const initializeGis = async () => {
    return new Promise((resolve) => {
        const checkGis = setInterval(() => {
            if (window.google) {
                clearInterval(checkGis);
                tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: '', // defined at request time
                });
                gisInited = true;
                resolve(true);
            }
        }, 100);
    });
};

/**
 * Trigger the login flow
 */
export const handleAuthClick = (callback) => {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
        callback(resp);
    };

    if (window.gapi.client.getToken() === null) {
        // Prompt the user to select a Google Account and ask for consent to share their data
        // when establishing a new session.
        tokenClient.requestAccessToken({ prompt: 'consent' });
// ... existing code ...
    } else {
        // Skip display of account chooser and consent dialog for an existing session.
        tokenClient.requestAccessToken({ prompt: '' });
    }
};

/**
 * Attempt silent authentication
 * @param {function} callback
 */
export const trySilentAuth = (callback) => {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
             // If silent auth fails (e.g. interaction_required), we just ignore it
             // and let the user click the Login button manually.
             console.log("Silent auth failed or required interaction", resp);
            return;
        }
        callback(resp);
    };

    // Attempt to get token without prompting
    // This will succeed if the user has a valid session
    try {
        tokenClient.requestAccessToken({ prompt: '' });
    } catch (e) {
        console.log("Silent auth error", e);
    }
};

/**
 * Sign out
 */
export const handleSignoutClick = () => {
    const token = window.gapi.client.getToken();
    if (token !== null) {
        window.google.accounts.oauth2.revoke(token.access_token);
        window.gapi.client.setToken('');
    }
};

/**
 * Fetch spreadsheet values
 * @param {string} range 
 */
export const getValues = async (range) => {
    try {
        const response = await window.gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
        });
        return response.result.values;
    } catch (err) {
        console.error('Error getting values', err);
        throw err;
    }
};

/**
 * Append values to the spreadsheet
 * @param {string} range 
 * @param {Array<Array<string>>} values 
 */
export const appendValues = async (range, values) => {
    try {
        const response = await window.gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: values,
            },
        });
        return response;
    } catch (err) {
        console.error('Error appending values', err);
        throw err;
    }
};

/**
 * Update a specific range/cell
 * @param {string} range 
 * @param {Array<Array<string>>} values 
 */
export const updateValues = async (range, values) => {
    try {
        const response = await window.gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: values,
            },
        });
        return response;
    } catch (err) {
        console.error('Error updating values', err);
        throw err;
    }
};

/**
 * Insert a new row at a specific index
 * @param {number} sheetId The ID of the sheet (tab) (usually 0 for the first one, but better to fetch)
 * @param {number} rowIndex The 0-based index to insert at
 */
export const insertRow = async (sheetId = 0, rowIndex) => {
    try {
        const response = await window.gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                requests: [
                    {
                        insertDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: 'ROWS',
                                startIndex: rowIndex,
                                endIndex: rowIndex + 1
                            },
                            inheritFromBefore: true
                        }
                    }
                ]
            }
        });
        return response;
    } catch (err) {
        console.error('Error inserting row', err);
        throw err;
    }
};

/**
 * Get the sheet ID by its name (title)
 * @param {string} sheetName 
 */
export const getSheetIdByName = async (sheetName) => {
    try {
        const response = await window.gapi.client.sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });
        const sheet = response.result.sheets.find(s => s.properties.title === sheetName);
        if (!sheet) throw new Error(`Sheet with name ${sheetName} not found`);
        return sheet.properties.sheetId;
    } catch (err) {
        console.error('Error getting sheet metadata', err);
        throw err;
    }
};

/**
 * Insert a new column at a specific index
 * @param {number} sheetId 
 * @param {number} colIndex 0-based index
 */
export const insertColumn = async (sheetId = 0, colIndex) => {
    try {
        const response = await window.gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                requests: [
                    {
                        insertDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: 'COLUMNS',
                                startIndex: colIndex,
                                endIndex: colIndex + 1
                            },
                            inheritFromBefore: true
                        }
                    }
                ]
            }
        });
        return response;
    } catch (err) {
        console.error('Error inserting column', err);
        throw err;
    }
};

/**
 * Delete a row at a specific index
 * @param {number} sheetId 
 * @param {number} rowIndex 0-based index
 */
export const deleteRow = async (sheetId = 0, rowIndex) => {
    try {
        const response = await window.gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: 'ROWS',
                                startIndex: rowIndex,
                                endIndex: rowIndex + 1
                            }
                        }
                    }
                ]
            }
        });
        return response;
    } catch (err) {
        console.error('Error deleting row', err);
        throw err;
    }
};

/**
 * Get User Email from Google Profile
 */
export const getUserEmail = async () => {
    try {
        const response = await window.gapi.client.request({
            'path': 'https://www.googleapis.com/oauth2/v3/userinfo',
        });
        return response.result.email;
    } catch (err) {
        console.error("Error getting user info", err);
        throw err;
    }
};

/**
 * Create a new sheet (tab)
 * @param {string} title 
 */
export const createSheet = async (title) => {
    try {
        const response = await window.gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                requests: [
                    {
                        addSheet: {
                            properties: {
                                title: title
                            }
                        }
                    }
                ]
            }
        });
        return response.result.replies[0].addSheet.properties.sheetId;
    } catch (err) {
        console.error('Error creating sheet', err);
        throw err;
    }
};
