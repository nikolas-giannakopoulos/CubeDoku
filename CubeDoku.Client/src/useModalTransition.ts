// useModalTransition.ts
// Custom hook for handling modal open/close animations
//
// The problem: when you set isOpen=false, you want an exit animation to play
// before the component is actually removed from the DOM. But if you just conditionally
// render based on isOpen, the component disappears instantly with no animation.
//
// This hook solves it with two flags:
//   shouldRender: controls whether the component is in the DOM at all
//   isClosing: when true, apply the exit CSS class (triggers the CSS transition)
//
// The duration parameter (default 280ms) should match the CSS transition duration
//
// Usage pattern in every modal:
//   const { shouldRender, isClosing } = useModalTransition(isOpen);
//   if (!shouldRender) return null;
//   return <div className={`overlay${isClosing ? ' modal-overlay-exit' : ''}`}>...
//
// I found this pattern on Stack Overflow and adapted it for our specific transition classes
// https://stackoverflow.com/questions/54895883/reset-to-initial-state-with-react-hooks

import { useEffect, useState } from 'react';

export function useModalTransition(isOpen: boolean, duration = 280) {
    const [shouldRender, setShouldRender] = useState(isOpen);
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // modal is opening: mount it and remove the closing class
            setShouldRender(true);
            setIsClosing(false);
        } else if (shouldRender) {
            // modal is closing: add the exit class and wait for animation to finish
            // then unmount
            setIsClosing(true);
            const timer = setTimeout(() => {
                setShouldRender(false);
                setIsClosing(false);
            }, duration);
            return () => clearTimeout(timer);  // cleanup if isOpen changes again before timer fires
        }
    }, [isOpen]);     // eslint-disable-line react-hooks/exhaustive-deps

    return { shouldRender, isClosing };
}

