import React from 'react';
import AdminPanel from '../components/AdminPanel';

export default function AdminPage({ licores, mesas, fetchAll }) {
  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
      <AdminPanel licores={licores} mesas={mesas} fetchAll={fetchAll} />
    </div>
  );
}