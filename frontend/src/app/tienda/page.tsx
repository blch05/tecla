import ShopView from '@/components/views/ShopView';

export const metadata = { title: 'tienda · tecla*' };

export default function TiendaPage() {
  return (
    <section className="view" id="v-shop">
      <ShopView />
    </section>
  );
}
