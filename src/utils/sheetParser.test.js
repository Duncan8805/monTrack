import { describe, it, expect } from 'vitest';
import { parseSheetData, calculateMonthlyTotals } from './sheetParser';

describe('sheetParser', () => {
    describe('parseSheetData', () => {
        it('should return null if rawValues is null or empty', () => {
            expect(parseSheetData(null)).toBeNull();
            expect(parseSheetData([])).toBeNull();
        });

        it('should correctly parse months from header row', () => {
            const raw = [
                ['', '項目', '2025/01', '2025/02'], // Header
                ['', '現金', '100', '200']
            ];
            const result = parseSheetData(raw);
            expect(result.months).toHaveLength(2);
            expect(result.months[0]).toEqual({ index: 2, label: '2025/01' });
            expect(result.months[1]).toEqual({ index: 3, label: '2025/02' });
        });

        it('should categorize accounts correctly', () => {
            const raw = [
                ['', '項目', '2025/01'],
                ['', '現金與帳戶'], // Asset Header
                ['', '銀行帳戶', '1000'], // Asset
                ['', '投資'], // Investment Header
                ['', '股票', '500'], // Investment
                ['', '信用卡'], // Liability Header
                ['', '主要信用卡', '200'] // Liability
            ];
            const result = parseSheetData(raw);

            expect(result.accounts.assets).toHaveLength(1);
            expect(result.accounts.assets[0].name).toBe('MyBank');

            expect(result.accounts.investments).toHaveLength(1);
            expect(result.accounts.investments[0].name).toBe('股票');

            expect(result.accounts.liabilities).toHaveLength(1);
            expect(result.accounts.liabilities[0].name).toBe('主要信用卡');
        });

        it('should parse currency strings to numbers', () => {
            const raw = [
                ['', '項目', '2025/01'],
                ['', '現金與帳戶'],
                ['', '銀行帳戶', '$1,000']
            ];
            const result = parseSheetData(raw);
            const account = result.accounts.assets[0];
            // key is the column index, which is 2 for '2025/01'
            expect(account.values[2]).toBe(1000);
        });
    });

    describe('calculateMonthlyTotals', () => {
        it('should return zeros if parsedData is null', () => {
            expect(calculateMonthlyTotals(null, 0)).toEqual({
                assets: 0, investments: 0, liabilities: 0, net: 0
            });
        });

        it('should correctly sum values for a given month index', () => {
            // Mock structure similar to what parseSheetData returns
            const mockData = {
                accounts: {
                    assets: [
                        { values: { 2: 1000 } },
                        { values: { 2: 500 } }
                    ],
                    investments: [
                        { values: { 2: 200 } }
                    ],
                    liabilities: [
                        { values: { 2: 300 } }
                    ]
                }
            };

            const totals = calculateMonthlyTotals(mockData, 2);

            expect(totals.assets).toBe(1500);
            expect(totals.investments).toBe(200);
            expect(totals.liabilities).toBe(300);
            expect(totals.net).toBe(1500 + 200 - 300); // 1400
        });

        it('should handle missing values for a month', () => {
            const mockData = {
                accounts: {
                    assets: [
                        { values: { 2: 1000 } },
                        { values: {} } // Missing value for index 2
                    ],
                    investments: [],
                    liabilities: []
                }
            };
            const totals = calculateMonthlyTotals(mockData, 2);
            expect(totals.assets).toBe(1000);
        });
    });
});
