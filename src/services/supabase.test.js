// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchData, addAccount } from './supabase';
import { supabase } from '../lib/supabaseClient';

// Mock Supabase Client
vi.mock('../lib/supabaseClient', () => ({
    supabase: {
        from: vi.fn(),
    }
}));

describe('Supabase Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('fetchData', () => {
        it('should fetch and transform data correctly', async () => {
            // Mock Data
            const mockAccounts = [
                { id: '1', name: 'Bank A', type: 'asset', created_at: '2025-01-01' }
            ];
            const mockBalances = [
                { account_id: '1', month: '2025/01', amount: 1000 }
            ];

            // Mock implementation details for chaining
            // accounts: from('accounts').select('*').order(...)
            const selectAccounts = vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockAccounts, error: null })
            });

            // balances: from('balances').select('*')
            const selectBalances = vi.fn().mockReturnValue(
                Promise.resolve({ data: mockBalances, error: null })
            );

            supabase.from.mockImplementation((table) => {
                if (table === 'accounts') {
                    return { select: selectAccounts };
                }
                if (table === 'balances') {
                    return { select: selectBalances };
                }
                return { select: vi.fn() };
            });

            const result = await fetchData('user-123');

            // Verify Transformations
            expect(result.months).toHaveLength(1);
            expect(result.months[0].label).toBe('2025/01');

            expect(result.accounts.assets).toHaveLength(1);
            expect(result.accounts.assets[0].name).toBe('Bank A');
            // Check formatted values: 0 is the index of the first month
            expect(result.accounts.assets[0].values[0]).toBe(1000);
        });

        it('should handle errors from Supabase', async () => {
            supabase.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } })
                })
            });

            await expect(fetchData('user-123')).rejects.toEqual({ message: 'DB Error' });
        });
    });

    describe('addAccount', () => {
        it('should insert account and initial balance', async () => {
            const newAccount = { id: 'new-id', name: 'New Bank', type: 'bank' };

            // Mock Chain: insert(...).select().single()
            const singleFn = vi.fn().mockResolvedValue({ data: newAccount, error: null });
            const selectFn = vi.fn().mockReturnValue({ single: singleFn });
            const insertAccountFn = vi.fn().mockReturnValue({ select: selectFn });

            // Mock Balance Insert
            const insertBalanceFn = vi.fn().mockResolvedValue({ error: null });

            supabase.from.mockImplementation((table) => {
                if (table === 'accounts') return { insert: insertAccountFn };
                if (table === 'balances') return { insert: insertBalanceFn };
            });

            const result = await addAccount({
                name: 'New Bank',
                type: 'bank',
                balance: 100,
                currentMonthLabel: '2025/01',
                userId: 'user-123'
            });

            expect(result).toEqual(newAccount);
            expect(insertAccountFn).toHaveBeenCalledWith([{ user_id: 'user-123', name: 'New Bank', type: 'bank' }]);
            expect(insertBalanceFn).toHaveBeenCalledWith([{
                user_id: 'user-123',
                account_id: 'new-id',
                month: '2025/01',
                amount: 100
            }]);
        });
    });
});
