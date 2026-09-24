/* Encabezado común de todas las vistas: sección, título y, a la derecha, las herramientas
   de la vista (pestañas, filtros o acciones). Mantiene el mismo tamaño y lugar en toda la app. */
export default function PageHeader({ eyebrow, title, sub, children }: {
  eyebrow?: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="ph-title">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {children && <div className="ph-tools">{children}</div>}
    </header>
  );
}
