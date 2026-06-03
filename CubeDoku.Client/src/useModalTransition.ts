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
    }, [isOpen]);

    return { shouldRender, isClosing };
}

