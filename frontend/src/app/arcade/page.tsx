import ArcadeView from '@/components/views/ArcadeView';

export const metadata = { title: 'arcade · tecla*' };

export default function ArcadePage() {
  return (
    <section className="view" id="v-arcade">
      <ArcadeView />
    </section>
  );
}
