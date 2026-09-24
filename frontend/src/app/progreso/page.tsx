import StatsView from '@/components/views/StatsView';

export const metadata = { title: 'progreso · tecla*' };

export default function ProgresoPage() {
  return (
    <section className="view" id="v-stats">
      <StatsView />
    </section>
  );
}
