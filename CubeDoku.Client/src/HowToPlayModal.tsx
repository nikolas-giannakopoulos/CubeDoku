import { LuX } from 'react-icons/lu';
import { useModalTransition } from './useModalTransition';
import './HowToPlayModal.css';
import './ProfileModal.css';

interface HowToPlayModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const HowToPlayModal = ({ isOpen, onClose }: HowToPlayModalProps) => {
    const { shouldRender, isClosing } = useModalTransition(isOpen);
    if (!shouldRender) return null;

    return (
        <div className={`howto-overlay${isClosing ? ' modal-overlay-exit' : ' modal-overlay-enter'}`} onClick={onClose}>
            <div className={`howto-modal${isClosing ? ' modal-panel-exit' : ' modal-panel-enter'}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="How to Play">
                <div className="modal-header">
                    <button className="modal-back-btn" aria-label="Close How to Play" onClick={onClose}>
                        <LuX size={20} />
                    </button>
                    <h2>How to Play CubeDoku</h2>
                </div>
                <p className="howto-intro">
                    CubeDoku combines Sudoku rules with 3D cube math constraints. Your goal is to complete the cube correctly and as fast as possible.
                </p>

                <section className="howto-section">
                    <h3>1. Face Rule (Sudoku Rule)</h3>
                    <p>
                        Each of the 6 faces is a 3x3 grid. Every face must contain numbers 1-9 with no duplicates.
                    </p>
                    <div className="howto-shot-slot" aria-label="Face rule screenshot placeholder">
                        Screenshot placeholder: valid/invalid face example
                    </div>
                </section>

                <section className="howto-section">
                    <h3>2. Edge Rule (Sum to 12)</h3>
                    <p>
                        Every edge is made of 2 connected cells from adjacent faces. Those 2 numbers must add up to 12.
                    </p>
                    <div className="howto-shot-slot" aria-label="Edge rule screenshot placeholder">
                        Screenshot placeholder: highlighted edge pair
                    </div>
                </section>

                <section className="howto-section">
                    <h3>3. Corner Rule (Sum to 12)</h3>
                    <p>
                        Every corner is made of 3 connected cells. The 3 values on that corner must add up to 12.
                    </p>
                    <div className="howto-shot-slot" aria-label="Corner rule screenshot placeholder">
                        Screenshot placeholder: highlighted corner triplet
                    </div>
                </section>

                <section className="howto-section">
                    <h3>Tips</h3>
                    <ul className="howto-tips">
                        <li>Start from faces with the most known values.</li>
                        <li>Use edge sums to eliminate impossible numbers quickly.</li>
                        <li>When stuck, check corner totals to unlock new moves.</li>
                        <li>Use the hint button strategically because it impacts score.</li>
                    </ul>
                </section>
            </div>
        </div>
    );
};
