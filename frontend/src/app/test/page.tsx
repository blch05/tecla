import TestView from '@/components/views/TestView';

export const metadata = { title: 'test · tecla*' };

export default function TestPage() {
  return (
    <section className="view" id="v-test">
      <TestView />
    </section>
  );
}
