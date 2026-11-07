import { supabase } from '../config/supabaseClient.js';

export async function getAllLicores() {
  const { data, error } = await supabase.from('licores').select('*');
  if (error) throw new Error(error.message);
  return data;
}

export async function createLicor(licorData) {
  const { data, error } = await supabase.from('licores').insert([licorData]).select();
  if (error) throw new Error(error.message);
  return data[0];
}