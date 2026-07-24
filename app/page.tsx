import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  Building2,
  ClipboardCheck,
  Map,
  PackageSearch,
  Truck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

async function getDashboardData() {
  const [
    storesResult,
    itemsResult,
    requirementsResult,
    shortagesResult,
  ] = await Promise.all([
    supabase
      .from("stores")
      .select("*", { count: "exact", head: true })
      .eq("active", true),

    supabase
      .from("items")
      .select("*", { count: "exact", head: true })
      .eq("active", true),

    supabase
      .from("store_item_requirements")
      .select("required_qty"),

    supabase
      .from("inventory_shortages")
      .select("*", { count: "exact", head: true })
      .eq("is_short", true),
  ]);

  const filtersRequired =
    requirementsResult.data?.reduce(
      (total, item) => total + (item.required_qty ?? 0),
      0
    ) ?? 0;

  return {
    storeCount: storesResult.count ?? 0,
    itemCount: itemsResult.count ?? 0,
    filtersRequired,
    shortageCount: shortagesResult.count ?? 0,
  };
}

export default async function HomePage() {
  const dashboardData = await getDashboardData();

  const dashboardCards = [
    {
      title: "Stores",
      value: dashboardData.storeCount,
      description: "Active service locations",
      icon: Building2,
    },
    {
      title: "Filter Types",
      value: dashboardData.itemCount,
      description: "Sizes in the catalog",
      icon: Boxes,
    },
    {
      title: "Filters Required",
      value: dashboardData.filtersRequired,
      description: "Across all locations",
      icon: ClipboardCheck,
    },
    {
      title: "Low Stock",
      value: dashboardData.shortageCount,
      description: "Items needing attention",
      icon: AlertTriangle,
    },
  ];

  const quickActions = [
    {
      title: "View Inventory",
      description: "Check warehouse and truck stock",
      icon: PackageSearch,
      href: "/inventory",
    },
    {
      title: "Service Stores",
      description: "Open digital service worksheets",
      icon: Building2,
      href: "/stores",
    },
    {
      title: "Plan Routes",
      description: "Organize upcoming store visits",
      icon: Map,
      href: "/routes",
    },
    {
      title: "Truck Inventory",
      description: "Track items assigned to vehicles",
      icon: Truck,
      href: "/inventory",
    },
  ];

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
              <Link
                className="action-card"
                href={action.href}
                key={action.title}
              >
                <span className="action-icon">
                  <Icon size={24} />
                </span>

                <span>
                  <strong>{action.title}</strong>
                  <small>{action.description}</small>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <nav className="mobile-nav" aria-label="Main navigation">
        <Link className="nav-item active" href="/">
          <Boxes size={20} />
          <span>Dashboard</span>
        </Link>

        <Link className="nav-item" href="/stores">
          <Building2 size={20} />
          <span>Stores</span>
        </Link>

        <Link className="nav-item" href="/inventory">
          <PackageSearch size={20} />
          <span>Inventory</span>
        </Link>

        <Link className="nav-item" href="/routes">
          <Map size={20} />
          <span>Routes</span>
        </Link>
      </nav>
    </main>
  );
}
