import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '../ui/Card';
import { X } from 'lucide-react';

export const AddAccountModal = ({ isOpen, onClose, onConfirm, currentMonthLabel }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState('bank'); // bank, credit, stock, fx
    const [balance, setBalance] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name) return;

        setLoading(true);
        try {
            await onConfirm({ name, type, balance: balance || 0 });
            setName('');
            setBalance('');
            onClose();
        } catch (error) {
            console.error('Failed to add account', error);
            alert('Failed to add account');
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center', // Center vertically and horizontally
            zIndex: 100, // Ensure it's on top
            padding: '1rem'
        }}>
            <Card style={{
                width: '100%',
                maxWidth: '360px',
                position: 'relative',
                background: '#1e293b',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)'
                    }}
                >
                    <X size={24} />
                </button>

                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>新增帳戶</h3>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>名稱</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="例如：國泰世華"
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                borderRadius: '0.5rem',
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(0,0,0,0.2)',
                                color: 'white',
                                fontSize: '1rem'
                            }}
                            autoFocus
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>類別</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {['bank', 'investment', 'credit'].map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setType(t)}
                                    style={{
                                        flex: 1,
                                        padding: '0.5rem',
                                        borderRadius: '0.5rem',
                                        border: '1px solid ' + (type === t ? 'var(--text-accent)' : 'rgba(255,255,255,0.1)'),
                                        background: type === t ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                                        color: type === t ? 'var(--text-accent)' : 'var(--text-secondary)',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    {t === 'bank' ? '銀行' : t === 'investment' ? '投資' : '信用卡'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                            金額 ({currentMonthLabel})
                        </label>
                        <input
                            type="number"
                            value={balance}
                            onChange={e => setBalance(e.target.value)}
                            placeholder="0"
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                borderRadius: '0.5rem',
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(0,0,0,0.2)',
                                color: 'white',
                                fontSize: '1rem'
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            marginTop: '1rem',
                            padding: '1rem',
                            borderRadius: '0.5rem',
                            border: 'none',
                            background: 'linear-gradient(to right, #38bdf8, #818cf8)',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? '新增中...' : '確認'}
                    </button>
                </form>
            </Card>
        </div>,
        document.body
    );
};
