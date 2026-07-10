import { useEffect, useState } from 'react';
import BrandMark from './BrandMark';

interface LoadingStateProps {
  title: string;
  messages: string[];
}

export default function LoadingState({ title, messages }: LoadingStateProps) {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    if (messages.length < 2) return;
    let i = 0;
    const id = setInterval(() => {
      i++;
      if (i >= messages.length) {
        clearInterval(id);
        return;
      }
      setFade(true);
      setTimeout(() => {
        setIndex(i);
        setFade(false);
      }, 250);
    }, 1300);
    return () => clearInterval(id);
  }, [messages]);

  return (
    <div className="auth-loader">
      <div className="auth-warm-logo">
        <BrandMark size={76} />
        <div className="auth-ring" aria-hidden="true" />
      </div>
      <h2>{title}</h2>
      <p className="auth-msg" style={{ opacity: fade ? 0 : 1 }}>
        {messages[index]}
      </p>
      <div className="auth-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}
