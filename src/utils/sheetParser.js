export const parseSheetData = (rawValues) => {
    if (!rawValues || rawValues.length === 0) return null;

    const headerRow = rawValues[0];
    const months = [];

    // Parse Months from Header (Column C -> Index 2 onwards)
    for (let i = 2; i < headerRow.length; i++) {
        if (headerRow[i]) {
            months.push({ index: i, label: headerRow[i] });
        }
    }

    const accounts = {
        assets: [],
        investments: [],
        liabilities: [],
        totals: {},
        sectionHeaders: {
            assets: 0,
            investments: 0,
            liabilities: 0
        }
    };

    let currentSection = 'assets'; // default to assets (Cash is usually top)

    for (let i = 1; i < rawValues.length; i++) {
        const row = rawValues[i];
        const label = row[1] || row[0]; // Usually name is in Col B, sometimes A

        // Skip empty rows or rows without labels
        if (!label) continue;

        // Detect Section Headers (Simple heuristic based on keywords)
        if (label.includes('信用卡') || label.includes('負債')) {
            currentSection = 'liabilities';
            accounts.sectionHeaders.liabilities = i + 1; // Store 1-based index
            continue; // Skip the header itself
        }
        if (label.includes('投資') || label.includes('股票') || label.includes('證券')) {
            currentSection = 'investments';
            accounts.sectionHeaders.investments = i + 1;
            continue;
        }
        if (label.includes('現金') || label.includes('帳戶')) {
            currentSection = 'assets';
            accounts.sectionHeaders.assets = i + 1;
            // If it's the main header "現金與帳戶", skip. 
            // If it's "現金" account, keep it.
            if (label === '現金與帳戶' || label === '項目') continue;
        }

        // Detect Totals
        if (label.includes('總額') || label.includes('總計')) {
            // Store total rows specifically if needed, or ignore to calc client-side
            // Let's store total rows for validation but calculate our own for UI
            continue;
        }

        // It's an account row
        const accountData = {
            name: label,
            rowParams: { rowIndex: i + 1 }, // 1-based index for API updates
            values: {} // Map monthIndex -> value
        };

        months.forEach(month => {
            const val = row[month.index];
            // Clean up currency strings "$1,234" -> 1234
            const numVal = val ? parseFloat(val.replace(/[$,]/g, '')) : 0;
            accountData.values[month.index] = isNaN(numVal) ? 0 : numVal;
        });

        if (currentSection === 'assets') {
            accounts.assets.push(accountData);
        } else if (currentSection === 'investments') {
            accounts.investments.push(accountData);
        } else {
            accounts.liabilities.push(accountData);
        }
    }

    return { months, accounts };
};

export const calculateMonthlyTotals = (parsedData, monthIndex) => {
    if (!parsedData) return { assets: 0, investments: 0, liabilities: 0, net: 0 };

    const sumSection = (items) => {
        return items.reduce((sum, item) => {
            return sum + (item.values[monthIndex] || 0);
        }, 0);
    };

    const totalAssets = sumSection(parsedData.accounts.assets);
    const totalInvestments = sumSection(parsedData.accounts.investments);
    const totalLiabilities = sumSection(parsedData.accounts.liabilities);

    return {
        assets: totalAssets,
        investments: totalInvestments,
        liabilities: totalLiabilities,
        net: totalAssets + totalInvestments - totalLiabilities
    };
};
