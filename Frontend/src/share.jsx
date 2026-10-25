import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ShareApp from './components/ShareApp';
import '../style.css';
import './study-club.css';
import './phone.css';
import './share.css';

// This presentation screen deliberately does not mount the game or call the API.
createRoot(document.getElementById('root')).render(<StrictMode><ShareApp /></StrictMode>);
