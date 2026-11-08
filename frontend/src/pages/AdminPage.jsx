import React from 'react';
import AdminPanel from '../components/AdminPanel';

export default function AdminPage({ licores, mesas, fetchAll }) {
  return (
    <AdminPanel licores={licores} mesas={mesas} fetchAll={fetchAll} />
  );
}