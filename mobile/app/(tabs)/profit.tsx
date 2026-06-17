import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, Alert,
} from 'react-native';
import { api } from '@/lib/api/client';
import { collectAssets, fmt, fmtPct } from '@crypto-assist/shared';
import type { Asset, ExitPrices, MarketPrices } from '@crypto-assist/shared';

interface AssetProfit extends Asset {
  currentPrice: number;
  currentValue: number;
  pnlValue: number;
  pnlPct: number;
}

export default function ProfitScreen() {
  const [rows, setRows] = useState<AssetProfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ops, exitPrices] = await Promise.all([api.getOps(), api.getExitPrices()]);
      const assets = collectAssets(ops, exitPrices as ExitPrices);
      let prices: MarketPrices = {};
      if (assets.length > 0) {
        prices = await api.getPrices(assets.map(a => a.coinId));
      }
      const enriched = assets.map<AssetProfit>(a => {
        const currentPrice = prices[a.coinId]?.price ?? 0;
        const exitPrice = a.exitPrice || currentPrice;
        const currentValue = a.qty * exitPrice;
        const costBasis = a.qty * a.avgPrice;
        const pnlValue = currentValue - costBasis;
        const pnlPct = costBasis > 0 ? (pnlValue / costBasis) * 100 : 0;
        return { ...a, currentPrice, currentValue, pnlValue, pnlPct };
      });
      setRows(enriched);
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  const totalPnl = rows.reduce((s, r) => s + r.pnlValue, 0);
  const totalCost = rows.reduce((s, r) => s + r.qty * r.avgPrice, 0);
  const totalPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Lucro/Prejuízo total</Text>
        <Text style={[styles.headerValue, { color: totalPnl >= 0 ? '#16a34a' : '#dc2626' }]}>
          {fmt(totalPnl)}
        </Text>
        <Text style={[styles.headerPct, { color: totalPnl >= 0 ? '#16a34a' : '#dc2626' }]}>
          {fmtPct(totalPct)}
        </Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={r => r.coinId}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        renderItem={({ item: r }) => (
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.symbol}>{r.symbol}</Text>
              <Text style={styles.name}>{r.name}</Text>
              <Text style={styles.detail}>PM: {fmt(r.avgPrice)}</Text>
              {r.exitPrice > 0 && <Text style={styles.detail}>Preço saída: {fmt(r.exitPrice)}</Text>}
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.pnl, { color: r.pnlValue >= 0 ? '#16a34a' : '#dc2626' }]}>
                {fmt(r.pnlValue)}
              </Text>
              <Text style={[styles.pct, { color: r.pnlValue >= 0 ? '#16a34a' : '#dc2626' }]}>
                {fmtPct(r.pnlPct)}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma posição encontrada.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#1a1a2e', padding: 20, paddingTop: 48 },
  headerLabel: { color: '#94a3b8', fontSize: 13 },
  headerValue: { fontSize: 32, fontWeight: 'bold', marginTop: 4 },
  headerPct: { fontSize: 15, marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', padding: 16, marginHorizontal: 12, marginTop: 8, borderRadius: 10, elevation: 1 },
  rowLeft: { flex: 1 },
  rowRight: { alignItems: 'flex-end', justifyContent: 'center' },
  symbol: { fontWeight: 'bold', fontSize: 16, color: '#1a1a2e' },
  name: { color: '#64748b', fontSize: 13 },
  detail: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  pnl: { fontSize: 16, fontWeight: '600' },
  pct: { fontSize: 13, marginTop: 2 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 48, fontSize: 15 },
});
