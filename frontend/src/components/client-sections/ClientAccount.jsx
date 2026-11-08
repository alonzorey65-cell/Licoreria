import React, { useEffect, useState } from 'react';
import { apiUrl } from '../../api/apiConfig';
import { getSupabaseClient, hasVerifiedCustomerIdentity } from '../../api/supabaseClient';

async function loadClientData(accessToken) {
  const rewardsResponse = await fetch(apiUrl('client/rewards'), { headers: { Authorization: `Bearer ${accessToken}` } });
  const rewards = await rewardsResponse.json().catch(() => ({}));
  if (!rewardsResponse.ok) throw new Error(rewards.error || 'No se pudieron cargar tus puntos.');
  return rewards;
}

export default function ClientAccount({ onSessionChange, currency = 'USD', locale = 'es' }) {
  const english = locale === 'en';
  const [session, setSession] = useState(null);
  const [profileName, setProfileName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [rewards, setRewards] = useState({ points: 0, credit_balance: 0 });
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview('');
      return undefined;
    }
    const previewUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [avatarFile]);

  const refreshAccount = async currentSession => {
    if (!currentSession?.access_token) return;
    const data = await loadClientData(currentSession.access_token);
    setRewards(data);
  };

  const loadProfile = async (client, currentSession) => {
    const user = currentSession?.user;
    if (!user) return;
    const metadata = user.user_metadata || {};
    const metadataName = metadata.display_name || metadata.full_name || metadata.name;
    const name = typeof metadataName === 'string' ? metadataName : '';
    setProfileName(name);
    setAvatarFile(null);
    if (typeof metadata.avatar_path === 'string'
      && metadata.avatar_path.startsWith(`${user.id}/`)
      && !metadata.avatar_path.includes('..')) {
      const { data, error } = await client.storage.from('customer-avatars').createSignedUrl(metadata.avatar_path, 60 * 60);
      if (error) throw error;
      setAvatarUrl(data.signedUrl);
    } else {
      setAvatarUrl(metadata.picture || '');
    }
  };

  useEffect(() => {
    let active = true;
    let authSubscription;
    getSupabaseClient()
      .then(client => client.auth.getSession().then(({ data, error }) => {
        if (error) throw error;
        if (active && hasVerifiedCustomerIdentity(data.session?.user)) {
          setSession(data.session);
          onSessionChange?.(data.session);
          return Promise.all([refreshAccount(data.session), loadProfile(client, data.session)]);
        }
        return undefined;
      }).then(() => {
        const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
          if (active) {
            const verifiedSession = hasVerifiedCustomerIdentity(nextSession?.user) ? nextSession : null;
            setSession(verifiedSession);
            onSessionChange?.(verifiedSession);
            if (verifiedSession) Promise.all([refreshAccount(verifiedSession), loadProfile(client, verifiedSession)]).catch(error => {
              console.error('No se pudo actualizar el perfil o la cuenta del cliente.', error);
              setFeedback({ type: 'error', message: error.message });
            });
            else {
              setProfileName('');
              setAvatarUrl('');
              setAvatarFile(null);
              setRewards({ points: 0, credit_balance: 0 });
            }
          }
        });
        authSubscription = data.subscription;
      }))
      .catch(error => {
        console.error('No se pudo inicializar la cuenta del cliente.', error);
        if (active) setFeedback({ type: 'error', message: 'No se pudo conectar con el acceso seguro. Revisa la configuración de Supabase.' });
      });
    return () => {
      active = false;
      authSubscription?.unsubscribe();
    };
  }, []);

  const saveProfile = async event => {
    event.preventDefault();
    if (!session?.user || busy) return;
    const name = profileName.trim();
    if (name.length < 2 || name.length > 80) {
      setFeedback({ type: 'error', message: english ? 'Name must be between 2 and 80 characters.' : 'El nombre debe tener entre 2 y 80 caracteres.' });
      return;
    }
    if (avatarFile && (!['image/jpeg', 'image/png', 'image/webp'].includes(avatarFile.type) || avatarFile.size > 3 * 1024 * 1024)) {
      setFeedback({ type: 'error', message: english ? 'Choose a JPG, PNG, or WebP image up to 3 MB.' : 'Elige una imagen JPG, PNG o WebP de hasta 3 MB.' });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const client = await getSupabaseClient();
      const metadata = session.user.user_metadata || {};
      let avatarPath = typeof metadata.avatar_path === 'string'
        && metadata.avatar_path.startsWith(`${session.user.id}/`)
        && !metadata.avatar_path.includes('..')
        ? metadata.avatar_path
        : '';
      if (avatarFile) {
        const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[avatarFile.type];
        avatarPath = `${session.user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await client.storage.from('customer-avatars').upload(avatarPath, avatarFile, {
          contentType: avatarFile.type,
          upsert: false
        });
        if (uploadError) throw uploadError;
      }

      const { data, error } = await client.auth.updateUser({
        data: { ...metadata, display_name: name, avatar_path: avatarPath }
      });
      if (error) throw error;
      const nextSession = { ...session, user: data.user };
      setSession(nextSession);
      setAvatarFile(null);
      await loadProfile(client, nextSession);
      onSessionChange?.(nextSession);
      setFeedback({ type: 'success', message: english ? 'Your profile was updated.' : 'Tu perfil se actualizó correctamente.' });
    } catch (error) {
      console.error('No se pudo guardar el perfil del cliente.', error);
      setFeedback({ type: 'error', message: error.message || (english ? 'Could not save your profile.' : 'No se pudo guardar tu perfil.') });
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const client = await getSupabaseClient();
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href.split('?')[0].split('#')[0] }
      });
      if (error) throw error;
    } catch (error) {
      console.error('No se pudo iniciar el acceso del cliente con Google.', error);
      setFeedback({
        type: 'error',
        message: error.message || (english
          ? 'Could not start Google sign-in. Check the Google provider settings in Supabase.'
          : 'No se pudo iniciar sesión con Google. Revisa la configuración del proveedor en Supabase.')
      });
    } finally {
      setBusy(false);
    }
  };

  const redeemPoints = async () => {
    const points = Math.floor(Number(rewards.points) / 100) * 100;
    if (points < 100 || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(apiUrl('client/rewards/redeem'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ points })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'No se pudieron canjear los puntos.');
      setRewards(result);
      setFeedback({ type: 'success', message: `Canjeaste ${points} puntos por ${new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es', { style: 'currency', currency }).format(points / 100)} de crédito para tu próximo pedido.` });
    } catch (error) {
      console.error('No se pudieron canjear los puntos de la cuenta.', error);
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    try {
      const client = await getSupabaseClient();
      const { error } = await client.auth.signOut();
      if (error) throw error;
      setSession(null);
      setProfileName('');
      setAvatarUrl('');
      setAvatarFile(null);
      onSessionChange?.(null);
      setRewards({ points: 0, credit_balance: 0 });
      setFeedback({ type: 'success', message: 'Cerraste sesión.' });
    } catch (error) {
      console.error('No se pudo cerrar la sesión del cliente.', error);
      setFeedback({ type: 'error', message: 'No se pudo cerrar la sesión. Inténtalo otra vez.' });
    }
  };

  return (
    <section className="client-panel-card client-account">
      <div className="client-panel-heading">
        <div><p className="store-kicker">{english ? 'SECURE ACCOUNT' : 'CUENTA SEGURA'}</p><h2>{english ? 'My orders and rewards' : 'Mis pedidos y recompensas'}</h2></div>
      </div>
      {!session ? (
        <div className="client-account-form">
          <p className="client-panel-note">{english ? 'Sign in with Google to place orders and see only the order history linked to your account.' : 'Inicia sesión con Google para hacer pedidos y consultar únicamente el historial asociado a tu cuenta.'}</p>
          <button type="button" className="checkout-button" onClick={signInWithGoogle} disabled={busy}>
            {busy ? (english ? 'Connecting…' : 'Conectando…') : (english ? 'Continue with Google' : 'Continuar con Google')}
          </button>
        </div>
      ) : (
        <div className="client-rewards-summary">
          <p>{english ? 'Signed in as:' : 'Sesión iniciada como:'} <strong>{session.user.email || session.user.phone}</strong></p>
          <form className="client-profile-editor" onSubmit={saveProfile}>
            <div className="client-profile-avatar">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" />
              ) : avatarUrl ? (
                <img src={avatarUrl} alt="" />
              ) : (
                <span aria-hidden="true">{profileName.trim().charAt(0).toUpperCase() || 'C'}</span>
              )}
            </div>
            <label>
              <span>{english ? 'Profile name' : 'Nombre del perfil'}</span>
              <input value={profileName} onChange={event => setProfileName(event.target.value)} minLength="2" maxLength="80" required />
            </label>
            <label>
              <span>{english ? 'Profile picture (JPG, PNG, WebP · max 3 MB)' : 'Foto de perfil (JPG, PNG, WebP · máximo 3 MB)'}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setAvatarFile(event.target.files?.[0] || null)} />
            </label>
            <button type="submit" className="checkout-button" disabled={busy}>
              {busy ? (english ? 'Saving…' : 'Guardando…') : (english ? 'Save profile' : 'Guardar perfil')}
            </button>
          </form>
          <div className="client-rewards-balance">
            <span>{Number(rewards.points || 0)} puntos</span>
            <strong>{new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es', { style: 'currency', currency }).format(Number(rewards.credit_balance || 0))} {english ? 'credit' : 'crédito'}</strong>
          </div>
          <p className="client-panel-note">{english ? 'Earn 1 point per currency unit on delivered orders. Every 100 points equal 1 unit of credit.' : 'Ganas 1 punto por cada unidad monetaria en pedidos entregados. Cada 100 puntos equivalen a 1 de crédito.'}</p>
          <div className="client-account-actions">
            <button type="button" className="checkout-button" onClick={redeemPoints} disabled={busy || Number(rewards.points) < 100}>{english ? 'Redeem available points' : 'Canjear puntos disponibles'}</button>
            <button type="button" className="client-text-link" onClick={signOut}>{english ? 'Sign out' : 'Cerrar sesión'}</button>
          </div>
        </div>
      )}
      {feedback && <p className={`checkout-feedback is-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.message}</p>}
      <p className="client-panel-note">{english ? 'Google sign-in must be enabled in the Supabase Auth provider settings.' : 'El acceso con Google debe estar habilitado en los proveedores de autenticación de Supabase.'}</p>
    </section>
  );
}
