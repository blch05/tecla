import ViewRunner from '@/components/ViewRunner';

export const metadata = { title: 'competir · tecla*' };

export default function CompetirPage() {
  return (
    <section className="view" id="v-comp">
      <div className="subtabs" id="comp-tabs" />
      <div className="panel" id="comp-area" />
      <ViewRunner view="comp" />
    </section>
  );
}
