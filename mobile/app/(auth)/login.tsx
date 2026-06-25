import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { buildAuthUrl, exchangeCode } from '@/lib/cognito';
import { useAuth } from '@/lib/auth';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { refreshSession } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handleSignIn(identityProvider?: string) {
    setLoading(true);
    try {
      const { url, verifier } = await buildAuthUrl(identityProvider);
      const result = await WebBrowser.openAuthSessionAsync(url, 'crypto-assist://callback');

      if (result.type === 'success') {
        const qs = result.url.split('?')[1] ?? '';
        const code = new URLSearchParams(qs).get('code');
        if (!code) { Alert.alert('Erro', 'Código de autorização não encontrado.'); return; }
        await exchangeCode(code, verifier);
        await refreshSession();
      }
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Falha na autenticação.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crypto Assist</Text>
      <Text style={styles.subtitle}>Faça login para continuar</Text>

      <TouchableOpacity style={styles.button} onPress={() => handleSignIn()} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Entrar</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.googleButton]}
        onPress={() => handleSignIn('Google')}
        disabled={loading}
      >
        <Text style={styles.buttonText}>Entrar com Google</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 4, color: '#1a1a2e' },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 40, color: '#666' },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 12 },
  googleButton: { backgroundColor: '#4b5563' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
