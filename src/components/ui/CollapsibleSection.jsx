import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from './Card';

export const CollapsibleSection = ({ title, children, defaultOpen = false, totalValue = null }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div style={{ marginBottom: '1.5rem' }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.5rem',
                    cursor: 'pointer',
                    marginBottom: '0.5rem'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isOpen ? <ChevronUp size={20} color="var(--text-secondary)" /> : <ChevronDown size={20} color="var(--text-secondary)" />}
                    <h4 style={{ color: 'var(--text-secondary)', margin: 0 }}>{title}</h4>
                </div>
                {totalValue && !isOpen && (
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{totalValue}</span>
                )}
            </div>

            {isOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {children}
                </div>
            )}
        </div>
    );
};
