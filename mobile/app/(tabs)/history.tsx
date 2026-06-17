import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, Alert, TouchableOpacity,
} from 'react-native';
import { api } from '@/lib/api/client';
import { fmt, fmtQty, fmtDate } from '@crypto-assist/shared';
import type { Op } from '@crypto-assist/shared';

export default function HistoryScreen() {
  const [ops, setOps] = useState<Op[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getOps();
      setOps([...data].reverse());
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    Alert.alert('Remover operação', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteOp(id);
            setOps(prev => prev.filter(o => o.id !== id));
          } catch (e: any) {
            Alert.alert('Erro', e.message);
          }
        },
      },
    ]);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={ops}
        keyExtractor={o => o.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        renderItem={({ item: o }) => (
          <View style={styles.row}>
            <View style={styles.rowTop}>
              <View style={styles.rowLeft}>
                <Text style={styles.symbol}>{o.symbol}</Text>
                <View style={[styles.badge, o.type === 'Compra' ? styles.badgeBuy : styles.badgeSell]}>
                  <Text style={styles.badgeText}>{o.type}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => handleDelete(o.id)}>
                <Text style={styles.deleteBtn}>Remover</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.rowDetails}>
              <Text style={styles.detail}>{fmtDate(o.date)}</Text>
              <Text style={styles.detail}>{fmtQty(o.qty)} × {fmt(o.price)}</Text>
              <Text style={styles.total}>{fmt(o.total)}</Text>
            </View>
            {o.platform ? <Text style={styles.platform}>{o.platform}</Text> : null}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma operação registrada.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row: { backgroundColor: '#fff', padding: 16, marginHorizontal: 12, marginTop: 8, borderRadius: 10, elevation: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  symbol: { fontWeight: 'bold', fontSize: 16, color: '#1a1a2e' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeBuy: { backgroundColor: '#dcfce7' },
  badgeSell: { backgroundColor: '#fee2e2' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  rowDetails: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detail: { color: '#64748b', fontSize: 13 },
  total: { fontWeight: '600', color: '#1a1a2e', fontSize: 14 },
  platform: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  deleteBtn: { color: '#dc2626', fontSize: 13 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 48, fontSize: 15 },
});
