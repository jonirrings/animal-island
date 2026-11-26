import { useEffect, useRef, useState } from 'react';
import * as Icons from '@animal-island/react-icons';

/**
 * 用 React 运行时真实挂载图标。
 *
 * 通过 `import * as Icons` 拿到全部 936 个组件，按 PascalCase 名索引。
 * 挂载完成后把耗时写回 DOM，供页面展示「运行时状态」。
 */
export default function ReactIcons({ names, size = 48 }) {
  const [status, setStatus] = useState('pending');
  const hostRef = useRef(null);
  const started = useRef(performance.now());

  useEffect(() => {
    const elapsed = Math.round(performance.now() - started.current);
    setStatus(`mounted ${names.length} icons in ${elapsed}ms`);
    if (hostRef.current) {
      hostRef.current.dataset.mountMs = String(elapsed);
      hostRef.current.dataset.rendered = String(names.length);
    }
  }, [names]);

  return (
    <div className="rt-grid" ref={hostRef} data-status={status}>
      {names.map((name) => {
        const Icon = Icons[name];
        if (!Icon) {
          return (
            <div className="rt-missing" key={name}>
              {name}
            </div>
          );
        }
        return (
          <div className="rt-cell" key={name} title={name}>
            <Icon size={size} />
            <span>{name}</span>
          </div>
        );
      })}
    </div>
  );
}
