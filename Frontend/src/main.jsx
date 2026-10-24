import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '../style.css';
import './pages/Arena.css';
import './study-club.css';

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
