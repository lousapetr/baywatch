import { useEffect } from 'preact/hooks';
import { AppContext, useAppState } from './data.ts';
import { useRoute } from './router.ts';
import { Header } from './components/Header.tsx';
import { TabBar } from './components/TabBar.tsx';
import { EmptyState } from './components/EmptyState.tsx';
import { Home } from './pages/Home.tsx';
import { Tides } from './pages/Tides.tsx';
import { Waves } from './pages/Waves.tsx';
import { About } from './pages/About.tsx';

export function App() {
  const state = useAppState();
  const route = useRoute();
  const hasData = state.forecast !== null;
  useEffect(() => scrollTo(0, 0), [route.path]);
  let page;
  if (route.path === '/o-aplikaci') page = <About />;
  else if (!hasData) page = <EmptyState />;
  else if (route.path === '/priliv') page = <Tides />;
  else if (route.path === '/vlny') page = <Waves />;
  else page = <Home />;
  return (
    <AppContext.Provider value={{ ...state, route }}>
      <Header />
      <main class="main">{page}</main>
      <TabBar current={route.path} />
    </AppContext.Provider>
  );
}
