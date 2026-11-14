import { useApp } from '../data.ts';

export function Tides() {
  const { spot, route } = useApp();
  return (
    <section class="card">
      <h1>Příliv</h1>
      <h2>{spot.name}</h2>
      <p>Stránka se připravuje.</p>
      {route.params['d'] && <p>Vybraný den: {route.params['d']}</p>}
    </section>
  );
}
