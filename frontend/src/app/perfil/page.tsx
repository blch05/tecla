import ViewRunner from '@/components/ViewRunner';

export const metadata = { title: 'perfil · tecla*' };

export default function PerfilPage() {
  return (
    <section className="view" id="v-profile">
      <ViewRunner view="profile" />
    </section>
  );
}
