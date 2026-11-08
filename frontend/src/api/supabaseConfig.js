function isValidConfig(url, key) {
  if (typeof url !== 'string' || typeof key !== 'string' || !key.trim()) return false;
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'https:' || (
      parsedUrl.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsedUrl.hostname)
    );
  } catch {
    return false;
  }
}

export async function resolveSupabaseConfig(configUrl, envConfig, fetchConfig = fetch) {
  try {
    const response = await fetchConfig(configUrl);
    if (!response.ok) throw new Error(`El servidor respondió con estado ${response.status}.`);
    const { supabaseUrl, publishableKey } = await response.json();
    if (!isValidConfig(supabaseUrl, publishableKey)) {
      throw new Error('El servidor devolvió una configuración pública de Supabase inválida.');
    }
    return { url: supabaseUrl, key: publishableKey };
  } catch (error) {
    if (isValidConfig(envConfig.url, envConfig.key)) {
      console.warn('No se pudo obtener la configuración de Supabase del servidor; se utilizará la configuración del frontend.', error);
      return envConfig;
    }
    console.error('No se pudo obtener la configuración pública de Supabase.', error);
    throw new Error('No se pudo conectar con el servidor para configurar el acceso. Inténtalo de nuevo.');
  }
}
