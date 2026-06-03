import React from 'react';
import type { Tab } from '../types';

interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'overview',
    label: 'Γενικά',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9"/>
        <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.5"/>
        <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.5"/>
        <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.3"/>
      </svg>
    ),
  },
  {
    id: 'research',
    label: 'Γραφήματα',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <polyline points="1,13 5,8 8,10 11,5 15,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="5" cy="8" r="1.5" fill="currentColor"/>
        <circle cx="8" cy="10" r="1.5" fill="currentColor"/>
        <circle cx="11" cy="5" r="1.5" fill="currentColor"/>
      </svg>
    ),
  },
  {
    id: 'audit',
    label: 'Ιστορικό',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.4"/>
        <line x1="5" y1="5" x2="11" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="5" y1="11" x2="8" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L14.5 4.5V11.5L8 15L1.5 11.5V4.5L8 1Z" stroke="white" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M8 1V15M1.5 4.5L8 8L14.5 4.5M8 8L8 15" stroke="white" strokeWidth="1" opacity="0.5"/>
          </svg>
        </div>
        <div>
          <div className="sidebar-logo-text">CubeDoku</div>
          <div className="sidebar-logo-sub">Analytics</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-label">Πλοήγηση</div>
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        Πτυχιακή Εργασία · CubeDoku
      </div>
    </aside>
  );
}
