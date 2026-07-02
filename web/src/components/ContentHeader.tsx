import { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle: string;
  children?: ReactNode;
}

export default function ContentHeader({ title, subtitle, children }: Props) {
  return (
    <div className="chead">
      <div>
        <div className="ct">{title}</div>
        <div className="cs">{subtitle}</div>
      </div>
      {children && <div className="refresh">{children}</div>}
    </div>
  );
}
