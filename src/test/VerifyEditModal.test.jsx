
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import * as supabaseService from '../services/supabase';
import { supabase } from '../lib/supabaseClient';

// Mock Supabase Client (Auth)
vi.mock('../lib/supabaseClient', () => ({
    supabase: {
        auth: {
            getSession: vi.fn(),
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
            signInWithOtp: vi.fn(),
            signOut: vi.fn(),
        }
    }
}));

// Mock Supabase Service (Data)
vi.mock('../services/supabase', () => ({
    fetchData: vi.fn(),
    addAccount: vi.fn(),
    updateAccount: vi.fn(),
    deleteAccount: vi.fn(),
    addMonth: vi.fn(),
}));

describe('App Verification - Edit Modal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should open edit modal when an account card is clicked', async () => {
        // Mock Session
        const mockSession = { user: { id: 'user-123', email: 'test@example.com' } };
        supabase.auth.getSession.mockResolvedValue({ data: { session: mockSession } });

        // Mock Data with one account
        const mockData = {
            months: [{ index: 0, label: '2025/01' }],
            accounts: {
                assets: [
                    { id: 'acc-1', name: 'Test Bank for Edit', type: 'asset', values: { '0': 1000 } }
                ],
                investments: [],
                liabilities: []
            }
        };
        supabaseService.fetchData.mockResolvedValue(mockData);

        render(<App />);

        // Wait for data to load
        await waitFor(() => {
            expect(screen.getByText('Test Bank for Edit')).toBeTruthy();
        });

        // Click the account card
        const card = screen.getByText('Test Bank for Edit').closest('div'); // The text is inside the card div
        fireEvent.click(card);

        // Verify Edit Modal opens
        // The edit modal likely has text "編輯帳戶" or buttons "更新" / "刪除"
        // Let's check for the delete button which should only be in edit modal
        await waitFor(() => {
            // Check for buttons or specific text in the modal
            expect(screen.getByText('刪除', { selector: 'button' })).toBeTruthy();
            expect(screen.getByText('更新', { selector: 'button' })).toBeTruthy();
        });
    });
});
