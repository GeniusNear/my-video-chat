// hooks/useResizable.ts
import { useState, useCallback } from 'react';

export const useResizable = (initialSize: number, direction: 'horizontal' | 'vertical') => {
  const [size, setSize] = useState(initialSize);

  const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    const startPos = direction === 'horizontal' ? mouseDownEvent.clientX : mouseDownEvent.clientY;
    const startSize = size;

    const onMouseMove = (mouseMoveEvent: MouseEvent) => {
      const currentPos = direction === 'horizontal' ? mouseMoveEvent.clientX : mouseMoveEvent.clientY;
      setSize(startSize + (currentPos - startPos));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [direction, size]);

  return { size, startResizing };
};