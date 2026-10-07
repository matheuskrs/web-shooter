import '@fontsource/lilita-one/400.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createQueryClient } from './api/queryClient';
import { App } from './app/App';
import { abandonBattleRouteOnLoad } from './app/navigation';
import { createAppServices, ServicesContext } from './app/services';
import './components/ui.css';
import { installTestApi } from './game/testing/testApi';
import { startMockApi } from './mocks/browser';
import './styles/global.css';

async function bootstrap() {
  abandonBattleRouteOnLoad();
  installTestApi();
  // Await the worker so the very first ranking request is already mocked.
  await startMockApi();

  const root = document.getElementById('root');
  if (!root) throw new Error('Missing #root element');
  const services = createAppServices();
  const queryClient = createQueryClient();

  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ServicesContext value={services}>
          <App />
        </ServicesContext>
      </QueryClientProvider>
    </StrictMode>,
  );
}

void bootstrap();
