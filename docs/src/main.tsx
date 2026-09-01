import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DhaakonProvider } from '@dhaakon/ui';
import '@dhaakon/ui/styles.css';
import './docs.css';
import { App } from './App';

declare const __MOTION_VERSION__: string;

createRoot(document.getElementById('root')!).render(
  <StrictMode><DhaakonProvider><App version={__MOTION_VERSION__} /></DhaakonProvider></StrictMode>,
);
