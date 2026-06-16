'use client';

import { useState, useRef, useCallback } from 'react';
import { Op, Asset, Prices } from '@/lib/types';
import { fmt, fmtQtd, fmtDate } from '@/lib/format';
import { searchCoins, fetchSinglePrice, CoinSearchResult } from '@/lib/coingecko';

interface Props {
  ops: Op[];
  assets: Asset[];
  prices: Prices;
  apiKey: string;
  onAddOp: (op: Op) => void;
  onEditOp: (index: number, op: Op) => void;
  onRemoveOp: (index: number) => void;
}

interface CoinSelection { coinId: string; symbol: string; name: string }

function CoinSearch({ id, placeholder, apiKey, onSelect, value, onChange }: {
  id: string; placeholder: string; apiKey: string;
  onSelect: (c: CoinSelection) => void;
  value: string; onChange: (v: string) => void;
}) {
  const [results, setResults] = useState<CoinSearchResult[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInput = (v: string) => {
    onChange(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      try { setResults(await searchCoins(v.trim(), apiKey)); } catch { setResults([]); }
    }, 300);
  };

  const select = (c: CoinSearchResult) => {
    onChange(c.name + ' (' + c.symbol.toUpperCase() + ')');
    setResults([]);
    onSelect({ coinId: c.id, symbol: c.symbol.toUpperCase(), name: c.name });
  };

  return (
    <div className="search-wrap">
      <input type="text" id={id} placeholder={placeholder} autoComplete="off"
        value={value} onChange={e => handleInput(e.target.value)} style={{ width: '100%' }} />
      {results.length > 0 && (
        <div className="search-dropdown">
          {results.map(c => (
            <div key={c.id} className="search-item" onClick={() => select(c)}>
              <span>{c.name} <span style={{ color: 'var(--text2)', fontSize: 12 }}>{c.symbol.toUpperCase()}</span></span>
              <span className="search-item-rank">{c.market_cap_rank ? '#' + c.market_cap_rank : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

export default function HistoricoTab({ ops, assets, prices, apiKey, onAddOp, onEditOp, onRemoveOp }: Props) {
  const [opData, setOpData] = useState(today());
  const [opCoin, setOpCoin] = useState<CoinSelection | null>(null);
  const [opCoinText, setOpCoinText] = useState('');
  const [opTipo, setOpTipo] = useState<'Compra' | 'Venda'>('Compra');
  const [opQtd, setOpQtd] = useState('');
  const [opPreco, setOpPreco] = useState('');
  const [opTaxa, setOpTaxa] = useState('');
  const [opPlataforma, setOpPlataforma] = useState('');
  const [priceMode, setPriceMode] = useState<'unit' | 'total'>('unit');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  // Trade form
  const [trData, setTrData] = useState(today());
  const [trFromCoinId, setTrFromCoinId] = useState('');
  const [trFromQty, setTrFromQty] = useState('');
  const [trToCoin, setTrToCoin] = useState<CoinSelection | null>(null);
  const [trToCoinText, setTrToCoinText] = useState('');
  const [trToQty, setTrToQty] = useState('');
  const [trTotal, setTrTotal] = useState('');
  const [trTaxa, setTrTaxa] = useState('');
  const [trTotalHint, setTrTotalHint] = useState('');

  const qtd = parseFloat(opQtd) || 0;
  const val = parseFloat(opPreco) || 0;
  const hint = qtd && val ? (priceMode === 'unit' ? 'Total: ' + fmt(qtd * val) : 'Unit.: ' + fmt(val / qtd)) : '';

  const resetOpForm = () => {
    setOpData(today()); setOpCoin(null); setOpCoinText(''); setOpTipo('Compra');
    setOpQtd(''); setOpPreco(''); setOpTaxa(''); setOpPlataforma('');
    setPriceMode('unit'); setEditingIdx(null);
  };

  const handleAddOp = () => {
    if (!opCoin || !qtd || !val) return;
    let preco: number, total: number;
    if (priceMode === 'total') {
      total = val; preco = qtd > 0 ? val / qtd : 0;
    } else {
      preco = val; total = opTipo === 'Venda' ? qtd * preco - (parseFloat(opTaxa) || 0) : qtd * preco + (parseFloat(opTaxa) || 0);
    }
    const op: Op = { data: opData, coinId: opCoin.coinId, symbol: opCoin.symbol, name: opCoin.name, tipo: opTipo, qtd, preco, taxa: parseFloat(opTaxa) || 0, total, plataforma: opPlataforma.trim() };
    if (editingIdx !== null) onEditOp(editingIdx, op); else onAddOp(op);
    resetOpForm();
  };

  const handleEditOp = (i: number) => {
    const o = ops[i];
    setEditingIdx(i); setOpData(o.data || '');
    setOpCoin({ coinId: o.coinId, symbol: o.symbol, name: o.name });
    setOpCoinText((o.name || '') + ' (' + (o.symbol || '') + ')');
    setOpTipo(o.tipo); setOpQtd(String(o.qtd)); setOpPreco(String(o.preco));
    setOpTaxa(String(o.taxa)); setOpPlataforma(o.plataforma || '');
    setPriceMode('unit');
  };

  const handleRemoveOp = (i: number) => {
    if (editingIdx === i) resetOpForm();
    onRemoveOp(i);
  };

  const syncTradeTotal = useCallback((fromId: string, fromQtyStr: string, toCoin: CoinSelection | null, totalStr: string) => {
    const fQty = parseFloat(fromQtyStr) || 0;
    let total = 0;
    if (fromId && fQty && prices[fromId]) {
      total = fQty * prices[fromId];
      setTrTotal(total.toFixed(2));
      setTrTotalHint('≈ atual');
    } else {
      total = parseFloat(totalStr) || 0;
      setTrTotalHint('');
    }
    if (total > 0 && toCoin && prices[toCoin.coinId]) {
      setTrToQty((total / prices[toCoin.coinId]).toFixed(8).replace(/\.?0+$/, ''));
    }
  }, [prices]);

  const handleTrToCoinSelect = async (c: CoinSelection) => {
    setTrToCoin(c);
    if (!prices[c.coinId]) {
      try {
        const p = await fetchSinglePrice(c.coinId, apiKey);
        if (p) prices[c.coinId] = p;
      } catch { /* ignore */ }
    }
    syncTradeTotal(trFromCoinId, trFromQty, c, trTotal);
  };

  const handleAddTrade = () => {
    const fromAsset = assets.find(a => a.coinId === trFromCoinId);
    if (!trFromCoinId || !trToCoin || !trFromQty || !trToQty || !trTotal) {
      alert('Preencha: moeda de origem, qtd. vendida, moeda de destino, qtd. comprada e total em R$.'); return;
    }
    if (trFromCoinId === trToCoin.coinId) { alert('A moeda de origem e de destino não podem ser a mesma.'); return; }
    const fromQty = parseFloat(trFromQty), toQty = parseFloat(trToQty), total = parseFloat(trTotal), taxa = parseFloat(trTaxa) || 0;
    const sellOp: Op = { data: trData, coinId: trFromCoinId, symbol: fromAsset?.symbol || '', name: fromAsset?.name || '', tipo: 'Venda', qtd: fromQty, preco: total / fromQty, taxa: 0, total, plataforma: '' };
    const buyOp: Op = { data: trData, coinId: trToCoin.coinId, symbol: trToCoin.symbol, name: trToCoin.name, tipo: 'Compra', qtd: toQty, preco: (total + taxa) / toQty, taxa, total: total + taxa, plataforma: '' };
    onAddOp(sellOp); onAddOp(buyOp);
    setTrFromQty(''); setTrToCoin(null); setTrToCoinText(''); setTrToQty(''); setTrTotal(''); setTrTaxa(''); setTrTotalHint('');
  };

  const isEditing = editingIdx !== null;

  return (
    <div id="tab-historico" className="section active">
      {/* Registrar operação */}
      <div className="op-card">
        <div className="sec-title" style={{ marginBottom: '.75rem' }}>
          <i className={`ti ${isEditing ? 'ti-pencil' : 'ti-plus'}`} style={{ fontSize: 13, verticalAlign: 'middle', marginRight: 4 }} />
          {isEditing ? 'Editar operação' : 'Registrar operação'}
        </div>
        <div className="op-fields">
          <div className="field">
            <label>Data</label>
            <input type="date" value={opData} onChange={e => setOpData(e.target.value)} />
          </div>
          <div className="field" style={{ position: 'relative' }}>
            <label>Moeda</label>
            <CoinSearch id="op-moeda-search" placeholder="Bitcoin, BTC..." apiKey={apiKey}
              value={opCoinText} onChange={setOpCoinText}
              onSelect={c => setOpCoin(c)} />
          </div>
          <div className="field">
            <label>Tipo</label>
            <select value={opTipo} onChange={e => setOpTipo(e.target.value as 'Compra' | 'Venda')}>
              <option>Compra</option><option>Venda</option>
            </select>
          </div>
          <div className="field">
            <label>Quantidade</label>
            <input type="number" placeholder="0" step="any" value={opQtd} onChange={e => setOpQtd(e.target.value)} />
          </div>
          <div className="field" style={{ position: 'relative' }}>
            <label>
              <span>{priceMode === 'total' ? 'Total (R$)' : 'Preço unit. (R$)'}</span>
              <button type="button" className="op-price-toggle" onClick={() => { setPriceMode(m => m === 'unit' ? 'total' : 'unit'); setOpPreco(''); }}>
                ⇄ {priceMode === 'total' ? 'unit.' : 'total'}
              </button>
            </label>
            <input type="number" placeholder="0.00" step="any" value={opPreco} onChange={e => setOpPreco(e.target.value)} />
            {hint && <div className="field-hint">{hint}</div>}
          </div>
          <div className="field">
            <label>Taxa (R$)</label>
            <input type="number" placeholder="0.00" step="any" value={opTaxa} onChange={e => setOpTaxa(e.target.value)} />
          </div>
          <div className="field">
            <label>Plataforma</label>
            <input type="text" placeholder="Binance, MetaMask..." value={opPlataforma} onChange={e => setOpPlataforma(e.target.value)} />
          </div>
          <div className="field-btn">
            <button className="btn-sm" onClick={handleAddOp}>
              <i className={`ti ${isEditing ? 'ti-check' : 'ti-plus'}`} /> {isEditing ? 'Salvar' : 'Registrar'}
            </button>
            {isEditing && (
              <button className="btn-sm" onClick={resetOpForm} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                <i className="ti ti-x" /> Cancelar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Trade entre ativos */}
      <div className="trade-card">
        <div className="sec-title" style={{ marginBottom: '.75rem' }}>
          <i className="ti ti-arrows-exchange" style={{ fontSize: 13, verticalAlign: 'middle', marginRight: 4 }} />
          Trade entre ativos
        </div>
        <div className="trade-fields">
          <div className="field">
            <label>Data</label>
            <input type="date" value={trData} onChange={e => setTrData(e.target.value)} />
          </div>
          <div className="field">
            <label>De (vender)</label>
            <select value={trFromCoinId} onChange={e => { setTrFromCoinId(e.target.value); syncTradeTotal(e.target.value, trFromQty, trToCoin, trTotal); }}>
              {assets.length ? assets.map(a => <option key={a.coinId} value={a.coinId}>{a.symbol} · {fmtQtd(a.qty)}</option>) : <option value="">Sem ativos na carteira</option>}
            </select>
          </div>
          <div className="field">
            <label>Qtd. vendida</label>
            <input type="number" placeholder="0" step="any" value={trFromQty} onChange={e => { setTrFromQty(e.target.value); syncTradeTotal(trFromCoinId, e.target.value, trToCoin, trTotal); }} />
          </div>
          <div className="field" style={{ position: 'relative' }}>
            <label>Para (comprar)</label>
            <CoinSearch id="tr-to-search" placeholder="Bitcoin, BTC..." apiKey={apiKey}
              value={trToCoinText} onChange={setTrToCoinText}
              onSelect={handleTrToCoinSelect} />
          </div>
          <div className="field">
            <label>Qtd. comprada</label>
            <input type="number" placeholder="0" step="any" value={trToQty} onChange={e => setTrToQty(e.target.value)} />
          </div>
          <div className="field">
            <label>Total (R$) <span className="trade-hint">{trTotalHint}</span></label>
            <input type="number" placeholder="0.00" step="any" value={trTotal} onChange={e => setTrTotal(e.target.value)} />
          </div>
          <div className="field">
            <label>Taxa (R$)</label>
            <input type="number" placeholder="0.00" step="any" value={trTaxa} onChange={e => setTrTaxa(e.target.value)} />
          </div>
          <div className="field-btn">
            <button className="btn-sm" onClick={handleAddTrade}>
              <i className="ti ti-arrows-exchange" /> Registrar
            </button>
          </div>
        </div>
      </div>

      {/* Lista de operações */}
      {!ops.length ? (
        <div className="empty-state"><i className="ti ti-receipt" /><span>Nenhuma operação registrada</span></div>
      ) : (
        <div className="op-list-wrap">
          <div className="op-list-row op-list-head">
            <span>Data</span><span>Moeda</span><span>Tipo</span><span>Qtd.</span>
            <span>Preço unit.</span><span>Total</span><span>Taxa</span><span>Plataforma</span><span />
          </div>
          {ops.map((o, i) => (
            <div className="op-list-row" key={i}>
              <span style={{ color: 'var(--text2)' }}>{fmtDate(o.data)}</span>
              <span style={{ fontWeight: 500 }}>{o.symbol || '—'}</span>
              <span><span className={`pill ${o.tipo === 'Compra' ? 'pill-pos' : 'pill-neg'}`}>{o.tipo}</span></span>
              <span>{fmtQtd(o.qtd)}</span>
              <span>{fmt(o.preco)}</span>
              <span style={{ fontWeight: 500 }}>{fmt(o.total)}</span>
              <span style={{ color: 'var(--text2)' }}>{o.taxa > 0 ? fmt(o.taxa) : '—'}</span>
              <span style={{ color: 'var(--text2)' }}>{o.plataforma || '—'}</span>
              <span className="op-actions">
                <button className="icon-btn" onClick={() => handleEditOp(i)} title="Editar"><i className="ti ti-pencil" /></button>
                <button className="icon-btn" onClick={() => handleRemoveOp(i)} title="Excluir" style={{ color: 'var(--danger)' }}><i className="ti ti-trash" /></button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
