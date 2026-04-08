import { LuChevronLeft } from 'react-icons/lu';
import { useTheme } from './context/ThemeContext';
import './ProfileModal.css';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
    const { theme, setTheme } = useTheme();

    const applyTheme = (nextTheme: 'dark' | 'light') => {
        setTheme(nextTheme);
    };

    if (!isOpen) return null;

    return (
        <div className="profile-stats-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <button className="modal-back-btn" onClick={onClose} aria-label="Close settings">
                        <LuChevronLeft size={20} />
                    </button>
                    <h3>Game Settings</h3>
                </div>

                <div className="settings-form">
                    <div className="settings-theme-block">
                        <label className="settings-label">Theme</label>
                        <div className="settings-theme-row" role="group" aria-label="Theme selection">
                            <button
                                type="button"
                                className={`settings-theme-btn${theme === 'dark' ? ' active' : ''}`}
                                onClick={() => applyTheme('dark')}
                            >
                                Dark
                            </button>
                            <button
                                type="button"
                                className={`settings-theme-btn${theme === 'light' ? ' active' : ''}`}
                                onClick={() => applyTheme('light')}
                            >
                                Light
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
