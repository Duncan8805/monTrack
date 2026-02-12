
import { useState, useEffect, useMemo } from 'react'
import * as supabaseService from './services/supabase'
import { supabase } from './lib/supabaseClient'
import { parseSheetData, calculateMonthlyTotals } from './utils/sheetParser' // We might need to adjust this or mapped data
import { Card } from './components/ui/Card'
import { CollapsibleSection } from './components/ui/CollapsibleSection'
import { AddAccountModal } from './components/forms/AddAccountModal'
import { EditAccountModal } from './components/forms/EditAccountModal'
import { Wallet, CreditCard, ChevronLeft, ChevronRight, TrendingUp, Plus } from 'lucide-react'
import './App.css'

function App() {
  const [session, setSession] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState(null);

  const [parsedData, setParsedData] = useState(null);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginMessage, setLoginMessage] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setIsAuthenticated(!!session)
      if (session?.user) {
        setUserEmail(session.user.email)
        fetchData(session.user.id)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setIsAuthenticated(!!session)
      if (session?.user) {
        setUserEmail(session.user.email)
        fetchData(session.user.id)
      } else {
        setUserEmail(null)
        setParsedData(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setLoginMessage('')
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: loginEmail,
        options: {
          emailRedirectTo: window.location.origin,
        },
      })
      if (error) throw error
      setLoginMessage('登入連結已發送至您的信箱！')
    } catch (error) {
      setLoginMessage('登入失敗: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const onLogout = async () => {
    await supabase.auth.signOut()
    setParsedData(null)
  };

  const fetchData = async (userId) => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await supabaseService.fetchData(userId);
      console.log("Fetched Data:", data);
      setParsedData(data);

      if (data && data.months.length > 0) {
        // Set to latest month by default if not set
        if (selectedMonthIndex >= data.months.length || selectedMonthIndex === 0) {
          // Default to 0? The parser usually orders them. 
          // My service implementation sorts months.
          // Let's set to the last one (latest) if desired, or 0.
          // Existing code defaulted to 0. 
          // If months are sorted '2025/01', '2025/02', then index 0 is Jan.
          // Usually users want to see the latest. 
          // Let's default to the last one.
          setSelectedMonthIndex(data.months.length - 1);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const currentMonthData = useMemo(() => {
    if (!parsedData || !parsedData.months[selectedMonthIndex]) return null;
    const month = parsedData.months[selectedMonthIndex];
    // We need to calculate totals from the structure returned by Supabase service
    // Structure: { accounts: { assets: [{ values: { '0': 100 } }] } }

    // We can reuse the `calculateMonthlyTotals` if the structure matches what it expects.
    // `sheetParser.js` expects:
    // accounts: { assets: [], ... } where item.values is map of monthIndex -> value.
    // My supabase service returns exactly that.
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

  // Actions
  const handleAddAccount = async ({ name, type, balance }) => {
    if (!session?.user) return;
    try {
      const now = new Date();
      const currentMonthLabel = currentMonthData ? currentMonthData.label : `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}`;
      await supabaseService.addAccount({
        name,
        type,
        balance,
        currentMonthLabel,
        userId: session.user.id
      });
      await fetchData(session.user.id);
      setIsAddModalOpen(false);
    } catch (err) {
      alert("Error adding account: " + err.message);
    }
  };

  const handleEditAccount = async (updatedAccount) => {
    if (!session?.user) return;
    try {
      const now = new Date();
      const currentMonthLabel = currentMonthData ? currentMonthData.label : `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}`;
      await supabaseService.updateAccount({
        id: updatedAccount.id,
        name: updatedAccount.name,
        balance: updatedAccount.balance, // The modal passes 'balance' as the new value
        currentMonthLabel,
        userId: session.user.id
      });
      await fetchData(session.user.id);
      setIsEditModalOpen(false);
      setEditingAccount(null);
    } catch (err) {
      alert("Error updating account: " + err.message);
    }
  };

  const handleDeleteAccount = async (account) => {
    if (!session?.user) return;
    if (!window.confirm(`確定要刪除帳戶 ${account.name}?`)) return;
    try {
      await supabaseService.deleteAccount(account.id);
      await fetchData(session.user.id);
      setIsEditModalOpen(false);
      setEditingAccount(null);
    } catch (err) {
      alert("Error deleting account: " + err.message);
    }
  };

  const handleAddMonth = async () => {
    if (!parsedData || parsedData.months.length === 0) return;
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

    try {
      // Add month logic -> Copy balances?
      // Current implementation in service copies balances from previous month
      await supabaseService.addMonth(newMonthLabel, lastMonth.label, session.user.id);
      await fetchData(session.user.id);
      // Select the new month (it will be the last one)
      // FetchData logic will perform re-render, we might need to manually set index if it doesn't auto-update
    } catch (err) {
      alert("Error adding month: " + err.message);
    }
  };
  // Previous Month Logic - Simplified for now, similar to add month but reversed logic is tricky with DB
  // Let's skip 'Add Previous Month' for now unless critical, or implement basic version
  const handleAddPreviousMonth = async () => {
    alert("目前只支援新增下個月");
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

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input
              type="email"
              placeholder="輸入您的 Email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="glass-input"
              style={{ padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="glass-panel"
              style={{
                padding: '1rem',
                fontSize: '1.2rem',
                color: 'var(--text-accent)',
                cursor: 'pointer',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.2)'
              }}
            >
              {loading ? '發送中...' : '取得登入連結'}
            </button>
          </form>
          {loginMessage && (
            <div style={{ marginTop: '1rem', color: loginMessage.includes('失敗') ? 'var(--color-danger)' : 'var(--color-success)' }}>
              {loginMessage}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem', paddingBottom: '6rem', maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
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
            {userEmail}
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

      {!loading && !parsedData && (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
          尚無資料，請新增帳戶。
        </div>
      )}

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


            {/* Assets List */}
            <CollapsibleSection
              title="現金與帳戶"
              defaultOpen={true}
              totalValue={formatCurrency(currentMonthData.totals.assets)}
            >
              {parsedData.accounts.assets.map((acc, idx) => (
                <Card
                  key={acc.id || idx}
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
                  key={acc.id || idx}
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
                  key={acc.id || idx}
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

      {!loading && parsedData && (!parsedData.months || parsedData.months.length === 0) && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>開始使用請新增第一個帳戶</p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="glass-panel"
            style={{ padding: '0.5rem 1rem', marginTop: '1rem', cursor: 'pointer', background: 'var(--text-accent)', color: 'black' }}
          >
            新增帳戶
          </button>
          <AddAccountModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            onConfirm={handleAddAccount}
            currentMonthLabel={`${new Date().getFullYear()}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}`}
          />
        </div>
      )}
    </div>
  )
}

export default App
