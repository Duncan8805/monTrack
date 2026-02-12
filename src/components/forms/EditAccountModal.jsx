import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '../ui/Card';
import { X } from 'lucide-react';

export const EditAccountModal = ({ isOpen, onClose, onConfirm, onDelete, account, currentMonthLabel }) => {
    const [name, setName] = useState('');
    const [balance, setBalance] = useState('');
    const [loading, setLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (account) {
            setName(account.name);
            setBalance(account.currentValue);
        }
    }, [account]);

    if (!isOpen || !account) return null;

    const handleDelete = async () => {
        if (!window.confirm(`確定要刪除帳戶 "${name}" 嗎？此動作無法復原。`)) return;
        setIsDeleting(true);
        try {
            await onDelete(account);
            onClose();
        } catch (err) {
            console.error("Delete failed", err);
            alert("刪除失敗");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name) return;

        setLoading(true);
        try {
            await onConfirm({ ...account, name, balance: balance || 0 }); // Pass back full account + updates
            onClose();
        } catch (error) {
            console.error('Failed to edit account', error);
            alert('編輯帳戶失敗');
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
            justifyContent: 'center',
            zIndex: 100,
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

                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>編輯帳戶</h3>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>名稱</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="帳戶名稱"
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

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={loading || isDeleting}
                            style={{
                                flex: 1,
                                padding: '1rem',
                                borderRadius: '0.5rem',
                                border: '1px solid var(--color-danger)',
                                background: 'transparent',
                                color: 'var(--color-danger)',
                                fontWeight: 'bold',
                                fontSize: '1rem',
                                opacity: (loading || isDeleting) ? 0.7 : 1,
                                cursor: 'pointer'
                            }}
                        >
                            {isDeleting ? '刪除中...' : '刪除'}
                        </button>
                        <button
                            type="submit"
                            disabled={loading || isDeleting}
                            style={{
                                flex: 2,
                                padding: '1rem',
                                borderRadius: '0.5rem',
                                border: 'none',
                                background: 'linear-gradient(to right, #38bdf8, #818cf8)',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '1rem',
                                opacity: (loading || isDeleting) ? 0.7 : 1,
                                cursor: 'pointer'
                            }}
                        >
                            {loading ? '儲存中...' : '確認'}
                        </button>
                    </div>
                </form>
            </Card>
        </div>,
        document.body
    );
};
