
import { useState, useEffect, useMemo } from 'react'
import { trySilentAuth, initializeGapi, initializeGis, handleAuthClick, handleSignoutClick, getValues, insertRow, updateValues, getSheetIdByName, insertColumn, deleteRow, getUserEmail, createSheet } from './services/googleSheets'
import { parseSheetData, calculateMonthlyTotals } from './utils/sheetParser'
import { CLIENT_ID, API_KEY } from './lib/config'
import { Card, StatCard } from './components/ui/Card'
import { CollapsibleSection } from './components/ui/CollapsibleSection'
import { AddAccountModal } from './components/forms/AddAccountModal'
import { EditAccountModal } from './components/forms/EditAccountModal'
import { Wallet, CreditCard, ChevronLeft, ChevronRight, TrendingUp, Plus } from 'lucide-react'
import './App.css'

// Mapping of Emails to Sheet Names (Tabs)
// In a real app, this might be in a database or a config sheet.
const USER_MAPPING = {
  'duncan6010@gmail.com': '月記帳',
  'default': 'User2' // Fallback for other users
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); // Sheet Name
  const [userEmail, setUserEmail] = useState(null);

  const [rawData, setRawData] = useState([]);
  const [parsedData, setParsedData] = useState(null);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isApiReady, setIsApiReady] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        await Promise.all([initializeGapi(), initializeGis()]);
        console.log('Google API initialized');
        setIsApiReady(true);

        // Attempt silent login
        trySilentAuth(async (resp) => {
          if (resp && !resp.error) {
            console.log("Silent login successful");
            handleLoginSuccess(resp); // Refactor success logic
          }
        });

      } catch (error) {
        console.error('Failed to initialize Google API', error);
        setError('Failed to initialize Google API. Check console.');
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (isAuthenticated && currentUser) {
      fetchData();
    }
  }, [currentUser, isAuthenticated]);

  const handleLoginSuccess = async (resp) => {
    setIsAuthenticated(true);
    // Get User Email to determine Sheet Name
    try {
      const email = await getUserEmail();
      setUserEmail(email);
      console.log("Logged in as:", email);

      // Determine Sheet Name
      // Use mapping if exists, otherwise use username part of email
      let sheetName = USER_MAPPING[email];
      if (!sheetName) {
        sheetName = email.split('@')[0];
        // Ensure valid sheet name (remove special chars if needed, but email username is usually ok)
        // Just Capitalize first letter for looks
        sheetName = sheetName.charAt(0).toUpperCase() + sheetName.slice(1);
      }

      // Check if sheet exists, if not create and initialize
      try {
        await getSheetIdByName(sheetName);
      } catch (e) {
        console.log(`Sheet ${sheetName} not found. Creating...`);
        await createSheet(sheetName);
        // Initialize with template data
        // Row 1: Headers
        await updateValues(`'${sheetName}'!A1`, [['', '項目', '2025/01']]);
        // Row 2: Assets Header
        await updateValues(`'${sheetName}'!A2`, [['', '現金與帳戶']]);
        // Row 3: Asset Item
        await updateValues(`'${sheetName}'!A3`, [['', '銀行帳戶', '0']]);
        // Row 15: Liabilities Header (Leave gap)
        await updateValues(`'${sheetName}'!A15`, [['', '信用卡']]);
        // Row 16: Liability Item
        await updateValues(`'${sheetName}'!A16`, [['', '主要信用卡', '0']]);
      }

      setCurrentUser(sheetName);

    } catch (err) {
      console.error("Failed to get user info or init sheet", err);
      alert("Failed to initialize user data: " + err.message);
    }
  };

  const onLogin = () => {
    handleAuthClick((resp) => {
      if (resp && !resp.error) {
        handleLoginSuccess(resp);
      }
    });
  };

  const onLogout = () => {
    handleSignoutClick();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setUserEmail(null);
    setRawData([]);
    setParsedData(null);
  };

  const fetchData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const values = await getValues(`'${currentUser}'!A1:P100`);
      setRawData(values || []);
      const parsed = parseSheetData(values);
      setParsedData(parsed);

      if (parsed && parsed.months.length > 0) {
        if (selectedMonthIndex >= parsed.months.length) {
          setSelectedMonthIndex(0);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const getInsertIndex = (type) => {
    if (!parsedData) return 2;

    if (type === 'bank') {
      const assets = parsedData.accounts.assets;
      if (assets.length > 0) {
        return assets[assets.length - 1].rowParams.rowIndex;
      }
      // If no assets, insert after Assets Header if exists, else Row 2
      if (parsedData.accounts.sectionHeaders.assets) {
        return parsedData.accounts.sectionHeaders.assets;
      }
      return 2;
    } else if (type === 'investment') {
      const investments = parsedData.accounts.investments;
      if (investments.length > 0) {
        return investments[investments.length - 1].rowParams.rowIndex;
      }
      if (parsedData.accounts.sectionHeaders.investments) {
        return parsedData.accounts.sectionHeaders.investments;
      }
      // Fallback: This is tricky. If no header exists, we should ideally ask user to create one or insert safely.
      // But for now, let's insert after assets.
      const assets = parsedData.accounts.assets;
      if (assets.length > 0) {
        return assets[assets.length - 1].rowParams.rowIndex + 1;
      }
      return 10;
    } else {
      const liabilities = parsedData.accounts.liabilities;
      if (liabilities.length > 0) {
        return liabilities[liabilities.length - 1].rowParams.rowIndex;
      }
      // If no liabilities, insert after Liabilities Header
      if (parsedData.accounts.sectionHeaders.liabilities) {
        return parsedData.accounts.sectionHeaders.liabilities;
      }

      // Fallback if header not found (shouldn't happen with correct init)
      // Attempt to find after assets + gap
      const assets = parsedData.accounts.assets;
      if (assets.length > 0) {
        return assets[assets.length - 1].rowParams.rowIndex + 10;
      }
      return 25;
    }
  };

  const handleAddAccount = async ({ name, type, balance }) => {
    if (!currentUser) return;
    try {
      let rowIndex = getInsertIndex(type);
      const sheetId = await getSheetIdByName(currentUser);

      // Special handling for Investment: Check if header exists
      if (type === 'investment') {
        const hasHeader = parsedData.accounts.sectionHeaders.investments > 0;
        if (!hasHeader) {
          console.log("Investment header missing. Creating...");
          // rowIndex currently points to insertion point (e.g. after assets)
          // We insert Header first
          await insertRow(sheetId, rowIndex);
          await updateValues(`'${currentUser}'!B${rowIndex + 1}`, [['投資']]);

          // Update rowIndex to be after the newly created header
          // The header is at rowIndex + 1 (Excel 1-based).
          // We want to insert account after it.
          rowIndex = rowIndex + 1;
        }
      }

      await insertRow(sheetId, rowIndex);

      const newExcelRow = rowIndex + 1;

      await updateValues(`'${currentUser}'!B${newExcelRow}`, [[name]]);

      if (parsedData.months[selectedMonthIndex]) {
        const colIndex = parsedData.months[selectedMonthIndex].index;
        const colLetter = String.fromCharCode(65 + colIndex);
        await updateValues(`'${currentUser}'!${colLetter}${newExcelRow}`, [[balance]]);
      }

      await fetchData();
      setIsAddModalOpen(false);

    } catch (err) {
      console.error('Add Account Error:', err);
      const msg = err.result?.error?.message || err.message || JSON.stringify(err);
      alert("Error adding account: " + msg);
    }
  };

  const openEditModal = (account) => {
    const currentValue = account.values[currentMonthData.index];
    setEditingAccount({ ...account, currentValue });
    setIsEditModalOpen(true);
  };

  const handleEditAccount = async (updatedAccount) => {
    if (!currentUser) return;
    try {
      const rowIndex = updatedAccount.rowParams.rowIndex;

      await updateValues(`'${currentUser}'!B${rowIndex}`, [[updatedAccount.name]]);

      if (parsedData.months[selectedMonthIndex]) {
        const colIndex = parsedData.months[selectedMonthIndex].index;
        const colLetter = String.fromCharCode(65 + colIndex);
        await updateValues(`'${currentUser}'!${colLetter}${rowIndex}`, [[updatedAccount.balance]]);
      }

      await fetchData();
      setIsEditModalOpen(false);
      setEditingAccount(null);
    } catch (err) {
      console.error('Edit Account Error:', err);
      const msg = err.result?.error?.message || err.message || JSON.stringify(err);
      alert("Error editing account: " + msg);
    }
  };

  const handleDeleteAccount = async (account) => {
    if (!currentUser) return;
    try {
      const rowIndex = account.rowParams.rowIndex - 1;
      const sheetId = await getSheetIdByName(currentUser);
      await deleteRow(sheetId, rowIndex);

      await fetchData();
      setIsEditModalOpen(false);
      setEditingAccount(null);
    } catch (err) {
      console.error("Delete account error", err);
      const msg = err.result?.error?.message || err.message || JSON.stringify(err);
      alert("Error deleting account: " + msg);
    }
  };

  const currentMonthData = useMemo(() => {
    if (!parsedData || !parsedData.months[selectedMonthIndex]) return null;
    const month = parsedData.months[selectedMonthIndex];
    const totals = calculateMonthlyTotals(parsedData, month.index);
    return { ...month, totals };
  }, [parsedData, selectedMonthIndex]);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0 }).format(val);
  };

  const handlePrevMonth = () => {
    if (selectedMonthIndex > 0) setSelectedMonthIndex(prev => prev - 1);
  };

  const handleNextMonth = () => {
    if (parsedData && selectedMonthIndex < parsedData.months.length - 1) setSelectedMonthIndex(prev => prev + 1);
  };

  const handleAddMonth = async () => {
    if (!currentUser || !parsedData || parsedData.months.length === 0) return;

    const lastMonth = parsedData.months[parsedData.months.length - 1];
    const [yearStr, monthStr] = lastMonth.label.split('/');
    let year = parseInt(yearStr);
    let month = parseInt(monthStr);

    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }

    const newMonthLabel = `${year}/${month.toString().padStart(2, '0')}`;

    if (!window.confirm(`開始新的月份：${newMonthLabel}?`)) return;

    setLoading(true);
    try {
      const insertAt = lastMonth.index + 1;
      const sheetId = await getSheetIdByName(currentUser);
      await insertColumn(sheetId, insertAt);

      const colLetter = String.fromCharCode(65 + insertAt);
      await updateValues(`'${currentUser}'!${colLetter}1`, [[newMonthLabel]]);

      await fetchData();

    } catch (err) {
      console.error("Failed to add month", err);
      alert("新增月份失敗: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  /* Previous Month Logic */
  const handleAddPreviousMonth = async () => {
    if (!currentUser || !parsedData || parsedData.months.length === 0) return;

    const firstMonth = parsedData.months[0];
    const [yearStr, monthStr] = firstMonth.label.split('/');
    let year = parseInt(yearStr);
    let month = parseInt(monthStr);

    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }

    const newMonthLabel = `${year}/${month.toString().padStart(2, '0')}`;

    if (!window.confirm(`新增之前的月份：${newMonthLabel}?`)) return;

    setLoading(true);
    try {
      // Insert at the first month's index (should be 2)
      const insertAt = firstMonth.index;
      const sheetId = await getSheetIdByName(currentUser);
      await insertColumn(sheetId, insertAt);

      const colLetter = String.fromCharCode(65 + insertAt);
      await updateValues(`'${currentUser}'!${colLetter}1`, [[newMonthLabel]]);

      await fetchData();

      // After reload, the new month will be at index 0 of parsed data
      // We want to stay or switch to it? 
      // Current behavior: fetchData resets to index 0 if out of bounds, 
      // but here we are adding at 0. So staying at 0 (or default) will show the NEW month (oldest).
      // That seems correct behavior for adding "previous".
      setSelectedMonthIndex(0);

    } catch (err) {
      console.error("Failed to add previous month", err);
      alert("新增月份失敗: " + err.message);
    } finally {
      setLoading(false);
    }
  };


  const isConfigured = CLIENT_ID !== 'YOUR_CLIENT_ID' && API_KEY !== 'YOUR_API_KEY';

  if (!isConfigured) {
    return (
      <div style={{ padding: '2rem', color: 'var(--color-warning)', textAlign: 'center' }}>
        <Card>
          <h3>Configuration Required</h3>
          <p>請更新 src/lib/config.js 以填入您的 Google Cloud Client ID 和 API Key。</p>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}>
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <h1 className="text-gradient" style={{ fontSize: '3rem', marginBottom: '1rem' }}>MonTrack</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>月度理財追蹤</p>
          <button
            className="glass-panel"
            onClick={onLogin}
            disabled={!isApiReady}
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1.2rem',
              color: isApiReady ? 'var(--text-accent)' : 'var(--text-secondary)',
              opacity: isApiReady ? 1 : 0.5,
              cursor: isApiReady ? 'pointer' : 'not-allowed',
              background: isApiReady ? 'rgba(56, 189, 248, 0.1)' : 'transparent'
            }}
          >
            {isApiReady ? '使用 Google 登入' : '初始化中...'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem', paddingBottom: '6rem', maxWidth: '600px', margin: '0 auto', position: 'relative' }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        paddingTop: '1rem'
      }}>
        <div>
          <h2 className="text-gradient" style={{ fontSize: '1.75rem', fontWeight: '800', letterSpacing: '-0.025em' }}>MonTrack</h2>
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            marginTop: '0.25rem',
            background: 'rgba(255,255,255,0.05)',
            padding: '2px 8px',
            borderRadius: '12px',
            display: 'inline-block',
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            {userEmail ? `${userEmail.split('@')[0]}` : ''}
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{
            color: 'var(--text-secondary)',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '0.5rem 1rem',
            borderRadius: '2rem',
            fontSize: '0.85rem',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          登出
        </button>
      </header>

      {loading && <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>載入資料中...</div>}

      {!loading && parsedData && currentMonthData && (
        <>
          <main className="animate-fade-in">
            {/* Month Selector */}
            <div className="glass-panel" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem',
              padding: '0.5rem 1rem',
              borderRadius: '2rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {selectedMonthIndex === 0 && (
                  <button onClick={handleAddPreviousMonth} style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '0.5rem',
                    cursor: 'pointer'
                  }} title="Add Previous Month">
                    <Plus size={18} strokeWidth={3} />
                  </button>
                )}
                <button onClick={handlePrevMonth} disabled={selectedMonthIndex === 0} style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  opacity: selectedMonthIndex === 0 ? 0.3 : 1,
                  display: selectedMonthIndex === 0 ? 'none' : 'flex',
                  padding: '0.5rem',
                  cursor: selectedMonthIndex === 0 ? 'default' : 'pointer'
                }}>
                  <ChevronLeft size={24} />
                </button>
              </div>

              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', letterSpacing: '0.05em' }}>{currentMonthData.label}</h3>

              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button onClick={handleNextMonth} disabled={selectedMonthIndex === parsedData.months.length - 1} style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  opacity: selectedMonthIndex === parsedData.months.length - 1 ? 0 : 1,
                  padding: '0.5rem',
                  display: selectedMonthIndex === parsedData.months.length - 1 ? 'none' : 'flex',
                }}>
                  <ChevronRight size={24} />
                </button>
                {selectedMonthIndex === parsedData.months.length - 1 && (
                  <button onClick={handleAddMonth} style={{
                    background: 'var(--text-accent)',
                    border: 'none',
                    color: '#0f172a',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: '0.5rem'
                  }} title="Add Next Month">
                    <Plus size={18} strokeWidth={3} />
                  </button>
                )}
              </div>
            </div>

            {/* Net Worth */}
            <Card className="text-gradient" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>淨資產</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                {formatCurrency(currentMonthData.totals.net)}
              </div>
            </Card>


            {/* Stats Row */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
              <StatCard title="資產" value={formatCurrency(currentMonthData.totals.assets)} type="success" icon={Wallet} />
              <StatCard title="投資" value={formatCurrency(currentMonthData.totals.investments)} type="warning" icon={TrendingUp} />
              <StatCard title="負債" value={formatCurrency(currentMonthData.totals.liabilities)} type="danger" icon={CreditCard} />
            </div>

            {/* Assets List */}
            <CollapsibleSection
              title="現金與帳戶"
              defaultOpen={true}
              totalValue={formatCurrency(currentMonthData.totals.assets)}
            >
              {parsedData.accounts.assets.map((acc, idx) => (
                <Card
                  key={idx}
                  className="animate-fade-in"
                  style={{
                    padding: '1.25rem',
                    marginBottom: 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    animationDelay: `${idx * 0.05}s`
                  }}
                  onClick={() => openEditModal(acc)}
                >
                  <span style={{ fontWeight: 500, fontSize: '1rem' }}>{acc.name}</span>
                  <span style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--color-success)' }}>{formatCurrency(acc.values[currentMonthData.index])}</span>
                </Card>
              ))}
            </CollapsibleSection>

            {/* Investments List */}
            <CollapsibleSection
              title="投資"
              defaultOpen={true}
              totalValue={formatCurrency(currentMonthData.totals.investments)}
            >
              {parsedData.accounts.investments.map((acc, idx) => (
                <Card
                  key={idx}
                  className="animate-fade-in"
                  style={{
                    padding: '1.25rem',
                    marginBottom: 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    animationDelay: `${idx * 0.05}s`
                  }}
                  onClick={() => openEditModal(acc)}
                >
                  <span style={{ fontWeight: 500, fontSize: '1rem' }}>{acc.name}</span>
                  <span style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--color-warning)' }}>{formatCurrency(acc.values[currentMonthData.index])}</span>
                </Card>
              ))}
            </CollapsibleSection>

            {/* Liabilities List */}
            <CollapsibleSection
              title="信用卡"
              defaultOpen={false}
              totalValue={formatCurrency(currentMonthData.totals.liabilities)}
            >
              {parsedData.accounts.liabilities.map((acc, idx) => (
                <Card
                  key={idx}
                  className="animate-fade-in"
                  style={{
                    padding: '1.25rem',
                    marginBottom: 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    animationDelay: `${idx * 0.05}s`
                  }}
                  onClick={() => openEditModal(acc)}
                >
                  <span style={{ fontWeight: 500, fontSize: '1rem' }}>{acc.name}</span>
                  <span style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--color-danger)' }}>{formatCurrency(acc.values[currentMonthData.index])}</span>
                </Card>
              ))}
            </CollapsibleSection>

            <AddAccountModal
              isOpen={isAddModalOpen}
              onClose={() => setIsAddModalOpen(false)}
              onConfirm={handleAddAccount}
              currentMonthLabel={currentMonthData.label}
            />

            <EditAccountModal
              isOpen={isEditModalOpen}
              onClose={() => { setIsEditModalOpen(false); setEditingAccount(null); }}
              onConfirm={handleEditAccount}
              onDelete={handleDeleteAccount}
              account={editingAccount}
              currentMonthLabel={currentMonthData.label}
            />

          </main>

          {/* FAB */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            style={{
              position: 'fixed',
              bottom: '2rem',
              right: '2rem',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'var(--text-accent)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(56, 189, 248, 0.4)',
              zIndex: 50,
              cursor: 'pointer'
            }}
          >
            <Plus size={32} color="#0f172a" strokeWidth={2.5} />
          </button>
        </>
      )}
    </div>
  )
}

export default App
