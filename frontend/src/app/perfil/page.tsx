import ProfileView from '@/components/views/ProfileView';

export const metadata = { title: 'perfil · tecla*' };

export default function PerfilPage() {
  return (
    <section className="view" id="v-profile">
      <ProfileView />
    </section>
  );
}
