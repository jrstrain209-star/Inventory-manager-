import {
  AlertTriangle,
  Boxes,
  Building2,
  ClipboardCheck,
  Map,
  PackageSearch,
  Truck,
} from "lucide-react";

const dashboardCards = [
  {
    title: "Stores",
    value: "6",
    description: "Active service locations",
    icon: Building2,
  },
  {
    title: "Filter Types",
    value: "16",
    description: "Sizes in the catalog",
    icon: Boxes,
  },
  {
    title: "Filters Required",
    value: "167",
    description: "Across all locations",
    icon: ClipboardCheck,
  },
  {
    title: "Low Stock",
    value: "0",
    description: "Items needing attention",
    icon: AlertTriangle,
  },
];

const quickActions = [
  {
    title: "View Inventory",
    description: "Check warehouse and truck stock",
    icon: PackageSearch,
  },
  {
    title: "Service Stores",
    description: "Open digital service worksheets",
    icon: Building2,
  },
  {
    title: "Plan Routes",
    description: "Organize upcoming store visits",
    icon: Map,
  },
  {
    title: "Truck Inventory",
    description: "Track items assigned to vehicles",
    icon: Truck,
  },
];

export default function HomePage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Inventory Manager</p>
          <h1>Dashboard</h1>
          <p className="subtitle">
            Track filters, stores, service visits, routes, and inventory.
          </p>
        </div>

        <div className="profile-badge" aria-label="User profile">
          JS
        </div>
      </header>

      <section className="summary-grid" aria-label="Inventory summary">
        {dashboardCards.map((card) => {
          const Icon = card.icon;

          return (
            <article className="summary-card" key={card.title}>
              <div className="card-icon">
                <Icon size={22} />
              </div>

              <div>
                <p className="card-label">{card.title}</p>
                <p className="card-value">{card.value}</p>
                <p className="card-description">{card.description}</p>
              </div>
            </article>
          );
        })}
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Shortcuts</p>
            <h2>Quick actions</h2>
          </div>
        </div>

        <div className="actions-grid">
          {quickActions.map((action) => {
            const Icon = action.icon;

            return (
              <button className="action-card" key={action.title} type="button">
                <span className="action-icon">
                  <Icon size={24} />
                </span>

                <span>
                  <strong>{action.title}</strong>
                  <small>{action.description}</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <nav className="mobile-nav" aria-label="Main navigation">
        <button className="nav-item active" type="button">
          <Boxes size={20} />
          <span>Dashboard</span>
        </button>

        <button className="nav-item" type="button">
          <Building2 size={20} />
          <span>Stores</span>
        </button>

        <button className="nav-item" type="button">
          <PackageSearch size={20} />
          <span>Inventory</span>
        </button>

        <button className="nav-item" type="button">
          <Map size={20} />
          <span>Routes</span>
        </button>
      </nav>
    </main>
  );
}
