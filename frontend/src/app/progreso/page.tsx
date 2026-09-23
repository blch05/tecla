import ViewRunner from '@/components/ViewRunner';

export const metadata = { title: 'progreso · tecla*' };

export default function ProgresoPage() {
  return (
    <section className="view" id="v-stats">
      <ViewRunner view="stats" />
    </section>
  );
}
