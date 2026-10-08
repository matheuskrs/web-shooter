import '@fontsource/lilita-one/400.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createQueryClient } from './api/queryClient';
import { pirateTheme } from './app/antTheme';
import { App } from './app/App';
import { abandonBattleRouteOnLoad } from './app/navigation';
import { createAppServices, ServicesContext } from './app/services';
import { notifyError } from './components/toast/notify';
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
  const queryClient = createQueryClient({ onRegistrationFailed: (error) => notifyError('register', error) });

  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider theme={pirateTheme}>
          <ServicesContext value={services}>
            <App />
          </ServicesContext>
        </ConfigProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}

void bootstrap();
