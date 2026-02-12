// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import * as supabaseService from './services/supabase';
import { supabase } from './lib/supabaseClient';

// Mock Supabase Client (Auth)
vi.mock('./lib/supabaseClient', () => ({
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
vi.mock('./services/supabase', () => ({
    fetchData: vi.fn(),
    addAccount: vi.fn(),
    updateAccount: vi.fn(),
    deleteAccount: vi.fn(),
    addMonth: vi.fn(),
}));

// Mock Lucide Icons (to avoid issues rendering SVGs in tests if not needed)
// actually they render fine usually, but let's see.

describe('App Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should show login screen when not authenticated', async () => {
        supabase.auth.getSession.mockResolvedValue({ data: { session: null } });

        render(<App />);

        await waitFor(() => {
            expect(screen.getByText('MonTrack')).toBeInTheDocument();
            expect(screen.getByText('取得登入連結')).toBeInTheDocument();
        });
    });

    it('should load data and show dashboard when authenticated', async () => {
        // Mock Session
        const mockSession = { user: { id: 'user-123', email: 'test@example.com' } };
        supabase.auth.getSession.mockResolvedValue({ data: { session: mockSession } });

        // Mock Data
        const mockData = {
            months: [{ index: 0, label: '2025/01' }],
            accounts: {
                assets: [
                    { id: 'acc-1', name: 'Test Bank', type: 'asset', values: { '0': 1000 } }
                ],
                investments: [],
                liabilities: [],
                sectionHeaders: { assets: 0, investments: 0, liabilities: 0 }
            }
        };
        supabaseService.fetchData.mockResolvedValue(mockData);

        render(<App />);

        // Verify Data Loading
        await waitFor(() => {
            expect(screen.getByText('Test Bank')).toBeInTheDocument();
            expect(screen.getByText('$1,000')).toBeInTheDocument();
        });
    });

    it('should open add account modal and call addAccount service', async () => {
        // Mock Session
        const mockSession = { user: { id: 'user-123', email: 'test@example.com' } };
        supabase.auth.getSession.mockResolvedValue({ data: { session: mockSession } });

        // Mock Data (Empty initially)
        const mockData = {
            months: [{ index: 0, label: '2025/01' }],
            accounts: { assets: [], investments: [], liabilities: [], sectionHeaders: {} }
        };
        supabaseService.fetchData.mockResolvedValue(mockData);
        supabaseService.addAccount.mockResolvedValue({ id: 'new-acc', name: 'New Bank', type: 'asset' });

        render(<App />);

        await waitFor(() => expect(screen.queryByText('載入資料中...')).not.toBeInTheDocument());

        // Open Modal (Find FAB by button role if possible, or by icon)
        // The FAB has a Plus icon.
        // Let's find by role button with no text (it's icon only)
        // Or just by role button and index if needed, or better add aria-label or testid.
        // Given the code, it's a button at the bottom right.
        const buttons = screen.getAllByRole('button');
        const fab = buttons[buttons.length - 1]; // Likely the FAB as it is rendered last

        fireEvent.click(fab);

        await waitFor(() => expect(screen.getByText('新增帳戶')).toBeInTheDocument());

        // Fill Form
        // Inputs don't have labels associated via `htmlFor` in the modal code probably, 
        // let's check input placeholders or testids.
        // AddAccountModal uses placeholders: "帳戶名稱 (例如：台新銀行)", "金額"

        fireEvent.change(screen.getByPlaceholderText('帳戶名稱 (例如：台新銀行)'), { target: { value: 'My New Bank' } });
        fireEvent.change(screen.getByPlaceholderText('金額'), { target: { value: '5000' } });

        // Select Type (Defaults to asset/bank, let's keep it)

        // Click Confirm "新增"
        fireEvent.click(screen.getByText('新增', { selector: 'button' }));

        await waitFor(() => {
            expect(supabaseService.addAccount).toHaveBeenCalledWith(expect.objectContaining({
                name: 'My New Bank',
                balance: '5000', // or number 5000 depending on implementation
                userId: 'user-123'
            }));
        });
    });
});
