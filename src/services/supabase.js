import { supabase } from '../lib/supabaseClient';

/**
 * Fetch all data for the authenticated user and format it to match the existing App structure.
 * Returns: { months: [], accounts: { assets: [], investments: [], liabilities: [] } }
 */
export const fetchData = async (userId) => {
    try {
        // 1. Fetch Accounts
        const { data: accounts, error: accountsError } = await supabase
            .from('accounts')
            .select('*')
            .order('created_at', { ascending: true });

        if (accountsError) throw accountsError;

        // 2. Fetch Balances
        const { data: balances, error: balancesError } = await supabase
            .from('balances')
            .select('*');

        if (balancesError) throw balancesError;

        // 3. Transform Data
        // Identify all unique months from balances to build the `months` array
        // Format: { index: 0, label: 'YYYY/MM' }
        // We'll sort them chronologically
        const uniqueMonths = [...new Set(balances.map(b => b.month))].sort();

        // Build months array with index for compatibility
        const months = uniqueMonths.map((m, idx) => ({
            index: idx, // Use array index as the key for compatibility with existing code
            label: m
        }));

        // Group accounts by type
        const parsedAccounts = {
            assets: [],
            investments: [],
            liabilities: [],
            sectionHeaders: { assets: 0, investments: 0, liabilities: 0 } // Legacy, might not need strict row checks anymore
        };

        accounts.forEach(acc => {
            const accBalances = {};
            // Populate values map: { '0': 1000, '1': 1050 } where keys are month indexes
            months.forEach((m, idx) => {
                const bal = balances.find(b => b.account_id === acc.id && b.month === m.label);
                accBalances[idx] = bal ? parseFloat(bal.amount) : 0;
            });

            const accountData = {
                id: acc.id, // Store ID for updates
                name: acc.name,
                type: acc.type,
                values: accBalances,
                rowParams: { rowIndex: -1 } // Legacy compatibility
            };

            if (acc.type === 'asset' || acc.type === 'bank') parsedAccounts.assets.push(accountData);
            else if (acc.type === 'investment') parsedAccounts.investments.push(accountData);
            else if (acc.type === 'liability' || acc.type === 'credit') parsedAccounts.liabilities.push(accountData);
        });

        return { months, accounts: parsedAccounts };

    } catch (error) {
        console.error('Error fetching data from Supabase:', error);
        throw error;
    }
};

/**
 * Add a new account
 */
export const addAccount = async ({ name, type, balance, currentMonthLabel, userId }) => {
    try {
        // 1. Insert Account
        const { data: account, error: accError } = await supabase
            .from('accounts')
            .insert([{ user_id: userId, name, type }])
            .select()
            .single();

        if (accError) throw accError;

        // 2. Insert Initial Balance for Current Month
        if (balance) {
            const { error: balError } = await supabase
                .from('balances')
                .insert([{
                    user_id: userId,
                    account_id: account.id,
                    month: currentMonthLabel,
                    amount: balance
                }]);

            if (balError) throw balError;
        }

        return account;
    } catch (error) {
        console.error('Error adding account:', error);
        throw error;
    }
};

/**
 * Update an account (name or balance)
 */
export const updateAccount = async ({ id, name, balance, currentMonthLabel, userId }) => {
    try {
        // 1. Update Name
        const { error: nameError } = await supabase
            .from('accounts')
            .update({ name })
            .eq('id', id)
            .eq('user_id', userId);

        if (nameError) throw nameError;

        // 2. Update Balance (Upsert)
        // We first check if a balance record exists for this month/account
        const { data: existingBalance, error: fetchError } = await supabase
            .from('balances')
            .select('id')
            .eq('account_id', id)
            .eq('month', currentMonthLabel)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError; // PGRST116 is "No rows found"

        if (existingBalance) {
            const { error: updateError } = await supabase
                .from('balances')
                .update({ amount: balance })
                .eq('id', existingBalance.id);
            if (updateError) throw updateError;
        } else {
            const { error: insertError } = await supabase
                .from('balances')
                .insert([{
                    user_id: userId,
                    account_id: id,
                    month: currentMonthLabel,
                    amount: balance
                }]);
            if (insertError) throw insertError;
        }

        return true;

    } catch (error) {
        console.error('Error updating account:', error);
        throw error;
    }
};

/**
 * Delete an account
 */
export const deleteAccount = async (accountId) => {
    try {
        // Balances should be deleted via cascade if configured, 
        // but explicit deletion is safer if not.
        const { error } = await supabase
            .from('accounts')
            .delete()
            .eq('id', accountId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error deleting account:', error);
        throw error;
    }
};

/**
 * Add a new month (initialize balances for all accounts? or simply allow new month label?)
 * In this relation model, "adding a month" might just mean creating a record with a new month label.
 * For now, we can perhaps just copy the previous month's balances to the new month?
 */
export const addMonth = async (newMonthLabel, previousMonthLabel, userId) => {
    try {
        // Fetch all balances for previous month
        const { data: prevBalances, error: fetchError } = await supabase
            .from('balances')
            .select('*')
            .eq('month', previousMonthLabel)
            .eq('user_id', userId);

        if (fetchError) throw fetchError;

        if (!prevBalances || prevBalances.length === 0) return;

        // Prepare new balances
        const newBalances = prevBalances.map(b => ({
            user_id: userId,
            account_id: b.account_id,
            month: newMonthLabel,
            amount: b.amount // Copy balance over
        }));

        const { error: insertError } = await supabase
            .from('balances')
            .insert(newBalances);

        if (insertError) throw insertError;

        return true;
    } catch (error) {
        console.error('Error adding month:', error);
        throw error;
    }
};

/**
 * Add a previous month (copy balances from the next month, which is the current oldest)
 */
export const addPreviousMonth = async (newMonthLabel, nextMonthLabel, userId) => {
    try {
        // Fetch all balances for the "next" month (chronologically next, which is the current oldest in DB)
        const { data: nextBalances, error: fetchError } = await supabase
            .from('balances')
            .select('*')
            .eq('month', nextMonthLabel)
            .eq('user_id', userId);

        if (fetchError) throw fetchError;

        if (!nextBalances || nextBalances.length === 0) return;

        // Prepare new balances
        const newBalances = nextBalances.map(b => ({
            user_id: userId,
            account_id: b.account_id,
            month: newMonthLabel,
            amount: b.amount // Copy balance over
        }));

        const { error: insertError } = await supabase
            .from('balances')
            .insert(newBalances);

        if (insertError) throw insertError;

        return true;
    } catch (error) {
        console.error('Error adding previous month:', error);
        throw error;
    }
};
