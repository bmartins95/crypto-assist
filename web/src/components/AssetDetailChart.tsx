import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { useLocale } from '@/context/LocaleContext';
import { fmtDate, fmtPct } from '@/lib/format';

export interface AssetDetailData {
  coinId: string;
  symbol: string;
  name: string;
  price: number;
  pctChange: number;
  series: number[];
  color: string;
}

interface Props {
  asset: AssetDetailData;
  dates: string[];
  fmtMoney: (v: number) => string;
  onClose: () => void;
}

export default function AssetDetailChart({ asset, dates, fmtMoney, onClose }: Props) {
  const { locale, t } = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const hasData = asset.series.length >= 2;

  useEffect(() => {
    closeButtonRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!canvasRef.current || !hasData) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dates.map(d => fmtDate(d, locale)),
        datasets: [{
          label: asset.symbol,
          data: asset.series,
          borderColor: asset.color,
          backgroundColor: `${asset.color}1a`,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => fmtPct(c.raw as number) }, padding: 10 },
        },
        scales: {
          y: { ticks: { callback: v => fmtPct(v as number), font: { size: 11 } }, grid: { color: 'rgba(128,128,128,0.08)' }, border: { display: false } },
          x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11 }, maxTicksLimit: 8 } },
        },
      },
    });
    return () => { chartInstance.current?.destroy(); chartInstance.current = null; };
  }, [asset, dates, locale, hasData]);

  return (
    <div className="drawer-backdrop open" onClick={onClose}>
      <div
        className="asset-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${asset.name} ${asset.symbol}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="asset-detail-header">
          <div>
            <span className="assets-list-badge" style={{ background: `${asset.color}22`, color: asset.color }}>{asset.symbol}</span>
            <span className="asset-detail-name">{asset.name}</span>
          </div>
          <button ref={closeButtonRef} type="button" className="icon-btn" aria-label={t.common_close} onClick={onClose}>
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="asset-detail-stats">
          <span className="asset-detail-price">{fmtMoney(asset.price)}</span>
          {hasData && <span className={asset.pctChange >= 0 ? 'pos' : 'neg'}>{fmtPct(asset.pctChange)}</span>}
        </div>
        <div className="chart-canvas-wrap" style={{ height: 220 }}>
          {hasData ? <canvas ref={canvasRef} /> : (
            <div className="empty-state" style={{ position: 'absolute', inset: 0 }}>
              <span style={{ fontSize: 13 }}>{t.profit_emptyTimeframe}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
