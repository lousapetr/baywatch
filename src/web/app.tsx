import { greeting } from '../shared/hello.ts';

export function App() {
  return (
    <main>
      <h1>{greeting('Santander')}</h1>
      <p>Přílivy a vlny na pobřeží – aplikace se připravuje.</p>
    </main>
  );
}
