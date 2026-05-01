// HowToPlayModal.tsx
// Explains the three rules of CubeDoku to the player
//
// Rules:
//   1. Face Rule (Sudoku): each face must have 1-9 with no repeats
//   2. Edge Rule: two cells sharing a cube edge must sum to 12
//   3. Corner Rule: three cells meeting at a cube corner must sum to 12
//
// Each rule has a visual screenshot to illustrate it
// The screenshots come in light and dark variants, selected based on the current theme
// (the ThemeContext tells us which theme is active)
//
// These images were captured from the actual game and then annotated in Figma.
// Getting them to show correctly at the right size on both mobile and desktop
// took more CSS trial and error than I'd like to admit.
//
// Clicking outside the modal closes it (handled by the overlay onClick)
// The aria attributes (role="dialog", aria-modal, aria-label) are for screen reader accessibility
// I wasn't sure if I needed all of them but it seemed better to include too many than too few

import { LuX } from 'react-icons/lu';
import { useModalTransition } from './useModalTransition';
import { useTheme } from './context/ThemeContext';
import './HowToPlayModal.css';
import './ProfileModal.css';

import firstDark  from './assets/first_dark.png';
import firstLight from './assets/first_light.png';
import secondDark  from './assets/second_dark.png';
import secondLight from './assets/second_light.png';
import thirdDark  from './assets/third_dark.png';
import thirdLight from './assets/third_light.png';

interface HowToPlayModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const HowToPlayModal = ({ isOpen, onClose }: HowToPlayModalProps) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { shouldRender, isClosing } = useModalTransition(isOpen);
    if (!shouldRender) return null;

    return (
        <div className={`howto-overlay${isClosing ? ' modal-overlay-exit' : ' modal-overlay-enter'}`} onClick={onClose}>
            <div
                className={`howto-modal${isClosing ? ' modal-panel-exit' : ' modal-panel-enter'}`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="How to Play"
            >
                <div className="modal-header">
                    <button className="modal-back-btn" aria-label="Close How to Play" onClick={onClose}>
                        <LuX size={20} />
                    </button>
                    <h2>How to Play CubeDoku</h2>
                </div>
                <p className="howto-intro">
                    CubeDoku combines Sudoku rules with 3D cube math constraints. Your goal is to complete the cube correctly and as fast as possible.
                </p>

                {/* Rule 1: Face Rule */}
                <section className="howto-section">
                    <h3>1. Face Rule (Sudoku Rule)</h3>
                    <p>
                        Each of the 6 faces is a 3x3 grid. Every face must contain numbers 1-9 with no duplicates.
                    </p>
                    <div className="howto-shot-slot" aria-label="Face rule screenshot">
                        <img src={isDark ? firstDark : firstLight} alt="Face rule example" className="howto-shot-img" />
                    </div>
                </section>

                {/* Rule 2: Edge Rule */}
                <section className="howto-section">
                    <h3>2. Edge Rule (Sum to 12)</h3>
                    <p>
                        Every edge is made of 2 connected cells from adjacent faces. Those 2 numbers must add up to 12.
                    </p>
                    <div className="howto-shot-slot" aria-label="Edge rule screenshot">
                        <img src={isDark ? secondDark : secondLight} alt="Edge rule example" className="howto-shot-img" />
                    </div>
                </section>

                {/* Rule 3: Corner Rule */}
                <section className="howto-section">
                    <h3>3. Corner Rule (Sum to 12)</h3>
                    <p>
                        Every corner is made of 3 connected cells. The 3 values on that corner must add up to 12.
                    </p>
                    <div className="howto-shot-slot" aria-label="Corner rule screenshot">
                        <img src={isDark ? thirdDark : thirdLight} alt="Corner rule example" className="howto-shot-img" />
                    </div>
                </section>

            </div>
        </div>
    );
};

