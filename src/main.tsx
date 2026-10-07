import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { abandonBattleRouteOnLoad } from './app/navigation';
import { createAppServices, ServicesProvider } from './app/services';
import { installTestApi } from './game/testing/testApi';
import './styles/global.css';

abandonBattleRouteOnLoad();
installTestApi();
const services = createAppServices();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <ServicesProvider services={services}>
      <App />
    </ServicesProvider>
  </StrictMode>,
);
