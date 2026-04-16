import { useEffect, useState } from 'react';

/**
 * Handles enter/exit lifecycle for modals.
 * - `shouldRender`: mount the modal DOM while true
 * - `isClosing`:    apply the exit CSS class while true
 *
 * Usage:
 *   const { shouldRender, isClosing } = useModalTransition(isOpen);
 *   if (!shouldRender) return null;
 *   <div className={`my-overlay${isClosing ? ' modal-overlay-exit' : ''}`}>
 *     <div className={`my-panel${isClosing ? ' modal-panel-exit' : ''}`}>
 *       ...
 *     </div>
 *   </div>
 */
export function useModalTransition(isOpen: boolean, duration = 280) {
    const [shouldRender, setShouldRender] = useState(isOpen);
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            setIsClosing(false);
        } else if (shouldRender) {
            setIsClosing(true);
            const timer = setTimeout(() => {
                setShouldRender(false);
                setIsClosing(false);
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);     // eslint-disable-line react-hooks/exhaustive-deps

    return { shouldRender, isClosing };
}
