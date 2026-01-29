import React from 'react';

export const Card = ({ children, className = '', style = {}, onClick, ...props }) => {
    return (
        <div
            className={`glass-panel ${onClick ? 'clickable-card' : ''} ${className}`}
            onClick={onClick}
            style={{
                padding: '1.5rem',
                marginBottom: '1rem',
                cursor: onClick ? 'pointer' : 'default',
                ...style
            }}
            {...props}
        >
            {children}
        </div>
    );
};

export const StatCard = ({ title, value, type = 'neutral', icon: Icon }) => {
    const getColor = () => {
        switch (type) {
            case 'success': return 'var(--color-success)';
            case 'danger': return 'var(--color-danger)';
            case 'warning': return 'var(--color-warning)';
            default: return 'var(--text-primary)';
        }
    };

    const getBackground = () => {
        switch (type) {
            case 'success': return 'linear-gradient(145deg, rgba(74, 222, 128, 0.1), transparent)';
            case 'danger': return 'linear-gradient(145deg, rgba(248, 113, 113, 0.1), transparent)';
            default: return 'none';
        }
    }

    return (
        <Card style={{
            flex: 1,
            minWidth: '140px',
            background: getBackground(),
            border: `1px solid ${type === 'neutral' ? 'rgba(255,255,255,0.05)' : getColor() + '40'}` // 40 is hex for 25% opacity
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{
                    padding: '8px',
                    borderRadius: '50%',
                    background: type === 'neutral' ? 'rgba(255,255,255,0.05)' : `${getColor()}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {Icon && <Icon size={18} color={getColor()} />}
                </div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>{title}</span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {value}
            </div>
        </Card>
    );
};
