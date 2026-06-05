import './style.css';
import { init } from './ui.js';
import { registerSW } from 'virtual:pwa-register';

init();
registerSW({ immediate: true });
