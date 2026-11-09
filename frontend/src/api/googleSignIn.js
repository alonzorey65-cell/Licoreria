export function googleSignInOptions(location) {
  return {
    provider: 'google',
    options: {
      redirectTo: `${location.origin}${location.pathname}`,
      queryParams: { prompt: 'select_account' }
    }
  };
}
