interface Props {
  label: string;
  value: string;
  valueColor?: 'pos' | 'neg';
  sub?: string;
  subColor?: 'pos' | 'neg';
  icon?: string;
}

export default function MetricCard({ label, value, valueColor, sub, subColor, icon }: Props) {
  return (
    <div className="metric">
      <div className="metric-label">{icon && <i className={icon} />} {label}</div>
      <div className={valueColor ? `metric-value ${valueColor}` : 'metric-value'}>{value}</div>
      {sub && <div className={subColor ? `metric-sub ${subColor}` : 'metric-sub'}>{sub}</div>}
    </div>
  );
}
