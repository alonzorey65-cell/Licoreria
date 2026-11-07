import React from 'react';
import { defaultTheme } from '../themes/theme';

export default function MainLayout({ children, title, subtitle, theme = defaultTheme }) {
  return (
    <div className="app-template" style={theme.variables}>
      {(title || subtitle) && (
        <header className="app-template__header">
          {title && <h1>{title}</h1>}
          {subtitle && <p>{subtitle}</p>}
        </header>
      )}
      {children}
    </div>
  );
}