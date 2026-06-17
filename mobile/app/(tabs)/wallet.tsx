import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api/client';
import { collectAssets, fmt, fmtPct, fmtQty } from '@crypto-assist/shared';
import type { Asset, ExitPrices, MarketPrices } from '@crypto-assist/shared';

export default function WalletScreen() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [prices, setPrices] = useState<MarketPrices>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ops, exitPrices] = await Promise.all([api.getOps(), api.getExitPrices()]);
      const builtAssets = collectAssets(ops, exitPrices as ExitPrices);
      setAssets(builtAssets);
      if (builtAssets.length > 0) {
        const ids = builtAssets.map(a => a.coinId);
        const mkt = await api.getPrices(ids);
        setPrices(mkt);
      }
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  const totalValue = assets.reduce((s, a) => s + a.qty * (prices[a.coinId]?.price ?? a.avgPrice), 0);
  const totalCost = assets.reduce((s, a) => s + a.qty * a.avgPrice, 0);
  const totalPnl = totalValue - totalCost;
  const totalPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>Valor total</Text>
          <Text style={styles.headerValue}>{fmt(totalValue)}</Text>
          <Text style={[styles.headerPnl, { color: totalPnl >= 0 ? '#16a34a' : '#dc2626' }]}>
            {fmt(totalPnl)} ({fmtPct(totalPct)})
          </Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logout}>Sair</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={assets}
        keyExtractor={a => a.coinId}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        renderItem={({ item: a }) => {
          const currentPrice = prices[a.coinId]?.price ?? 0;
          const value = a.qty * currentPrice;
          const pnl = value - a.qty * a.avgPrice;
          const pct = a.avgPrice > 0 ? ((currentPrice - a.avgPrice) / a.avgPrice) * 100 : 0;
          return (
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.symbol}>{a.symbol}</Text>
                <Text style={styles.name}>{a.name}</Text>
                <Text style={styles.qty}>{fmtQty(a.qty)} unid.</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.value}>{fmt(value)}</Text>
                <Text style={[styles.pnl, { color: pnl >= 0 ? '#16a34a' : '#dc2626' }]}>
                  {fmt(pnl)} ({fmtPct(pct)})
                </Text>
                <Text style={styles.avgPrice}>PM: {fmt(a.avgPrice)}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma operação encontrada.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#1a1a2e', padding: 20, paddingTop: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerLabel: { color: '#94a3b8', fontSize: 13 },
  headerValue: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginTop: 2 },
  headerPnl: { fontSize: 14, marginTop: 2 },
  logout: { color: '#94a3b8', fontSize: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', padding: 16, marginHorizontal: 12, marginTop: 8, borderRadius: 10, elevation: 1 },
  rowLeft: { flex: 1 },
  rowRight: { alignItems: 'flex-end' },
  symbol: { fontWeight: 'bold', fontSize: 16, color: '#1a1a2e' },
  name: { color: '#64748b', fontSize: 13 },
  qty: { color: '#64748b', fontSize: 12, marginTop: 2 },
  value: { fontWeight: '600', fontSize: 15, color: '#1a1a2e' },
  pnl: { fontSize: 13, marginTop: 2 },
  avgPrice: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 48, fontSize: 15 },
});
